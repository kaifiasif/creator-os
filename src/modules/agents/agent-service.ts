/**
 * Client for the Python agents service (agents/creator_agents).
 *
 * By default the web app starts the service itself as a child process on 127.0.0.1 with a fresh random
 * token and a port the OS picks, so nothing else can call it and there is one command to run. Set
 * CREATOR_OS_AGENTS_URL and AGENTS_SERVICE_TOKEN to use a service you run yourself instead.
 *
 * The child gets only the variables it needs: never the session secrets, the database path or other keys.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type { Env } from '../../config/env.ts';
import type { Logger } from '../../core/logger.ts';
import { z } from 'zod';
import type { AgentName, TraceStep } from '../../domain/types.ts';

const AGENTS_DIR = fileURLToPath(new URL('../../../agents/', import.meta.url));
const START_TIMEOUT_MS = 15_000;
/** Covers the Claude loop at its worst: eight steps, each with the client's own retries. */
const REQUEST_TIMEOUT_MS = 15 * 60_000;
const MAX_RESPONSE_BYTES = 4_000_000;
const MAX_TRACE_STEPS = 200;
const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]']);

/**
 * Traces are shown to the creator, and model thoughts in them can be steered by text in a transcript,
 * so they are checked and bounded like any other input before they are stored.
 */
const short = (n: number) => z.string().transform((s) => (s.length > n ? `${s.slice(0, n)}…` : s));
const TraceSchema = z
  .array(
    z.object({
      step: z.number().int().min(0),
      kind: z.enum(['thought', 'tool', 'submit', 'submit_rejected']),
      tool: short(64).optional(),
      text: short(600).optional(),
      input: z.unknown().optional(),
      result: z.unknown().optional(),
      error: z.union([short(500), z.boolean()]).optional(),
    }),
  )
  .max(MAX_TRACE_STEPS);
const ResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), output: z.unknown(), trace: TraceSchema }),
  z.object({ ok: z.literal(false), error: short(500), trace: TraceSchema }),
]);

/** A trace entry's free-form input and result are capped once serialised, so one call cannot bloat the row. */
function boundTrace(trace: TraceStep[]): TraceStep[] {
  const cap = (v: unknown) => {
    if (v === undefined) return v;
    const text = JSON.stringify(v);
    return text.length > 2000 ? `${text.slice(0, 2000)}…` : v;
  };
  return trace.map((t) => ({ ...t, input: cap(t.input), result: cap(t.result) }));
}

export interface AgentServiceOptions {
  python: string;
  url?: string;
  token?: string;
  anthropicApiKey?: string;
  /** Any OpenAI-compatible API (Groq by default), used by the agents when there is no Claude key. */
  llmApiKey?: string;
  llmBaseUrl?: string;
  retryDelayMs?: number;
  /** Let the service write its own logs to stderr. Off in tests. */
  logs: boolean;
}

export const agentServiceOptions = (env: Env): AgentServiceOptions => ({
  python: env.CREATOR_OS_PYTHON,
  url: env.CREATOR_OS_AGENTS_URL,
  token: env.AGENTS_SERVICE_TOKEN,
  anthropicApiKey: env.ANTHROPIC_API_KEY,
  llmApiKey: env.LLM_API_KEY,
  llmBaseUrl: env.LLM_BASE_URL,
  retryDelayMs: env.RETRY_DELAY_MS,
  logs: env.NODE_ENV !== 'test',
});

export interface AgentRequest {
  user_id: string;
  run_id: string;
  use_model: boolean;
  model: string;
  context: Record<string, unknown>;
  prior?: Record<string, unknown>;
  tools: { url: string; token: string };
}

export type AgentResult = { ok: true; output: unknown; trace: TraceStep[] } | { ok: false; error: string; trace: TraceStep[] };

export interface AgentService {
  run(agent: AgentName, request: AgentRequest): Promise<AgentResult>;
}

interface Endpoint {
  url: string;
  token: string;
}

