# ADR-001: Keep SQLite as the data store

**Status:** Accepted
**Date:** 2026-10-07

## Context

Creator OS is used by one creator on their own machine. Its data is small: a few thousand archive posts, a few hundred sources and drafts, and their embeddings. Writes come from one person plus a few background jobs. The data is private (unpublished drafts, recorded calls), so keeping it local is a feature.

## Decision

Keep SQLite, through Node's built-in `node:sqlite`, with:

- versioned migrations (`src/db/migrations`, tracked in `schema_migrations`);
- `STRICT` tables with CHECK, NOT NULL, UNIQUE and foreign-key constraints for every invariant the product relies on;
- WAL mode, `foreign_keys = ON`, a 5 s busy timeout;
- all SQL behind repositories, so the rest of the code does not know which database it talks to.

## Options considered

| | SQLite (chosen) | Postgres |
|---|---|---|
| Setup for the creator | None: one file | Install or run a server |
| Backup | Copy one file | `pg_dump` |
| Concurrency | One writer at a time; enough for one person | Many writers |
| Vector search | Brute-force cosine in Node (fine below ~50k vectors) | pgvector indexes |
| Multi-user and hosting | Not suitable | Suitable, with row-level security |

## Consequences

- Easier: zero-setup install, trivially private, fast tests on `:memory:`.
- Harder: hosting it for several people, or archives far beyond tens of thousands of posts.

## When to revisit, and how to move

Move to Postgres when Creator OS becomes hosted or multi-user, or repetition search gets slow. The path:

1. Translate `0001_initial.sql` (`TEXT` times become `timestamptz`, `BLOB` embeddings become `vector(n)` with pgvector, JSON columns become `jsonb`).
2. Re-implement `src/db/client.ts` on `pg`; repositories keep their method signatures, so services and routes do not change.
3. Add `creator_id` to every table and enable row-level security before the first second user.
4. Copy data with a one-off script that reads through the SQLite repositories and writes through the Postgres ones.
