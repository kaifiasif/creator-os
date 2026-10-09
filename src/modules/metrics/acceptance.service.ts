/** FR-009: acceptance by condition, memory and week; flag behaviour; agent agreement. Locked while drafts await a decision. */
import type { AppContext } from '../../context.ts';
import { conflict, ErrorCode } from '../../core/errors.ts';
import { isoWeek, mean, rate as shareOf, wilson } from '../../domain/stats.ts';
import type { Decision, Outcome, Run } from '../../domain/types.ts';
import type { DecisionPrediction, ReviewOutput, ScoreOutput } from '../agents/agent.types.ts';
import { predictionLabel } from '../agents/agents.service.ts';
import { hasChecks } from '../agents/tools.ts';
import { MIN_PIECES } from '../archive/archive.service.ts';
import { isBlocking } from '../checks/gate.ts';
import { classifyOutcome, latestAccept } from '../decisions/outcome.ts';

interface DecidedRun {
  run: Run;
  decisions: Decision[];
  first: Decision;
  sentences: { id: string; text: string; blocking: boolean; flag: string | null; voiceFlag: boolean }[];
  agents: { reviewer?: ReviewOutput; scorer?: ScoreOutput; decision?: DecisionPrediction };
  outcome: Outcome;
  posted: boolean;
}

function decidedRuns(ctx: AppContext): DecidedRun[] {
  const { runs, drafts, decisions, agents } = ctx.repos;
  return runs.withDrafts().flatMap((run) => {
    const draft = drafts.findByRunId(run.id);
    if (!draft) return [];
    const list = decisions.listForDraft(draft.id);
    const first = list[0];
    if (!first) return [];
    const sentences = drafts.sentences(draft.id).map((s) => {
      const checked = hasChecks(s.checks) ? s.checks : null;
      return {
        id: s.id,
        text: s.text,
        blocking: checked ? isBlocking(checked) : false,
        flag: checked ? (checked.repetition.flag ? 'repeat' : checked.traceability.status) : null,
        voiceFlag: Boolean(checked?.voice?.flag),
      };
    });
    return [{ run, decisions: list, first, sentences, agents: agents.outputs(run.id) as DecidedRun['agents'], outcome: classifyOutcome(draft, list), posted: Boolean(draft.posted_at) }];
  });
}

const lightRate = (rows: DecidedRun[]) => {
  const k = rows.filter((r) => r.outcome === 'light_accept').length;
  return { n: rows.length, light_edit: k, rate: shareOf(k, rows.length), ci95: wilson(k, rows.length) };
};

const agreement = (rows: DecidedRun[]) => {
  const k = rows.filter((r) => r.agents.decision?.recommendation === predictionLabel(r.first.decision)).length;
  return { n: rows.length, agree: k, rate: shareOf(k, rows.length), ci95: wilson(k, rows.length) };
};

const rejectRate = (rows: DecidedRun[]) => shareOf(rows.filter((r) => r.first.decision === 'reject').length, rows.length);
const meanOrNull = (xs: number[]) => (xs.length ? Math.round(mean(xs) * 10) / 10 : null);

function countBy<T>(items: T[], key: (item: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) counts[key(item)] = (counts[key(item)] ?? 0) + 1;
  return counts;
}

function flagStats(rows: DecidedRun[]) {
  let shown = 0;
  let overriddenCount = 0;
  let ledToEdit = 0;
  const log: { run_id: string; sentence: string; reason: string; flag: string | null }[] = [];
  for (const r of rows.filter((x) => x.run.condition === 'gate')) {
    const finalText = latestAccept(r.decisions)?.final_text ?? '';
    const accepted = Boolean(latestAccept(r.decisions));
    const overrides = new Map(r.decisions.flatMap((d) => d.overrides).flatMap((o) => (o.sentence_id ? [[o.sentence_id, o.reason] as const] : [])));
    for (const s of r.sentences.filter((x) => x.blocking)) {
      shown++;
      const reason = overrides.get(s.id);
      if (reason) {
        overriddenCount++;
        log.push({ run_id: r.run.id, sentence: s.text, reason, flag: s.flag });
      } else if (accepted && !finalText.includes(s.text)) ledToEdit++;
    }
  }
  return { shown, overridden: overriddenCount, led_to_edit: ledToEdit, override_log: log };
}

function agentStats(rows: DecidedRun[]) {
  const predicted = rows.filter((r) => r.agents.decision);
  const accepted = rows.filter((r) => r.decisions.some((d) => d.decision !== 'reject'));
  const usedReviewer = accepted.filter((r) => r.decisions.some((d) => d.assist === 'reviewer'));
  const scored = rows.filter((r) => r.agents.scorer);
  return {
    decision: {
      ...agreement(predicted),
      by_condition: { gate: agreement(predicted.filter((r) => r.run.condition === 'gate')), context_only: agreement(predicted.filter((r) => r.run.condition === 'context_only')) },
      confusion: countBy(predicted, (r) => `${r.agents.decision!.recommendation}->${predictionLabel(r.first.decision)}`),
    },
    reviewer: {
      runs_with_fixes: rows.filter((r) => r.agents.reviewer?.changed).length,
      used: usedReviewer.length,
      light_rate_when_used: lightRate(usedReviewer).rate,
      light_rate_when_not_used: lightRate(accepted.filter((r) => !usedReviewer.includes(r))).rate,
    },
    scorer: {
      n: scored.length,
      mean_overall_light_accept: meanOrNull(scored.filter((r) => r.outcome === 'light_accept').map((r) => r.agents.scorer!.overall)),
      mean_overall_other: meanOrNull(scored.filter((r) => r.outcome !== 'light_accept').map((r) => r.agents.scorer!.overall)),
    },
  };
}

