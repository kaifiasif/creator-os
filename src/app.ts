import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Hono } from 'hono';
import type { AppServices } from './context.ts';
import { AppError, ErrorCode } from './core/errors.ts';
import { createErrorHandler } from './http/error-handler.ts';
import { createRateLimiter, rateLimit } from './http/middleware/rate-limit.ts';
import { requestLog } from './http/middleware/request-log.ts';
import { sameOrigin } from './http/middleware/same-origin.ts';
import { securityHeaders } from './http/middleware/security-headers.ts';
import { requireSession } from './http/middleware/session.ts';
import { serveWebApp } from './http/static.ts';
import type { AppEnv } from './http/types.ts';
import { agentsRoutes } from './modules/agents/agents.routes.ts';
import { archiveRoutes } from './modules/archive/archive.routes.ts';
import { authRoutes } from './modules/auth/auth.routes.ts';
import { decisionsRoutes } from './modules/decisions/decisions.routes.ts';
import { metricsRoutes } from './modules/metrics/metrics.routes.ts';
import { runsRoutes } from './modules/runs/runs.routes.ts';
import { rehearsalRoutes } from './modules/rehearsal/rehearsal.routes.ts';
import { sourcesRoutes } from './modules/sources/sources.routes.ts';
import { healthRoutes, systemRoutes } from './modules/system/system.routes.ts';

const ROOT = join(import.meta.dirname, '..');

/** Composes the HTTP app. Every feature module contributes its own router; nothing else knows its routes. */
/** POSTs that spend model tokens or disk space: uploads, extraction, drafting, agents, rehearsal, archive embedding. */
const COSTLY = /^\/api\/(sources(\/[^/]+\/(retry|transcript|speaker-map))?|runs(\/[^/]+\/(retry|agents|rehearsal))?|rehearsals\/[^/]+\/interview|archive\/import)$/;
const isCostly = (method: string, path: string) => method === 'POST' && COSTLY.test(path);

export function createApp(app: AppServices, options: { publicDir?: string } = {}) {
  const { rateLimits, trustProxy } = app.config;
  const api = new Hono<AppEnv>()
    .use(rateLimit(createRateLimiter(rateLimits.api), { trustProxy }))
    .use(sameOrigin())
    // public: health checks, and signing up or in
    .route('/', healthRoutes(app))
    .route('/auth', authRoutes(app))
    // everything below needs a session, and sees only that creator's data
    .use(requireSession(app))
    .use(rateLimit(createRateLimiter(rateLimits.costly), { trustProxy, applies: (c) => isCostly(c.req.method, c.req.path), key: (c) => `user:${c.get('session').user.id}` }))
    .route('/', systemRoutes(app))
    .route('/', archiveRoutes())
    .route('/', sourcesRoutes())
    .route('/', runsRoutes())
    .route('/', agentsRoutes())
    .route('/', decisionsRoutes())
    .route('/', metricsRoutes())
    .route('/', rehearsalRoutes(app))
    .all('*', () => {
      throw new AppError(404, ErrorCode.NOT_FOUND, 'No such endpoint.');
    });

  return new Hono<AppEnv>()
    .use(requestLog(app.log))
    .use(securityHeaders())
    .route('/api', api)
    .get('/openapi.yaml', async (c) => c.body(await readFile(join(ROOT, 'openapi.yaml')), 200, { 'content-type': 'text/yaml; charset=utf-8' }))
    .get('*', serveWebApp(options.publicDir ?? join(ROOT, 'public')))
    .onError(createErrorHandler(app.log));
}
export type App = ReturnType<typeof createApp>;
