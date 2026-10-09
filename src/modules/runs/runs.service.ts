/** FR-004 runs: create, list, retry, and the blinded review view. */
import type { AppContext } from '../../context.ts';
import { conflict, notFound, unprocessable } from '../../core/errors.ts';
import { nowIso, uuidv7 } from '../../domain/ids.ts';
import type { AngleChoice, Run } from '../../domain/types.ts';
import { PROMPT_VERSIONS } from '../../prompts/index.ts';
import { AGENT_VERSIONS, agentSettings, agentView } from '../agents/agents.service.ts';
import { hasChecks } from '../agents/tools.ts';
import { isBlocking } from '../checks/gate.ts';
import { groupPosts } from '../checks/sentence-mapping.ts';
import { getAngles } from '../sources/angles.service.ts';
import { assignCondition } from './condition.ts';
import { enqueueGeneration, regateDraft } from './generation.ts';
import type { CreateRunInput } from './runs.schemas.ts';

const DEFAULT_EXPERIMENT_SEED = 7;

function requireRun(ctx: AppContext, id: string): Run {
  const run = ctx.repos.runs.findById(id);
  if (!run) throw notFound('Run');
  return run;
}

/** Picks the claims to draft from: the creator's choice, or the top proposed angle. */
async function resolveAngle(ctx: AppContext, input: CreateRunInput): Promise<{ claimIds: string[]; choice: AngleChoice }> {
  const custom = input.angle_choice === 'custom' || Boolean(input.custom_angle?.trim());
  if (input.angle_claim_ids.length) return { claimIds: input.angle_claim_ids, choice: custom ? 'custom' : 'picked' };
  const [first] = await getAngles(ctx, input.source_item_id);
  if (!first) throw conflict('No angle could be proposed for this source.');
  return { claimIds: first.claim_ids, choice: custom ? 'custom' : 'auto_angle' };
}

export async function createRun(ctx: AppContext, input: CreateRunInput) {
  const source = ctx.repos.sources.findById(input.source_item_id);
  if (!source) throw notFound('Source');
  if (source.status !== 'ready') throw conflict('This source has no verified claims to draft from yet.', { status: source.status });

  const { claimIds, choice } = await resolveAngle(ctx, input);
  const claims = ctx.repos.sources.claimsByIds(claimIds);
  if (claims.length !== claimIds.length || claims.some((c) => c.source_item_id !== input.source_item_id)) {
    throw unprocessable('Every angle claim must come from this source.');
  }
  if (!claims[0].is_creator) throw unprocessable('The lead claim must be something you said, not another speaker.');

  const seedBase = ctx.repos.settings.get('experiment_seed', DEFAULT_EXPERIMENT_SEED);
  const { condition, seed } = assignCondition(ctx.repos.runs.count(), seedBase, ctx.config.forcedCondition);
  const { llm, embeddings } = ctx.providers;
  const run = {
    id: uuidv7(),
    source_item_id: input.source_item_id,
    condition,
    seed,
    memory_enabled: input.memory_enabled,
    format: input.format,
    angle_choice: choice,
    angle_claim_ids: claimIds,
    custom_angle: input.custom_angle?.trim() || null,
    status: 'generating' as const,
    model_versions: {
      llm: llm.name,
      ...llm.models,
      embeddings: embeddings.name,
      prompts: PROMPT_VERSIONS,
      agents: agentSettings(ctx).agents_enabled ? AGENT_VERSIONS : null,
    },
    created_at: nowIso(),
  };
  ctx.repos.runs.insert(run);
  enqueueGeneration(ctx, run.id);
  return { run_id: run.id, status: run.status };
}

export async function retryRun(ctx: AppContext, id: string) {
  const run = requireRun(ctx, id);
  if (run.status === 'failed') {
    ctx.db.transaction(() => {
      ctx.repos.drafts.deleteForRun(id);
      ctx.repos.runs.setStatus(id, 'generating');
    });
    enqueueGeneration(ctx, id);
    return { run_id: id, status: 'generating' as const };
  }
  if (run.status !== 'gate_failed') throw conflict('Only failed runs can be retried.', { status: run.status });
  return { run_id: id, status: await regateDraft(ctx, run) };
}

export const listRuns = (ctx: AppContext) => ctx.repos.runs.list();

/**
 * The review payload. Blinding rules (FR-008):
 * - the condition and model versions are withheld until the first decision;
 * - under context_only, check results are withheld until the first decision.
 */
export function getRun(ctx: AppContext, id: string) {
  const run = requireRun(ctx, id);
  const { drafts, decisions: decisionsRepo, sources } = ctx.repos;
  const draft = drafts.findByRunId(id);
  const decisions = draft ? decisionsRepo.listForDraft(draft.id) : [];
  const decided = decisions.length > 0;
  const checksVisible = decided || run.condition === 'gate';
  const source = sources.findById(run.source_item_id);
  const segments = sources.segments(run.source_item_id).map(({ source_item_id: _s, text: _t, ...segment }) => segment);
  const claims = sources.claims(run.source_item_id).map(({ id, text, speaker, is_creator, char_start, char_end, quote }) => ({ id, text, speaker, is_creator, char_start, char_end, quote }));

  let draftView = null;
  if (draft) {
    const overridden = new Set(decisions.flatMap((d) => d.overrides).flatMap((o) => (o.sentence_id ? [o.sentence_id] : [])));
    const latest = decisions.at(-1);
    draftView = {
      id: draft.id,
      gate_status: checksVisible || draft.gate_status === 'gate_failed' ? draft.gate_status : ('hidden' as const),
      gate_error: draft.gate_error,
      generated_text: draft.generated_text,
      voice: checksVisible ? draft.voice_score : null,
      posts: groupPosts(drafts.sentences(draft.id)).map((sentences, i) => ({
        position: i + 1,
        text: sentences.map((s) => s.text).join(' '),
        sentences: sentences.map((s) => ({
          id: s.id,
          text: s.text,
          type: s.type,
          supports: s.supports,
          checks: checksVisible ? s.checks : null,
          blocking: run.condition === 'gate' && hasChecks(s.checks) && isBlocking(s.checks) && !overridden.has(s.id),
        })),
      })),
      confirmed: Boolean(draft.confirmed_hash) && draft.confirmed_hash === latest?.text_hash,
      confirmed_at: draft.confirmed_at,
      posted_at: draft.posted_at,
      posted_url: draft.posted_url,
      note: draft.note,
    };
  }

  return {
    run_id: run.id,
    status: run.status,
    error: run.error,
    format: run.format,
    memory_enabled: run.memory_enabled,
    angle_choice: run.angle_choice,
    custom_angle: run.custom_angle,
    angle_claim_ids: run.angle_claim_ids,
    condition: decided ? run.condition : null,
    checks_visible: checksVisible,
    enforce_flags: run.condition === 'gate' && !decided,
    created_at: run.created_at,
    ready_at: run.ready_at,
    model_versions: decided ? run.model_versions : null,
    source: source
      ? { id: source.id, title: source.title, kind: source.kind, transcript_text: source.transcript_text, creator_speaker: source.creator_speaker, segments }
      : null,
    claims,
    draft: draftView,
    agents: draft ? agentView(ctx, run, decided) : {},
    agent_settings: agentSettings(ctx),
    decisions,
  };
}
