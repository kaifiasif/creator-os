/** FR-011: the creator labels archive pairs, and the repetition threshold is fitted to their labels. */
import type { AppContext } from '../../context.ts';
import { unprocessable } from '../../core/errors.ts';
import { nowIso, uuidv7 } from '../../domain/ids.ts';
import { cosine, round } from '../../domain/stats.ts';
import type { ArchivePiece } from '../../domain/types.ts';

const DEFAULT_PAIRS = 30;
/** Quantile bands over pairs sorted by similarity: oversample the top, where the threshold lives. */
const BANDS = [0, 0.02, 0.06, 0.15, 0.4, 1];

const calibrationKey = (ctx: AppContext) => `calibration:${ctx.providers.embeddings.name}`;

export function calibrationPairs(ctx: AppContext, n = DEFAULT_PAIRS) {
  const pieces = ctx.repos.archive.referencePieces();
  const labelled = new Set(ctx.repos.metrics.labels().map((l) => `${l.piece_a}|${l.piece_b}`));
  const pairs: { a: ArchivePiece; b: ArchivePiece; similarity: number }[] = [];
  for (let i = 0; i < pieces.length; i++) {
    for (let j = i + 1; j < pieces.length; j++) {
      const [a, b] = [pieces[i], pieces[j]].sort((x, y) => x.id.localeCompare(y.id));
      if (!labelled.has(`${a.id}|${b.id}`)) pairs.push({ a, b, similarity: cosine(a.embedding, b.embedding) });
    }
  }
  pairs.sort((x, y) => y.similarity - x.similarity);

  const edges = BANDS.map((q) => Math.floor(q * (pairs.length - 1)));
  const perBand = Math.ceil(n / (BANDS.length - 1));
  const picked: typeof pairs = [];
  for (let band = 0; band < edges.length - 1; band++) {
    const slice = pairs.slice(edges[band], Math.max(edges[band] + 1, edges[band + 1]));
    const step = Math.max(1, Math.floor(slice.length / perBand));
    for (let k = 0; k < slice.length && picked.length < n && k / step < perBand; k += step) picked.push(slice[k]);
  }
  const brief = (p: ArchivePiece) => ({ id: p.id, text: p.text, published_at: p.published_at });
  return {
    labelled: ctx.repos.metrics.labelCount(),
    current: ctx.repos.settings.get<Record<string, unknown> | null>(calibrationKey(ctx), null),
    pairs: picked.map((p) => ({ piece_a: brief(p.a), piece_b: brief(p.b), similarity: round(p.similarity, 3) })),
  };
}

export function saveLabels(ctx: AppContext, labels: { piece_a: string; piece_b: string; same_angle: boolean }[]) {
  ctx.db.transaction(() => {
    for (const label of labels) {
      const [aId, bId] = [label.piece_a, label.piece_b].sort();
      const a = ctx.repos.archive.findById(aId);
      const b = ctx.repos.archive.findById(bId);
      if (!a || !b) throw unprocessable('Unknown archive piece in labels.', { piece_a: label.piece_a, piece_b: label.piece_b });
      ctx.repos.metrics.upsertLabel({ id: uuidv7(), piece_a: aId, piece_b: bId, similarity: cosine(a.embedding, b.embedding), same_angle: label.same_angle, created_at: nowIso() });
    }
  });
  return { labelled: ctx.repos.metrics.labelCount() };
}

/** Picks the similarity cut-off with the best F1 against the creator's labels. Pure. */
export function bestThreshold(labels: { similarity: number; same_angle: boolean }[]): { threshold: number; f1: number } | null {
  let best: { threshold: number; f1: number } | null = null;
  for (const t of [...new Set(labels.map((l) => l.similarity))].sort((a, b) => a - b)) {
    let tp = 0;
    let fp = 0;
    let fn = 0;
    for (const l of labels) {
      const predicted = l.similarity >= t;
      if (predicted && l.same_angle) tp++;
      else if (predicted) fp++;
      else if (l.same_angle) fn++;
    }
    const f1 = tp ? (2 * tp) / (2 * tp + fp + fn) : 0;
    if (!best || f1 > best.f1) best = { threshold: round(t, 3), f1: round(f1, 3) };
  }
  return best;
}

export function fitThreshold(ctx: AppContext) {
  const labels = ctx.repos.metrics.labels();
  if (!labels.some((l) => l.same_angle) || !labels.some((l) => !l.same_angle)) {
    throw unprocessable('Label at least one "same angle" and one "different" pair first.');
  }
  const result = { ...bestThreshold(labels)!, n: labels.length, fitted_at: nowIso() };
  ctx.repos.settings.set(calibrationKey(ctx), result);
  return result;
}
