// The agents on the free OpenAI-compatible key (Groq by default), end to end through the Python service,
// against a local stub of /chat/completions. Nothing leaves the machine.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import { localLlm } from '../src/providers/llm.local.ts';
import { createHarness, importSampleArchive, type Harness, type Json } from './helpers.ts';

const KEY = 'gsk_free_test_key_0123456789';
const seen: { auth: string; model: string; tools: string[] }[] = [];
let limited = 0;

/** Answers each agent with a valid submission straight away, or 429 while `limited` lasts. */
const stub = createServer((req, res) => {
  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', () => {
    const body = JSON.parse(raw);
    const tools: string[] = (body.tools ?? []).map((t: Json) => t.function.name);
    seen.push({ auth: req.headers.authorization ?? '', model: body.model, tools });
    if (limited > 0) {
      limited--;
      res.writeHead(429, { 'content-type': 'application/json', 'retry-after': '0' });
      return res.end(JSON.stringify({ error: { message: 'Rate limit reached for model' } }));
    }
    const submit = tools.find((t) => t.startsWith('submit_'));
    const args: Record<string, unknown> = {
      submit_review: { summary: 'Looks fine.', issues: [], revised_posts: ['Small pull requests get reviewed the same day.'] },
      submit_scores: { hook: { score: 4, reason: 'Short claim.' }, clarity: { score: 4.5, reason: 'One idea.' }, comment: 'Good.' },
      submit_recommendation: { recommendation: 'accept', confidence: 0.8, rationale: 'Clean.' },
    };
    const call = { id: `call_${seen.length}`, type: 'function', function: { name: submit, arguments: JSON.stringify(args[submit ?? '']) } };
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content: null, tool_calls: [call] }, finish_reason: 'tool_calls' }] }));
  });
});

let h: Harness;
before(async () => {
  await new Promise<void>((resolve) => stub.listen(0, '127.0.0.1', resolve));
  h = createHarness({ LLM_API_KEY: KEY, LLM_BASE_URL: `http://127.0.0.1:${(stub.address() as AddressInfo).port}/openai/v1` });
  h.ctx.providers.llm = localLlm; // drafting stays local here; only the agents talk to the stub
  h.ctx.config.forcedCondition = 'gate';
  await importSampleArchive(h);
  await h.api('POST', '/api/settings', { agents_enabled: true, show_recommendation: true });
});
after(() => stub.close());

async function run(text: string): Promise<Json> {
  const id = await h.readySource(`free ${seen.length}`, text);
  return h.runFor(id, { format: 'post' });
}

test('with only LLM_API_KEY the agents run on the free model through the Python service', async () => {
  const r = await run('Small pull requests get reviewed the same day, and big ones get reviewed never.');
  for (const agent of ['reviewer', 'scorer', 'decision']) {
    assert.equal(r.agents[agent].status, 'done', r.agents[agent].error);
    assert.equal(r.agents[agent].model, 'openai/gpt-oss-120b');
  }
  assert.deepEqual(seen.map((s) => s.tools.at(-1)), ['submit_review', 'submit_scores', 'submit_recommendation']);
  assert.ok(seen.every((s) => s.auth === `Bearer ${KEY}` && s.model === 'openai/gpt-oss-120b'));
  assert.equal(r.agents.scorer.output.dimensions.hook.by, 'model');
  assert.equal(r.agents.decision.output.recommendation, 'accept');
  assert.equal(typeof r.agents.reviewer.output.verification.blocking, 'number', 'the server still re-checks the reviewer');
});

test('a rate limit is retried, and when it persists the agent fails with a clear message and no key', async () => {
  limited = 1;
  const retried = await run('Writing the docs first shows you which API you would be embarrassed to explain.');
  assert.equal(retried.agents.reviewer.status, 'done');

  limited = 3; // the first agent's three attempts all hit the limit
  const r = await run('Most dashboards are where decisions go to be postponed, in my experience shipping them.');
  assert.equal(r.agents.reviewer.status, 'failed');
  assert.match(r.agents.reviewer.error, /rate limit reached \(429\).*Run agents again/);
  assert.doesNotMatch(JSON.stringify(r.agents), new RegExp(KEY));
  assert.equal(r.agents.scorer.status, 'done', 'the next agent still runs');
});
