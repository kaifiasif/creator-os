import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApp } from '../src/app.ts';
import { configFromEnv, loadEnv } from '../src/config/env.ts';
import { createContext } from '../src/context.ts';
import { createLogger } from '../src/core/logger.ts';
import { openDatabase } from '../src/db/client.ts';
import { migrate } from '../src/db/migrate.ts';
import { createProviders } from '../src/providers/index.ts';
import { sessionCookie, TEST_PASSWORD } from './helpers.ts';

function appWith(rateLimits: Partial<ReturnType<typeof configFromEnv>['rateLimits']> = {}) {
  const env = loadEnv({ NODE_ENV: 'test', TRUST_PROXY: '1' });
  const db = openDatabase(':memory:');
  migrate(db);
  const config = configFromEnv(env);
  config.rateLimits = { ...config.rateLimits, ...rateLimits };
  return createApp(createContext({ db, providers: createProviders(env), config, log: createLogger({}, false) }));
}

const json = (body: unknown, headers: Record<string, string> = {}) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json', ...headers },
  body: JSON.stringify(body),
});

async function signedIn(app: ReturnType<typeof appWith>, email = 'sec@example.com') {
  const res = await app.request('/api/auth/signup', json({ email, password: TEST_PASSWORD }, { 'x-forwarded-for': '1.1.1.1' }));
  assert.equal(res.status, 201);
  return sessionCookie(res);
}

test('every response carries the security headers, and the CSP forbids inline scripts', async () => {
  const res = await appWith().request('/api/health');
  const csp = res.headers.get('content-security-policy') ?? '';
  assert.match(csp, /script-src 'self'(;|$)/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('x-frame-options'), 'DENY');
});

test('wrong passwords are rate limited per visitor and per email', async () => {
  const app = appWith({ authFailures: { limit: 3, windowMs: 60_000 } });
  await signedIn(app, 'target@example.com');
  const attempt = (ip: string, email = 'target@example.com', password = 'wrong password!') =>
    app.request('/api/auth/login', json({ email, password }, { 'x-forwarded-for': ip }));

  // one machine guessing at different accounts
  for (const email of ['a@example.com', 'b@example.com', 'c@example.com']) assert.equal((await attempt('6.6.6.6', email)).status, 401);
  const blocked = await attempt('6.6.6.6', 'target@example.com', TEST_PASSWORD);
  assert.equal(blocked.status, 429, 'even the right password waits out the block');
  assert.equal(((await blocked.json()) as { error: { code: string } }).error.code, 'RATE_LIMITED');
  assert.ok(Number(blocked.headers.get('retry-after')) > 0);

  // many machines guessing at one account: a looser cap (5x), so strangers cannot easily lock it
  for (let i = 1; i <= 15; i++) assert.equal((await attempt(`2.0.0.${i}`)).status, 401);
  assert.equal((await attempt('2.0.1.1', 'target@example.com', TEST_PASSWORD)).status, 429);
  assert.equal((await attempt('9.9.9.9', 'other@example.com')).status, 401, 'other accounts are unaffected');
});

test('sign-ups are limited per visitor', async () => {
  const app = appWith({ signups: { limit: 2, windowMs: 60_000 } });
  const signup = (n: number) => app.request('/api/auth/signup', json({ email: `u${n}@example.com`, password: TEST_PASSWORD }, { 'x-forwarded-for': '3.3.3.3' }));
  assert.equal((await signup(1)).status, 201);
  assert.equal((await signup(2)).status, 201);
  assert.equal((await signup(3)).status, 429);
});

test('costly calls have their own, tighter limit per account; reads are not counted against it', async () => {
  const app = appWith({ costly: { limit: 2, windowMs: 60_000 } });
  const cookie = await signedIn(app);
  const post = () => app.request('/api/sources', json({ text: 'hi' }, { cookie }));
  for (let i = 0; i < 2; i++) assert.notEqual((await post()).status, 429);
  assert.equal((await post()).status, 429);
  assert.equal((await app.request('/api/sources', { headers: { cookie } })).status, 200);
});

test('a caller-supplied request id is echoed only when it is a plain token', async () => {
  const app = appWith();
  const ok = await app.request('/api/health', { headers: { 'x-request-id': 'trace-123' } });
  assert.equal(ok.headers.get('x-request-id'), 'trace-123');
  const odd = await app.request('/api/health', { headers: { 'x-request-id': '<script>' } });
  assert.notEqual(odd.headers.get('x-request-id'), '<script>');
});

test('writes from another site are refused (CSRF), same-site writes pass', async () => {
  const app = appWith();
  const cookie = await signedIn(app);
  const write = (headers: Record<string, string>) => app.request('/api/sources', json({ text: 'hi' }, { cookie, host: 'creator.example', ...headers }));
  assert.equal((await write({ origin: 'https://evil.example' })).status, 403);
  assert.equal((await write({ 'sec-fetch-site': 'cross-site' })).status, 403);
  assert.notEqual((await write({ origin: 'https://creator.example', 'sec-fetch-site': 'same-origin' })).status, 403);
  const login = await app.request('/api/auth/login', json({ email: 'sec@example.com', password: TEST_PASSWORD }, { host: 'creator.example', origin: 'https://evil.example' }));
  assert.equal(login.status, 403, 'log-in CSRF is refused too');
});

test('behind a proxy the last X-Forwarded-For entry is the visitor, so a forged first entry buys nothing', async () => {
  const app = appWith({ authFailures: { limit: 2, windowMs: 60_000 } });
  const attempt = (forged: string) =>
    app.request('/api/auth/login', json({ email: `x${forged}@example.com`, password: 'wrong password!' }, { 'x-forwarded-for': `${forged}, 5.5.5.5` }));
  assert.equal((await attempt('1.0.0.1')).status, 401);
  assert.equal((await attempt('1.0.0.2')).status, 401);
  assert.equal((await attempt('1.0.0.3')).status, 429);
  const odd = await app.request('/api/auth/logout', { method: 'POST', headers: { origin: 'not a url' } });
  assert.equal(odd.status, 403, 'a malformed Origin is refused, not a 500');
});
