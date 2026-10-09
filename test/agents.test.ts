// Reviewer, Scorer and Decision agents through the Python agents service: visibility, server-side
// verification, failure isolation, and the tool bridge. The agents' own logic is tested in agents/tests.
import assert from 'node:assert/strict';
import { before, beforeEach, test } from 'node:test';
import type { TraceStep } from '../src/domain/types.ts';
import { loadAgentContext } from '../src/modules/agents/tools.ts';
import { localLlm } from '../src/providers/llm.local.ts';
import { createHarness, fixture, importSampleArchive, type Json } from './helpers.ts';

const h = createHarness();
const { api, ctx, runFor } = h;
let n = 0;

async function source(text: string): Promise<string> {
  n++;
  return h.readySource(`s${n}`, `${text} (${n})`);
}

const decide = (run: Json, body: unknown) => api('POST', `/api/drafts/${run.draft.id}/decision`, body);

function plantFlags(): void {
  ctx.providers.llm = {
    ...localLlm,
    generateDraft: async ({ claims: cs }) => [
      {
        sentences: [
          { text: cs[0].text, type: 'assertion', supports: [cs[0].id] },
          { text: 'This cut my review time by 73 percent.', type: 'assertion', supports: [cs[0].id] },
          { text: 'Shipping small is not about speed, it is about being wrong in smaller pieces.', type: 'assertion', supports: [cs[0].id] },
        ],
      },
    ],
  };
}

before(() => importSampleArchive(h));
beforeEach(async () => {
  h.reset();
  ctx.config.forcedCondition = 'gate';
  await api('POST', '/api/settings', { agents_enabled: true, show_recommendation: false });
});

test('all three agents run after the gate; reviewer fixes are verified by the server; prediction hidden until you decide', async () => {
  plantFlags();
  const r = await runFor(await source(await fixture('voice-memo.txt')));
  assert.equal(r.agents.reviewer.status, 'done', r.agents.reviewer.error);
  assert.equal(r.agents.scorer.status, 'done');
  assert.equal(r.agents.decision.status, 'hidden', 'prediction must not anchor the decision');

  const review = r.agents.reviewer.output;
  const problems = review.issues.map((i: Json) => i.problem);
  assert.ok(problems.includes('unsupported'));
  assert.ok(problems.includes('repeat'));
  assert.equal(review.changed, true);
  assert.equal(review.verification.blocking, 0, JSON.stringify(review.verification));
  assert.ok(r.agents.reviewer.trace.some((t: TraceStep) => t.tool === 'check_posts'));

  const scores = r.agents.scorer.output;
  assert.deepEqual(Object.keys(scores.dimensions).sort(), ['clarity', 'hook', 'novelty', 'traceability', 'voice_fit']);
  assert.equal(scores.dimensions.traceability.by, 'rule');
  assert.equal(scores.dimensions.hook.by, 'model');
  assert.ok(scores.dimensions.traceability.score < 5);

  // the creator applies the reviewer's version; the assist is logged
  const d = await decide(r, { decision: 'edit_then_accept', final_posts: review.revised_posts, assist: 'reviewer' });
  assert.equal(d.status, 200, JSON.stringify(d.body));
  assert.equal(d.body.recheck_status, 'clean');
  const after = (await api('GET', `/api/runs/${r.run_id}`)).body;
  assert.equal(after.agents.decision.status, 'done');
  assert.equal(after.agents.decision.output.recommendation, 'edit');

  const metrics = (await api('GET', '/api/metrics/acceptance')).body;
  assert.equal(metrics.locked, false);
  assert.ok(metrics.agents.decision.n >= 1);
  assert.ok(metrics.agents.decision.agree >= 1);
  assert.ok(metrics.agents.reviewer.used >= 1);
  assert.match((await api('GET', '/api/metrics/export.csv')).body, /agent_prediction,agent_score,used_reviewer/);
});

test('show_recommendation reveals the prediction before deciding', async () => {
  await api('POST', '/api/settings', { show_recommendation: true });
  const r = await runFor(await source('Every confused click is a bug report the customer will never file, and nobody reads release notes.'), { format: 'post' });
  assert.equal(r.agents.decision.status, 'done');
  assert.ok(['accept', 'edit', 'reject'].includes(r.agents.decision.output.recommendation));
  await decide(r, { decision: 'reject', reject_reason: 'not_worth_posting' });
});

