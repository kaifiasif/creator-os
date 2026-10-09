/**
 * Background stages for a source: transcribe → (map speaker) → extract claims.
 * Each stage records its own failure on the source row, so a crash never leaves a source stuck.
 */
import type { AppContext } from '../../context.ts';
import { errorFields } from '../../core/logger.ts';
import { uuidv7 } from '../../domain/ids.ts';
import { normalizeWs } from '../../domain/text.ts';
import type { Claim } from '../../domain/types.ts';
import { parseTextTranscript } from '../../providers/transcription.ts';
import { locateQuote } from './quote-locator.ts';

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

export function enqueueTranscription(ctx: AppContext, sourceId: string): void {
  ctx.jobs.enqueue('transcribe', () => transcribe(ctx, sourceId));
}

export function enqueueExtraction(ctx: AppContext, sourceId: string): void {
  ctx.jobs.enqueue('extract_claims', () => extractClaims(ctx, sourceId));
}

export async function transcribe(ctx: AppContext, sourceId: string): Promise<void> {
  const { sources } = ctx.repos;
  const source = sources.findById(sourceId);
  if (!source) return;
  const started = Date.now();
  try {
    const transcript =
      source.storage_path && !source.transcript_text
        ? await ctx.providers.transcription.transcribeAudio(source.storage_path)
        : parseTextTranscript(source.transcript_text ?? '');
    if (!transcript.segments.length) throw new Error('The transcript is empty.');
    const single = transcript.speakers.length === 1;
    sources.saveTranscript(sourceId, {
      transcript_text: transcript.transcript_text,
      speakers: transcript.speakers,
      status: single ? 'extracting' : 'mapping',
      creator_speaker: single ? transcript.speakers[0] : null,
      segments: transcript.segments.map((s) => ({ id: uuidv7(), ...s })),
    });
    ctx.log.info('transcribed', { source_item_id: sourceId, segments: transcript.segments.length, ms: Date.now() - started });
    if (single) await extractClaims(ctx, sourceId);
  } catch (error) {
    ctx.log.error('transcription_failed', { source_item_id: sourceId, ...errorFields(error) });
    sources.markFailed(sourceId, message(error));
  }
}

export async function extractClaims(ctx: AppContext, sourceId: string): Promise<void> {
  const { sources } = ctx.repos;
  const source = sources.findById(sourceId);
  if (!source?.transcript_text) return;
  const transcript = source.transcript_text;
  const segments = sources.segments(sourceId);
  const started = Date.now();
  try {
    const raw = await ctx.providers.llm.extractClaims({ segments, creatorSpeaker: source.creator_speaker });
    const kept: Omit<Claim, 'embedding'>[] = [];
    const dropped: { quote: string; reason: string }[] = [];
    const seen = new Set<string>();

    for (const candidate of raw) {
      const segment = segments[candidate.segment];
      const location = segment && locateQuote(segment.text, candidate.quote);
      if (!segment || !location) {
        dropped.push({ quote: candidate.quote, reason: segment ? 'quote not found verbatim in segment' : 'segment does not exist' });
        continue;
      }
      const char_start = segment.char_start + location.start;
      const char_end = segment.char_start + location.end;
      const quote = transcript.slice(char_start, char_end);
      if (normalizeWs(quote) !== normalizeWs(candidate.quote)) {
        dropped.push({ quote: candidate.quote, reason: 'offset check failed' });
        continue;
      }
      const key = `${char_start}:${char_end}`;
      if (seen.has(key)) continue;
      seen.add(key);
      kept.push({
        id: uuidv7(),
        source_item_id: sourceId,
        text: candidate.text,
        quote,
        char_start,
        char_end,
        speaker: segment.speaker,
        is_creator: segment.speaker === source.creator_speaker,
        retired: false,
        retired_reason: null,
      });
    }

    const vectors = await ctx.providers.embeddings.embed(kept.map((k) => k.text));
    const claims = kept.map((k, i) => ({ ...k, embedding: vectors[i] }));
    const creatorClaims = claims.filter((c) => c.is_creator).length;
    sources.saveClaims(sourceId, claims, creatorClaims ? 'ready' : 'nothing_postable', {
      extracted: raw.length,
      kept: claims.length,
      creator_claims: creatorClaims,
      dropped,
    });
    ctx.log.info('claims_extracted', { source_item_id: sourceId, kept: claims.length, dropped: dropped.length, ms: Date.now() - started });
  } catch (error) {
    ctx.log.error('claim_extraction_failed', { source_item_id: sourceId, ...errorFields(error) });
    sources.markFailed(sourceId, `Claim extraction failed: ${message(error)}`);
  }
}
