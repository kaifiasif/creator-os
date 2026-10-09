import type { Database } from '../client.ts';
import { bool, json } from '../codec.ts';

export interface CalibrationLabel {
  piece_a: string;
  piece_b: string;
  similarity: number;
  same_angle: boolean;
}

export interface DriftSnapshot {
  week: string;
  homogeneity_ratio: number;
  archive_p90: number;
  centroid_distance: number;
}

/** Calibration labels and weekly drift snapshots: the two tables only the metrics read and write. */
export function createMetricsRepository(db: Database, userId: string) {
  return {
    labels(): CalibrationLabel[] {
      return db
        .all('SELECT piece_a, piece_b, similarity, same_angle FROM calibration_labels WHERE user_id = ?', userId)
        .map((r) => ({ piece_a: String(r.piece_a), piece_b: String(r.piece_b), similarity: Number(r.similarity), same_angle: bool.decode(r.same_angle) }));
    },

    labelCount(): number {
      return db.get<{ n: number }>('SELECT COUNT(*) AS n FROM calibration_labels WHERE user_id = ?', userId)?.n ?? 0;
    },

    /** Labels are idempotent per pair: labelling a pair again overwrites the earlier answer. */
    upsertLabel(label: CalibrationLabel & { id: string; created_at: string }): void {
      db.run(
        `INSERT INTO calibration_labels (id, user_id, piece_a, piece_b, similarity, same_angle, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (piece_a, piece_b) DO UPDATE SET same_angle = excluded.same_angle WHERE user_id = excluded.user_id`,
        label.id, userId, label.piece_a, label.piece_b, label.similarity, label.same_angle, label.created_at,
      );
    },

    upsertDriftSnapshot(s: DriftSnapshot & { id: string; features: unknown; created_at: string }): void {
      db.run(
        `INSERT INTO drift_snapshots (id, user_id, week, homogeneity_ratio, archive_p90, centroid_distance, features, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (user_id, week) DO UPDATE SET homogeneity_ratio = excluded.homogeneity_ratio, archive_p90 = excluded.archive_p90,
           centroid_distance = excluded.centroid_distance, features = excluded.features, created_at = excluded.created_at`,
        s.id, userId, s.week, s.homogeneity_ratio, s.archive_p90, s.centroid_distance, json.encode(s.features), s.created_at,
      );
    },

    driftHistory(limit = 8): DriftSnapshot[] {
      return db.all<DriftSnapshot>('SELECT week, homogeneity_ratio, archive_p90, centroid_distance FROM drift_snapshots WHERE user_id = ? ORDER BY week DESC LIMIT ?', userId, limit);
    },
  };
}
export type MetricsRepository = ReturnType<typeof createMetricsRepository>;
