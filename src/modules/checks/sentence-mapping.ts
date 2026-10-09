import { overlap, sentenceSpans } from '../../domain/text.ts';
import type { DraftSentence, SentenceType } from '../../domain/types.ts';

export interface MappedSentence {
  key: string;
  post_position: number;
  position: number;
  text: string;
  type: SentenceType;
  supports: string[];
  from_sentence_id: string | null;
  unchanged: boolean;
}

const MIN_OVERLAP = 0.5;

/**
 * Maps each sentence of an edited final text back to the generated sentence it came from
 * (exact match first, then the best content overlap), so its citations carry over.
 * Brand-new sentences start as connective; effectiveType() promotes factual ones to assertions,
 * which then need a source like any other.
 */
export function mapFinalSentences(finalPosts: string[], original: Pick<DraftSentence, 'id' | 'text' | 'type' | 'supports'>[]): MappedSentence[] {
  return finalPosts.flatMap((post, pi) =>
    sentenceSpans(post).map((span, si) => {
      const exact = original.find((o) => o.text === span.text);
      let from = exact ?? null;
      if (!from) {
        let best: { o: (typeof original)[number]; score: number } | null = null;
        for (const o of original) {
          const score = overlap(o.text, span.text);
          if (score >= MIN_OVERLAP && (!best || score > best.score)) best = { o, score };
        }
        from = best?.o ?? null;
      }
      return {
        key: `f${pi + 1}.${si + 1}`,
        post_position: pi + 1,
        position: si + 1,
        text: span.text,
        type: from ? from.type : 'connective',
        supports: from ? from.supports : [],
        from_sentence_id: from?.id ?? null,
        unchanged: Boolean(exact),
      };
    }),
  );
}

/** Groups sentences into posts by post_position. */
export function groupPosts<T extends { post_position: number }>(rows: T[]): T[][] {
  const posts: T[][] = [];
  for (const r of rows) (posts[r.post_position - 1] ??= []).push(r);
  return posts.filter(Boolean);
}

export const postTexts = (rows: { post_position: number; text: string }[]): string[] => groupPosts(rows).map((p) => p.map((s) => s.text).join(' '));
