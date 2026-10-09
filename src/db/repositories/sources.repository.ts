import type { Angle, Claim, ExtractionLog, Segment, SourceItem, SourceStatus } from '../../domain/types.ts';
import type { Database, RawRow } from '../client.ts';
import { bool, json, vector } from '../codec.ts';

const toSource = (r: RawRow): SourceItem => ({
  id: String(r.id),
  title: String(r.title),
  kind: r.kind as SourceItem['kind'],
  content_hash: String(r.content_hash),
  storage_path: (r.storage_path as string | null) ?? null,
  mime: String(r.mime),
  status: r.status as SourceStatus,
  transcript_text: (r.transcript_text as string | null) ?? null,
  speakers: json.decodeNullable<string[]>(r.speakers),
  creator_speaker: (r.creator_speaker as string | null) ?? null,
  consent_confirmed: bool.decode(r.consent_confirmed),
  extraction_log: json.decodeNullable<ExtractionLog>(r.extraction_log),
  error: (r.error as string | null) ?? null,
  created_at: String(r.created_at),
});

const toSegment = (r: RawRow): Segment => ({
  id: String(r.id),
  source_item_id: String(r.source_item_id),
  position: Number(r.position),
  speaker: String(r.speaker),
  start_ms: (r.start_ms as number | null) ?? null,
  end_ms: (r.end_ms as number | null) ?? null,
  char_start: Number(r.char_start),
  char_end: Number(r.char_end),
  text: String(r.text),
});

const toClaim = (r: RawRow): Claim => ({
  id: String(r.id),
  source_item_id: String(r.source_item_id),
  text: String(r.text),
  speaker: String(r.speaker),
  is_creator: bool.decode(r.is_creator),
  char_start: Number(r.char_start),
  char_end: Number(r.char_end),
  quote: String(r.quote),
  embedding: vector.decode(r.embedding),
  retired: bool.decode(r.retired),
  retired_reason: (r.retired_reason as string | null) ?? null,
});

const toAngle = (r: RawRow): Angle => ({
  id: String(r.id),
  source_item_id: String(r.source_item_id),
  position: Number(r.position),
  lead_claim_id: String(r.lead_claim_id),
  claim_ids: json.decode<string[]>(r.claim_ids),
  rationale: String(r.rationale),
  closest_piece_id: (r.closest_piece_id as string | null) ?? null,
  closest_similarity: (r.closest_similarity as number | null) ?? null,
  retired_match: bool.decode(r.retired_match),
});

export interface SourceListItem {
  id: string;
  title: string;
  kind: SourceItem['kind'];
  status: SourceStatus;
  error: string | null;
  created_at: string;
  creator_claims: number;
  runs: number;
}

export type NewSource = Pick<SourceItem, 'id' | 'title' | 'kind' | 'content_hash' | 'storage_path' | 'mime' | 'transcript_text' | 'consent_confirmed' | 'created_at'>;

/**
 * Every query is scoped to one creator. Sources carry user_id; segments, claims and angles are
 * reached only through a source the creator owns, so an id from someone else's data matches nothing.
 */