/** Starts `python -m creator_agents` and resolves once it prints the port it is listening on. */
function startChild(options: AgentServiceOptions, log: Logger, onExit: (endpoint: Promise<Endpoint>) => void): Promise<Endpoint> {
  const token = randomBytes(32).toString('base64url');
  const env: Record<string, string> = {
    PATH: process.env.PATH ?? '',
    AGENTS_HOST: '127.0.0.1',
    AGENTS_PORT: '0',
    AGENTS_SERVICE_TOKEN: token,
    AGENTS_LOG: options.logs ? '1' : '0',
    PYTHONUNBUFFERED: '1',
    PYTHONDONTWRITEBYTECODE: '1',
  };
  // only the key the agents will actually use: Claude first, as in the rest of the app
  if (options.anthropicApiKey) env.ANTHROPIC_API_KEY = options.anthropicApiKey;
  else if (options.llmApiKey) {
    env.LLM_API_KEY = options.llmApiKey;
    if (options.llmBaseUrl) env.LLM_BASE_URL = options.llmBaseUrl;
  }
  if (options.retryDelayMs !== undefined) env.RETRY_DELAY_MS = String(options.retryDelayMs);

  const started: Promise<Endpoint> = new Promise((resolve, reject) => {
    let child: ChildProcess;
    try {
      child = spawn(options.python, ['-m', 'creator_agents'], { cwd: AGENTS_DIR, env, stdio: ['ignore', 'pipe', options.logs ? 'inherit' : 'ignore'] });
    } catch (error) {
      reject(error);
      return;
    }
    const fail = (message: string) => {
      clearTimeout(timer);
      child.kill();
      reject(new Error(`Could not start the agents service: ${message}`));
    };
    const timer = setTimeout(() => fail('it did not report a port in time.'), START_TIMEOUT_MS);
    let buffered = '';
    child.stdout?.setEncoding('utf8');
    child.stdout?.on('data', (chunk: string) => {
      buffered += chunk;
      const line = buffered.split('\n')[0];
      if (!buffered.includes('\n')) return;
      try {
        const { port } = JSON.parse(line) as { port: unknown };
        if (!Number.isInteger(port) || (port as number) < 1 || (port as number) > 65535) throw new Error('bad port');
        clearTimeout(timer);
        child.stdout?.removeAllListeners('data');
        child.stdout?.resume();
        log.info('agents_service_started', { pid: child.pid, port });
        resolve({ url: `http://127.0.0.1:${port}`, token });
      } catch {
        fail('it printed an unexpected first line.');
      }
    });
    child.once('error', (error) => fail(`${options.python} could not run (${error.message}). Install Python 3.10+ or set CREATOR_OS_PYTHON.`));
    child.once('exit', (code, signal) => {
      clearTimeout(timer);
      onExit(started);
      reject(new Error(`Could not start the agents service: it exited (${signal ?? code}).`));
      log.warn('agents_service_exited', { code, signal });
    });
    // the service must never keep the web app (or a test run) alive on its own
    child.unref();
    (child.stdout as unknown as { unref?: () => void } | null)?.unref?.();
    process.once('exit', () => child.kill());
  });
  return started;
}

export function createAgentService(options: AgentServiceOptions, log: Logger): AgentService {
  let endpoint: Promise<Endpoint> | null = null;

  const resolveEndpoint = (): Promise<Endpoint> => {
    if (options.url) {
      if (!options.token) throw new Error('AGENTS_SERVICE_TOKEN is required with CREATOR_OS_AGENTS_URL.');
      // the tool bridge listens on loopback and the tokens travel in clear, so the service must be on this machine
      if (!LOOPBACK.has(new URL(options.url).hostname)) throw new Error('CREATOR_OS_AGENTS_URL must point at this machine (127.0.0.1 or localhost).');
      return Promise.resolve({ url: options.url.replace(/\/$/, ''), token: options.token });
    }
    if (!endpoint) {
      const current = startChild(options, log, (exited) => {
        if (endpoint === exited) endpoint = null; // start a new one on the next call
      });
      endpoint = current;
      current.catch(() => {
        if (endpoint === current) endpoint = null;
      });
    }
    return endpoint;
  };

  return {
    async run(agent, request) {
      const { url, token } = await resolveEndpoint();
      const res = await fetch(`${url}/v1/agents/${agent}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const text = await res.text();
      if (text.length > MAX_RESPONSE_BYTES) throw new Error('Agents service sent a response that is too large.');
      let body: unknown = null;
      try {
        body = JSON.parse(text);
      } catch {
        // reported below as a bad response
      }
      if (!res.ok) throw new Error(`Agents service ${res.status}: ${(body as { error?: { code?: string } } | null)?.error?.code ?? 'error'}`);
      const parsed = ResultSchema.safeParse(body);
      if (!parsed.success) throw new Error('Agents service sent a response in the wrong shape.');
      const trace = boundTrace(parsed.data.trace as TraceStep[]);
      return parsed.data.ok ? { ok: true, output: parsed.data.output, trace } : { ok: false, error: parsed.data.error, trace };
    },
  };
}
