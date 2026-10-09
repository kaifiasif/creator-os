// Audience rehearsal: simulates follower reactions to a decided draft, tracks the job in SQLite, and
// stores a summary the review screen can render. One rehearsal row per attempt; the latest one wins.
// Two engines: the built-in swarm (default, src/swarm) or an external MiroFish (MIROFISH_URL).
import { createHash, randomUUID } from 'node:crypto';
import { buildSeed, loadRunInput } from './seed.js';
import { summarize } from './summarize.js';

export class RehearsalError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const STAGES = ['queued', 'ontology', 'graph', 'preparing', 'running', 'reporting', 'done', 'failed'];
const ACTIVE = STAGES.filter((s) => !['done', 'failed'].includes(s));

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS rehearsals (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN (${STAGES.map((s) => `'${s}'`).join(',')})),
  progress INTEGER NOT NULL DEFAULT 0,
  text_hash TEXT NOT NULL,
  settings_json TEXT NOT NULL,
  project_id TEXT,
  graph_id TEXT,
  simulation_id TEXT,
  result_json TEXT,
  state_json TEXT,
  interviews_json TEXT NOT NULL DEFAULT '[]',
  error TEXT,
  created_at TEXT NOT NULL,
  finished_at TEXT
);
CREATE INDEX IF NOT EXISTS rehearsals_run ON rehearsals(run_id, created_at);
`;

// Works with both Creator OS database wrappers (0.4 db.js and 0.5 db/client.ts): only get/all/run/exec.
const exec = (db, sql) => (db.exec ? db.exec(sql) : db.raw.exec(sql));
const nowIso = () => new Date().toISOString();

function insertRow(db, row) {
  const keys = Object.keys(row);
  db.run(`INSERT INTO rehearsals (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`, ...keys.map((k) => row[k]));
}
function updateRow(db, id, patch) {
  const keys = Object.keys(patch);
  db.run(`UPDATE rehearsals SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, ...keys.map((k) => patch[k] ?? null), id);
}

// Standalone setup. In Creator OS 0.5+, ship migrations/0002_rehearsals.sql instead.
export function ensureSchema(db) {
  exec(db, SCHEMA);
  const cols = db.all('PRAGMA table_info(rehearsals)').map((c) => c.name);
  if (!cols.includes('state_json')) exec(db, 'ALTER TABLE rehearsals ADD COLUMN state_json TEXT');
}

export function rehearsalConfig(env = process.env) {
  const engine = env.REHEARSAL_ENGINE || (env.MIROFISH_URL ? 'mirofish' : 'swarm');
  return {
    engine,
    enabled: engine === 'swarm' || Boolean(env.MIROFISH_URL),
    max_rounds: Number(env.REHEARSAL_ROUNDS || env.MIROFISH_MAX_ROUNDS || 10),
    // Off by default: seeing simulated reactions before deciding would contaminate the blind experiment.
    before_decision: env.MIROFISH_BEFORE_DECISION === '1',
    handle: env.CREATOR_HANDLE || 'the creator',
  };
}

const sha256 = (s) => createHash('sha256').update(s, 'utf8').digest('hex');
const parse = (s, fallback) => { try { return s ? JSON.parse(s) : fallback; } catch { return fallback; } };

function view(row) {
  if (!row) return null;
  return {
    id: row.id,
    run_id: row.run_id,
    status: row.status,
    progress: row.progress,
    settings: parse(row.settings_json, {}),
    simulation_id: row.simulation_id,
    result: parse(row.result_json, null),
    interviews: parse(row.interviews_json, []),
    error: row.error,
    created_at: row.created_at,
    finished_at: row.finished_at,
  };
}

const latestRow = (db, runId) => db.get('SELECT * FROM rehearsals WHERE run_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1', runId);

export function getRehearsal(db, runId, config = rehearsalConfig()) {
  return { enabled: config.enabled, engine: config.engine, before_decision: config.before_decision, rehearsal: view(latestRow(db, runId)) };
}

