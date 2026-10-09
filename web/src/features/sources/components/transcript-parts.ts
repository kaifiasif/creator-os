import type { Claim, Segment } from '@/api/types';

export interface TranscriptPart {
  text: string;
  claim: Claim | null;
}

/**
 * Splits a segment's text into plain runs and claim quotes. Claim offsets point into the whole
 * transcript, so they are shifted by the segment's start. Overlapping quotes keep the earlier one.
 */
export function transcriptParts(segment: Segment, claims: Claim[]): TranscriptPart[] {
  const inside = claims
    .filter((c) => c.char_start >= segment.char_start && c.char_end <= segment.char_end && c.char_end > c.char_start)
    .sort((a, b) => a.char_start - b.char_start);
  const parts: TranscriptPart[] = [];
  let cursor = 0;
  for (const claim of inside) {
    const start = claim.char_start - segment.char_start;
    const end = claim.char_end - segment.char_start;
    if (start < cursor) continue;
    if (start > cursor) parts.push({ text: segment.text.slice(cursor, start), claim: null });
    parts.push({ text: segment.text.slice(start, end), claim });
    cursor = end;
  }
  if (cursor < segment.text.length) parts.push({ text: segment.text.slice(cursor), claim: null });
  return parts;
}
