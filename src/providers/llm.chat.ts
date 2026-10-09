import type { z } from 'zod';
import { extractClaimsPrompt, judgeEntailmentPrompt, proposeAnglesPrompt } from '../prompts/index.ts';
import { AnglesOutput, ClaimsOutput, DraftOutput, JudgmentOutput, type LlmProvider, type Prompt } from './llm.types.ts';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

/** One text completion. Each vendor (Claude, any OpenAI-compatible API) supplies its own. */
export type Complete = (request: { model: string; system: string; messages: ChatTurn[]; maxTokens: number }) => Promise<string>;

/** Pulls the JSON object out of a reply that may be wrapped in prose or a code fence. */
function parseJsonReply(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('reply contained no JSON object');
  return JSON.parse(text.slice(start, end + 1));
}

/**
 * Asks once, validates, and on a schema failure asks once more with the error.
 * Transport retries happen inside the client, so this loop is about content only.
 */
async function ask<S extends z.ZodType>(complete: Complete, model: string, prompt: Prompt, schema: S, maxTokens = 4096): Promise<z.output<S>> {
  const messages: ChatTurn[] = [{ role: 'user', content: prompt.user }];
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = await complete({ model, system: prompt.system, messages, maxTokens });
    try {
      return schema.parse(parseJsonReply(text));
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      if (attempt === 1) throw new Error(`Model output failed its schema twice: ${reason}`, { cause: error });
      messages.push({ role: 'assistant', content: text }, { role: 'user', content: `That output was invalid: ${reason}. Return corrected JSON only.` });
    }
  }
  throw new Error('unreachable');
}

/** The drafting pipeline on top of any chat model: same prompts, same schemas, whichever vendor answers. */
export function createChatLlm(name: string, complete: Complete, models: { main: string; judge: string }): LlmProvider {
  return {
    name,
    models,
    extractClaims: async ({ segments }) => (await ask(complete, models.main, extractClaimsPrompt(segments), ClaimsOutput)).claims,
    proposeAngles: async ({ claims }) => (await ask(complete, models.main, proposeAnglesPrompt(claims), AnglesOutput)).angles,
    generateDraft: async (input) => (await ask(complete, models.main, input.prompt, DraftOutput)).posts,
    // Reasoning models spend tokens before answering, so the judge gets more room than its short JSON needs.
    judgeEntailment: ({ sentence, claims }) => ask(complete, models.judge, judgeEntailmentPrompt(sentence, claims), JudgmentOutput, 1024),
  };
}
