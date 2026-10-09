/** FR-007: up to three angles per source, each with how close it sits to something already posted. */
import type { AppContext } from '../../context.ts';
import { conflict, notFound } from '../../core/errors.ts';
import { uuidv7 } from '../../domain/ids.ts';
import { cosine, round } from '../../domain/stats.ts';
import type { Angle, ArchivePiece, Vector } from '../../domain/types.ts';
import { repetitionThreshold } from '../archive/archive.service.ts';

const RETIRED_MARGIN = 0.05;

function nearestPiece(pieces: ArchivePiece[], vec: Vector): { piece: ArchivePiece; similarity: number } | null {
  let best: { piece: ArchivePiece; similarity: number } | null = null;
  for (const piece of pieces) {
    const similarity = cosine(vec, piece.embedding);
    if (!best || similarity > best.similarity) best = { piece, similarity };
  }
  return best;
}

async function proposeAndStore(ctx: AppContext, sourceId: string): Promise<void> {
  const { sources, archive } = ctx.repos;
  const claims = sources.claims(sourceId);
  const pieces = archive.referencePieces();
  const creator = claims.filter((c) => c.is_creator).map((c) => ({ ...c, closest: nearestPiece(pieces, c.embedding)?.similarity ?? 0 }));
  const proposed = await ctx.providers.llm.proposeAngles({ claims: creator });

  const byId = new Map(claims.map((c) => [c.id, c]));
  const retired = archive.retiredAngles();
  const threshold = repetitionThreshold(ctx);
  const angles: Angle[] = proposed
    .filter((a) => byId.get(a.lead_claim_id)?.is_creator)
    .map((a, position) => {
      const lead = byId.get(a.lead_claim_id)!;
      const near = nearestPiece(pieces, lead.embedding);
      const nearRetired = retired.some((r) => cosine(r.embedding, lead.embedding) >= threshold - RETIRED_MARGIN);
      return {
        id: uuidv7(),
        source_item_id: sourceId,
        position,
        lead_claim_id: lead.id,
        claim_ids: [...new Set([lead.id, ...a.claim_ids.filter((id) => byId.has(id))])],
        rationale: a.rationale,
        closest_piece_id: near?.piece.id ?? null,
        closest_similarity: near ? round(near.similarity, 2) : null,
        retired_match: nearRetired || Boolean(near?.piece.retired),
      };
    });
  sources.insertAngles(angles);
}

export async function getAngles(ctx: AppContext, sourceId: string) {
  const { sources, archive } = ctx.repos;
  const source = sources.findById(sourceId);
  if (!source) throw notFound('Source');
  if (source.status !== 'ready') {
    throw conflict(source.status === 'nothing_postable' ? 'Nothing postable was found in this source.' : `Source is ${source.status}.`, { status: source.status });
  }
  if (!sources.angles(sourceId).length) await proposeAndStore(ctx, sourceId);

  const claims = new Map(sources.claims(sourceId).map((c) => [c.id, c]));
  return sources.angles(sourceId).map((a) => {
    const lead = claims.get(a.lead_claim_id);
    const piece = a.closest_piece_id ? archive.findById(a.closest_piece_id) : undefined;
    return {
      id: a.id,
      position: a.position,
      lead_claim: lead ? { id: lead.id, text: lead.text, quote: lead.quote } : null,
      claim_ids: a.claim_ids,
      rationale: a.rationale,
      closest_archive: piece ? { id: piece.id, text: piece.text, published_at: piece.published_at, url: piece.url, similarity: a.closest_similarity } : null,
      retired_match: a.retired_match,
    };
  });
}