export function createSourcesRepository(db: Database, userId: string) {
  const ownedSource = (column: string) => `${column} IN (SELECT id FROM source_items WHERE user_id = ?)`;
  const owns = (sourceId: string) => Boolean(db.get('SELECT 1 FROM source_items WHERE id = ? AND user_id = ?', sourceId, userId));
  return {
    insert(s: NewSource): void {
      db.run(
        `INSERT INTO source_items (id, user_id, title, kind, content_hash, storage_path, mime, status, transcript_text, consent_confirmed, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'transcribing', ?, ?, ?)`,
        s.id, userId, s.title, s.kind, s.content_hash, s.storage_path, s.mime, s.transcript_text, s.consent_confirmed, s.created_at,
      );
    },

    findById(id: string): SourceItem | undefined {
      const row = db.get('SELECT * FROM source_items WHERE id = ? AND user_id = ?', id, userId);
      return row && toSource(row);
    },

    findByHash(contentHash: string): Pick<SourceItem, 'id' | 'title'> | undefined {
      return db.get<{ id: string; title: string }>('SELECT id, title FROM source_items WHERE user_id = ? AND content_hash = ?', userId, contentHash);
    },

    list(): SourceListItem[] {
      return db.all<SourceListItem>(`
        SELECT s.id, s.title, s.kind, s.status, s.error, s.created_at,
               (SELECT COUNT(*) FROM claims c WHERE c.source_item_id = s.id AND c.is_creator = 1) AS creator_claims,
               (SELECT COUNT(*) FROM runs r WHERE r.source_item_id = s.id) AS runs
        FROM source_items s
        WHERE s.user_id = ?
        ORDER BY s.created_at DESC`, userId);
    },

    // ------------------------------------------------------------ state changes
    saveTranscript(id: string, t: { transcript_text: string; speakers: string[]; status: SourceStatus; creator_speaker: string | null; segments: Omit<Segment, 'source_item_id'>[] }): void {
      db.transaction(() => {
        if (!owns(id)) return;
        db.run('DELETE FROM transcript_segments WHERE source_item_id = ?', id);
        for (const s of t.segments) {
          db.run(
            `INSERT INTO transcript_segments (id, source_item_id, position, speaker, start_ms, end_ms, char_start, char_end, text)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            s.id, id, s.position, s.speaker, s.start_ms, s.end_ms, s.char_start, s.char_end, s.text,
          );
        }
        db.run(
          'UPDATE source_items SET transcript_text = ?, speakers = ?, status = ?, creator_speaker = ?, error = NULL WHERE id = ? AND user_id = ?',
          t.transcript_text, json.encode(t.speakers), t.status, t.creator_speaker, id, userId,
        );
      });
    },

    replaceTranscriptText(id: string, text: string): void {
      db.run(
        "UPDATE source_items SET transcript_text = ?, storage_path = NULL, status = 'transcribing', error = NULL, creator_speaker = NULL WHERE id = ? AND user_id = ?",
        text, id, userId,
      );
    },

    setStatus(id: string, status: SourceStatus): void {
      db.run('UPDATE source_items SET status = ?, error = NULL WHERE id = ? AND user_id = ?', status, id, userId);
    },

    setCreatorSpeaker(id: string, speaker: string): void {
      db.run("UPDATE source_items SET creator_speaker = ?, status = 'extracting', error = NULL WHERE id = ? AND user_id = ?", speaker, id, userId);
    },

    markFailed(id: string, error: string): void {
      db.run("UPDATE source_items SET status = 'failed', error = ? WHERE id = ? AND user_id = ?", error, id, userId);
    },

    /** Replaces claims (and the angles built on them) and records the extraction outcome, atomically. */
    saveClaims(id: string, claims: Claim[], status: SourceStatus, log: ExtractionLog): void {
      db.transaction(() => {
        if (!owns(id)) return;
        db.run('DELETE FROM angles WHERE source_item_id = ?', id);
        db.run('DELETE FROM claims WHERE source_item_id = ?', id);
        for (const c of claims) {
          db.run(
            `INSERT INTO claims (id, source_item_id, text, speaker, is_creator, char_start, char_end, quote, embedding)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            c.id, id, c.text, c.speaker, c.is_creator, c.char_start, c.char_end, c.quote, vector.encode(c.embedding),
          );
        }
        db.run('UPDATE source_items SET status = ?, extraction_log = ?, error = NULL WHERE id = ? AND user_id = ?', status, json.encode(log), id, userId);
      });
    },

    // ------------------------------------------------------------ children
    segments(sourceId: string): Segment[] {
      return db.all(`SELECT * FROM transcript_segments WHERE source_item_id = ? AND ${ownedSource('source_item_id')} ORDER BY position`, sourceId, userId).map(toSegment);
    },

    claims(sourceId: string): Claim[] {
      return db.all(`SELECT * FROM claims WHERE source_item_id = ? AND ${ownedSource('source_item_id')} ORDER BY char_start`, sourceId, userId).map(toClaim);
    },

    claimsByIds(ids: string[]): Claim[] {
      const rows = db.all(`SELECT * FROM claims WHERE id IN (SELECT value FROM json_each(?)) AND ${ownedSource('source_item_id')}`, JSON.stringify(ids), userId).map(toClaim);
      const byId = new Map(rows.map((c) => [c.id, c]));
      return ids.flatMap((id) => byId.get(id) ?? []);
    },

    findClaim(id: string): Claim | undefined {
      const row = db.get(`SELECT * FROM claims WHERE id = ? AND ${ownedSource('source_item_id')}`, id, userId);
      return row && toClaim(row);
    },

    setClaimRetired(id: string, reason: string): void {
      db.run(`UPDATE claims SET retired = 1, retired_reason = ? WHERE id = ? AND ${ownedSource('source_item_id')}`, reason, id, userId);
    },

    angles(sourceId: string): Angle[] {
      return db.all(`SELECT * FROM angles WHERE source_item_id = ? AND ${ownedSource('source_item_id')} ORDER BY position`, sourceId, userId).map(toAngle);
    },

    insertAngles(angles: Angle[]): void {
      db.transaction(() => {
        for (const a of angles) {
          if (!owns(a.source_item_id)) continue;
          db.run(
            `INSERT INTO angles (id, source_item_id, position, lead_claim_id, claim_ids, rationale, closest_piece_id, closest_similarity, retired_match)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            a.id, a.source_item_id, a.position, a.lead_claim_id, json.encode(a.claim_ids), a.rationale, a.closest_piece_id, a.closest_similarity, a.retired_match,
          );
        }
      });
    },
  };
}
export type SourcesRepository = ReturnType<typeof createSourcesRepository>;
