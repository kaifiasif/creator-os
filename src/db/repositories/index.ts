import type { Database } from '../client.ts';
import { createAgentsRepository } from './agents.repository.ts';
import { createArchiveRepository } from './archive.repository.ts';
import { createDecisionsRepository } from './decisions.repository.ts';
import { createDraftsRepository } from './drafts.repository.ts';
import { createMetricsRepository } from './metrics.repository.ts';
import { createRunsRepository } from './runs.repository.ts';
import { createSettingsRepository } from './settings.repository.ts';
import { createSourcesRepository } from './sources.repository.ts';

/**
 * The only code that writes SQL. Services depend on these, never on the database directly.
 * Every repository is bound to one creator: ownership is enforced here, in the queries, so a
 * service cannot forget it and an id from another account reads as "not found".
 */
export function createRepositories(db: Database, userId: string) {
  return {
    settings: createSettingsRepository(db, userId),
    archive: createArchiveRepository(db, userId),
    sources: createSourcesRepository(db, userId),
    runs: createRunsRepository(db, userId),
    drafts: createDraftsRepository(db, userId),
    decisions: createDecisionsRepository(db, userId),
    agents: createAgentsRepository(db, userId),
    metrics: createMetricsRepository(db, userId),
  };
}
export type Repositories = ReturnType<typeof createRepositories>;