const OFF = 'Audience rehearsal is off. Unset REHEARSAL_ENGINE to use the built-in engine, or set MIROFISH_URL to a running MiroFish backend.';

// Spend caps: each rehearsal is ~12 model calls and each interview is one, so a leaked token or a stuck
// retry loop can't burn through the free tier.
export const LIMITS = { rehearsalsPerRunPerDay: 10, interviewsPerRehearsal: 25 };

export function startRehearsal(db, runId, { client, engine, background, config = rehearsalConfig(), audience, max_rounds, force = false } = {}) {
  const useSwarm = config.engine !== 'mirofish';
  if (useSwarm ? !engine : !client) throw new RehearsalError(503, OFF);
  const input = loadRunInput(db, runId);
  if (!input) throw new RehearsalError(404, 'Run not found.');
  if (!input.draft || !input.posts.length) throw new RehearsalError(409, 'This run has no draft to rehearse yet.');
  if (!input.decided && !config.before_decision) throw new RehearsalError(409, 'Decide on the draft first. Rehearsal opens after your decision so it does not sway it.');
  if (input.decision === 'reject') throw new RehearsalError(409, 'This draft was rejected, so there is nothing to rehearse.');

  const textHash = sha256(input.posts.join('\n\n'));
  const prev = latestRow(db, runId);
  if (prev && ACTIVE.includes(prev.status)) return view(prev);
  if (prev && prev.status === 'done' && prev.text_hash === textHash && !force) return view(prev);

  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
  const recent = db.get('SELECT COUNT(*) AS n FROM rehearsals WHERE run_id = ? AND created_at > ?', runId, dayAgo).n;
  if (recent >= LIMITS.rehearsalsPerRunPerDay) throw new RehearsalError(429, `This draft has been rehearsed ${recent} times today. Try again tomorrow.`);

  if (audience != null && (typeof audience !== 'string' || audience.length > 2000)) throw new RehearsalError(422, 'audience must be text of at most 2000 characters.');
  const rounds = Math.min(Math.max(Number(max_rounds) || config.max_rounds, 1), 40);
  const settings = { max_rounds: rounds, audience: audience?.trim() || null, handle: config.handle };
  const row = {
    id: randomUUID(), run_id: runId, status: 'queued', progress: 0, text_hash: textHash,
    settings_json: JSON.stringify(settings), interviews_json: '[]', created_at: nowIso(),
  };
  insertRow(db, row);
  const job = () => (useSwarm ? executeSwarm(db, row.id, input, settings, engine) : execute(db, row.id, input, settings, client));
  if (background) background(job);
  else job();
  return view(row);
}

// Built-in engine: personas, feed rounds, report, all in-process.
export async function executeSwarm(db, id, input, settings, engine) {
  const set = (patch) => updateRow(db, id, patch);
  try {
    const { result, state } = await engine.run({ input, settings, onStage: (status, progress) => set({ status, progress }) });
    set({ status: 'done', progress: 100, result_json: JSON.stringify(result), state_json: JSON.stringify(state), finished_at: nowIso() });
  } catch (e) {
    set({ status: 'failed', error: e.message, finished_at: nowIso() });
  }
}

