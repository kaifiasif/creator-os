// Accounts: sign-up, log-in, sessions, 2-step codes, and above all that one creator never sees
// or changes another creator's data.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApp } from '../src/app.ts';
import { configFromEnv, loadEnv } from '../src/config/env.ts';
import { createContext } from '../src/context.ts';
import { createLogger } from '../src/core/logger.ts';
import { openDatabase } from '../src/db/client.ts';
import { loadMigrations, migrate } from '../src/db/migrate.ts';
import { currentStep, totpCode } from '../src/modules/auth/totp.ts';
import { createProviders } from '../src/providers/index.ts';
import { createHarness, fixture, importSampleArchive, sessionCookie, TEST_PASSWORD, type Json } from './helpers.ts';

const h = createHarness();
const { api, readySource, runFor, ctx, signUp, settle } = h;

const post = (body: unknown, cookie = '') => ({ method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify(body) });
const login = (body: unknown) => h.app.request('/api/auth/login', post(body));

test('sign up, see yourself, log out, log back in', async () => {
  const anon = await (await h.app.request('/api/auth/session')).json() as Json;
  assert.equal(anon.user, null);

  const me = await signUp('Ada@Example.com ');
  assert.equal(me.user.email, 'ada@example.com', 'emails are trimmed and lower-cased');
  const session = (await me.api('GET', '/api/auth/session')).body;
  assert.equal(session.user.email, 'ada@example.com');
  assert.equal(session.user.mfa_enabled, false);

  const taken = await h.app.request('/api/auth/signup', post({ email: 'ada@example.com', password: TEST_PASSWORD }));
  assert.equal(taken.status, 409);
  assert.equal(((await taken.json()) as Json).error.code, 'ACCOUNT_EXISTS');
  const short = await h.app.request('/api/auth/signup', post({ email: 'bob@example.com', password: 'short' }));
  assert.equal(short.status, 400);

  // unknown email and wrong password read the same
  const wrong = (await (await login({ email: 'ada@example.com', password: 'not the password' })).json()) as Json;
  const nobody = (await (await login({ email: 'nobody@example.com', password: 'not the password' })).json()) as Json;
  assert.deepEqual(wrong, nobody);

  await me.api('POST', '/api/auth/logout');
  assert.equal((await me.api('GET', '/api/runs')).status, 401, 'the old cookie is dead after log-out');
  const again = await login({ email: 'ADA@example.com', password: TEST_PASSWORD });
  assert.equal(again.status, 200);
  const cookie = again.headers.get('set-cookie') ?? '';
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  assert.equal((await h.app.request('/api/runs', { headers: { cookie: sessionCookie(again) } })).status, 200);
});

test('one creator cannot read, change or even detect another creator\'s data', async () => {
  ctx.config.forcedCondition = 'gate';
  await importSampleArchive(h);
  const notes = await fixture('rough-notes.md');
  const sourceId = await readySource('notes', notes);
  const run = await runFor(sourceId, { format: 'post' });
  assert.equal(run.status, 'in_review', run.error);
  const pieceId = (await api('GET', '/api/archive')).body.pieces[0].id;
  const claimId = (await api('GET', `/api/sources/${sourceId}`)).body.claims[0].id;
  await api('POST', '/api/settings', { show_recommendation: true });

  const eve = await signUp('eve@example.com');
  const as = eve.api;
  // lists are empty
  assert.equal((await as('GET', '/api/sources')).body.length, 0);
  assert.equal((await as('GET', '/api/runs')).body.length, 0);
  assert.equal((await as('GET', '/api/archive')).body.pieces.length, 0);
  // ids from the other account read as missing, never as forbidden
  for (const path of [`/api/sources/${sourceId}`, `/api/runs/${run.run_id}`, `/api/sources/${sourceId}/angles`]) {
    const r = await as('GET', path);
    assert.equal(r.status, 404, path);
  }
  const writes: [string, unknown][] = [
    [`/api/drafts/${run.draft.id}/decision`, { decision: 'reject', reject_reason: 'not_me' }],
    [`/api/drafts/${run.draft.id}/note`, { note: 'mine now' }],
    [`/api/runs/${run.run_id}/retry`, {}],
    [`/api/runs/${run.run_id}/agents`, {}],
    [`/api/runs/${run.run_id}/rehearsal`, {}],
    [`/api/sources/${sourceId}/retry`, {}],
    [`/api/archive/${pieceId}/retire`, { reason: 'taken' }],
    [`/api/claims/${claimId}/retire`, { reason: 'taken' }],
    ['/api/runs', { source_item_id: sourceId, format: 'post' }],
  ];
  for (const [path, body] of writes) {
    const r = await as('POST', path, body);
    assert.ok([404, 400].includes(r.status), `${path} answered ${r.status}`);
    assert.notEqual(r.status, 200);
  }
  assert.equal((await as('GET', `/api/runs/${run.run_id}/rehearsal`)).body.rehearsal, null);
  // the same recording is a new source for a different creator, not a duplicate
  assert.equal((await as('POST', '/api/sources', { title: 'notes', text: notes })).status, 202);
  // settings and numbers are per creator
  assert.equal((await as('GET', '/api/settings')).body.show_recommendation, false);
  assert.equal((await api('GET', '/api/settings')).body.show_recommendation, true);
  await settle();

  // and nothing of the owner's changed
  const after = (await api('GET', `/api/runs/${run.run_id}`)).body;
  assert.equal(after.status, 'in_review');
  assert.equal(after.draft.note ?? null, null);
  assert.equal((await api('GET', '/api/archive')).body.pieces.find((p: Json) => p.id === pieceId).retired, false);
  ctx.config.forcedCondition = undefined;
});

