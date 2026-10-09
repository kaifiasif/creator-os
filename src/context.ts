import type { AppConfig } from './config/env.ts';
import { createJobRunner, type JobRunner } from './core/jobs.ts';
import { createLogger, type Logger } from './core/logger.ts';
import type { Database } from './db/client.ts';
import { createAccountsRepository, type AccountsRepository } from './db/repositories/accounts.repository.ts';
import { createRepositories, type Repositories } from './db/repositories/index.ts';
import { createAgentService, type AgentService } from './modules/agents/agent-service.ts';
import type { AgentImplementations } from './modules/agents/agent.types.ts';
import { createToolBridge, type ToolBridge } from './modules/agents/tool-bridge.ts';
import type { VoiceReference } from './modules/archive/voice-reference.ts';
import type { Providers } from './providers/index.ts';

/** Derived from one creator's archive; rebuilt lazily after every import. */
export interface UserCache {
  voiceReference: VoiceReference | null;
}

/**
 * Process-wide dependencies, passed explicitly. No module-level singletons: tests build these with
 * fake providers and an in-memory database, and production builds them at boot.
 *
 * Nothing here can read creator data: the only way to reach archive, sources, runs or metrics is
 * `forUser`, which hands back repositories that filter every query by that creator.
 */
export interface AppServices {
  db: Database;
  providers: Providers;
  config: AppConfig;
  jobs: JobRunner;
  log: Logger;
  /** Users and sessions. Only the auth module uses this. */
  accounts: AccountsRepository;
  /** The Python agents service, and the bridge its tools call back through. */
  agents: { service: AgentService; bridge: ToolBridge };
  /** Test seam: replace an agent's implementation without touching providers. */
  agentOverrides: AgentImplementations | null;
  forUser(userId: string): AppContext;
}

/** What a feature service sees: one signed-in creator's data and nothing else. */
export interface AppContext extends Omit<AppServices, 'forUser' | 'accounts'> {
  userId: string;
  repos: Repositories;
  cache: UserCache;
}

/** Voice references are rebuilt from the archive on demand, so dropping the oldest is only a cost. */
const MAX_CACHED_USERS = 50;

export function createContext(deps: { db: Database; providers: Providers; config: AppConfig; log?: Logger; agentService?: AgentService }): AppServices {
  const log = deps.log ?? createLogger();
  const caches = new Map<string, UserCache>();
  const cacheFor = (userId: string): UserCache => {
    let cache = caches.get(userId);
    if (!cache) {
      if (caches.size >= MAX_CACHED_USERS) caches.delete(caches.keys().next().value as string);
      cache = { voiceReference: null };
      caches.set(userId, cache);
    }
    return cache;
  };

  const services: AppServices = {
    db: deps.db,
    providers: deps.providers,
    config: deps.config,
    jobs: createJobRunner(log),
    log,
    accounts: createAccountsRepository(deps.db),
    // without explicit options the service starts with local rules only: no model key reaches it
    agents: { service: deps.agentService ?? createAgentService({ ...deps.config.agentService, logs: false }, log), bridge: createToolBridge() },
    agentOverrides: null,
    // read at call time, so a test that swaps providers or overrides affects the next request
    forUser: (userId) => ({
      db: services.db,
      providers: services.providers,
      config: services.config,
      jobs: services.jobs,
      agents: services.agents,
      log: services.log.child({ user_id: userId }),
      agentOverrides: services.agentOverrides,
      userId,
      repos: createRepositories(services.db, userId),
      cache: cacheFor(userId),
    }),
  };
  return services;
}
