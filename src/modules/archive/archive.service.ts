/** FR-002 archive import and indexing, FR-010 retiring angles. */
import type { AppContext } from '../../context.ts';
import { notFound, unprocessable } from '../../core/errors.ts';
import { nowIso, uuidv7 } from '../../domain/ids.ts';
import { hashInt } from '../../domain/stats.ts';
import { sentenceSpans, tokenize } from '../../domain/text.ts';
import type { ArchiveImportInput, RetireInput } from './archive.schemas.ts';
import { parseImport } from './import-parsers.ts';
import { invalidateVoiceReference } from './voice-reference.ts';

/** Below this many published pieces, results are labelled "below prerequisite". */
export const MIN_PIECES = 20;
const HOLDOUT_PERCENT = 20;
const MIN_CHUNK_TOKENS = 4;

export function repetitionThreshold(ctx: AppContext): number {
  const provider = ctx.providers.embeddings;
  const calibration = ctx.repos.settings.get<{ threshold: number } | null>(`calibration:${provider.name}`, null);
  return calibration?.threshold ?? provider.defaultThreshold;
}

/** Parses an import without saving it, so the creator sees every row and chooses what goes in. */
export function previewArchive(ctx: AppContext, input: ArchiveImportInput) {
  const { items, pieces } = parseImport(input);
  const kept = new Set(pieces.map((p) => p.external_id));
  const ids = new Set(items.map((i) => i.external_id));
  const existing = ctx.repos.archive.existingExternalIds(pieces.map((p) => p.external_id));
  const partOfThread = (i: (typeof items)[number]) => !i.is_retweet && Boolean(i.in_reply_to) && ids.has(i.in_reply_to ?? '');

  const rows = pieces.map((p) => ({
    external_id: p.external_id,
    text: p.text,
    parts: p.parts.length > 1 ? p.parts : null,
    published_at: p.published_at,
    url: p.url ?? null,
    status: existing.has(p.external_id) ? ('exists' as const) : ('new' as const),
    kind: p.parts.length > 1 ? ('thread' as const) : ('post' as const),
  }));
  const excluded = items
    .filter((i) => !kept.has(i.external_id) && !partOfThread(i))
    .map((i) => ({ external_id: i.external_id, text: i.text, published_at: i.published_at, url: i.url ?? null, reason: i.is_retweet ? ('retweet' as const) : ('reply' as const) }));

  return {
    rows,
    excluded,
    counts: {
      rows: rows.length,
      new: rows.filter((r) => r.status === 'new').length,
      exists: rows.filter((r) => r.status === 'exists').length,
      threads: rows.filter((r) => r.kind === 'thread').length,
      excluded: excluded.length,
    },
  };
}

export async function importArchive(ctx: AppContext, input: ArchiveImportInput) {
  const { archive, settings } = ctx.repos;
  const parsed = parseImport(input);
  const only = input.only ? new Set(input.only) : null;
  const pieces = only ? parsed.pieces.filter((p) => only.has(p.external_id)) : parsed.pieces;
  if (!pieces.length) throw unprocessable('No usable pieces after filtering retweets and replies.');

  const existing = archive.existingExternalIds(pieces.map((p) => p.external_id));
  const fresh = pieces.filter((p) => !existing.has(p.external_id));
  const provider = ctx.providers.embeddings;
  const seed = settings.get('holdout_seed', 42);

  // embed before opening the transaction: provider calls never hold a database lock
  const pieceVectors = await provider.embed(fresh.map((p) => p.text));
  const chunkTexts = fresh.map((p) => sentenceSpans(p.text).map((s) => s.text).filter((t) => tokenize(t).length >= MIN_CHUNK_TOKENS));
  const chunkVectors = await provider.embed(chunkTexts.flat());

  let holdout = 0;
  let k = 0;
  ctx.db.transaction(() => {
    fresh.forEach((p, i) => {
      const isHoldout = hashInt(`${seed}:${p.external_id}`) % 100 < HOLDOUT_PERCENT;
      if (isHoldout) holdout++;
      archive.insertPiece(
        {
          id: uuidv7(),
          external_id: p.external_id,
          text: p.text,
          parts: p.parts.length > 1 ? p.parts : null,
          published_at: p.published_at,
          url: p.url ?? null,
          embedding: pieceVectors[i],
          embedding_provider: provider.name,
          is_holdout: isHoldout,
          created_at: nowIso(),
        },
        chunkTexts[i].map((text) => ({ id: uuidv7(), text, embedding: chunkVectors[k++] })),
      );
    });
  });
  invalidateVoiceReference(ctx);

  const total = archive.count();
  return {
    imported: fresh.length,
    skipped_existing: pieces.length - fresh.length,
    threads_grouped: parsed.threadsGrouped,
    excluded: parsed.excluded,
    holdout,
    total_pieces: total,
    warning: total < MIN_PIECES ? `Only ${total} published pieces. The capstone needs at least ${MIN_PIECES}; metrics will be labelled below prerequisite.` : null,
  };
}

export function listArchive(ctx: AppContext) {
  const pieces = ctx.repos.archive.listSummaries();
  return {
    total: pieces.length,
    holdout: pieces.filter((p) => p.is_holdout).length,
    retired: pieces.filter((p) => p.retired).length,
    below_prerequisite: pieces.length < MIN_PIECES,
    embedding_provider: ctx.providers.embeddings.name,
    repetition_threshold: repetitionThreshold(ctx),
    pieces,
  };
}

/** Retiring an angle means future drafts that say it again are flagged at high severity. */
export async function retireAngle(ctx: AppContext, target: { pieceId: string } | { claimId: string }, { reason }: RetireInput) {
  const { archive, sources } = ctx.repos;
  const text =
    'pieceId' in target
      ? (archive.findById(target.pieceId) ?? throwNotFound('Archive piece')).text
      : (sources.findClaim(target.claimId) ?? throwNotFound('Claim')).text;
  const [embedding] = await ctx.providers.embeddings.embed([text]);
  const id = uuidv7();
  ctx.db.transaction(() => {
    if ('pieceId' in target) archive.setRetired(target.pieceId, reason);
    else sources.setClaimRetired(target.claimId, reason);
    archive.insertRetiredAngle({
      id,
      piece_id: 'pieceId' in target ? target.pieceId : null,
      claim_id: 'claimId' in target ? target.claimId : null,
      text,
      reason,
      embedding,
      created_at: nowIso(),
    });
  });
  return { id, retired: true };
}

export function unretirePiece(ctx: AppContext, pieceId: string) {
  if (!ctx.repos.archive.findById(pieceId)) throw notFound('Archive piece');
  ctx.db.transaction(() => {
    ctx.repos.archive.setRetired(pieceId, null);
    ctx.repos.archive.deleteRetiredAnglesForPiece(pieceId);
  });
  return { retired: false };
}

function throwNotFound(what: string): never {
  throw notFound(what);
}
