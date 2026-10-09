# Creator OS

Turns your raw material (voice memo transcripts, call transcripts, rough notes) into X posts and threads, and treats your published archive as a **standard every draft must pass** rather than examples it copies. Built from `creator_os_PRD.md` v1.0.

## Run it

Needs Node 22.18 or newer (it runs the TypeScript source directly, no build step for the server) and Python 3.10 or newer for the agents (standard library only, nothing to `pip install`).

```bash
npm install        # four server dependencies: hono, @hono/node-server, @hono/zod-validator, zod
npm run seed       # optional: a 44-post sample archive and 4 sample sources (illustrative, not real posts)
npm start          # http://localhost:4173, then create your account (it starts the Python agents itself)
npm test           # 60 Node tests (API, accounts, agents end to end) and 31 Python tests (the agents)
npm run check      # typecheck the server and the web app
```

Open the app and create an account. The first account takes over whatever is already in the database (the seeded samples included); later accounts start empty and never see each other's data. To seed samples into an existing account, run `SEED_EMAIL=you@example.com npm run seed`.

## Where the backend and the data live

| What | Where |
|---|---|
| Backend code | `src/`, split into feature modules: `routes` (validate input) → `service` (business rules) → `db/repositories` (the only SQL) |
| Database | `data/creator-os.db`, one SQLite file. Set `CREATOR_OS_DB` to move it |
| Uploaded audio | `data/uploads/`. Set `CREATOR_OS_UPLOADS` to move it |
| Schema | `src/db/migrations/*.sql`, applied in order on boot. `0003_accounts.sql` adds users, sessions and an owner on every table |
| Accounts | `src/modules/auth/`: sign-up, log-in, sessions, password change, 2-step codes |
| Agents | `agents/creator_agents/` (Python): Reviewer, Scorer, Decision and their model tool loop (Claude or an OpenAI-compatible API such as Groq). The Node app starts it on a private local port and keeps all data access to itself |
| API contract | `openapi.yaml`, served at `/openapi.yaml` |

Why SQLite and how to move to Postgres later: `docs/adr/001-sqlite-as-the-store.md`. The layers and rules: `docs/architecture.md`.

## The UI

React 19, Vite, Tailwind 4 and real shadcn/ui components (new-york-v4, in `web/src/components/ui/`), laid out like the shadcn dashboard: an inset sidebar, stat cards, then tables and tabs. Source lives in `web/`; it builds into `public/`. Code rules for the web app are in `web/CONVENTIONS.md`.

```bash
npm run build:web  # rebuild public/ after changing web/src
npm run dev:web    # Vite dev server on :5173, proxying /api to :4173 (run npm start alongside)
```

How the web code is organised:

- `web/src/features/<feature>/`: one folder per screen (sources, drafts, review, archive, results, settings). Each has an `api.ts` with its TanStack Query hooks, a page, small components and hooks.
- `web/src/api/`: a typed client generated from the server's own route types (Hono RPC), so the web app and API cannot drift apart.
- `web/src/components/ui/` (shadcn), `components/shared/` (page header, stat card, status badge, empty and error states), `components/layout/` (sidebar, header).
- `web/src/lib/labels.ts`: every user-facing name for a server value, in one place.

Keyboard:

| Keys | Does |
|---|---|
| `⌘K` / `Ctrl K` | Command menu |
| `C` | New capture |
| `G` then `I` / `D` / `A` / `R` | Go to Inbox, Drafts, Archive, Results |
| `1`–`3` | Pick an angle on a source |
| `J` / `K` | Move between a draft's sentences |
| `A` / `E` / `R` | Accept, edit, reject a draft |
| `←` / `→` | Label calibration pairs |
| `?` | All shortcuts |

Screens:

- **Inbox**: stat cards and a table of everything captured. New capture opens a side sheet with three tabs: upload many files (each a row with its own title, kind, consent and progress), record in the browser, or paste.
- **Source**: the transcript with your claims highlighted, angle cards to draft from, claims, and the extraction log.
- **Drafts** and **Review**: the post with a proof mark on each sentence, Source / Agents / History tabs, accept, edit or reject, then a typed `POST` confirm and an Open in X link (the app never posts for you).
- **Audience** (a tab on a decided draft): rehearses the post with 12 simulated followers over 10 rounds, then shows likes, replies, pushback and which sentences people reacted to. It uses the same `LLM_API_KEY` (Groq by default); without a key it shows a labelled rule-based estimate.
- **Archive**: your posts, import with a preview, retire and restore, and calibration of the repeat threshold.
- **Results**: acceptance with and without checks, rejections, flags, agents, drift and the run table with CSV export. Locked until every draft in review has a decision.
- **Log in** and **sign up**: every creator has their own account and sees only their own data. The first account takes over anything already in the database.
- **Settings**: your account (password, log out), optional 2-step codes, agents, theme, and which providers are active.

