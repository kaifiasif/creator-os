/** FR-004: draft generation and the gate pass that follows it. Runs as a background job per run. */
import type { AppContext } from '../../context.ts';
import { errorFields } from '../../core/logger.ts';
import { nowIso, uuidv7 } from '../../domain/ids.ts';
import { centroid, cosine } from '../../domain/stats.ts';
import { packSentences, X_LIMIT, xLength } from '../../domain/text.ts';
import type { Claim, DraftFormat, DraftSentence, Run, StoredChecks } from '../../domain/types.ts';
import { generateDraftPrompt } from '../../prompts/index.ts';
import type { DraftPost } from '../../providers/llm.types.ts';
import { voiceSummary } from '../archive/voice-reference.ts';
import { enqueueAgents } from '../agents/agents.service.ts';
import { runGate, type GateResult } from '../checks/gate.ts';
import { postTexts } from '../checks/sentence-mapping.ts';

const EXAMPLE_COUNT = 5;

/** Splits over-limit posts once (by rule, not by the model). Anything still over is left for the channel check to flag. */
export function enforceLength(posts: DraftPost[], format: DraftFormat): DraftPost[] {
  if (format === 'post') return [{ sentences: posts.flatMap((p) => p.sentences) }];
  return posts.flatMap((p) => {
    const text = p.sentences.map((s) => s.text).join(' ');
    return xLength(text) <= X_LIMIT ? [p] : packSentences(p.sentences).map((sentences) => ({ sentences }));
  });
}

/** The context_only condition shows the model the creator's nearest earlier posts instead of rules. */
function nearestExamples(ctx: AppContext, claims: Claim[]) {
  const centre = centroid(claims.map((c) => c.embedding));
  return ctx.repos.archive
    .referencePieces()
    .map((p) => ({ id: p.id, text: p.text, similarity: cosine(centre, p.embedding) }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, EXAMPLE_COUNT);
}

const gateOutcome = (gate: GateResult) => ({
  runStatus: gate.status === 'gate_failed' ? ('gate_failed' as const) : ('in_review' as const),
  runError: gate.error ? `Gate failed: ${gate.error}` : null,
  draftPatch: { gate_status: gate.status, gate_error: gate.error, voice_score: gate.voice ? { ...gate.voice, channel: gate.channel } : { channel: gate.channel } },
});

const storedChecks = (gate: GateResult, sentenceId: string): StoredChecks => gate.checks.get(sentenceId) ?? { error: 'not checked' };

export async function generate(ctx: AppContext, runId: string): Promise<void> {
  const { runs, drafts, sources } = ctx.repos;
  const run = runs.findById(runId);
  if (!run) return;
  const started = Date.now();
  try {
    const claims = sources.claimsByIds(run.angle_claim_ids);
    const examples = run.condition === 'context_only' ? nearestExamples(ctx, claims) : [];
    const request = {
      claims,
      leadClaimId: claims[0].id,
      format: run.format,
      condition: run.condition,
      voiceSummary: run.condition === 'gate' ? voiceSummary(ctx) : null,
      examples,
      customAngle: run.custom_angle,
    };
    const posts = enforceLength(await ctx.providers.llm.generateDraft({ ...request, prompt: generateDraftPrompt(request) }), run.format);

    const draftId = uuidv7();
    const rows: Omit<DraftSentence, 'checks'>[] = posts.flatMap((p, pi) =>
      p.sentences.map((s, si) => ({ id: uuidv7(), draft_id: draftId, post_position: pi + 1, position: si + 1, text: s.text.trim(), type: s.type, supports: s.supports })),
    );
    runs.setPromptArchiveIds(runId, examples.map((e) => e.id));

    const gate = await runGate(ctx, { sourceItemId: run.source_item_id, sentences: rows.map((r) => ({ key: r.id, ...r })), posts: postTexts(rows), memoryEnabled: run.memory_enabled });
    const outcome = gateOutcome(gate);
    ctx.db.transaction(() => {
      drafts.insert(
        { id: draftId, run_id: runId, generated_text: postTexts(rows).join('\n\n'), ...outcome.draftPatch, created_at: nowIso() },
        rows.map((r) => ({ ...r, checks: storedChecks(gate, r.id) })),
      );
      runs.markReady(runId, outcome.runStatus, outcome.runError, nowIso());
    });
    ctx.log.info('run_ready', { run_id: runId, gate: gate.status, ms: Date.now() - started });
    if (gate.status !== 'gate_failed') enqueueAgents(ctx, runId);
  } catch (error) {
    ctx.log.error('run_failed', { run_id: runId, step: 'generate', ...errorFields(error) });
    runs.setStatus(runId, 'failed', error instanceof Error ? error.message : String(error));
  }
}

export function enqueueGeneration(ctx: AppContext, runId: string): void {
  ctx.jobs.enqueue('generate', () => generate(ctx, runId));
}

/** Re-runs the gate on an existing draft, e.g. after the embeddings provider was down. */
export async function regateDraft(ctx: AppContext, run: Run): Promise<'gate_failed' | 'in_review'> {
  const draft = ctx.repos.drafts.findByRunId(run.id);
  if (!draft) throw new Error(`Run ${run.id} has no draft to re-check.`);
  const rows = ctx.repos.drafts.sentences(draft.id);
  const gate = await runGate(ctx, { sourceItemId: run.source_item_id, sentences: rows.map((r) => ({ key: r.id, ...r })), posts: postTexts(rows), memoryEnabled: run.memory_enabled });
  const outcome = gateOutcome(gate);
  ctx.db.transaction(() => {
    ctx.repos.drafts.saveGateResult(draft.id, outcome.draftPatch, new Map(rows.map((r) => [r.id, storedChecks(gate, r.id)])));
    ctx.repos.runs.setStatus(run.id, outcome.runStatus, outcome.runError);
  });
  if (gate.status !== 'gate_failed') enqueueAgents(ctx, run.id);
  return outcome.runStatus;
}