test('2-step codes: set up, required at log-in, single use, turned off with password and code', async () => {
  const me = await signUp('mfa@example.com');
  const setup = (await me.api('POST', '/api/auth/mfa/setup')).body;
  assert.match(setup.otpauth_uri, /^otpauth:\/\/totp\/Creator%20OS%3Amfa%40example\.com\?secret=/);
  assert.equal((await me.api('POST', '/api/auth/mfa/enable', { code: '000000' === totpCode(setup.secret, currentStep()) ? '111111' : '000000' })).body.error.code, 'WRONG_CREDENTIALS');
  const enabled = await me.api('POST', '/api/auth/mfa/enable', { code: totpCode(setup.secret, currentStep()) });
  assert.equal(enabled.body.user.mfa_enabled, true);

  const noCode = await login({ email: 'mfa@example.com', password: TEST_PASSWORD });
  assert.equal(noCode.status, 401);
  assert.equal(((await noCode.json()) as Json).error.code, 'MFA_REQUIRED');
  const nextCode = totpCode(setup.secret, currentStep() + 1);
  assert.equal((await login({ email: 'mfa@example.com', password: TEST_PASSWORD, code: nextCode })).status, 200);
  assert.equal((await login({ email: 'mfa@example.com', password: TEST_PASSWORD, code: nextCode })).status, 401, 'a code works once');
  assert.equal((await login({ email: 'mfa@example.com', password: 'wrong password', code: nextCode })).status, 401);

  const off = await me.api('POST', '/api/auth/mfa/disable', { password: TEST_PASSWORD, code: totpCode(setup.secret, currentStep() + 1) });
  assert.equal(off.body.error.code, 'WRONG_CREDENTIALS', 'the used code cannot turn it off either');
});

test('changing the password signs out other devices, keeps this one', async () => {
  const laptop = await signUp('pw@example.com');
  const phone = sessionCookie(await login({ email: 'pw@example.com', password: TEST_PASSWORD }));
  const bad = await laptop.api('POST', '/api/auth/password', { current_password: 'nope nope nope', new_password: 'a brand new password' });
  assert.equal(bad.status, 400);
  assert.equal((await laptop.api('POST', '/api/auth/password', { current_password: TEST_PASSWORD, new_password: 'a brand new password' })).status, 200);
  assert.equal((await laptop.api('GET', '/api/runs')).status, 200);
  assert.equal((await h.app.request('/api/runs', { headers: { cookie: phone } })).status, 401);
  assert.equal((await login({ email: 'pw@example.com', password: 'a brand new password' })).status, 200);
});

