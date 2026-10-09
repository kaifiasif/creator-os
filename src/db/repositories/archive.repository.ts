import type { ArchiveChunk, ArchivePiece, RetiredAngle } from '../../domain/types.ts';
import type { Database, RawRow } from '../client.ts';
import { bool, json, vector } from '../codec.ts';

const toPiece = (r: RawRow): ArchivePiece => ({
  id: String(r.id),
  external_id: String(r.external_id),
  text: String(r.text),
  parts: json.decodeNullable<string[]>(r.parts),
  published_at: String(r.published_at),
  url: (r.url as string | null) ?? null,
  embedding: vector.decode(r.embedding),
  embedding_provider: String(r.embedding_provider),
  is_holdout: bool.decode(r.is_holdout),
  retired: bool.decode(r.retired),
  retired_reason: (r.retired_reason as string | null) ?? null,
  created_at: String(r.created_at),
});

const toRetired = (r: RawRow): RetiredAngle => ({
  id: String(r.id),
  piece_id: (r.piece_id as string | null) ?? null,
  claim_id: (r.claim_id as string | null) ?? null,
  text: String(r.text),
  reason: String(r.reason),
  embedding: vector.decode(r.embedding),
  created_at: String(r.created_at),
});

export type NewPiece = Omit<ArchivePiece, 'retired' | 'retired_reason'>;
export type PieceSummary = Omit<ArchivePiece, 'embedding' | 'embedding_provider' | 'created_at'>;

export function createArchiveRepository(db: Database, userId: string) {
  return {
    insertPiece(piece: NewPiece, chunks: { id: string; text: string; embedding: Float32Array }[]): void {
      db.run(
        `INSERT INTO archive_pieces (id, user_id, external_id, text, parts, published_at, url, embedding, embedding_provider, is_holdout, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        piece.id, userId, piece.external_id, piece.text, json.encode(piece.parts), piece.published_at, piece.url,
        vector.encode(piece.embedding), piece.embedding_provider, piece.is_holdout, piece.created_at,
      );
      for (const c of chunks) {
        db.run('INSERT INTO archive_chunks (id, piece_id, text, embedding) VALUES (?, ?, ?, ?)', c.id, piece.id, c.text, vector.encode(c.embedding));
      }
    },

    existingExternalIds(externalIds: string[]): Set<string> {
      if (!externalIds.length) return new Set();
      const rows = db.all<{ external_id: string }>(
        'SELECT external_id FROM archive_pieces WHERE user_id = ? AND external_id IN (SELECT value FROM json_each(?))',
        userId, JSON.stringify(externalIds),
      );
      return new Set(rows.map((r) => r.external_id));
    },

    count(): number {
      return db.get<{ n: number }>('SELECT COUNT(*) AS n FROM archive_pieces WHERE user_id = ?', userId)?.n ?? 0;
    },

    findById(id: string): ArchivePiece | undefined {
      const row = db.get('SELECT * FROM archive_pieces WHERE id = ? AND user_id = ?', id, userId);
      return row && toPiece(row);
    },

    /** Everything the archive screen shows, newest first, without the embeddings. */
    listSummaries(): PieceSummary[] {
      return db
        .all('SELECT id, external_id, text, parts, published_at, url, is_holdout, retired, retired_reason FROM archive_pieces WHERE user_id = ? ORDER BY published_at DESC', userId)
        .map((r) => ({
          id: String(r.id),
          external_id: String(r.external_id),
          text: String(r.text),
          parts: json.decodeNullable<string[]>(r.parts),
          published_at: String(r.published_at),
          url: (r.url as string | null) ?? null,
          is_holdout: bool.decode(r.is_holdout),
          retired: bool.decode(r.retired),
          retired_reason: (r.retired_reason as string | null) ?? null,
        }));
    },

    /** Reference set: pieces not held out for calibration. Drafts are compared against these. */
    referencePieces(): ArchivePiece[] {
      return db.all('SELECT * FROM archive_pieces WHERE user_id = ? AND is_holdout = 0 ORDER BY published_at', userId).map(toPiece);
    },
    holdoutPieces(): ArchivePiece[] {
      return db.all('SELECT * FROM archive_pieces WHERE user_id = ? AND is_holdout = 1 ORDER BY published_at', userId).map(toPiece);
    },
    allPieces(): ArchivePiece[] {
      return db.all('SELECT * FROM archive_pieces WHERE user_id = ? ORDER BY published_at', userId).map(toPiece);
    },

    referenceChunks(): ArchiveChunk[] {
      return db
        .all(
          `SELECT c.piece_id, c.embedding, p.text, p.published_at, p.url, p.retired
           FROM archive_chunks c JOIN archive_pieces p ON p.id = c.piece_id WHERE p.user_id = ? AND p.is_holdout = 0`,
          userId,
        )
        .map((r) => ({
          piece_id: String(r.piece_id),
          embedding: vector.decode(r.embedding),
          text: String(r.text),
          published_at: String(r.published_at),
          url: (r.url as string | null) ?? null,
          retired: bool.decode(r.retired),
        }));
    },

    setRetired(id: string, reason: string | null): void {
      db.run('UPDATE archive_pieces SET retired = ?, retired_reason = ? WHERE id = ? AND user_id = ?', reason !== null, reason, id, userId);
    },

    // ------------------------------------------------------------ retired angles
    insertRetiredAngle(angle: RetiredAngle): void {
      db.run(
        'INSERT INTO retired_angles (id, user_id, piece_id, claim_id, text, reason, embedding, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        angle.id, userId, angle.piece_id, angle.claim_id, angle.text, angle.reason, vector.encode(angle.embedding), angle.created_at,
      );
    },
    retiredAngles(): RetiredAngle[] {
      return db.all('SELECT * FROM retired_angles WHERE user_id = ? ORDER BY created_at', userId).map(toRetired);
    },
    deleteRetiredAnglesForPiece(pieceId: string): void {
      db.run('DELETE FROM retired_angles WHERE user_id = ? AND piece_id = ?', userId, pieceId);
    },
  };
}
export type ArchiveRepository = ReturnType<typeof createArchiveRepository>;
