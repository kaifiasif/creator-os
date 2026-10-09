import type { Complete } from './llm.chat.ts';
import { providerError, withRetry, type RetryPolicy } from './retry.ts';

/** Minimal Anthropic Messages API client shared by the LLM provider and the agents. */
export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

export interface Message {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}

export interface ToolSchema {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface MessagesRequest {
  model: string;
  system: string;
  messages: Message[];
  max_tokens?: number;
  tools?: ToolSchema[];
}

export interface MessagesResponse {
  content: ContentBlock[];
  stop_reason: string;
}

export interface AnthropicClient {
  messages(request: MessagesRequest): Promise<MessagesResponse>;
}

const REQUEST_TIMEOUT_MS = 90_000;

export function createAnthropicClient(apiKey: string, retry: RetryPolicy): AnthropicClient {
  return {
    messages: (request) =>
      withRetry(async () => {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ max_tokens: 4096, ...request }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        if (!res.ok) throw await providerError('Anthropic', res);
        return (await res.json()) as MessagesResponse;
      }, retry),
  };
}

export const textOf = (res: MessagesResponse): string =>
  res.content
    .filter((b): b is Extract<ContentBlock, { type: 'text' }> => b.type === 'text')
    .map((b) => b.text)
    .join('');

/** The plain-text completion the drafting pipeline uses (the agents use `messages` directly, for tools). */
export const anthropicComplete =
  (client: AnthropicClient): Complete =>
  async ({ model, system, messages, maxTokens }) =>
    textOf(await client.messages({ model, system, messages, max_tokens: maxTokens }));
