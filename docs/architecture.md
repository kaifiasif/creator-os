# Creator OS architecture

Creator OS runs as one service. A Node process serves the API and the built web app and keeps everything in one SQLite file; it starts a small Python process next to it for the Reviewer, Scorer and Decision agents.

## Where things live

| What | Where |
|---|---|
| Backend code | `src/` (TypeScript, run directly by Node 22, no build step) |
| Database | `data/creator-os.db` (SQLite; set `CREATOR_OS_DB` to move it) |
| Uploaded audio | `data/uploads/` (set `CREATOR_OS_UPLOADS`) |
| Schema | `src/db/migrations/*.sql`, applied in order on boot |
| API contract | `openapi.yaml` (served at `/openapi.yaml`) |
| Web app source | `web/src/`; its build lands in `public/` |
| Agents | `agents/creator_agents/` (Python 3.10+, standard library only) |
| Tests | `test/*.test.ts` and `agents/tests/` (`npm test` runs both) |

## Layers

```
HTTP request
  └─ src/app.ts                 middleware: request id + log, bearer auth, one error handler
      └─ modules/<feature>/*.routes.ts     parse + validate input with zod; no logic
          └─ modules/<feature>/*.service.ts business rules; throws AppError with a stable code
              ├─ db/repositories/*.ts      the only code that writes SQL; returns typed domain objects
              ├─ providers/*.ts            everything that leaves the machine (Claude, OpenAI, AssemblyAI)
              └─ domain/*.ts               pure functions: text, stats, types
```

Rules the code follows:

- **Validation happens once, at the route.** Services receive typed values and do not re-check them.
- **Only repositories touch SQL.** They expose intention-named methods (`markReady`, `saveClaims`, `confirm`), never a generic `update(table, patch)`, so every write is findable.
- **No singletons.** Everything a service needs arrives in an `AppContext` (`src/context.ts`). Tests build one with an in-memory database and swap providers on it.
- **Errors are part of the contract.** Every failure a caller can cause has a code (`src/core/errors.ts`). Caller mistakes return 4xx and log at info; our failures return 500 with a request id and log the stack.
- **Retries live in one place:** `providers/retry.ts`, with jitter, and never for 4xx. Every outbound call has a timeout.
- **Background work owns its failures.** Transcription, drafting and the agents run as jobs (`core/jobs.ts`); each records `failed` plus the reason on its own row, so nothing is left stuck in a running state.

## Feature modules

| Module | Owns |
|---|---|
| `archive` | Import (paste, CSV, X export), preview, holdout split, voice reference, retiring angles |
| `sources` | Upload rules, transcription → speaker mapping → claim extraction, angles |
| `checks` | The pre-review gate: traceability, repetition, channel rules, voice |
| `runs` | Condition assignment, draft generation, the blinded review view |
| `agents` | Runs the Python agents: prepares each draft for them, answers their tool calls through the tool bridge, checks and stores their results, decides what is visible |
| `decisions` | Accept / edit / reject, the re-check of the final text, typed publish confirmation |
| `metrics` | Acceptance dashboard, CSV export, drift, threshold calibration |
| `system` | Health and configuration |

## The agents service

```
Node app (owns data)                                   Python agents service (owns agent logic)
  agents.service.ts  ── POST /v1/agents/<agent> ──────▶  server.py → reviewer.py | scorer.py | decision.py
     draft, claims, voice stats, one-time token            local rules, or runtime.py's model tool loop
  tool-bridge.ts     ◀── POST /tools/<tool> + token ────  bridge.py: search_archive, check_sentence, check_posts
     checks and archive search for that one draft
  agents.service.ts  ◀── { output, trace } ─────────────
     validates the output, re-checks the Reviewer's version, stores the row
```

- **The split.** Python owns what the agents do: their prompts, plans, rules, scoring and the model tool loop. The loop speaks Claude's Messages format; `openai_compat.py` translates it to OpenAI-style function calling for Groq and similar APIs, so traces and validation are the same on either. Node owns everything that touches a creator's data. The Python side never opens the database and never chooses whose data it sees.
- **Who can call what.** Both servers listen on 127.0.0.1 only, on ports the OS picks. Node calls Python with a random token it generates when it starts the child process. Python calls back with a per-draft token that Node binds to one creator and one draft and revokes when the agents finish (30 minutes at most). The `user_id` sent to Python is used only for log lines.
- **Trust.** Node validates every output with the same zod schemas as before (`agent.types.ts`) and re-runs the checks on the Reviewer's version. Python validates every model submission and tool input against JSON schemas (`schemas.py`), and Node validates tool inputs again at the bridge.
- **Lifecycle.** The child starts on the first agent run and is restarted on the next run if it dies. If Python is missing, the agents fail with that reason on their rows and the rest of the app keeps working. `CREATOR_OS_AGENTS_URL` points at a service started by hand instead.
- **Parity.** Numbers and text follow JavaScript's rules (`jsnum.py`) so scores and notes read the same as the earlier TypeScript agents; the port was checked against them on twelve drafts with identical outputs and traces.

## Data model

Tables are `STRICT` and the important rules are enforced by the database, not only by the code. Some examples from `0001_initial.sql`:

- a call cannot be stored without consent;
- a claim's quote must be exactly as long as its character span;
- an accepted decision must carry its final text, hash and re-check result, and a rejection must carry a reason;
- a draft cannot be marked posted unless it was confirmed;
- every foreign key has an index and an explicit `ON DELETE`.

IDs are UUIDv7 (time-ordered). Embeddings are stored as float32 blobs. Times are ISO-8601 UTC strings.

Why SQLite and how to move to Postgres: see [ADR-001](adr/001-sqlite-as-the-store.md).
