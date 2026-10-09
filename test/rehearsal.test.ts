import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHarness, fixture, type Json } from './helpers.ts';

const h = createHarness();
const { api, readySource, runFor, ctx, settle } = h;

test('rehearsal: closed before decision, runs offline after accept, interviews need a model', async () => {
  ctx.config.forcedCondition = 'gate';
  const cfg = await api('GET', '/api/rehearsal/config');
  assert.equal(cfg.status, 200);
  assert.equal(cfg.body.engine, 'swarm-offline');

  const id = await readySource('notes', await fixture('rough-notes.md'));
  const run = await runFor(id, { format: 'post' });
  assert.equal(run.status, 'in_review', run.error);

  const early = await api('POST', `/api/runs/${run.run_id}/rehearsal`, {});
  assert.equal(early.status, 409);
  assert.match(early.body.error.message, /Decide on the draft first/);

  const overrides = run.draft.posts.flatMap((p: Json) => p.sentences).filter((s: Json) => s.blocking).map((s: Json) => ({ sentence_id: s.id, reason: 'checked' }));
  const d = await api('POST', `/api/drafts/${run.draft.id}/decision`, { decision: 'accept', overrides });
  assert.equal(d.status, 200, JSON.stringify(d.body));

  const bad = await api('POST', `/api/runs/${run.run_id}/rehearsal`, { max_rounds: 99 });
  assert.equal(bad.status, 400);

  const started = await api('POST', `/api/runs/${run.run_id}/rehearsal`, { max_rounds: 5 });
  assert.equal(started.status, 202, JSON.stringify(started.body));
  await settle();
  const got = await api('GET', `/api/runs/${run.run_id}/rehearsal`);
  const r = got.body.rehearsal;
  assert.equal(r.status, 'done', r.error);
  assert.equal(r.result.engine, 'swarm-offline');
  assert.equal(r.result.draft_seeded, true);
  assert.ok(r.result.sentences.length >= 1);

  const ask = await api('POST', `/api/rehearsals/${r.id}/interview`, { agent_id: 1, prompt: 'Why?' });
  assert.equal(ask.status, 409);
  assert.match(ask.body.error.message, /LLM_API_KEY/);
  assert.equal((await api('GET', '/api/runs/nope/rehearsal')).body.rehearsal, null);

  // spend cap: rehearsals per draft per day (one already ran above)
  for (let i = 1; i < 10; i++) {
    assert.equal((await api('POST', `/api/runs/${run.run_id}/rehearsal`, { max_rounds: 1, force: true })).status, 202);
    await settle();
  }
  const capped = await api('POST', `/api/runs/${run.run_id}/rehearsal`, { max_rounds: 1, force: true });
  assert.equal(capped.status, 429);
  assert.equal(capped.body.error.code, 'RATE_LIMITED');
});
