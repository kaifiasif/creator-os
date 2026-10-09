/**
 * Deterministic local stand-in for the LLM, so the whole workflow runs offline and in tests.
 * It returns the same validated shapes as the Anthropic provider.
 */
import { cosine } from '../domain/stats.ts';
import { contentWords, ensurePeriod, numbersIn, overlap, sentenceSpans, stripFillers, tokenize } from '../domain/text.ts';
import { AnglesOutput, ClaimsOutput, DraftOutput, type DraftPost, type DraftSentenceInput, type LlmProvider } from './llm.types.ts';

const STRONG =
  /\b(never|always|stop|most|nobody|everyone|mistake|lesson|learned|realized|the real|actually|wrong|truth|secret|underrated|overrated|biggest|best|worst|hard part|instead)\b/i;

export const localLlm: LlmProvider = {
  name: 'local',
  models: { main: 'local-heuristic@1', judge: 'local-overlap@1' },

  async extractClaims({ segments }) {
    const claims = segments.flatMap((seg) =>
      sentenceSpans(seg.text)
        .filter((s) => s.text.split(/\s+/).length >= 6 && !/\?\s*$/.test(s.text) && contentWords(s.text).length >= 3)
        .map((s) => ({ segment: seg.position, quote: s.text, text: stripFillers(s.text) })),
    );
    return ClaimsOutput.parse({ claims: claims.slice(0, 40) }).claims;
  },

  async proposeAngles({ claims }) {
    const scored = claims
      .map((c) => {
        const words = c.text.split(/\s+/).length;
        const why: string[] = [];
        let score = 0;
        if (numbersIn(c.text).length) {
          score += 1.2;
          why.push('leads with a concrete number');
        }
        if (STRONG.test(c.text)) {
          score += 1;
          why.push('takes a clear position');
        }
        if (words >= 8 && words <= 30) score += 0.6;
        score += (1 - c.closest) * 1.5;
        why.push(c.closest < 0.35 ? 'unlike anything in your archive' : 'close to an earlier post');
        return { claim: c, score, why };
      })
      .sort((a, b) => b.score - a.score);

    const picked: typeof scored = [];
    for (const s of scored) {
      if (picked.length === 3) break;
      if (!picked.some((p) => overlap(p.claim.text, s.claim.text) > 0.5)) picked.push(s);
    }
    const angles = picked.map(({ claim, why }) => {
      const support = claims
        .filter((o) => o.id !== claim.id)
        .map((o) => ({ id: o.id, sim: cosine(o.embedding, claim.embedding) + overlap(o.text, claim.text) }))
        .sort((a, b) => b.sim - a.sim)
        .slice(0, 3)
        .map((x) => x.id);
      return { lead_claim_id: claim.id, claim_ids: [claim.id, ...support], rationale: why.join('; ').replace(/^\w/, (x) => x.toUpperCase()) };
    });
    return AnglesOutput.parse({ angles }).angles;
  },

  async generateDraft({ claims, leadClaimId, format, condition, examples }) {
    const lead = claims.find((c) => c.id === leadClaimId) ?? claims[0];
    const rest = claims.filter((c) => c.id !== lead.id);
    const sentenceFor = (c: (typeof claims)[number]): DraftSentenceInput =>
      c.is_creator
        ? { text: ensurePeriod(c.text), type: 'assertion', supports: [c.id] }
        : { text: `As ${c.speaker} put it, "${c.text.replace(/[.!]$/, '')}."`, type: 'assertion', supports: [c.id] };

    const sentences = [sentenceFor(lead)];
    if (format === 'post') {
      if (rest[0] && lead.text.length + rest[0].text.length < 250) sentences.push(sentenceFor(rest[0]));
      return DraftOutput.parse({ posts: [{ sentences }] }).posts;
    }
    sentences.push({ text: 'Here is what I mean.', type: 'connective', supports: [] });
    for (const c of rest.slice(0, 6)) sentences.push(sentenceFor(c));
    // context_only borrows a closing move from the nearest archive example, the way style examples steer a model
    if (condition === 'context_only' && examples.length) {
      const closing = examples[0].text.split(/(?<=[.!?])\s+/).pop();
      if (closing && tokenize(closing).length < 14) sentences.push({ text: ensurePeriod(closing), type: 'connective', supports: [] });
    }
    // at most two short sentences per post keeps the thread readable
    const posts: DraftPost[] = [];
    for (const s of sentences) {
      const last = posts.at(-1);
      const lastLength = last?.sentences.reduce((n, x) => n + x.text.length, 0) ?? 0;
      if (last && last.sentences.length < 2 && lastLength + s.text.length < 240) last.sentences.push(s);
      else posts.push({ sentences: [s] });
    }
    return DraftOutput.parse({ posts }).posts;
  },

  async judgeEntailment({ sentence, claims }) {
    const source = claims.map((c) => `${c.text} ${c.quote}`).join(' ');
    const sourceNumbers = new Set(numbersIn(source));
    const missingNumbers = numbersIn(sentence).filter((n) => !sourceNumbers.has(n));
    if (missingNumbers.length) return { status: 'unsupported', reason: `Number ${missingNumbers.join(', ')} does not appear in the cited source.` };

    const words = contentWords(sentence.replace(/^as [\w .'-]+ put it,?/i, ''));
    if (!words.length) return { status: 'supported', reason: 'No factual content beyond the cited claim.' };
    const sourceWords = new Set(contentWords(source));
    const covered = words.filter((w) => sourceWords.has(w)).length / words.length;
    const missing = words.filter((w) => !sourceWords.has(w)).slice(0, 4);
    if (covered >= 0.75) return { status: 'supported', reason: `${Math.round(covered * 100)}% of content words appear in the cited source.` };
    if (covered >= 0.45) return { status: 'partial', reason: `Not in source: ${missing.join(', ')}.` };
    return { status: 'unsupported', reason: `Most content is not in the cited source (missing: ${missing.join(', ')}).` };
  },
};