## Providers: works offline, better with keys

| Env var | Effect when set | Without it |
|---|---|---|
| `ANTHROPIC_API_KEY` | Claude extracts claims, proposes angles, drafts (`claude-sonnet-5-5`) and judges entailment (`claude-haiku-4-5-20251001`) | Deterministic local heuristics do each step, so the full workflow still runs |
| `LLM_API_KEY` | Free option for demos: the same steps run on Groq's free tier (`openai/gpt-oss-120b` drafts and runs the agents, `openai/gpt-oss-20b` judges). Get a key at console.groq.com, no card needed. Set `LLM_BASE_URL` to use any other OpenAI-compatible API (OpenRouter, Gemini, Mistral, OpenAI). Used only when `ANTHROPIC_API_KEY` is not set | Local heuristics, as above |
| `OPENAI_API_KEY` | `text-embedding-3-small` for repetition and voice checks (default threshold 0.82) | Local hashed lexical embeddings (default threshold 0.60) |
| `ASSEMBLYAI_API_KEY` | Audio uploads (.m4a .mp3 .wav .mp4) are transcribed with speaker labels | Audio sources fail cleanly with a "paste the transcript" fallback |
| `CREATOR_OS_SIGNUP` | `closed`: only the first account can be created; everyone after that is turned away | `open`: anyone who can reach the server can create an account |
| `CREATOR_OS_OWNER_EMAIL` | Only this email takes over data from before accounts, and closed sign-up still lets it in. Set it when you deploy an existing database, so a stranger who signs up first gets an empty account | The first sign-up takes it over |
| `NODE_ENV=production` | Session cookies are `Secure` (HTTPS only). Always set it when deployed | Cookies also work over plain http, for localhost |
| `TRUST_PROXY` | Set to `1` on Render or Fly, so rate limits count each visitor rather than the proxy | Limits count the direct connection |
| `CREATOR_OS_DB`, `PORT` | Database file path (default `data/creator-os.db`), port (default 4173) | |
| `CREATOR_OS_CONDITION` | Forces `gate` or `context_only` for demos | Seeded, balanced assignment (see below) |
| `CREATOR_OS_MAIN_MODEL`, `CREATOR_OS_JUDGE_MODEL` | Override model ids | |
| `CREATOR_OS_PYTHON` | The Python the agents run on, for example `python3.12` or a full path | `python3` |
| `CREATOR_OS_AGENTS_URL`, `AGENTS_SERVICE_TOKEN` | Use an agents service you started yourself (`npm run agents` with the same token) on the same machine, for example to debug it | The app starts and stops the agents service itself |

The Reviewer, Scorer and Decision agents use tool calling on whichever model is set: Claude first, then the `LLM_API_KEY` model. With neither, they run their local rule versions. Free plans allow only a few requests a minute; when the limit is hit the agent waits and retries twice, and if it is still limited it fails with a message saying to wait a minute and use "Run agents again". A `403 ... error code: 1010` means the provider's firewall refused the request rather than the key; every request names itself with a `creator-os` user agent, which Groq's firewall requires since v0.7.2.

Third-party calls only happen for the keys you set. Calls with other people require ticking a consent box before they are processed.

Security: see `docs/security.md` for what is protected and how.

Re-run calibration after switching embedding providers; thresholds are stored per provider.

## The workflow

