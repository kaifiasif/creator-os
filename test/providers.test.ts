import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { loadEnv } from '../src/config/env.ts';
import { createProviders } from '../src/providers/index.ts';

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

test('provider choice: Claude key wins, then LLM_API_KEY (Groq by default), then local rules', () => {
  assert.equal(createProviders(loadEnv({})).llm.name, 'local');

  const groq = createProviders(loadEnv({ LLM_API_KEY: 'k' })).llm;
  assert.equal(groq.name, 'api.groq.com');
  assert.deepEqual(groq.models, { main: 'openai/gpt-oss-120b', judge: 'openai/gpt-oss-20b' });

  const custom = createProviders(loadEnv({ LLM_API_KEY: 'k', LLM_BASE_URL: 'https://openrouter.ai/api/v1', CREATOR_OS_MAIN_MODEL: 'm' })).llm;
  assert.equal(custom.name, 'openrouter.ai');
  assert.equal(custom.models.main, 'm');

  assert.equal(createProviders(loadEnv({ ANTHROPIC_API_KEY: 'a', LLM_API_KEY: 'k' })).llm.name, 'anthropic');
});

test('OpenAI-compatible LLM: sends a chat completion and parses the JSON reply', async () => {
  const sent: { url: string; auth: string | null; body: { model: string; messages: { role: string }[] } }[] = [];
  globalThis.fetch = async (input, init) => {
    sent.push({ url: String(input), auth: new Headers(init?.headers).get('authorization'), body: JSON.parse(String(init?.body)) });
    const content = 'Here you go:\n{"status": "supported", "reason": "quoted directly"}';
    return Response.json({ choices: [{ message: { content } }] });
  };

  const llm = createProviders(loadEnv({ LLM_API_KEY: 'secret' })).llm;
  const judgment = await llm.judgeEntailment({ sentence: 'It took 11 days.', claims: [{ text: 'It took 11 days.', quote: 'took 11 days' }] });

  assert.deepEqual(judgment, { status: 'supported', reason: 'quoted directly' });
  assert.equal(sent[0].url, 'https://api.groq.com/openai/v1/chat/completions');
  assert.equal(sent[0].auth, 'Bearer secret');
  assert.equal(sent[0].body.model, 'openai/gpt-oss-20b');
  assert.deepEqual(sent[0].body.messages.map((m) => m.role), ['system', 'user']);
});