function tableRow(r: DecidedRun) {
  const accepted = latestAccept(r.decisions);
  return {
    run_id: r.run.id,
    created_at: r.run.created_at,
    condition: r.run.condition,
    memory_enabled: r.run.memory_enabled,
    format: r.run.format,
    angle_choice: r.run.angle_choice,
    decision: r.first.decision,
    reject_reason: r.first.reject_reason,
    edit_ratio: accepted?.edit_ratio ?? null,
    claim_set_changed: accepted ? Boolean(accepted.claim_set_changed) : null,
    time_to_decision_s: r.first.time_to_decision_ms !== null ? Math.round(r.first.time_to_decision_ms / 1000) : null,
    flags_shown: r.run.condition === 'gate' ? r.sentences.filter((s) => s.blocking).length : 0,
    overrides: r.decisions.flatMap((d) => d.overrides).length,
    outcome: r.outcome,
    posted: r.posted,
    agent_prediction: r.agents.decision?.recommendation ?? null,
    agent_score: r.agents.scorer?.overall ?? null,
    used_reviewer: r.decisions.some((d) => d.assist === 'reviewer'),
  };
}
export type AcceptanceRow = ReturnType<typeof tableRow>;

const LOCK_REASON = 'Decide on every draft in review before opening the numbers, so they cannot anchor your judgment.';

export function acceptance(ctx: AppContext) {
  const pending = ctx.repos.runs.awaitingFirstDecision();
  if (pending.length) return { locked: true as const, reason: LOCK_REASON, pending_runs: pending };

  const rows = decidedRuns(ctx);
  const byWeek = new Map<string, DecidedRun[]>();
  for (const r of rows) {
    const week = isoWeek(new Date(r.first.decided_at));
    byWeek.set(week, [...(byWeek.get(week) ?? []), r]);
  }
  const rejected = rows.filter((r) => r.first.decision === 'reject');
  const voiceFlagged = rows.filter((r) => r.sentences.some((s) => s.voiceFlag));
  const condition = (c: Run['condition']) => (r: DecidedRun) => r.run.condition === c;

  return {
    locked: false as const,
    agents: agentStats(rows),
    below_prerequisite: ctx.repos.archive.count() < MIN_PIECES,
    runs: rows.length,
    by_condition: { gate: lightRate(rows.filter(condition('gate'))), context_only: lightRate(rows.filter(condition('context_only'))) },
    by_memory: { on: lightRate(rows.filter((r) => r.run.memory_enabled)), off: lightRate(rows.filter((r) => !r.run.memory_enabled)) },
    by_week: [...byWeek.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, rs]) => ({ week, n: rs.length, rate: lightRate(rs).rate, gate: lightRate(rs.filter(condition('gate'))).rate, context_only: lightRate(rs.filter(condition('context_only'))).rate })),
    rejections: {
      total: rejected.length,
      fixed: rejected.filter((r) => r.outcome === 'rejected_fixed').length,
      abandoned: rejected.filter((r) => r.outcome === 'abandoned').length,
      pending: rejected.filter((r) => r.outcome === 'rejected_pending').length,
      reasons: countBy(rejected, (r) => r.first.reject_reason ?? 'other'),
    },
    flags: flagStats(rows),
    voice_flag_signal: { reject_rate_when_flagged: rejectRate(voiceFlagged), reject_rate_when_clean: rejectRate(rows.filter((r) => !voiceFlagged.includes(r))) },
    table: rows.map(tableRow),
  };
}

const CSV_COLUMNS: (keyof AcceptanceRow)[] = [
  'run_id', 'created_at', 'condition', 'memory_enabled', 'format', 'angle_choice', 'decision', 'reject_reason', 'edit_ratio', 'claim_set_changed',
  'time_to_decision_s', 'flags_shown', 'overrides', 'outcome', 'posted', 'agent_prediction', 'agent_score', 'used_reviewer',
];

const csvCell = (v: unknown) => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function exportCsv(ctx: AppContext): string {
  const result = acceptance(ctx);
  if (result.locked) throw conflict(result.reason, { pending_runs: result.pending_runs }, ErrorCode.METRICS_LOCKED);
  return [CSV_COLUMNS.join(','), ...result.table.map((row) => CSV_COLUMNS.map((c) => csvCell(row[c])).join(','))].join('\n');
}
