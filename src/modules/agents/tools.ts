/**
 * What the agents see of a draft, and the tools that need the creator's data. All read-only: agents
 * inspect and verify, they never change a draft or decide. The agents themselves run in the Python
 * service (agents/); this module prepares their input and answers their tool calls.
 */
import { z } from 'zod';
import type { AppContext } from '../../context.ts';
import { notFound } from '../../core/errors.ts';
import { cosine, round } from '../../domain/stats.ts';
import type { SentenceChecks, StoredChecks, VoiceScore } from '../../domain/types.ts';
import { repetitionThreshold } from '../archive/archive.service.ts';
import { getVoiceReference, voiceSummary } from '../archive/voice-reference.ts';
import { isBlocking, runGate } from '../checks/gate.ts';
import { mapFinalSentences, postTexts } from '../checks/sentence-mapping.ts';
import type { CheckableSentence } from '../checks/traceability.ts';
import type { AgentContext, Verification } from './agent.types.ts';

export function loadAgentContext(ctx: AppContext, runId: string): AgentContext {
  const run = ctx.repos.runs.findById(runId);
  const draft = ctx.repos.drafts.findByRunId(runId);
  if (!run || !draft) throw notFound('Draft');
  const rows = ctx.repos.drafts.sentences(draft.id);
  const claims = ctx.repos.sources.claims(run.source_item_id).map(({ id, text, speaker, is_creator, quote }) => ({ id, text, speaker, is_creator, quote }));
  return { run, draft, rows, claims, posts: postTexts(rows) };
}

export const hasChecks = (c: StoredChecks | undefined | null): c is SentenceChecks => Boolean(c && 'traceability' in c);

export interface CheckSummary {
  traceability: SentenceChecks['traceability']['status'];
  reason: string;
  repeat: { severity: 'normal' | 'high' | null; similarity?: number; published_at?: string; earlier?: string } | null;
  voice: string[];
  blocking: boolean;
}

/** A compact view of one sentence's checks: what an agent (or a person) needs to act on it. */
export function summarizeChecks(c: StoredChecks | undefined | null): CheckSummary | null {
  if (!hasChecks(c)) return null;
  const top = c.repetition.matches[0];
  return {
    traceability: c.traceability.status,
    reason: c.traceability.reason,
    repeat: c.repetition.flag ? { severity: c.repetition.severity, similarity: top?.similarity, published_at: top?.published_at, earlier: top?.text } : null,
    voice: c.voice?.flag ? c.voice.features.map((f) => f.feature) : [],
    blocking: isBlocking(c),
  };
}

const gateFor = (ctx: AppContext, agent: AgentContext, sentences: CheckableSentence[], posts: string[]) =>
  runGate(ctx, { sourceItemId: agent.run.source_item_id, sentences, posts, memoryEnabled: agent.run.memory_enabled });

/** Deterministic verification of a candidate version, used by the Reviewer's tool and by the server after it submits. */
export async function verifyPosts(ctx: AppContext, agent: AgentContext, posts: string[]): Promise<Verification> {
  const clean = posts.map((p) => p.trim()).filter(Boolean);
  if (!clean.length) return { blocking: 0, sentences: [], channel: [], empty: true };
  const mapped = mapFinalSentences(clean, agent.rows);
  const gate = await gateFor(ctx, agent, mapped, clean);
  if (gate.status === 'gate_failed') return { gate_failed: true, error: gate.error };
  const sentences = mapped.map((m) => ({ text: m.text, ...summarizeChecks(gate.checks.get(m.key)) }));
  const channel = gate.channel.filter((c) => !c.ok);
  return { blocking: sentences.filter((s) => s.blocking).length + channel.length, sentences, channel };
}

const voiceOf = (v: VoiceScore | null | undefined) =>
  v && !v.skipped ? { centroid_distance: v.centroid_distance, beyond_p90: v.beyond_p90, z_scores: v.z_scores } : null;

/** What get_draft returns: posts, sentences with ids, cited claim ids and each sentence's check results. */
export function draftView(agent: AgentContext) {
  const score = agent.draft.voice_score;
  return {
    gate_status: agent.draft.gate_status,
    voice: score && 'skipped' in score ? voiceOf(score) : null,
    channel: score?.channel ?? [],
    posts: agent.posts.map((_, i) => ({
      position: i + 1,
      sentences: agent.rows
        .filter((s) => s.post_position === i + 1)
        .map((s) => ({ id: s.id, text: s.text, type: s.type, supports: s.supports, checks: summarizeChecks(s.checks) })),
    })),
  };
}

/** What voice_profile returns: statistics of the creator's writing, no archive text. */
export function voiceProfile(ctx: AppContext) {
  const ref = getVoiceReference(ctx);
  return { ...voiceSummary(ctx), sentence_words_sd: ref.empty ? null : round(ref.sentStats.words.std, 1) };
}

/** The measured facts the Scorer's rule dimensions are computed from, one entry per sentence. */
export function ruleFacts(ctx: AppContext, agent: AgentContext) {
  const score = agent.draft.voice_score;
  return {
    sentences: agent.rows.map((r) =>
      hasChecks(r.checks)
        ? {
            type: r.checks.traceability.type,
            status: r.checks.traceability.status,
            top_similarity: r.checks.repetition.matches[0]?.similarity ?? null,
            repeat_flag: r.checks.repetition.flag,
            voice_flag: Boolean(r.checks.voice?.flag),
          }
        : null,
    ),
    voice_score: score && 'skipped' in score ? score : null,
    repetition_threshold: repetitionThreshold(ctx),
  };
}

/**
 * The tools that need the creator's data, served to the agents service through the tool bridge.
 * Inputs are validated here again: the bridge treats whatever the agents service sends as untrusted.
 */
export const BridgeInputs = {
  search_archive: z.object({ text: z.string().min(1).max(5000), k: z.number().int().min(1).max(5).default(3) }),
  check_sentence: z.object({
    text: z.string().min(1).max(2000),
    supports: z.array(z.string().max(100)).max(20).default([]),
    type: z.enum(['assertion', 'connective']).default('assertion'),
  }),
  check_posts: z.object({ posts: z.array(z.string().max(2000)).max(25) }),
} as const;
export type BridgeTool = keyof typeof BridgeInputs;

export async function runBridgeTool(ctx: AppContext, agent: AgentContext, tool: BridgeTool, input: unknown): Promise<unknown> {
  switch (tool) {
    case 'search_archive': {
      const { text, k } = BridgeInputs.search_archive.parse(input);
      const [vec] = await ctx.providers.embeddings.embed([text]);
      return ctx.repos.archive
        .referencePieces()
        .map((p) => ({ text: p.text, published_at: p.published_at, retired: p.retired, similarity: round(cosine(vec, p.embedding), 3) }))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, k);
    }
    case 'check_sentence': {
      const { text, supports, type } = BridgeInputs.check_sentence.parse(input);
      const gate = await gateFor(ctx, agent, [{ key: 'c', text, type, supports }], [text]);
      if (gate.status === 'gate_failed') throw new Error(`Checks could not run: ${gate.error}`);
      const checks = gate.checks.get('c');
      return { passes: Boolean(checks) && !isBlocking(checks!), ...summarizeChecks(checks) };
    }
    case 'check_posts':
      return verifyPosts(ctx, agent, BridgeInputs.check_posts.parse(input).posts);
  }
}
