import type { AgentName, AgentRun, AgentStatus, TraceStep } from '../../domain/types.ts';
import type { Database, RawRow } from '../client.ts';
import { json } from '../codec.ts';

const toAgentRun = (r: RawRow): AgentRun => ({
  id: String(r.id),
  run_id: String(r.run_id),
  agent: r.agent as AgentName,
  status: r.status as AgentStatus,
  output: json.decodeNullable<unknown>(r.output),
  trace: json.decode<TraceStep[]>(r.trace),
  model: String(r.model),
  version: String(r.version),
  error: (r.error as string | null) ?? null,
  ms: (r.ms as number | null) ?? null,
  started_at: String(r.started_at),
  finished_at: (r.finished_at as string | null) ?? null,
});

/** Agent runs belong to whoever owns their run. */
export function createAgentsRepository(db: Database, userId: string) {
  const ownedRun = (column: string) => `${column} IN (SELECT id FROM runs WHERE user_id = ?)`;
  return {
    /** One row per (run, agent). Re-running an agent resets its row instead of adding another. */
    start(row: { id: string; run_id: string; agent: AgentName; model: string; version: string; started_at: string }): string {
      if (!db.get(`SELECT 1 WHERE ${ownedRun('?')}`, row.run_id, userId)) throw new Error('Agent run for a run this creator does not own.');
      const existing = db.get<{ id: string }>('SELECT id FROM agent_runs WHERE run_id = ? AND agent = ?', row.run_id, row.agent);
      if (existing) {
        db.run(
          "UPDATE agent_runs SET status = 'running', output = NULL, trace = '[]', error = NULL, ms = NULL, model = ?, version = ?, started_at = ?, finished_at = NULL WHERE id = ?",
          row.model, row.version, row.started_at, existing.id,
        );
        return existing.id;
      }
      db.run(
        "INSERT INTO agent_runs (id, run_id, agent, status, model, version, started_at) VALUES (?, ?, ?, 'running', ?, ?, ?)",
        row.id, row.run_id, row.agent, row.model, row.version, row.started_at,
      );
      return row.id;
    },

    finish(id: string, result: { output: unknown; trace: TraceStep[]; ms: number; finished_at: string }): void {
      db.run(
        `UPDATE agent_runs SET status = 'done', output = ?, trace = ?, ms = ?, finished_at = ? WHERE id = ? AND ${ownedRun('run_id')}`,
        json.encode(result.output), json.encode(result.trace), result.ms, result.finished_at, id, userId,
      );
    },

    fail(id: string, result: { error: string; trace: TraceStep[]; ms: number; finished_at: string }): void {
      db.run(
        `UPDATE agent_runs SET status = 'failed', error = ?, trace = ?, ms = ?, finished_at = ? WHERE id = ? AND ${ownedRun('run_id')}`,
        result.error, json.encode(result.trace), result.ms, result.finished_at, id, userId,
      );
    },

    listForRun(runId: string): AgentRun[] {
      return db.all(`SELECT * FROM agent_runs WHERE run_id = ? AND ${ownedRun('run_id')} ORDER BY started_at`, runId, userId).map(toAgentRun);
    },

    /** Outputs of the agents that finished on a run, keyed by agent. */
    outputs(runId: string): Partial<Record<AgentName, unknown>> {
      const rows = db.all<{ agent: AgentName; output: string }>(
        `SELECT agent, output FROM agent_runs WHERE run_id = ? AND status = 'done' AND ${ownedRun('run_id')}`,
        runId, userId,
      );
      return Object.fromEntries(rows.map((r) => [r.agent, json.decode(r.output)]));
    },
  };
}
export type AgentsRepository = ReturnType<typeof createAgentsRepository>;