// Runs the six MiroFish steps. Each step records its ids so a failure can be inspected in MiroFish's UI.
export async function execute(db, id, input, settings, client) {
  const set = (patch) => updateRow(db, id, patch);
  const progressOf = (status, base, span) => (d) => {
    const pct = Number(d?.progress ?? d?.progress_percent ?? 0);
    set({ status, progress: Math.round(base + (span * Math.min(Math.max(pct, 0), 100)) / 100) });
  };
  try {
    const { seedMarkdown, requirement, draft } = buildSeed({
      posts: input.posts, archive: input.archive, audience: settings.audience, handle: settings.handle, format: input.format,
    });
    set({ status: 'ontology', progress: 2 });
    const onto = await client.generateOntology({ seedMarkdown, requirement, projectName: `creator-os run ${input.run.id.slice(0, 8)}` });
    set({ project_id: onto.project_id, status: 'graph', progress: 8 });

    const graph = await client.buildGraph(onto.project_id, { onProgress: progressOf('graph', 8, 22) });
    set({ graph_id: graph.graph_id, status: 'preparing', progress: 30 });

    const sim = await client.createSimulation(onto.project_id, graph.graph_id);
    set({ simulation_id: sim.simulation_id });
    await client.prepare(sim.simulation_id, { onProgress: progressOf('preparing', 30, 20) });

    set({ status: 'running', progress: 50 });
    const runStatus = await client.run(sim.simulation_id, { maxRounds: settings.max_rounds, onProgress: progressOf('running', 50, 35) });

    set({ status: 'reporting', progress: 85 });
    const [posts, actions] = await Promise.all([client.posts(sim.simulation_id), client.actions(sim.simulation_id)]);
    // The report is useful but not essential; keep the simulation results if it fails.
    let report = null, reportError = null;
    try { report = await client.report(sim.simulation_id, { onProgress: progressOf('reporting', 85, 14) }); }
    catch (e) { reportError = e.message; }

    const result = summarize({ draft, sentences: input.sentences, posts: posts.posts || [], actions: actions.actions || [], report, runStatus });
    if (reportError) result.report_error = reportError;
    result.engine = 'mirofish';
    set({ status: 'done', progress: 100, result_json: JSON.stringify(result), finished_at: nowIso() });
  } catch (e) {
    set({ status: 'failed', error: e.step ? `${e.step}: ${e.message}` : e.message, finished_at: nowIso() });
  }
}

export async function interviewAgent(db, rehearsalId, { agent_id, prompt } = {}, { client, engine } = {}) {
  const row = db.get('SELECT * FROM rehearsals WHERE id = ?', rehearsalId);
  if (!row) throw new RehearsalError(404, 'Rehearsal not found.');
  if (row.status !== 'done') throw new RehearsalError(409, 'The rehearsal has not finished yet.');
  const state = parse(row.state_json, null);
  if (!Number.isInteger(agent_id) || agent_id < 0) throw new RehearsalError(422, 'agent_id must be a non-negative integer.');
  const q = String(prompt || '').trim();
  if (!q || q.length > 1000) throw new RehearsalError(422, 'Ask a question of 1 to 1000 characters.');

  if (parse(row.interviews_json, []).length >= LIMITS.interviewsPerRehearsal) throw new RehearsalError(429, `You've asked ${LIMITS.interviewsPerRehearsal} questions on this rehearsal. Start a new one to ask more.`);

  let answer;
  if (state) {
    // Built-in engine: interviews work any time later, from the stored persona and its action log.
    if (!engine?.canInterview) throw new RehearsalError(503, 'Interviews need a model. Set LLM_API_KEY (the free Groq key the app uses) or SWARM_LLM_API_KEY.');
    try { answer = await engine.interview({ state, agentId: agent_id, question: q }); }
    catch (e) { throw new RehearsalError(e.status || 502, e.status ? e.message : `The model could not answer: ${e.message}`); }
  } else {
    if (!client || !row.simulation_id) throw new RehearsalError(503, 'This rehearsal ran on MiroFish; set MIROFISH_URL to interview its followers.');
    let data;
    try { data = await client.interview(row.simulation_id, agent_id, q); }
    catch (e) { throw new RehearsalError(502, `MiroFish could not run the interview: ${e.message} The simulation may have shut down; start a new rehearsal to ask more.`); }
    answer = data?.result?.response ?? data?.result?.platforms?.twitter?.response ?? data?.response ?? '';
  }
  const entry = { agent_id, prompt: q, answer, at: nowIso() };
  const interviews = [...parse(row.interviews_json, []), entry];
  updateRow(db, rehearsalId, { interviews_json: JSON.stringify(interviews) });
  return entry;
}
