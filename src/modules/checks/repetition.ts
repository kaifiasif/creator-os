import { cosine } from '../../domain/stats.ts';
import type { ArchiveChunk, ArchivePiece, RepetitionCheck, RepetitionMatch, RetiredAngle } from '../../domain/types.ts';

export interface ArchiveIndex {
  chunks: ArchiveChunk[];
  pieces: ArchivePiece[];
}

const RETIRED_MARGIN = 0.05;
const round3 = (x: number) => Math.round(x * 1000) / 1000;

/**
 * Has the creator said this before? Compares against whole pieces and their sentence chunks.
 * With memory on, anything close to a retired angle is flagged at high severity.
 */
export function checkRepetition(
  vec: Float32Array,
  index: ArchiveIndex,
  retired: RetiredAngle[],
  { threshold, memoryEnabled }: { threshold: number; memoryEnabled: boolean },
): RepetitionCheck {
  const best = new Map<string, RepetitionMatch>();
  const consider = (pieceId: string, similarity: number, p: { text: string; published_at: string; url: string | null; retired: boolean }) => {
    const current = best.get(pieceId);
    if (!current || similarity > current.similarity) {
      best.set(pieceId, { piece_id: pieceId, similarity: round3(similarity), text: p.text, published_at: p.published_at, url: p.url, retired: p.retired });
    }
  };
  for (const c of index.chunks) consider(c.piece_id, cosine(vec, c.embedding), c);
  for (const p of index.pieces) consider(p.id, cosine(vec, p.embedding), p);

  const matches = [...best.values()].sort((a, b) => b.similarity - a.similarity).slice(0, 3);
  const top = matches[0];
  let flag = Boolean(top && top.similarity >= threshold);
  let severity: RepetitionCheck['severity'] = flag ? 'normal' : null;
  let retiredMatch: RepetitionCheck['retired_match'] = null;

  if (memoryEnabled) {
    for (const r of retired) {
      const similarity = cosine(vec, r.embedding);
      if (similarity >= threshold - RETIRED_MARGIN && (!retiredMatch || similarity > retiredMatch.similarity)) {
        retiredMatch = { similarity: round3(similarity), reason: r.reason, text: r.text };
      }
    }
    const retiredPiece = matches.find((m) => m.retired && m.similarity >= threshold - RETIRED_MARGIN);
    if (!retiredMatch && retiredPiece) retiredMatch = { similarity: retiredPiece.similarity, reason: 'Matches a retired archive piece', text: retiredPiece.text };
    if (retiredMatch) {
      flag = true;
      severity = 'high';
    }
  }
  return { flag, severity, threshold, matches: flag ? matches : matches.slice(0, 1), retired_match: retiredMatch };
}
