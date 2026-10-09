/**
 * Three agents run on every draft after the gate, in order:
 *   Reviewer → Scorer → Decision.
 * The agents themselves live in the Python agents service (agents/creator_agents). This module decides
 * whether they run, hands each one the draft and a tool-bridge session scoped to this creator, checks
 * what comes back, verifies the Reviewer's fixes itself, and records every result on its own row.
 * Each agent's failure is recorded on its own row and does not stop the next one.
 */
import { z } from 'zod';
import type { AppContext } from '../../context.ts';
import { conflict, notFound } from '../../core/errors.ts';
import { errorFields } from '../../core/logger.ts';
import { nowIso, uuidv7 } from '../../domain/ids.ts';
import type { AgentName, AgentRun, AgentSettings, Run, TraceStep } from '../../domain/types.ts';
import { DecisionPrediction, ReviewSubmission, ScoreOutput, type AgentContext, type PriorOutputs, type ReviewOutput } from './agent.types.ts';
import type { BridgeSession } from './tool-bridge.ts';
import { draftView, loadAgentContext, ruleFacts, verifyPosts, voiceProfile } from './tools.ts';

export const AGENT_VERSIONS: Record<AgentName, string> = { reviewer: 'reviewer@1', scorer: 'scorer@1', decision: 'decision@1' };
const LOCAL_MODEL = 'local-rules@1';
/** Space out agent runs on hosted models so free-tier RPM limits are less likely to trip mid-run. */
const HOSTED_AGENT_GAP_MS = 2500;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function agentRow(rows: AgentRun[], agent: AgentName): AgentRun | undefined {
  return rows.find((r) => r.agent === agent);
}

function doneOutput<T>(row: AgentRun | undefined): T | null {
  return row?.status === 'done' && row.output != null ? (row.output as T) : null;
}

// ---------------------------------------------------------------- settings
export function agentSettings(ctx: AppContext): AgentSettings {
  return {
    agents_enabled: ctx.repos.settings.get('agents_enabled', true),
    show_recommendation: ctx.repos.settings.get('show_recommendation', false),
  };
}

export function saveAgentSettings(ctx: AppContext, patch: Partial<AgentSettings>): AgentSettings {
  if (patch.agents_enabled !== undefined) ctx.repos.settings.set('agents_enabled', patch.agents_enabled);
  if (patch.show_recommendation !== undefined) ctx.repos.settings.set('show_recommendation', patch.show_recommendation);
  return agentSettings(ctx);
}

// ---------------------------------------------------------------- orchestration
const modelFor = (ctx: AppContext, agent: AgentName) => (ctx.agentOverrides?.[agent] ? 'test' : ctx.config.agentsUseModel ? ctx.config.agentModel : LOCAL_MODEL);

/** One pass over a draft: the data every agent sees, sent once per agent, and the bridge session for its tools. */
interface Pass {
  agent: AgentContext;
  context: Record<string, unknown>;
  bridge: BridgeSession;
}

/** Runs one agent in the agents service and checks its output before anything is stored. */
async function remote<T>(ctx: AppContext, pass: Pass, name: AgentName, schema: z.ZodType<T>, trace: TraceStep[], prior?: PriorOutputs): Promise<T> {
  const result = await ctx.agents.service.run(name, {
    user_id: ctx.userId,
    run_id: pass.agent.run.id,
    use_model: ctx.config.agentsUseModel,
    model: ctx.config.agentModel,
    context: pass.context,
    prior: prior ? { reviewer: prior.reviewer, scorer: prior.scorer } : undefined,
    tools: { url: pass.bridge.url, token: pass.bridge.token },
  });
  trace.push(...result.trace);
  if (!result.ok) throw new Error(result.error);
  const parsed = schema.safeParse(result.output);
  if (!parsed.success) throw new Error(`The ${name} returned a result in the wrong shape.`);
  return parsed.data;
}

/** Runs one agent, recording its status, trace and timing. Returns null when it failed. */
async function runOne<T>(ctx: AppContext, runId: string, agent: AgentName, work: (trace: TraceStep[]) => Promise<T>): Promise<T | null> {
  const id = ctx.repos.agents.start({ id: uuidv7(), run_id: runId, agent, model: modelFor(ctx, agent), version: AGENT_VERSIONS[agent], started_at: nowIso() });
  const trace: TraceStep[] = [];
  const started = Date.now();
  try {
    const output = await work(trace);
    ctx.repos.agents.finish(id, { output, trace, ms: Date.now() - started, finished_at: nowIso() });
    ctx.log.info('agent_done', { run_id: runId, agent, ms: Date.now() - started, steps: trace.length });
    return output;
  } catch (error) {
    ctx.repos.agents.fail(id, { error: error instanceof Error ? error.message : String(error), trace, ms: Date.now() - started, finished_at: nowIso() });
    ctx.log.error('agent_failed', { run_id: runId, agent, ...errorFields(error) });
    return null;
  }
}

