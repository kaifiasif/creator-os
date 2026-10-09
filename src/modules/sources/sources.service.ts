/** FR-001 ingest and FR-003 claims: the commands a creator issues on a source. */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AppContext } from '../../context.ts';
import { conflict, ErrorCode, notFound, unprocessable } from '../../core/errors.ts';
import { nowIso, uuidv7 } from '../../domain/ids.ts';
import { normalizeWs, sha256 } from '../../domain/text.ts';
import type { SourceItem, SourceKind } from '../../domain/types.ts';
import { assertConsent, classifyIntake, defaultKind, defaultTitle, type UploadedFile } from './intake.ts';
import { enqueueExtraction, enqueueTranscription } from './processing.ts';

export interface CreateSourceInput {
  title?: string;
  kind?: SourceKind;
  text?: string;
  file?: UploadedFile;
  consent_confirmed: boolean;
}

const accepted = (id: string, status: SourceItem['status']) => ({ source_item_id: id, status });

function requireSource(ctx: AppContext, id: string): SourceItem {
  const source = ctx.repos.sources.findById(id);
  if (!source) throw notFound('Source');
  return source;
}

export async function createSource(ctx: AppContext, input: CreateSourceInput) {
  const intake = classifyIntake(input);
  const kind = defaultKind(intake, input.kind);
  assertConsent(kind, input.consent_confirmed);

  const contentHash = intake.medium === 'audio' ? sha256(Buffer.from(intake.data).toString('base64')) : sha256(normalizeWs(intake.text));
  const duplicate = ctx.repos.sources.findByHash(contentHash);
  if (duplicate) {
    throw conflict(`This material was already added as "${duplicate.title}".`, { existing_source_item_id: duplicate.id }, ErrorCode.DUPLICATE_SOURCE);
  }

  const id = uuidv7();
  let storagePath: string | null = null;
  if (intake.medium === 'audio') {
    await mkdir(ctx.config.uploadDir, { recursive: true });
    storagePath = join(ctx.config.uploadDir, `${id}${intake.extension}`);
    await writeFile(storagePath, intake.data);
  }
  ctx.repos.sources.insert({
    id,
    title: defaultTitle(input.title, kind),
    kind,
    content_hash: contentHash,
    storage_path: storagePath,
    mime: intake.mime,
    transcript_text: intake.medium === 'text' ? intake.text : null,
    consent_confirmed: input.consent_confirmed,
    created_at: nowIso(),
  });
  enqueueTranscription(ctx, id);
  return accepted(id, 'transcribing');
}

const REPLACEABLE: SourceItem['status'][] = ['failed', 'mapping', 'nothing_postable'];

export function pasteTranscript(ctx: AppContext, id: string, text: string) {
  const source = requireSource(ctx, id);
  if (!REPLACEABLE.includes(source.status)) {
    throw conflict(`Source is ${source.status}; a manual transcript can replace it only after a failure.`, { status: source.status });
  }
  ctx.repos.sources.replaceTranscriptText(id, text);
  enqueueTranscription(ctx, id);
  return accepted(id, 'transcribing');
}

export function retrySource(ctx: AppContext, id: string) {
  const source = requireSource(ctx, id);
  if (source.status !== 'failed') throw conflict('Only failed sources can be retried.', { status: source.status });
  // resume from the stage that failed: extraction if a speaker was already chosen, else transcription
  const resumeExtraction = Boolean(source.creator_speaker && source.speakers);
  const status = resumeExtraction ? 'extracting' : 'transcribing';
  ctx.repos.sources.setStatus(id, status);
  if (resumeExtraction) enqueueExtraction(ctx, id);
  else enqueueTranscription(ctx, id);
  return accepted(id, status);
}

const MAPPABLE: SourceItem['status'][] = ['mapping', 'ready', 'nothing_postable'];

export function setSpeakerMap(ctx: AppContext, id: string, creatorSpeaker: string) {
  const source = requireSource(ctx, id);
  if (!MAPPABLE.includes(source.status)) throw conflict('The transcript is not ready yet.', { status: source.status });
  if (ctx.repos.runs.existsForSource(id)) throw conflict('Drafts already exist for this source, so the speaker can no longer change.');
  if (!source.speakers?.includes(creatorSpeaker)) {
    throw unprocessable(`Unknown speaker "${creatorSpeaker}". Choose one of: ${source.speakers?.join(', ') ?? 'none'}.`, { speakers: source.speakers ?? [] });
  }
  ctx.repos.sources.setCreatorSpeaker(id, creatorSpeaker);
  enqueueExtraction(ctx, id);
  return accepted(id, 'extracting');
}

export function getSource(ctx: AppContext, id: string) {
  const { storage_path, content_hash: _hash, mime: _mime, consent_confirmed: _consent, ...source } = requireSource(ctx, id);
  const segments = ctx.repos.sources.segments(id).map(({ source_item_id: _s, ...segment }) => segment);
  const claims = ctx.repos.sources.claims(id).map(({ embedding: _e, source_item_id: _s, retired_reason: _r, ...claim }) => claim);
  const runs = ctx.repos.runs.listForSource(id);
  return { ...source, has_audio: Boolean(storage_path), segments, claims, runs };
}

export const listSources = (ctx: AppContext) => ctx.repos.sources.list();
