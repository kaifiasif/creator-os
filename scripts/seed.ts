/**
 * Loads the sample archive and four sample sources into the local database.
 * Sample data is illustrative, not real published posts. Replace it with your own X export.
 *
 * With SEED_EMAIL set, the samples go to that existing account. Otherwise they wait for the
 * first account to sign up, which takes them over.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { configFromEnv, loadEnv } from '../src/config/env.ts';
import { createContext } from '../src/context.ts';
import { AppError, ErrorCode } from '../src/core/errors.ts';
import { createLogger } from '../src/core/logger.ts';
import { openDatabase } from '../src/db/client.ts';
import { migrate } from '../src/db/migrate.ts';
import { nowIso, uuidv7 } from '../src/domain/ids.ts';
import { ArchiveImportInput } from '../src/modules/archive/archive.schemas.ts';
import { importArchive } from '../src/modules/archive/archive.service.ts';
import { createSource, type CreateSourceInput } from '../src/modules/sources/sources.service.ts';
import { createProviders } from '../src/providers/index.ts';

const FIXTURES = join(import.meta.dirname, '..', 'fixtures');
const fixture = (name: string) => readFile(join(FIXTURES, name), 'utf8');

const env = loadEnv();
const db = openDatabase(env.CREATOR_OS_DB);
migrate(db);
const app = createContext({ db, providers: createProviders(env), config: configFromEnv(env), log: createLogger({ script: 'seed' }, false) });

const seedEmail = process.env.SEED_EMAIL?.trim().toLowerCase();
const account = seedEmail ? app.accounts.findByEmail(seedEmail) : undefined;
if (seedEmail && !account) throw new Error(`No account for SEED_EMAIL=${seedEmail}. Sign up first, or leave SEED_EMAIL unset.`);
const owner = account?.id ?? app.accounts.unclaimedOwner() ?? (app.accounts.hasAccounts() ? undefined : app.accounts.ensureUnclaimedOwner(uuidv7(), nowIso()));
if (!owner) throw new Error('Accounts already exist. Set SEED_EMAIL to the account that should get the sample data.');
const ctx = app.forUser(owner);
console.log('seeding for', account ? seedEmail : 'the first account to sign up');

const archive = ArchiveImportInput.parse(JSON.parse(await fixture('sample-archive.json')));
console.log('archive', await importArchive(ctx, archive));

const sources: CreateSourceInput[] = [
  { title: 'Walk memo: why review takes so long', kind: 'voice_memo', text: await fixture('voice-memo.txt'), consent_confirmed: false },
  { title: 'Call with Priya about FDE roles', kind: 'call', text: await fixture('call-with-mentor.txt'), consent_confirmed: true },
  { title: 'Server components migration notes', kind: 'note', text: await fixture('rough-notes.md'), consent_confirmed: false },
  { title: 'Memo: bundle size and shipping small', kind: 'voice_memo', text: await fixture('repeat-memo.txt'), consent_confirmed: false },
];
for (const source of sources) {
  try {
    console.log('source', source.title, await createSource(ctx, source));
  } catch (error) {
    // re-seeding an existing database hits the duplicate check; anything else is a real failure
    if (!(error instanceof AppError) || error.code !== ErrorCode.DUPLICATE_SOURCE) throw error;
    console.log('source', source.title, 'already added');
  }
}
await ctx.jobs.idle();
db.close();
console.log(`done: ${env.CREATOR_OS_DB}`);
