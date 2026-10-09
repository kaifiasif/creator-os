import { CLAUDE_MODELS, OPENAI_COMPATIBLE_MODELS, type Env } from '../config/env.ts';
import { anthropicComplete, createAnthropicClient, type AnthropicClient } from './anthropic-client.ts';
import { createOpenAiEmbeddings, localEmbeddings, type EmbeddingProvider } from './embeddings.ts';
import { createChatLlm } from './llm.chat.ts';
import { localLlm } from './llm.local.ts';
import { createOpenAiCompatibleComplete } from './openai-compatible-client.ts';
import type { LlmProvider } from './llm.types.ts';
import { DEFAULT_RETRY, type RetryPolicy } from './retry.ts';
import { createAssemblyAi, noAudioTranscription, type TranscriptionProvider } from './transcription.ts';

/** Everything that leaves the machine. Swapped wholesale in tests; picked from keys in production. */
export interface Providers {
  llm: LlmProvider;
  embeddings: EmbeddingProvider;
  transcription: TranscriptionProvider;
  /** Present only when ANTHROPIC_API_KEY is set; agents fall back to their local rules without it. */
  anthropic: AnthropicClient | null;
}

export function createProviders(env: Env): Providers {
  const retry: RetryPolicy =
    env.RETRY_DELAY_MS === undefined ? DEFAULT_RETRY : { delaysMs: DEFAULT_RETRY.delaysMs.map((d) => (d / 1000) * (env.RETRY_DELAY_MS ?? 0)) };
  const anthropic = env.ANTHROPIC_API_KEY ? createAnthropicClient(env.ANTHROPIC_API_KEY, retry) : null;
  return {
    llm: pickLlm(env, anthropic, retry),
    embeddings: env.OPENAI_API_KEY ? createOpenAiEmbeddings(env.OPENAI_API_KEY, retry) : localEmbeddings,
    transcription: env.ASSEMBLYAI_API_KEY ? createAssemblyAi(env.ASSEMBLYAI_API_KEY, retry) : noAudioTranscription,
    anthropic,
  };
}

/** Claude when its key is set, else any OpenAI-compatible API (Groq by default), else the offline rules. */
function pickLlm(env: Env, anthropic: AnthropicClient | null, retry: RetryPolicy): LlmProvider {
  const models = (defaults: { main: string; judge: string }) => ({
    main: env.CREATOR_OS_MAIN_MODEL ?? defaults.main,
    judge: env.CREATOR_OS_JUDGE_MODEL ?? defaults.judge,
  });
  if (anthropic) return createChatLlm('anthropic', anthropicComplete(anthropic), models(CLAUDE_MODELS));
  if (env.LLM_API_KEY) {
    const complete = createOpenAiCompatibleComplete({ baseUrl: env.LLM_BASE_URL, apiKey: env.LLM_API_KEY }, retry);
    return createChatLlm(new URL(env.LLM_BASE_URL).host, complete, models(OPENAI_COMPATIBLE_MODELS));
  }
  return localLlm;
}

export type { AnthropicClient, EmbeddingProvider, LlmProvider, TranscriptionProvider };