test('context_only: every agent is hidden before the decision', async () => {
  ctx.config.forcedCondition = 'context_only';
  const r = await runFor(await source('Server components made me rethink where data lives, and the page got faster without memo.'), { format: 'post' });
  for (const agent of ['reviewer', 'scorer', 'decision']) assert.equal(r.agents[agent].status, 'hidden');
  await decide(r, { decision: 'accept' });
  assert.equal((await api('GET', `/api/runs/${r.run_id}`)).body.agents.reviewer.status, 'done');
});

test('a reviewer that invents a number is caught by server verification', async () => {
  ctx.agentOverrides = { reviewer: async (_app, agent) => ({ summary: 'tightened', issues: [], revised_posts: [`${agent.posts[0]} It saved 90 hours.`] }) };
  const r = await runFor(await source('Feature flags let me ship quietly, and nobody noticed the launch at all this time.'), { format: 'post' });
  const review = r.agents.reviewer.output;
  assert.ok(review.verification.blocking >= 1);
  assert.ok(review.verification.sentences.some((s: Json) => s.traceability === 'unsupported'));
  await decide(r, { decision: 'reject', reject_reason: 'other' });
});

test('one agent failing does not stop the others; retry re-runs them', async () => {
  ctx.agentOverrides = {
    reviewer: async () => {
      throw new Error('Anthropic 529 overloaded');
    },
  };
  const r = await runFor(await source('Most dashboards are where decisions go to be postponed, in my experience shipping them.'), { format: 'post' });
  assert.equal(r.agents.reviewer.status, 'failed');
  assert.match(r.agents.reviewer.error, /529/);
  assert.equal(r.agents.scorer.status, 'done');

  ctx.agentOverrides = null;
  assert.equal((await api('POST', `/api/runs/${r.run_id}/agents`)).status, 202);
  await h.settle();
  assert.equal((await api('GET', `/api/runs/${r.run_id}`)).body.agents.reviewer.status, 'done');
  await decide(r, { decision: 'reject', reject_reason: 'other' });
});

test('agents can be switched off; unknown settings are rejected', async () => {
  assert.equal((await api('POST', '/api/settings', { agents_enabled: 'yes' })).status, 400);
  await api('POST', '/api/settings', { agents_enabled: false });
  const r = await runFor(await source('Accessibility bugs ship at the start of a project and are paid for at the end.'), { format: 'post' });
  assert.deepEqual(r.agents, {});
  await decide(r, { decision: 'reject', reject_reason: 'other' });
});

test('the tool bridge answers only with the pass token, validates input, and stops when the pass ends', async () => {
  const r = await runFor(await source('Small pull requests get reviewed the same day, and big ones get reviewed never.'), { format: 'post' });
  const user = await h.user();
  const session = await ctx.agents.bridge.open(user, loadAgentContext(user, r.run_id));
  const call = (tool: string, body: unknown, token = session.token) =>
    fetch(`${session.url}/${tool}`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });

  const ok = await call('search_archive', { text: 'small pull requests', k: 2 });
  assert.equal(ok.status, 200);
  assert.equal(((await ok.json()) as Json).result.length, 2);
  const check = (await (await call('check_sentence', { text: 'Small pull requests get reviewed the same day.' })).json()) as Json;
  assert.equal(typeof check.result.passes, 'boolean');

  assert.equal((await call('search_archive', { text: 'x' }, 'not-the-token')).status, 401);
  assert.equal((await call('search_archive', { text: '' })).status, 422);
  assert.equal((await call('drop_tables', {})).status, 404);
  session.close();
  assert.equal((await call('search_archive', { text: 'small pull requests' })).status, 401);
  await decide(r, { decision: 'reject', reject_reason: 'other' });
});

test('an agents service that fails or returns the wrong shape fails that agent only', async () => {
  const real = ctx.agents.service;
  ctx.agents.service = {
    run: async (agent, request) => {
      if (agent === 'reviewer') throw new Error('Agents service 503: unavailable');
      if (agent === 'scorer') return { ok: true, output: { dimensions: {}, overall: 9 }, trace: [] };
      return real.run(agent, request);
    },
  };
  try {
    const r = await runFor(await source('Writing the docs first shows you which API you would be embarrassed to explain.'), { format: 'post' });
    assert.equal(r.agents.reviewer.status, 'failed');
    assert.match(r.agents.reviewer.error, /503/);
    assert.equal(r.agents.scorer.status, 'failed');
    assert.match(r.agents.scorer.error, /wrong shape/);
    assert.equal(r.status, 'in_review');
    await decide(r, { decision: 'reject', reject_reason: 'other' });
  } finally {
    ctx.agents.service = real;
  }
});