async function review(ctx: AppContext, pass: Pass, trace: TraceStep[]): Promise<ReviewOutput> {
  const override = ctx.agentOverrides?.reviewer;
  const submission = override ? await override(ctx, pass.agent, trace) : await remote(ctx, pass, 'reviewer', ReviewSubmission, trace);
  // never trust the agent's claim that its fixes pass: verify here, with the same checks the draft went through
  const verification = await verifyPosts(ctx, pass.agent, submission.revised_posts);
  const changed = submission.revised_posts.map((p) => p.trim()).join('\n\n') !== pass.agent.posts.join('\n\n');
  return { ...submission, changed, verification };
}

function score(ctx: AppContext, pass: Pass, trace: TraceStep[]) {
  const override = ctx.agentOverrides?.scorer;
  return override ? override(ctx, pass.agent, trace) : remote(ctx, pass, 'scorer', ScoreOutput, trace);
}

function predict(ctx: AppContext, pass: Pass, trace: TraceStep[], prior: PriorOutputs) {
  const override = ctx.agentOverrides?.decision;
  return override ? override(ctx, pass.agent, trace, prior) : remote(ctx, pass, 'decision', DecisionPrediction, trace, prior);
}

export async function runAgents(ctx: AppContext, runId: string): Promise<void> {
  if (!agentSettings(ctx).agents_enabled) return;
  const agent = loadAgentContext(ctx, runId);
  if (agent.draft.gate_status === 'gate_failed') return; // agents read check results; without them they would be guessing

  const context = { draft: draftView(agent), claims: agent.claims, posts: agent.posts, voice_profile: voiceProfile(ctx), rule_facts: ruleFacts(ctx, agent) };
  const bridge = await ctx.agents.bridge.open(ctx, agent);
  const pass: Pass = { agent, context, bridge };
  const existing = ctx.repos.agents.listForRun(runId);
  const hosted = ctx.config.agentsUseModel && ctx.providers.llm.name !== 'local';
  try {
    let reviewer = doneOutput<ReviewOutput>(agentRow(existing, 'reviewer'));
    if (!reviewer) {
      reviewer = await runOne(ctx, runId, 'reviewer', (trace) => review(ctx, pass, trace));
      if (hosted) await sleep(HOSTED_AGENT_GAP_MS);
    }

    let scorer = doneOutput<ScoreOutput>(agentRow(existing, 'scorer'));
    if (!scorer) {
      scorer = await runOne(ctx, runId, 'scorer', (trace) => score(ctx, pass, trace));
      if (hosted) await sleep(HOSTED_AGENT_GAP_MS);
    }

    if (!doneOutput(agentRow(existing, 'decision'))) {
      await runOne(ctx, runId, 'decision', (trace) => predict(ctx, pass, trace, { reviewer, scorer }));
    }
  } finally {
    bridge.close();
  }
}

export function enqueueAgents(ctx: AppContext, runId: string): void {
  ctx.jobs.enqueue('agents', () => runAgents(ctx, runId));
}

export function retryAgents(ctx: AppContext, runId: string) {
  const run = ctx.repos.runs.findById(runId);
  if (!run) throw notFound('Run');
  if (run.status !== 'in_review' && run.status !== 'decided') throw conflict('Agents run once the draft has passed through the checks.', { status: run.status });
  enqueueAgents(ctx, runId);
  return { run_id: runId, status: 'running' as const };
}

// ---------------------------------------------------------------- view
export type AgentView =
  | { status: 'running' | 'hidden' }
  | { status: 'running' | 'done' | 'failed'; output: unknown; trace: TraceStep[]; model: string; error: string | null; ms: number | null };

/**
 * Visibility follows the experiment: under context_only nothing is shown before the decision (the review
 * would reveal the checks). The Decision agent's prediction is hidden before the creator decides unless
 * show_recommendation is on, so it cannot anchor the decision it is compared against.
 */
export function agentView(ctx: AppContext, run: Run, decided: boolean): Partial<Record<AgentName, AgentView>> {
  const { show_recommendation } = agentSettings(ctx);
  const view: Partial<Record<AgentName, AgentView>> = {};
  for (const r of ctx.repos.agents.listForRun(run.id)) {
    const visible = decided || (run.condition === 'gate' && (r.agent !== 'decision' || show_recommendation));
    view[r.agent] = visible
      ? { status: r.status, output: r.output, trace: r.trace, model: r.model, error: r.error, ms: r.ms }
      : { status: r.status === 'running' ? 'running' : 'hidden' };
  }
  return view;
}

/** Maps a creator decision to the Decision agent's vocabulary, for agreement metrics. */
export const predictionLabel = (decision: string): 'accept' | 'edit' | 'reject' => (decision === 'reject' ? 'reject' : decision === 'accept' ? 'accept' : 'edit');
