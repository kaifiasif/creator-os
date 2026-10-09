/**
 * Versioned prompts, one per pipeline step. Bump the version whenever the text changes:
 * it is stored on runs.model_versions so every result stays attributable to its prompt.
 */
import type { Claim } from '../domain/types.ts';
import type { ClaimWithNovelty, DraftRequest, Prompt, SegmentInput } from '../providers/llm.types.ts';

export const PROMPT_VERSIONS = {
  extract_claims: 'extract_claims@1',
  propose_angles: 'propose_angles@1',
  generate_draft: 'generate_draft@1',
  judge_entailment: 'judge_entailment@1',
} as const;

export function extractClaimsPrompt(segments: SegmentInput[]): Prompt {
  const transcript = segments.map((s) => `[${s.position}] ${s.speaker}: ${s.text}`).join('\n');
  return {
    system:
      'You extract atomic, postable claims from a transcript. A claim is one assertion a speaker made. ' +
      'For each claim return the verbatim quote copied character-for-character from one segment. Never paraphrase the quote. ' +
      'Skip small talk, questions, and filler. Return JSON only.',
    user:
      `Transcript segments:\n${transcript}\n\n` +
      'Return {"claims":[{"segment":<segment number>,"quote":"<exact substring of that segment>","text":"<claim restated cleanly, same meaning>"}]}. At most 25 claims.',
  };
}

export function proposeAnglesPrompt(claims: ClaimWithNovelty[]): Prompt {
  const list = claims.map((c) => `${c.id} | closest archive similarity ${c.closest.toFixed(2)} | ${c.text}`).join('\n');
  return {
    system: "You propose lead angles for an X post from a creator's own claims. You only choose and order claims; you do not invent content. Return JSON only.",
    user:
      `Creator claims (id | novelty signal | text):\n${list}\n\n` +
      'Propose exactly 3 distinct angles. Each: {"lead_claim_id":"<id>","claim_ids":["<lead id>", "<up to 4 supporting ids>"],"rationale":"<one line, why this leads>"}. ' +
      'Prefer leads that are concrete and least similar to the archive. Return {"angles":[...]}.',
  };
}

/**
 * Prompt text is identical across conditions except one block:
 *  - gate: a short voice summary (feature averages and three hook patterns). No archive text.
 *  - context_only: the five nearest archive pieces as style examples.
 */
export function generateDraftPrompt(input: Omit<DraftRequest, 'prompt'>): Prompt {
  const { claims, leadClaimId, format, condition, voiceSummary, examples, customAngle } = input;
  const claimList = claims.map((c) => `${c.id} | speaker=${c.is_creator ? 'CREATOR' : c.speaker} | ${c.text}`).join('\n');
  const styleBlock =
    condition === 'gate'
      ? `Voice summary of the creator (statistics only):\n${JSON.stringify(voiceSummary)}`
      : `Style examples from the creator's published posts:\n${examples.map((e, i) => `Example ${i + 1}:\n${e.text}`).join('\n\n')}`;
  return {
    system:
      'You draft X posts for one creator from claims they actually made. Every assertion sentence must cite the claim ids it rests on. ' +
      "Never add facts, numbers, or opinions that are not in the cited claims. A claim whose speaker is not CREATOR must be attributed to that speaker, never written as the creator's own view. " +
      'Connective sentences (transitions, no factual content) cite nothing. Return JSON only.',
    user:
      `${styleBlock}\n\nClaims (id | speaker | text):\n${claimList}\n\n` +
      `Lead with claim ${leadClaimId}.${customAngle ? ` The creator's own angle: "${customAngle}".` : ''}\n` +
      `Format: ${format === 'post' ? 'a single post, at most 280 characters' : 'a thread of 2-10 posts, each at most 280 characters'}.\n` +
      'Return {"posts":[{"sentences":[{"text":"...","type":"assertion"|"connective","supports":["<claim id>"]}]}]}.',
  };
}

export function judgeEntailmentPrompt(sentence: string, claims: Pick<Claim, 'text' | 'quote'>[]): Prompt {
  return {
    system:
      'You check whether source claims support a sentence. "supported": fully entailed. "partial": some content is not entailed. "unsupported": main content not entailed. Return JSON only.',
    user: `Sentence: ${sentence}\n\nSource claims with verbatim quotes:\n${claims.map((c) => `- ${c.text} (quote: "${c.quote}")`).join('\n')}\n\nReturn {"status":"supported"|"partial"|"unsupported","reason":"<one line>"}.`,
  };
}
