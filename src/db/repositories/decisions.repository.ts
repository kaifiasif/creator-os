import type { Decision, Override, Recheck } from '../../domain/types.ts';
import type { Database, RawRow } from '../client.ts';
import { bool, json } from '../codec.ts';

const toDecision = (r: RawRow): Decision => ({
  id: String(r.id),
  draft_id: String(r.draft_id),
  decision: r.decision as Decision['decision'],
  reject_reason: (r.reject_reason as Decision['reject_reason']) ?? null,
  reject_note: (r.reject_note as string | null) ?? null,
  final_posts: json.decodeNullable<string[]>(r.final_posts),
  final_text: (r.final_text as string | null) ?? null,
  text_hash: (r.text_hash as string | null) ?? null,
  edit_ratio: (r.edit_ratio as number | null) ?? null,
  claim_set_changed: bool.decodeNullable(r.claim_set_changed),
  overrides: json.decode<Override[]>(r.overrides),
  recheck: json.decodeNullable<Recheck>(r.recheck),
  recheck_status: (r.recheck_status as Decision['recheck_status']) ?? null,
  assist: (r.assist as 'reviewer' | null) ?? null,
  time_to_decision_ms: (r.time_to_decision_ms as number | null) ?? null,
  decided_at: String(r.decided_at),
});

/** Decisions belong to whoever owns the draft's run. */
export function createDecisionsRepository(db: Database, userId: string) {
  const ownedDraft = (column: string) => `${column} IN (SELECT d.id FROM drafts d JOIN runs r ON r.id = d.run_id WHERE r.user_id = ?)`;
  return {
    insert(d: Decision): void {
      if (!db.get(`SELECT 1 WHERE ${ownedDraft('?')}`, d.draft_id, userId)) throw new Error('Decision for a draft this creator does not own.');
      db.run(
        `INSERT INTO decisions (id, draft_id, decision, reject_reason, reject_note, final_posts, final_text, text_hash, edit_ratio,
           claim_set_changed, overrides, recheck, recheck_status, assist, time_to_decision_ms, decided_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        d.id, d.draft_id, d.decision, d.reject_reason, d.reject_note, json.encode(d.final_posts), d.final_text, d.text_hash, d.edit_ratio,
        d.claim_set_changed, json.encode(d.overrides), json.encode(d.recheck), d.recheck_status, d.assist, d.time_to_decision_ms, d.decided_at,
      );
    },

    listForDraft(draftId: string): Decision[] {
      return db.all(`SELECT * FROM decisions WHERE draft_id = ? AND ${ownedDraft('draft_id')} ORDER BY decided_at, rowid`, draftId, userId).map(toDecision);
    },

    /** Final texts the creator confirmed for posting, newest first. */
    confirmedOutputs(limit: number): { draft_id: string; confirmed_at: string; final_text: string }[] {
      return db.all<{ draft_id: string; confirmed_at: string; final_text: string }>(
        `SELECT d.id AS draft_id, d.confirmed_at, x.final_text
         FROM drafts d JOIN runs r ON r.id = d.run_id JOIN decisions x ON x.id = (
           SELECT y.id FROM decisions y WHERE y.draft_id = d.id AND y.text_hash = d.confirmed_hash ORDER BY y.decided_at DESC LIMIT 1
         )
         WHERE r.user_id = ? AND d.confirmed_hash IS NOT NULL
         ORDER BY d.confirmed_at DESC LIMIT ?`,
        userId, limit,
      );
    },
  };
}
export type DecisionsRepository = ReturnType<typeof createDecisionsRepository>;