1. **Archive** (FR-002, 010, 011): import `tweets.js`, CSV, or pasted posts. Threads are grouped, retweets and replies to others dropped, re-import is idempotent, and a seeded 20% is held out (never used as a reference, only to estimate natural variance and the voice false-flag rate). Label pairs as same angle or different and fit the repetition threshold to your F1. Retire angles you are done saying.
2. **Inbox** (FR-001): paste or upload. Multi-speaker transcripts (`Name [mm:ss]: text`) ask once which speaker is you.
3. **Claims** (FR-003): every claim's quote is located in the transcript by string match and its offsets recomputed. Quotes that do not verify are dropped and logged. Other speakers' claims are marked and can only be drafted with attribution.
4. **Angle** (FR-007): three proposed leads, each with the closest earlier post and a label if it matches a retired angle. Pick one, write your own, or skip (logged as `auto_angle`).
5. **Draft** (FR-004): structured output, every assertion cites claim ids. Character limits are enforced by a rule (URLs count 23, emoji 2), over-limit posts re-split once.
6. **Gate** (FR-005, 008): per sentence, before you look:
   - traceability: citation exists, quote still matches the transcript at its offsets, other speakers attributed, numbers not in the source rejected, then an entailment judge (supported / partial / unsupported)
   - repetition: nearest archive pieces above your threshold, with date and link; retired angles flag at high severity
   - channel rules: length, broken mentions or links, numbering, markdown links
   - voice (advisory): sentence features beyond 2 SD of your archive, draft distance from your archive centre
   - a "connective" sentence that carries numbers or substance is checked as an assertion, so the label cannot dodge the check
   - any check that throws makes the draft `gate_failed`; it cannot be accepted until the checks run (fail closed). Voice is the one check that degrades with a visible notice instead.
