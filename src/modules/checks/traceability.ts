import { contentWords, numbersIn } from '../../domain/text.ts';
import type { Claim, SentenceType, TraceabilityCheck } from '../../domain/types.ts';
import type { LlmProvider } from '../../providers/llm.types.ts';

const ATTRIBUTION = /\b(said|says|told me|put it|according to|argued|argues|pointed out|reminded me|mentioned|in their words)\b/i;

export interface CheckableSentence {
  key: string;
  text: string;
  type: SentenceType;
  supports: string[];
}

export interface TraceContext {
  transcript: string;
  claimsById: Map<string, Claim>;
}

/** A "connective" that carries facts is treated as an assertion, so the label cannot dodge the check. */
export function effectiveType(s: { text: string; type: SentenceType }): SentenceType {
  if (s.type === 'connective' && (numbersIn(s.text).length || contentWords(s.text).length > 6)) return 'assertion';
  return s.type;
}

/**
 * Is this sentence backed by what was actually said? Rules run first (cheap, certain);
 * the model only judges entailment once every rule has passed.
 */
export async function checkTraceability(sentence: CheckableSentence, ctx: TraceContext, llm: LlmProvider): Promise<TraceabilityCheck> {
  const type = effectiveType(sentence);
  if (type === 'connective') return { status: 'supported', reason: 'Connective sentence with no factual content.', type };
  if (!sentence.supports.length) return { status: 'unsupported', reason: 'Assertion cites no source claim.', type };

  const cited: Claim[] = [];
  for (const id of sentence.supports) {
    const claim = ctx.claimsById.get(id);
    if (!claim) return { status: 'unsupported', reason: `Cited claim ${id.slice(0, 8)} does not exist in this source.`, type };
    if (ctx.transcript.slice(claim.char_start, claim.char_end) !== claim.quote) {
      return { status: 'unsupported', reason: 'Cited quote no longer matches the transcript at its offsets.', type };
    }
    cited.push(claim);
  }

  for (const c of cited.filter((x) => !x.is_creator)) {
    const named = sentence.text.toLowerCase().includes(c.speaker.toLowerCase());
    if (!named && !ATTRIBUTION.test(sentence.text) && !/["“”]/.test(sentence.text)) {
      return { status: 'unsupported', reason: `Built on ${c.speaker}'s claim but written as your own view. Attribute it.`, type };
    }
  }

  const sourceNumbers = new Set(cited.flatMap((c) => numbersIn(`${c.text} ${c.quote}`)));
  const stray = numbersIn(sentence.text).filter((n) => !sourceNumbers.has(n));
  if (stray.length) return { status: 'unsupported', reason: `Number ${stray.join(', ')} does not appear in the cited source.`, type };

  const judgment = await llm.judgeEntailment({ sentence: sentence.text, claims: cited });
  return { status: judgment.status, reason: judgment.reason, type };
}
