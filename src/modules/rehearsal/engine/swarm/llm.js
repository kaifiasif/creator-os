// JSON chat calls against any OpenAI-compatible endpoint (Groq, Gemini, OpenRouter, a local Ollama).

export class LlmError extends Error {}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Without SWARM_LLM_* it reuses Creator OS's own OpenAI-compatible setting (LLM_API_KEY, Groq by default),
// so one free key covers the app and rehearsal.
const env = process.env;
const ownKey = Boolean(env.SWARM_LLM_API_KEY);

export function swarmLlm({
  apiKey = env.SWARM_LLM_API_KEY || env.LLM_API_KEY,
  baseUrl = ownKey
    ? env.SWARM_LLM_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai'
    : env.SWARM_LLM_BASE_URL || env.LLM_BASE_URL || 'https://api.groq.com/openai/v1',
  model = env.SWARM_LLM_MODEL || (ownKey ? 'gemini-2.5-flash' : env.CREATOR_OS_MAIN_MODEL || 'openai/gpt-oss-120b'),
  fetchImpl = globalThis.fetch,
  timeoutMs = 120_000,
  retries = 4,
} = {}) {
  if (!apiKey) return null;
  const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
  let calls = 0;

  // Sends one prompt, parses the JSON reply, runs validate(); a bad shape is retried once with the error.
  async function json({ system, user, validate = (x) => x, temperature = 0.8, maxTokens = 4096 }) {
    const messages = [{ role: 'system', content: system }, { role: 'user', content: user }];
    for (let shapeTry = 0; shapeTry < 2; shapeTry++) {
      const text = await send(messages, temperature, maxTokens);
      try {
        return validate(JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, '')));
      } catch (e) {
        if (shapeTry) throw new LlmError(`The model returned an unusable answer: ${e.message}`);
        messages.push({ role: 'assistant', content: text }, { role: 'user', content: `That was invalid (${e.message}). Reply again with valid JSON only.` });
      }
    }
  }

  async function send(messages, temperature, maxTokens) {
    for (let attempt = 0; ; attempt++) {
      calls++;
      let res;
      try {
        res = await fetchImpl(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens, response_format: { type: 'json_object' } }),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (e) {
        if (attempt < retries) { await sleep(1000 * 2 ** attempt); continue; }
        throw new LlmError(`Could not reach the model at ${baseUrl} (${e.message}).`);
      }
      // Free tiers rate-limit per minute; wait it out rather than failing the rehearsal.
      if ((res.status === 429 || res.status >= 500) && attempt < retries) {
        const after = Number(res.headers.get('retry-after'));
        await sleep(Number.isFinite(after) && after > 0 ? after * 1000 : 2000 * 2 ** attempt);
        continue;
      }
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new LlmError(body?.error?.message || body?.[0]?.error?.message || `Model call failed with HTTP ${res.status}.`);
      const text = body?.choices?.[0]?.message?.content;
      if (typeof text !== 'string') throw new LlmError('The model returned no text.');
      return text;
    }
  }

  return { name: 'openai-compatible', model, json, get calls() { return calls; } };
}
