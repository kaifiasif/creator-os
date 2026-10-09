import type { Draft, DraftSentence, GateStatus, StoredChecks } from '../../domain/types.ts';
import type { Database, RawRow } from '../client.ts';
import { json } from '../codec.ts';

const toDraft = (r: RawRow): Draft => ({
  id: String(r.id),
  run_id: String(r.run_id),
  generated_text: String(r.generated_text),
  gate_status: r.gate_status as GateStatus,
  gate_error: (r.gate_error as string | null) ?? null,
  voice_score: json.decodeNullable<Draft['voice_score']>(r.voice_score),
  confirmed_hash: (r.confirmed_hash as string | null) ?? null,
  confirmed_at: (r.confirmed_at as string | null) ?? null,
  posted_at: (r.posted_at as string | null) ?? null,
  posted_url: (r.posted_url as string | null) ?? null,
  note: (r.note as string | null) ?? null,
  created_at: String(r.created_at),
});

const toSentence = (r: RawRow): DraftSentence => ({
  id: String(r.id),
  draft_id: String(r.draft_id),
  post_position: Number(r.post_position),
  position: Number(r.position),
  text: String(r.text),
  type: r.type as DraftSentence['type'],
  supports: json.decode<string[]>(r.supports),
  checks: json.decode<StoredChecks>(r.checks),
});

export interface GateResultPatch {
  gate_status: GateStatus;
  gate_error: string | null;
  voice_score: Draft['voice_score'];
}

/** Drafts belong to whoever owns their run; every lookup and write goes through that run. */
export function createDraftsRepository(db: Database, userId: string) {
  const ownedRun = (column: string) => `${column} IN (SELECT id FROM runs WHERE user_id = ?)`;
  const ownedDraft = (column: string) => `${column} IN (SELECT d.id FROM drafts d JOIN runs r ON r.id = d.run_id WHERE r.user_id = ?)`;
  return {
    /** A draft and its sentences are written together or not at all. */
    insert(draft: Omit<Draft, 'confirmed_hash' | 'confirmed_at' | 'posted_at' | 'posted_url' | 'note'>, sentences: DraftSentence[]): void {
      db.transaction(() => {
        if (!db.get('SELECT 1 FROM runs WHERE id = ? AND user_id = ?', draft.run_id, userId)) throw new Error('Draft for a run this creator does not own.');
        db.run(
          'INSERT INTO drafts (id, run_id, generated_text, gate_status, gate_error, voice_score, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          draft.id, draft.run_id, draft.generated_text, draft.gate_status, draft.gate_error, json.encode(draft.voice_score), draft.created_at,
        );
        for (const s of sentences) {
          db.run(
            'INSERT INTO draft_sentences (id, draft_id, post_position, position, text, type, supports, checks) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            s.id, draft.id, s.post_position, s.position, s.text, s.type, json.encode(s.supports), json.encode(s.checks),
          );
        }
      });
    },

    findById(id: string): Draft | undefined {
      const row = db.get(`SELECT * FROM drafts WHERE id = ? AND ${ownedRun('run_id')}`, id, userId);
      return row && toDraft(row);
    },

    findByRunId(runId: string): Draft | undefined {
      const row = db.get(`SELECT * FROM drafts WHERE run_id = ? AND ${ownedRun('run_id')}`, runId, userId);
      return row && toDraft(row);
    },

    sentences(draftId: string): DraftSentence[] {
      return db.all(`SELECT * FROM draft_sentences WHERE draft_id = ? AND ${ownedDraft('draft_id')} ORDER BY post_position, position`, draftId, userId).map(toSentence);
    },

    deleteForRun(runId: string): void {
      db.run(`DELETE FROM drafts WHERE run_id = ? AND ${ownedRun('run_id')}`, runId, userId);
    },

    saveGateResult(draftId: string, patch: GateResultPatch, checks: Map<string, StoredChecks>): void {
      db.transaction(() => {
        for (const [sentenceId, c] of checks) {
          db.run(`UPDATE draft_sentences SET checks = ? WHERE id = ? AND draft_id = ? AND ${ownedDraft('draft_id')}`, json.encode(c), sentenceId, draftId, userId);
        }
        db.run(
          `UPDATE drafts SET gate_status = ?, gate_error = ?, voice_score = ? WHERE id = ? AND ${ownedRun('run_id')}`,
          patch.gate_status, patch.gate_error, json.encode(patch.voice_score), draftId, userId,
        );
      });
    },

    clearConfirmation(draftId: string): void {
      db.run(`UPDATE drafts SET confirmed_hash = NULL, confirmed_at = NULL WHERE id = ? AND ${ownedRun('run_id')}`, draftId, userId);
    },
    confirm(draftId: string, hash: string, at: string): void {
      db.run(`UPDATE drafts SET confirmed_hash = ?, confirmed_at = ? WHERE id = ? AND ${ownedRun('run_id')}`, hash, at, draftId, userId);
    },
    markPosted(draftId: string, at: string, url: string | null): void {
      db.run(`UPDATE drafts SET posted_at = ?, posted_url = ? WHERE id = ? AND ${ownedRun('run_id')}`, at, url, draftId, userId);
    },
    setNote(draftId: string, note: string | null): void {
      db.run(`UPDATE drafts SET note = ? WHERE id = ? AND ${ownedRun('run_id')}`, note, draftId, userId);
    },
  };
}
export type DraftsRepository = ReturnType<typeof createDraftsRepository>;
