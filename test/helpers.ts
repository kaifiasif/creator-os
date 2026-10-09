/** Test harness: a real app on an in-memory database, with local providers that tests can swap per case. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/app.ts';
import { configFromEnv, DEFAULT_RATE_LIMITS, loadEnv } from '../src/config/env.ts';
import { createContext, type AppContext, type AppServices } from '../src/context.ts';
import { createLogger } from '../src/core/logger.ts';
import { openDatabase } from '../src/db/client.ts';
import { migrate } from '../src/db/migrate.ts';
import { agentServiceOptions, createAgentService } from '../src/modules/agents/agent-service.ts';
import { createProviders, type Providers } from '../src/providers/index.ts';

export const fixture = (name: string) => readFile(new URL(`../fixtures/${name}`, import.meta.url), 'utf8');

/** Response bodies are whatever JSON the endpoint returns; tests assert on their shape directly. */
// biome-ignore lint/suspicious/noExplicitAny: response JSON is asserted structurally
export type Json = any;

export type Api = (method: string, path: string, body?: unknown) => Promise<{ status: number; body: Json }>;

export interface Client {
  api: Api;
  /** The Cookie header this client sends. */
  cookie: string;
  user: { id: string; email: string };
}

export const TEST_PASSWORD = 'correct horse battery staple';

/** The session cookie from a response, as a request Cookie header. */
export const sessionCookie = (res: Response) => (res.headers.get('set-cookie') ?? '').split(';')[0] ?? '';

export interface Harness {
  /** Process-wide services: tests swap providers, config and agent overrides here. */
  ctx: AppServices;
  app: ReturnType<typeof createApp>;
  /** The default creator's own context, for asserting on their rows directly. */
  user(): Promise<AppContext>;
  /** Restores the local providers, condition and agent overrides between tests. */
  reset(): void;
  /** Calls the API as the default creator, who is signed up on first use. */
  api: Api;
  /** Signs up another creator and returns a client that acts as them. */
  signUp(email: string, password?: string): Promise<Client>;
  /** A raw request with the default creator's session cookie added. */
  request(path: string, init?: RequestInit): Promise<Response>;
  /** Waits for every background job (transcription, drafting, agents) to finish. */
  settle(): Promise<void>;
  readySource(title: string, text: string, extra?: Record<string, unknown>): Promise<string>;
  runFor(sourceId: string, extra?: Record<string, unknown>): Promise<Json>;
}

/** `env` adds variables on top of the test defaults, for example a model key pointed at a local stub. */
export function createHarness(extraEnv: Record<string, string> = {}): Harness {
  const python = process.env.CREATOR_OS_PYTHON ? { CREATOR_OS_PYTHON: process.env.CREATOR_OS_PYTHON } : {};
  const env = loadEnv({ NODE_ENV: 'test', RETRY_DELAY_MS: '0', ...python, ...extraEnv });
  const db = openDatabase(':memory:');
  migrate(db);
  const fresh = (): Providers => createProviders(env);
  const ctx = createContext({
    db,
    providers: fresh(),
    config: {
      ...configFromEnv(env),
      uploadDir: join(tmpdir(), 'creator-os-test-uploads'),
      // every test signs up its own creators from the same in-process "client"
      rateLimits: { ...DEFAULT_RATE_LIMITS, signups: { limit: 1000, windowMs: 60_000 } },
    },
    log: createLogger({}, false),
    agentService: createAgentService(agentServiceOptions(env), createLogger({}, false)),
  });
  const app = createApp(ctx);

  const parse = async (res: Response) => {
    const text = await res.text();
    let parsed: Json = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      // CSV and other text bodies stay as strings
    }
    return { status: res.status, body: parsed };
  };
  const apiFor = (cookie: string): Api => async (method, path, body) =>
    parse(
      await app.request(path, {
        method,
        headers: { cookie, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );

  const signUp: Harness['signUp'] = async (email, password = TEST_PASSWORD) => {
    const res = await app.request('/api/auth/signup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
    assert.equal(res.status, 201, await res.clone().text());
    const cookie = sessionCookie(res);
    const { user } = (await res.json()) as Json;
    return { api: apiFor(cookie), cookie, user };
  };
  let main: Promise<Client> | null = null;
  const creator = () => (main ??= signUp('creator@example.com'));
  const api: Api = async (method, path, body) => (await creator()).api(method, path, body);

  const settle = async () => {
    await new Promise((r) => setTimeout(r, 5));
    await ctx.jobs.idle();
  };

  return {
    ctx,
    app,
    api,
    signUp,
    settle,
    async user() {
      return ctx.forUser((await creator()).user.id);
    },
    async request(path, init = {}) {
      const headers = new Headers(init.headers);
      headers.set('cookie', (await creator()).cookie);
      return app.request(path, { ...init, headers });
    },
    reset() {
      ctx.providers = fresh();
      ctx.config.forcedCondition = undefined;
      ctx.agentOverrides = null;
    },
    async readySource(title, text, extra = {}) {
      const r = await api('POST', '/api/sources', { title, text, ...extra });
      assert.equal(r.status, 202, JSON.stringify(r.body));
      await settle();
      return r.body.source_item_id as string;
    },
    async runFor(sourceId, extra = {}) {
      const r = await api('POST', '/api/runs', { source_item_id: sourceId, format: 'thread', ...extra });
      assert.equal(r.status, 202, JSON.stringify(r.body));
      await settle();
      return (await api('GET', `/api/runs/${r.body.run_id}`)).body;
    },
  };
}

export async function importSampleArchive(h: Harness): Promise<Json> {
  const imported = await h.api('POST', '/api/archive/import', JSON.parse(await fixture('sample-archive.json')));
  assert.equal(imported.status, 200, JSON.stringify(imported.body));
  return imported.body;
}