7. **Review** (FR-006): sentences carry proof marks; selecting one highlights the exact words it rests on in the transcript. Unsupported, partial and repeated sentences block Accept until you edit them or log a reason.
8. **Re-check and publish**: every accept re-runs all checks on the final text. Publishing needs a clean re-check and a typed `POST`; then you copy the posts or open X compose. Creator OS never calls the X API. Any later edit invalidates the confirmation. You mark it posted yourself.
9. **Evidence** (FR-009, 012): locked while any draft is waiting for a decision. Gate vs context-only light-edit acceptance with Wilson 95% intervals, weekly trend, rejected-and-fixed vs abandoned, flags shown / edited / overridden, memory on vs off, whether voice flags predict rejection, drift (homogeneity ratio vs your archive's P90, centroid distance, opening patterns, side-by-side pairs), CSV export.

## Agents

Three agents run on every draft once the checks finish. Each one plans its own steps, calls read-only tools (`get_draft`, `get_claims`, `search_archive`, `check_sentence`, `check_posts`, `voice_profile`), and finishes by calling a submit tool whose output is validated. An invalid submission is sent back for correction. Every step is kept as a trace you can open on the review screen.

| Agent | What it does | What it cannot do |
|---|---|---|
| **Reviewer** | Finds unsupported, partial, repeated, off-voice and over-length sentences, proposes the smallest fix using only your claims, and verifies each fix with the real checks. | Its own claim that a fix passes is ignored: the server re-runs every check on its revised version. It never edits your draft; you choose "Start from the reviewer's version". |
| **Scorer** | Scores 1 to 5 on five dimensions. Backed by source, new to your archive and sounds like you are **measured by rules**; opening and clarity are **judged by the model** against your own writing. | It does not rescore the measured dimensions. |
| **Decision** | Predicts accept, edit or reject, with a confidence and a reason. | It never decides. Its prediction is hidden until you decide (switchable on the Evidence page), and the Evidence page reports how often it matched you. |

The agents are written in Python (`agents/creator_agents/`) and run as a small internal service. The Node app keeps everything that touches your data: accounts, the database, the checks and the archive search. For each draft it sends the agents service the draft, your claims and voice statistics, plus a one-time token. When an agent calls `search_archive`, `check_sentence` or `check_posts`, the service calls back to the Node app with that token, which only works for that one draft and stops working when the agents finish. The Node app then checks every result before storing it, and re-checks the Reviewer's version itself.

With `ANTHROPIC_API_KEY` set, they run as Claude tool-use loops (`CREATOR_OS_AGENT_MODEL`, default `claude-sonnet-5-5`, up to 8 steps). With only `LLM_API_KEY`, the same loop runs on that API's function calling (default `openai/gpt-oss-120b` on Groq). Without either, local rule-based versions call the same tools in a fixed order. If one agent fails, the others still run, and "Run agents again" retries. Agents never run on a draft whose checks failed.

Blinding: under `context_only` every agent's output is hidden until you decide, because the review would reveal the checks. Under `gate` the Reviewer and Scorer appear before you decide, so in this build the gate arm means archive checks plus Reviewer and Scorer. Turn agents off on the Evidence page to test the gate on its own.

Evidence: how often the Decision agent matched your first decision (with a Wilson interval, by condition, and a prediction-to-decision table), how often you started from the Reviewer's version and your light-edit rate when you did, and whether the Scorer's overall score separates drafts you accepted lightly from everything else. Decisions record `assist: "reviewer"` when the final text started from the Reviewer's version.

## Experiment design as implemented

- **Condition assignment**: seeded block randomisation. Runs are paired in creation order and each pair holds one `gate` and one `context_only`, in seeded order, so 24 runs give exactly 12 and 12, reproducibly.
- **Blinding**: the condition is never returned before a decision. Under `context_only` the checks run and are stored but are withheld from the review screen and not enforced; they are revealed after the decision. (The absence of proof marks does reveal the condition; the PRD accepts "blind when possible".)
- **Prompts** are identical across conditions except one block: `gate` gets a statistical voice summary with no archive text, `context_only` gets the 5 nearest archive posts. A test asserts the gate prompt contains no archive text. Prompt versions are stored on each run.
- **Outcomes**: light accept = edit ratio ≤ 0.15 on the final text and no claim added or removed. A rejected draft published within 2 minutes of rejection is `rejected_fixed`; unpublished after 48 hours is `abandoned`.
- **Publish re-check is enforced in both conditions.** It runs after the decision is recorded, so it does not affect the acceptance measure, and it keeps "zero untraceable claims published" true for every run.

## Where each decision sits

| Decision | Owner |
|---|---|
| Quote is in the transcript at the span | Rule (string match) |
| Character limits, thread split, channel rules | Rule |
| Claim supports the sentence | Model judge (or local overlap), fail closed |
| Repetition of the archive | Embeddings + threshold fitted to your labels |
| Voice distance | Statistics, advisory only |
| Which angle leads | You (three proposals) |
| Whether the piece deserves to exist | You |
| Proposed fixes | Reviewer agent, verified by the gate; you choose whether to use them |
| Taste scores (opening, clarity) | Scorer agent, advisory |
| Predicted decision | Decision agent, hidden until you decide, scored for agreement |
| Publish | You: typed confirm, manual post |

## Deviations from the PRD stack

The PRD names Next.js, Supabase (Postgres + pgvector, Auth, Storage) and Vercel. No repository or Supabase project was attached, so this build is a self-contained Node server with SQLite (`node:sqlite`), in-process background jobs, brute-force cosine search (fine for 1 user and up to roughly 20k chunks), and email and password accounts (with optional 2-step codes) instead of magic-link auth. The schema mirrors PRD section 11 and the API mirrors section 9, so moving to Supabase means new repositories in `src/db/repositories/` and a pgvector query in place of the cosine scan in `src/modules/checks/`.

Not built: blind voice test (FR-013), LinkedIn adapter (FR-016, out of scope by design).

## Deploy

It is one service: `npm start` runs the web app, which starts the Python agents next to it. The host needs Node 22.18+ and Python 3.10+, and a disk for `data/`.

- **Any host with Docker** (Render, Fly.io, Railway, a VPS): the included `Dockerfile` has both. Mount a persistent disk at `/app/data`.
- **A host with Node and Python already installed**: build command `npm ci --omit=dev`, start command `npm start`.

Set `NODE_ENV=production`, `HOST=0.0.0.0`, `TRUST_PROXY=1` behind Render or Fly, `CREATOR_OS_OWNER_EMAIL` if you bring an existing database, and the provider keys you want (`LLM_API_KEY` for Groq's free tier). The agents service needs no port of its own and is never reachable from outside: it listens on 127.0.0.1 only.

## Layout

```
src/main.ts               boot: env, migrations, server, graceful shutdown
src/app.ts                Hono app: request log, auth, feature routers, one error handler
src/modules/<feature>/    *.routes.ts, *.service.ts, *.schemas.ts per feature:
                          sources, runs, decisions, checks, agents, archive, metrics, system
src/db/                   SQLite client, migrations, repositories
src/providers/            llm (Anthropic | local), embeddings (OpenAI | local), transcription, retry
agents/creator_agents/    Python agents service: reviewer, scorer, decision, tool loop, HTTP server
agents/tests/             unittest suites for the agents
src/domain/               types and pure functions
src/prompts/              versioned prompts, one per step
web/src/                  UI source (see above)
public/                   built UI, served as is
test/                     node:test suites (agents.test.ts runs the real Python service)
docs/                     architecture, ADRs
fixtures/                 sample archive and sources
openapi.yaml              API contract
```
