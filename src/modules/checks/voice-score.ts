import { cosine } from '../../domain/stats.ts';
import type { VoiceScore } from '../../domain/types.ts';
import { pieceFeatures, type VoiceReference } from '../archive/voice-reference.ts';

const round = (x: number, places: number) => Math.round(x * 10 ** places) / 10 ** places;

/** Whole-draft voice: z-scores per feature and distance from the archive centre. Advisory only. */
export function draftVoiceScore(ref: VoiceReference, fullText: string, vec: Float32Array): VoiceScore {
  if (ref.empty) return { skipped: true, notice: 'No archive yet, so voice was not scored.' };
  const f = pieceFeatures(fullText);
  const z: Record<string, number> = {};
  for (const [k, s] of Object.entries(ref.pieceStats)) z[k] = s.std ? round((f[k as keyof typeof ref.pieceStats] - s.mean) / s.std, 1) : 0;
  const distance = 1 - cosine(vec, ref.centroid);
  return {
    skipped: false,
    z_scores: z,
    opening_pattern: f.opening_pattern,
    opening_pattern_archive_share: round((ref.openings[f.opening_pattern] ?? 0) / ref.n, 2),
    centroid_distance: round(distance, 3),
    archive_distance_p90: round(ref.distance_p90, 3),
    beyond_p90: distance > ref.distance_p90,
    holdout_false_flag_rate: ref.holdout_false_flag_rate,
  };
}
