/**
 * The creator's voice, measured from their own archive (FR-008).
 * Statistics only: nothing here quotes archive text back into a prompt.
 */
import type { AppContext } from '../../context.ts';
import { centroid, cosine, mean, percentile, std } from '../../domain/stats.ts';
import { EMOJI, HEDGES, openingPattern, splitSentences } from '../../domain/text.ts';
import type { ArchivePiece, VoiceFeatureFlag } from '../../domain/types.ts';

const FIRST_PERSON = /\b(i|i'm|i've|i'd|me|my|mine)\b/i;
const GENERIC = /\b(delve|leverage|game[- ]changer|unlock|elevate|in today's|fast-paced|landscape|synergy|navigate the|tapestry|supercharge|seamless(ly)?|robust|empower)\b/i;

export interface SentenceFeatures {
  words: number;
  word_length: number;
  hedge: number;
  emoji: number;
  hashtag: number;
  question: number;
  first_person: number;
  generic: number;
}

const PIECE_STATS = ['mean_sentence_length', 'sentence_length_variance', 'question_rate', 'first_person_rate', 'hedge_rate', 'emoji_rate', 'hashtag_rate'] as const;
type PieceStat = (typeof PIECE_STATS)[number];
export type PieceFeatures = Record<PieceStat, number> & { opening_pattern: string };

type Moments = { mean: number; std: number };

export type VoiceReference =
  | { empty: true }
  | {
      empty: false;
      n: number;
      sentStats: Record<'words' | 'word_length', Moments>;
      rates: Record<'hedge' | 'emoji' | 'hashtag' | 'generic', number>;
      pieceStats: Record<PieceStat, Moments>;
      openings: Record<string, number>;
      centroid: Float32Array;
      distance_p50: number;
      distance_p90: number;
      holdout_false_flag_rate: number | null;
    };

const has = (re: RegExp, s: string) => (s.match(re) ?? []).length > 0;

export function sentenceFeatures(s: string): SentenceFeatures {
  const words = s.split(/\s+/).filter(Boolean);
  const letters = words.map((w) => w.replace(/[^\p{L}]/gu, '').length).filter(Boolean);
  return {
    words: words.length,
    word_length: letters.length ? mean(letters) : 0,
    hedge: has(HEDGES, s) ? 1 : 0,
    emoji: has(EMOJI, s) ? 1 : 0,
    hashtag: /#\w/.test(s) ? 1 : 0,
    question: /\?\s*$/.test(s) ? 1 : 0,
    first_person: FIRST_PERSON.test(s) ? 1 : 0,
    generic: GENERIC.test(s) ? 1 : 0,
  };
}

export function pieceFeatures(text: string): PieceFeatures {
  const f = splitSentences(text).map(sentenceFeatures);
  const lengths = f.map((x) => x.words);
  return {
    mean_sentence_length: mean(lengths),
    sentence_length_variance: std(lengths) ** 2,
    question_rate: mean(f.map((x) => x.question)),
    first_person_rate: mean(f.map((x) => x.first_person)),
    hedge_rate: mean(f.map((x) => x.hedge)),
    emoji_rate: mean(f.map((x) => x.emoji)),
    hashtag_rate: mean(f.map((x) => x.hashtag)),
    opening_pattern: openingPattern(text),
  };
}

/** Sentence-level deviations from the archive, named by feature. Advisory only. */
export function sentenceVoiceFlags(sentence: string, ref: VoiceReference): VoiceFeatureFlag[] {
  if (ref.empty) return [];
  const f = sentenceFeatures(sentence);
  const flags: VoiceFeatureFlag[] = [];
  for (const k of ['words', 'word_length'] as const) {
    const z = (f[k] - ref.sentStats[k].mean) / ref.sentStats[k].std;
    if (Math.abs(z) > 2) flags.push({ feature: k === 'words' ? 'sentence length' : 'word length', z: Math.round(z * 10) / 10 });
  }
  const rare = { hedge: 'hedging', emoji: 'emoji', hashtag: 'hashtag', generic: 'generic register' } as const;
  for (const [k, label] of Object.entries(rare) as [keyof typeof rare, string][]) {
    if (f[k] && ref.rates[k] < 0.05) flags.push({ feature: label, archive_rate: Math.round(ref.rates[k] * 100) / 100 });
  }
  return flags;
}

export function buildVoiceReference(reference: ArchivePiece[], holdout: ArchivePiece[]): VoiceReference {
  if (!reference.length) return { empty: true };
  const sentences = reference.flatMap((p) => splitSentences(p.text)).map(sentenceFeatures);
  const moments = (xs: number[]): Moments => ({ mean: mean(xs), std: std(xs) });
  const sentStats = {
    words: { mean: mean(sentences.map((s) => s.words)), std: std(sentences.map((s) => s.words)) || 1 },
    word_length: { mean: mean(sentences.map((s) => s.word_length)), std: std(sentences.map((s) => s.word_length)) || 1 },
  };
  const rates = {
    hedge: mean(sentences.map((s) => s.hedge)),
    emoji: mean(sentences.map((s) => s.emoji)),
    hashtag: mean(sentences.map((s) => s.hashtag)),
    generic: mean(sentences.map((s) => s.generic)),
  };
  const features = reference.map((p) => pieceFeatures(p.text));
  const pieceStats = Object.fromEntries(PIECE_STATS.map((k) => [k, moments(features.map((x) => x[k]))])) as Record<PieceStat, Moments>;
  const openings: Record<string, number> = {};
  for (const f of features) openings[f.opening_pattern] = (openings[f.opening_pattern] ?? 0) + 1;

  const center = centroid(reference.map((p) => p.embedding)) as Float32Array;
  const distance = (p: ArchivePiece) => 1 - cosine(p.embedding, center);
  // held-out pieces give an honest spread; fall back to the reference set when there are too few
  const spread = holdout.length >= 3 ? holdout.map(distance) : reference.map(distance);

  const ref: VoiceReference = {
    empty: false,
    n: reference.length,
    sentStats,
    rates,
    pieceStats,
    openings,
    centroid: center,
    distance_p50: percentile(spread, 50),
    distance_p90: percentile(spread, 90),
    holdout_false_flag_rate: null,
  };
  ref.holdout_false_flag_rate = holdout.length
    ? holdout.filter((p) => splitSentences(p.text).some((s) => sentenceVoiceFlags(s, ref).length)).length / holdout.length
    : null;
  return ref;
}

export function getVoiceReference(ctx: AppContext): VoiceReference {
  ctx.cache.voiceReference ??= buildVoiceReference(ctx.repos.archive.referencePieces(), ctx.repos.archive.holdoutPieces());
  return ctx.cache.voiceReference;
}

export function invalidateVoiceReference(ctx: AppContext): void {
  ctx.cache.voiceReference = null;
}

/** Short statistical summary used in the gate-condition prompt. Contains no archive text. */
export function voiceSummary(ctx: AppContext): Record<string, unknown> {
  const ref = getVoiceReference(ctx);
  if (ref.empty) return { note: 'no archive' };
  const r = (x: number) => Math.round(x * 100) / 100;
  return {
    mean_sentence_words: r(ref.sentStats.words.mean),
    question_rate: r(ref.pieceStats.question_rate.mean),
    first_person_rate: r(ref.pieceStats.first_person_rate.mean),
    hedge_rate: r(ref.pieceStats.hedge_rate.mean),
    emoji_rate: r(ref.pieceStats.emoji_rate.mean),
    hashtag_rate: r(ref.pieceStats.hashtag_rate.mean),
    top_hook_patterns: Object.entries(ref.openings)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k]) => k),
  };
}
