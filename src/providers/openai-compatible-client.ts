import type { Complete } from './llm.chat.ts';
import { providerError, withRetry, type RetryPolicy } from './retry.ts';

/** Groq, OpenRouter, Gemini, Mistral and OpenAI all accept this request shape at `<baseUrl>/chat/completions`. */
interface ChatCompletionResponse {
  choices: { message: { content: string | null } }[];
}

const REQUEST_TIMEOUT_MS = 90_000;

export function createOpenAiCompatibleComplete(options: { baseUrl: string; apiKey: string }, retry: RetryPolicy): Complete {
  const url = `${options.baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const vendor = new URL(url).host;
  return ({ model, system, messages, maxTokens }) =>
    withRetry(async () => {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json', 'user-agent': 'creator-os/0.7.3', authorization: `Bearer ${options.apiKey}` },
        body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'system', content: system }, ...messages] }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!res.ok) throw await providerError(vendor, res);
      const body = (await res.json()) as ChatCompletionResponse;
      const text = body.choices[0]?.message.content;
      if (!text) throw new Error(`${vendor} returned an empty reply`);
      return text;
    }, retry);
}
