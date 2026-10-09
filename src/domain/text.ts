/** Deterministic text utilities. Nothing here calls a model or touches I/O. */
import { createHash } from 'node:crypto';

export interface Span {
  text: string;
  start: number;
  end: number;
}

export const sha256 = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex');

const STOPWORDS = new Set(
  `a an the and or but if then so of to in on at by for with from as is are was were be been being
i me my mine we our you your he she it its they them their this that these those there here what which who whom
do does did done have has had having not no yes can could will would should may might must just very really
about into over under up down out than too also only even still all any some more most such own same other
im ive id dont doesnt didnt cant wont isnt arent wasnt thats theres its lets youre theyre weve`.split(/\s+/),
);

const FILLERS = /\b(um+|uh+|erm|you know|i mean|kind of|sort of|like(?=,)|basically|actually|literally)\b,?\s*/gi;

export const normalizeWs = (s: string): string => s.replace(/\s+/g, ' ').trim();

export function stripFillers(s: string): string {
  return normalizeWs(s.replace(/,\s*like,\s*/gi, ' ').replace(FILLERS, ''))
    .replace(/^(so|and|but|yeah|okay|ok|right)[,\s]+/i, '')
    .replace(/^\w/, (c) => c.toUpperCase());
}

export function splitSentences(text: string): string[] {
  return text
    .split(/\n+/)
    .flatMap((para) => para.match(/[^.!?]+(?:[.!?]+["')\]]*|$)/g) ?? [])
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Sentence spans with char offsets in the original string. */
export function sentenceSpans(text: string, base = 0): Span[] {
  const spans: Span[] = [];
  const re = /[^.!?\n]+(?:[.!?]+["')\]]*|(?=\n)|$)/g;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (!m[0]) {
      re.lastIndex++;
      continue;
    }
    const raw = m[0];
    const lead = raw.length - raw.trimStart().length;
    const t = raw.trim();
    if (t) spans.push({ text: t, start: base + m.index + lead, end: base + m.index + lead + t.length });
  }
  return spans;
}

export const tokenize = (text: string): string[] => text.toLowerCase().match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)?|[^\s\p{L}\p{N}]/gu) ?? [];

const isWord = (t: string) => /[\p{L}\p{N}]/u.test(t);

const stem = (w: string) => w.replace(/['’]s$/, '').replace(/(ing|edly|ed|ly|es|s)$/, (suf, _i: number, str: string) => (str.length - suf.length >= 3 ? '' : suf));

export function contentWords(text: string): string[] {
  return tokenize(text)
    .filter(isWord)
    .map((w) => w.replace(/['’]/g, ''))
    .filter((w) => !STOPWORDS.has(w) && w.length > 1)
    .map(stem);
}

export const numbersIn = (text: string): string[] =>
  (text.match(/(?<![\p{L}\d])\d[\d,.]*%?/gu) ?? []).map((n) => n.replace(/[,.]$/, '').replace(/,/g, ''));

/**
 * Edit ratio per the PRD: 1 - LCS / max(len) over tokens. Punctuation weighs 0.1,
 * so a punctuation-only change stays below 0.02 on any normal sentence.
 */
export function editRatio(a: string, b: string): number {
  const ta = tokenize(a);
  const tb = tokenize(b);
  const weight = (t: string) => (isWord(t) ? 1 : 0.1);
  const total = (ts: string[]) => ts.reduce((s, t) => s + weight(t), 0);
  const wa = total(ta);
  const wb = total(tb);
  if (wa === 0 && wb === 0) return 0;
  const prev = new Float64Array(tb.length + 1);
  const cur = new Float64Array(tb.length + 1);
  for (let i = 1; i <= ta.length; i++) {
    for (let j = 1; j <= tb.length; j++) {
      cur[j] = ta[i - 1] === tb[j - 1] ? prev[j - 1] + weight(ta[i - 1]) : Math.max(prev[j], cur[j - 1]);
    }
    prev.set(cur);
  }
  return Math.round((1 - prev[tb.length] / Math.max(wa, wb)) * 10000) / 10000;
}

/** Content-word overlap, used to map edited sentences back to their originals. */
export function overlap(a: string, b: string): number {
  const A = new Set(contentWords(a));
  const B = new Set(contentWords(b));
  if (!A.size || !B.size) return 0;
  let shared = 0;
  for (const x of A) if (B.has(x)) shared++;
  return shared / Math.max(A.size, B.size);
}

// ---------------------------------------------------------------- X rules
export const X_LIMIT = 280;
const URL_RE = /https?:\/\/[^\s]+/g;
const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });

const isWide = (segment: string) => {
  const cp = segment.codePointAt(0) ?? 0;
  return (
    /\p{Extended_Pictographic}/u.test(segment) ||
    (cp >= 0x1100 && cp <= 0x115f) ||
    (cp >= 0x2e80 && cp <= 0xa4cf) ||
    (cp >= 0xac00 && cp <= 0xd7a3) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xff00 && cp <= 0xff60)
  );
};

/** Length as X counts it: URLs are 23, emoji and CJK count double. */
export function xLength(text: string): number {
  let n = 0;
  const withoutUrls = text.replace(URL_RE, () => {
    n += 23;
    return '';
  });
  for (const { segment } of segmenter.segment(withoutUrls)) n += isWide(segment) ? 2 : 1;
  return n;
}

/** Greedy split of sentences into posts that each fit the X limit. */
export function packSentences<T extends { text: string }>(sentences: T[], limit = X_LIMIT): T[][] {
  const posts: T[][] = [];
  let cur: T[] = [];
  const len = (arr: T[]) => xLength(arr.map((s) => s.text).join(' '));
  for (const s of sentences) {
    if (cur.length && len([...cur, s]) > limit) {
      posts.push(cur);
      cur = [];
    }
    cur.push(s);
  }
  if (cur.length) posts.push(cur);
  return posts;
}

export const composeUrl = (text: string): string => `https://x.com/intent/post?text=${encodeURIComponent(text)}`;

export const HEDGES = /\b(maybe|perhaps|probably|possibly|might|i think|i guess|i feel|seems?|somewhat|kind of|sort of|arguably)\b/gi;
export const EMOJI = /\p{Extended_Pictographic}/gu;

export type OpeningPattern = 'question' | 'number' | 'story' | 'claim' | 'other';

export function openingPattern(text: string): OpeningPattern {
  const first = splitSentences(text)[0] ?? '';
  if (/\?\s*$/.test(first)) return 'question';
  if (/^\s*[\d$]/.test(first) || /\b\d+\b/.test(first.slice(0, 25))) return 'number';
  if (/^\s*(i|we|my|last|yesterday|today|this week|when i|years? ago)\b/i.test(first)) return 'story';
  if (first.split(/\s+/).length <= 14) return 'claim';
  return 'other';
}

export const ensurePeriod = (t: string): string => (/[.!?"]$/.test(t.trim()) ? t.trim() : `${t.trim()}.`);
