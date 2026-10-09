import type { ModelVersions, Run, RunStatus } from '../../domain/types.ts';
import type { Database, RawRow } from '../client.ts';
import { bool, json } from '../codec.ts';

const toRun = (r: RawRow): Run => ({
  id: String(r.id),
  source_item_id: String(r.source_item_id),
  condition: r.condition as Run['condition'],
  seed: Number(r.seed),
  memory_enabled: bool.decode(r.memory_enabled),
  format: r.format as Run['format'],
  angle_choice: r.angle_choice as Run['angle_choice'],
  angle_claim_ids: json.decode<string[]>(r.angle_claim_ids),
  custom_angle: (r.custom_angle as string | null) ?? null,
  status: r.status as RunStatus,
  model_versions: json.decode<ModelVersions>(r.model_versions),
  prompt_archive_ids: json.decodeNullable<string[]>(r.prompt_archive_ids),
  error: (r.error as string | null) ?? null,
  created_at: String(r.created_at),
  ready_at: (r.ready_at as string | null) ?? null,
});

export interface RunListItem {
  id: string;
  status: RunStatus;
  format: Run['format'];
  created_at: string;
  source_item_id: string;
  source_title: string;
  decisions: number;
  posted_at: string | null;
}

export function createRunsRepository(db: Database, userId: string) {
  return {
    insert(run: Omit<Run, 'prompt_archive_ids' | 'error' | 'ready_at'>): void {
      db.run(
        `INSERT INTO runs (id, user_id, source_item_id, condition, seed, memory_enabled, format, angle_choice, angle_claim_ids, custom_angle, status, model_versions, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        run.id, userId, run.source_item_id, run.condition, run.seed, run.memory_enabled, run.format, run.angle_choice,
        json.encode(run.angle_claim_ids), run.custom_angle, run.status, json.encode(run.model_versions), run.created_at,
      );
    },

    findById(id: string): Run | undefined {
      const row = db.get('SELECT * FROM runs WHERE id = ? AND user_id = ?', id, userId);
      return row && toRun(row);
    },

    /** All runs that have a draft, oldest first. Used by the metrics. */
    withDrafts(): Run[] {
      return db.all('SELECT r.* FROM runs r JOIN drafts d ON d.run_id = r.id WHERE r.user_id = ? ORDER BY r.created_at', userId).map(toRun);
    },

    count(): number {
      return db.get<{ n: number }>('SELECT COUNT(*) AS n FROM runs WHERE user_id = ?', userId)?.n ?? 0;
    },

    existsForSource(sourceId: string): boolean {
      return Boolean(db.get('SELECT 1 FROM runs WHERE user_id = ? AND source_item_id = ? LIMIT 1', userId, sourceId));
    },

    listForSource(sourceId: string): Pick<Run, 'id' | 'status' | 'format' | 'created_at'>[] {
      return db.all<Pick<Run, 'id' | 'status' | 'format' | 'created_at'>>(
        'SELECT id, status, format, created_at FROM runs WHERE user_id = ? AND source_item_id = ? ORDER BY created_at DESC',
        userId, sourceId,
      );
    },

    list(): RunListItem[] {
      return db.all<RunListItem>(`
        SELECT r.id, r.status, r.format, r.created_at, r.source_item_id, s.title AS source_title,
               (SELECT COUNT(*) FROM decisions x JOIN drafts d ON d.id = x.draft_id WHERE d.run_id = r.id) AS decisions,
               (SELECT d.posted_at FROM drafts d WHERE d.run_id = r.id) AS posted_at
        FROM runs r JOIN source_items s ON s.id = r.source_item_id
        WHERE r.user_id = ?
        ORDER BY r.created_at DESC`, userId);
    },

    /** Drafts waiting for a first decision. While any exist, the numbers stay locked. */
    awaitingFirstDecision(): { id: string; title: string }[] {
      return db.all<{ id: string; title: string }>(`
        SELECT r.id, s.title FROM runs r JOIN source_items s ON s.id = r.source_item_id
        WHERE r.user_id = ? AND r.status = 'in_review'
          AND NOT EXISTS (SELECT 1 FROM drafts d JOIN decisions x ON x.draft_id = d.id WHERE d.run_id = r.id)`, userId);
    },

    // ------------------------------------------------------------ state changes
    setStatus(id: string, status: RunStatus, error: string | null = null): void {
      db.run('UPDATE runs SET status = ?, error = ? WHERE id = ? AND user_id = ?', status, error, id, userId);
    },
    markReady(id: string, status: RunStatus, error: string | null, readyAt: string): void {
      db.run('UPDATE runs SET status = ?, error = ?, ready_at = ? WHERE id = ? AND user_id = ?', status, error, readyAt, id, userId);
    },
    setPromptArchiveIds(id: string, ids: string[]): void {
      db.run('UPDATE runs SET prompt_archive_ids = ? WHERE id = ? AND user_id = ?', json.encode(ids), id, userId);
    },

    /** The run a rehearsal belongs to, if the rehearsal is this creator's. */
    ownsRehearsal(rehearsalId: string): boolean {
      return Boolean(db.get('SELECT 1 FROM rehearsals h JOIN runs r ON r.id = h.run_id WHERE h.id = ? AND r.user_id = ?', rehearsalId, userId));
    },
  };
}
export type RunsRepository = ReturnType<typeof createRunsRepository>;