test('expired and forged sessions are refused', async () => {
  const me = await signUp('expiry@example.com');
  assert.equal((await h.app.request('/api/runs', { headers: { cookie: 'cos_session=' + 'A'.repeat(43) } })).status, 401);
  ctx.db.run("UPDATE sessions SET created_at = '1999-01-01T00:00:00.000Z', expires_at = '2000-01-01T00:00:00.000Z' WHERE user_id = ?", me.user.id);
  assert.equal((await me.api('GET', '/api/runs')).status, 401);
});

test('data from before accounts goes to the first sign-up; closed sign-up allows only that one', async () => {
  const env = loadEnv({ NODE_ENV: 'test', CREATOR_OS_SIGNUP: 'closed' });
  const db = openDatabase(':memory:');
  migrate(db, loadMigrations().filter((m) => m.version < 3));
  db.run("INSERT INTO settings (key, value) VALUES ('show_recommendation', 'false')");
  db.run(
    `INSERT INTO source_items (id, title, kind, content_hash, mime, status, transcript_text, created_at)
     VALUES ('legacy-source', 'Old memo', 'note', 'h1', 'text/plain', 'failed', 'text', '2026-01-01T00:00:00.000Z')`,
  );
  migrate(db);
  const app = createApp(createContext({ db, providers: createProviders(env), config: configFromEnv(env), log: createLogger({}, false) }));

  const first = await app.request('/api/auth/signup', post({ email: 'owner@example.com', password: TEST_PASSWORD }));
  assert.equal(first.status, 201);
  const sources = (await (await app.request('/api/sources', { headers: { cookie: sessionCookie(first) } })).json()) as Json;
  assert.deepEqual(sources.map((s: Json) => s.id), ['legacy-source']);

  const second = await app.request('/api/auth/signup', post({ email: 'late@example.com', password: TEST_PASSWORD }));
  assert.equal(second.status, 403);
  assert.equal(((await second.json()) as Json).error.code, 'SIGNUP_CLOSED');
});

test('with an owner email set, a stranger who signs up first gets an empty account, not the old data', async () => {
  const env = loadEnv({ NODE_ENV: 'test', CREATOR_OS_SIGNUP: 'closed', CREATOR_OS_OWNER_EMAIL: 'Owner@Example.com' });
  const db = openDatabase(':memory:');
  migrate(db, loadMigrations().filter((m) => m.version < 3));
  db.run(
    `INSERT INTO source_items (id, title, kind, content_hash, mime, status, transcript_text, created_at)
     VALUES ('legacy-source', 'Old memo', 'note', 'h1', 'text/plain', 'failed', 'text', '2026-01-01T00:00:00.000Z')`,
  );
  migrate(db);
  const app = createApp(createContext({ db, providers: createProviders(env), config: configFromEnv(env), log: createLogger({}, false) }));
  const signup = (email: string) => app.request('/api/auth/signup', post({ email, password: TEST_PASSWORD }));
  const sourcesOf = async (res: Response) => ((await (await app.request('/api/sources', { headers: { cookie: sessionCookie(res) } })).json()) as Json).map((s: Json) => s.id);

  assert.equal((await signup('stranger@example.com')).status, 403, 'closed sign-up admits only the owner');
  const owner = await signup('owner@example.com');
  assert.equal(owner.status, 201);
  assert.deepEqual(await sourcesOf(owner), ['legacy-source']);
});

test('parallel wrong guesses cannot outrun the failure limit', async () => {
  const env = loadEnv({ NODE_ENV: 'test' });
  const db = openDatabase(':memory:');
  migrate(db);
  const config = configFromEnv(env);
  config.rateLimits = { ...config.rateLimits, authFailures: { limit: 3, windowMs: 60_000 } };
  const app = createApp(createContext({ db, providers: createProviders(env), config, log: createLogger({}, false) }));
  await app.request('/api/auth/signup', post({ email: 'burst@example.com', password: TEST_PASSWORD }));
  const statuses = await Promise.all(
    Array.from({ length: 8 }, async () => (await app.request('/api/auth/login', post({ email: 'burst@example.com', password: 'wrong password!' }))).status),
  );
  assert.equal(statuses.filter((s) => s === 401).length, 3);
  assert.equal(statuses.filter((s) => s === 429).length, 5);
});
