/** Boot: parse env, open and migrate the database, build the context, serve. */
import { serve } from '@hono/node-server';
import { createApp } from './app.ts';
import { configFromEnv, loadEnv } from './config/env.ts';
import { createContext } from './context.ts';
import { createLogger } from './core/logger.ts';
import { openDatabase } from './db/client.ts';
import { migrate } from './db/migrate.ts';
import { agentServiceOptions, createAgentService } from './modules/agents/agent-service.ts';
import { sweepSessions } from './modules/auth/auth.service.ts';
import { createProviders } from './providers/index.ts';

const SHUTDOWN_GRACE_MS = 10_000;
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);
const SESSION_SWEEP_MS = 60 * 60 * 1000;

function main(): void {
  const log = createLogger({ service: 'creator-os' });
  const env = loadEnv();
  const host = process.env.HOST ?? '127.0.0.1';

  const db = openDatabase(env.CREATOR_OS_DB);
  const { applied } = migrate(db);
  if (applied.length) log.info('migrated', { applied });

  const agentService = createAgentService(agentServiceOptions(env), log.child({ component: 'agents' }));
  const app = createContext({ db, providers: createProviders(env), config: configFromEnv(env), log, agentService });
  if (!LOCAL_HOSTS.has(host) && !app.config.secureCookies) {
    // session cookies sent over plain http can be read on the network
    log.warn('insecure_cookies', { host, hint: 'Serve over HTTPS with NODE_ENV=production so session cookies are Secure.' });
  }
  if (app.accounts.unclaimedOwner()) log.info('unclaimed_data', { hint: 'The first account to sign up takes over the existing archive, sources and runs.' });
  sweepSessions(app);
  const sweeper = setInterval(() => sweepSessions(app), SESSION_SWEEP_MS);
  sweeper.unref();

  const server = serve({ fetch: createApp(app).fetch, hostname: host, port: env.PORT }, () => {
    const { llm, embeddings, transcription } = app.providers;
    log.info('listening', { url: `http://${host}:${env.PORT}`, db: env.CREATOR_OS_DB, signup: app.config.signup, llm: llm.name, embeddings: embeddings.name, transcription: transcription.name });
  });

  // finish in-flight jobs (they write their own status), then close the database
  const shutdown = (signal: string) => {
    log.info('shutting_down', { signal, pending_jobs: app.jobs.pending });
    server.close();
    const timer = setTimeout(() => process.exit(1), SHUTDOWN_GRACE_MS);
    void app.jobs.idle().then(() => {
      clearTimeout(timer);
      db.close();
      process.exit(0);
    });
  };
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

main();
