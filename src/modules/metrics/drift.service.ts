/** FR-012 (spec 8.5): are confirmed outputs getting more alike than the creator's own writing ever was? */
import type { AppContext } from '../../context.ts';
import { nowIso, uuidv7 } from '../../domain/ids.ts';
import { centroid, cosine, isoWeek, mean, meanPairwiseSimilarity, percentile, round } from '../../domain/stats.ts';
import { openingPattern } from '../../domain/text.ts';

const MIN_ARCHIVE = 10;
const MIN_OUTPUTS = 3;
const OUTPUT_WINDOW = 10;
const ARCHIVE_WINDOW = 10;

const hookCounts = (texts: string[]) => {
  const counts: Record<string, number> = {};
  for (const t of texts) counts[openingPattern(t)] = (counts[openingPattern(t)] ?? 0) + 1;
  return counts;
};

export async function drift(ctx: AppContext) {
  const archive = ctx.repos.archive.allPieces();
  const outputs = ctx.repos.decisions.confirmedOutputs(OUTPUT_WINDOW);
  if (archive.length < MIN_ARCHIVE) return { ready: false as const, reason: `Import at least ${MIN_ARCHIVE} archive pieces to measure drift.` };
  if (outputs.length < MIN_OUTPUTS) {
    return { ready: false as const, reason: `Drift needs at least ${MIN_OUTPUTS} published outputs; you have ${outputs.length}.`, outputs: outputs.length };
  }

  const vectors = await ctx.providers.embeddings.embed(outputs.map((o) => o.final_text));
  // how alike the creator's own consecutive posts are, window by window: the baseline
  const windows: number[] = [];
  for (let i = 0; i + ARCHIVE_WINDOW <= archive.length; i++) windows.push(meanPairwiseSimilarity(archive.slice(i, i + ARCHIVE_WINDOW).map((p) => p.embedding)));
  const archiveMean = mean(windows) || 1e-9;
  const homogeneity = meanPairwiseSimilarity(vectors) / archiveMean;
  const p90 = percentile(windows.map((w) => w / archiveMean), 90);
  const reference = archive.filter((p) => !p.is_holdout);
  const centre = centroid(reference.map((p) => p.embedding));
  const distance = mean(vectors.map((v) => 1 - cosine(v, centre)));

  const pairs = outputs.slice(0, 3).map((o, i) => {
    const nearest = reference.map((p) => ({ p, s: cosine(vectors[i], p.embedding) })).sort((a, b) => b.s - a.s)[0];
    return {
      output: o.final_text,
      archive: nearest ? { text: nearest.p.text, published_at: nearest.p.published_at, url: nearest.p.url, similarity: round(nearest.s, 2) } : null,
    };
  });

  const week = isoWeek();
  const snapshot = { homogeneity_ratio: round(homogeneity, 3), archive_p90: round(p90, 3), centroid_distance: round(distance, 3) };
  const features = { hooks_output: hookCounts(outputs.map((o) => o.final_text)), hooks_archive: hookCounts(archive.map((p) => p.text)), outputs: outputs.length };
  ctx.repos.metrics.upsertDriftSnapshot({ id: uuidv7(), week, ...snapshot, features, created_at: nowIso() });
  const history = ctx.repos.metrics.driftHistory();
  // alert only when the last two weeks both sit above the archive's own 90th percentile
  const alert = history.length >= 2 && history.slice(0, 2).every((h) => h.homogeneity_ratio > h.archive_p90);
  return { ready: true as const, week, ...snapshot, ...features, pairs, history, alert };
}
