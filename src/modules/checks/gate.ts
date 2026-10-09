/**
 * FR-005 pre-review gate. Traceability, repetition and channel rules fail closed: if they cannot
 * run, the draft cannot be accepted. Voice is advisory and is skipped with a visible notice.
 */
import type { AppContext } from '../../context.ts';
import { errorFields } from '../../core/logger.ts';
import type { ChannelResult, SentenceChecks, VoiceScore } from '../../domain/types.ts';
import { repetitionThreshold } from '../archive/archive.service.ts';
import { getVoiceReference, sentenceVoiceFlags } from '../archive/voice-reference.ts';
import { checkChannel } from './channel.ts';
import { checkRepetition } from './repetition.ts';
import { checkTraceability, type CheckableSentence } from './traceability.ts';
import { draftVoiceScore } from './voice-score.ts';

export interface GateInput {
  sourceItemId: string;
  sentences: CheckableSentence[];
  posts: string[];
  memoryEnabled: boolean;
}

export type GateResult =
  | { status: 'clean' | 'flagged'; error: null; checks: Map<string, SentenceChecks>; channel: ChannelResult[]; voice: VoiceScore }
  | { status: 'gate_failed'; error: string; checks: Map<string, SentenceChecks>; channel: ChannelResult[]; voice: null };

export const isBlocking = (c: SentenceChecks): boolean => c.traceability.status !== 'supported' || c.repetition.flag;

const NOT_CHECKED = { flag: false, severity: null, matches: [], retired_match: null } as const;

export async function runGate(ctx: AppContext, input: GateInput): Promise<GateResult> {
  const { sources, archive } = ctx.repos;
  const source = sources.findById(input.sourceItemId);
  const claims = sources.claims(input.sourceItemId);
  const trace = { transcript: source?.transcript_text ?? '', claimsById: new Map(claims.map((c) => [c.id, c])) };
  const checks = new Map<string, SentenceChecks>();

  let vectors: Float32Array[];
  try {
    const threshold = repetitionThreshold(ctx);
    const index = { chunks: archive.referenceChunks(), pieces: archive.referencePieces() };
    const retired = archive.retiredAngles();
    vectors = await ctx.providers.embeddings.embed([...input.sentences.map((s) => s.text), input.posts.join('\n\n')]);
    for (const [i, s] of input.sentences.entries()) {
      const traceability = await checkTraceability(s, trace, ctx.providers.llm);
      const repetition = traceability.type === 'assertion' ? checkRepetition(vectors[i], index, retired, { threshold, memoryEnabled: input.memoryEnabled }) : { ...NOT_CHECKED, matches: [] };
      checks.set(s.key, { traceability, repetition });
    }
  } catch (error) {
    ctx.log.warn('gate_failed', { source_item_id: input.sourceItemId, ...errorFields(error) });
    return { status: 'gate_failed', error: error instanceof Error ? error.message : String(error), checks, channel: [], voice: null };
  }

  const channel = checkChannel(input.posts);
  let voice: VoiceScore;
  try {
    const ref = getVoiceReference(ctx);
    for (const s of input.sentences) {
      const features = sentenceVoiceFlags(s.text, ref);
      const c = checks.get(s.key);
      if (c) c.voice = { flag: features.length > 0, features };
    }
    voice = draftVoiceScore(ref, input.posts.join('\n\n'), vectors[vectors.length - 1]);
  } catch (error) {
    // voice is advisory: say it was skipped rather than fail the whole gate
    ctx.log.warn('voice_check_skipped', errorFields(error));
    voice = { skipped: true, notice: `Voice check could not run: ${error instanceof Error ? error.message : String(error)}` };
    for (const c of checks.values()) c.voice = { flag: false, features: [], skipped: true };
  }

  const blocking = [...checks.values()].some(isBlocking) || channel.some((c) => !c.ok);
  return { status: blocking ? 'flagged' : 'clean', error: null, checks, channel, voice };
}
