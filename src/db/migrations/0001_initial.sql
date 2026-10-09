-- Creator OS schema, version 1.
--
-- Conventions
--   * STRICT tables: SQLite rejects a value of the wrong type instead of silently storing it.
--   * Ids are UUIDv7 text (time-ordered, not guessable). Timestamps are ISO-8601 UTC text.
--   * Booleans are INTEGER constrained to 0/1. JSON columns are checked with json_valid().
--   * Embeddings are BLOBs of little-endian float32.
--   * Every foreign key has an index and an explicit ON DELETE rule.
--   * Invariants live here, not only in the services: a bad row cannot be written.

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL CHECK (json_valid(value))
) STRICT;

-- ---------------------------------------------------------------- archive
CREATE TABLE archive_pieces (
  id                 TEXT PRIMARY KEY,
  external_id        TEXT NOT NULL UNIQUE,
  text               TEXT NOT NULL CHECK (length(trim(text)) > 0),
  parts              TEXT CHECK (parts IS NULL OR (json_valid(parts) AND json_type(parts) = 'array')),
  published_at       TEXT NOT NULL,
  url                TEXT,
  embedding          BLOB NOT NULL,
  embedding_provider TEXT NOT NULL,
  is_holdout         INTEGER NOT NULL DEFAULT 0 CHECK (is_holdout IN (0, 1)),
  retired            INTEGER NOT NULL DEFAULT 0 CHECK (retired IN (0, 1)),
  retired_reason     TEXT,
  created_at         TEXT NOT NULL,
  CHECK (retired = 1 OR retired_reason IS NULL)
) STRICT;
CREATE INDEX archive_pieces_published ON archive_pieces (published_at DESC);
CREATE INDEX archive_pieces_reference ON archive_pieces (is_holdout);

CREATE TABLE archive_chunks (
  id        TEXT PRIMARY KEY,
  piece_id  TEXT NOT NULL REFERENCES archive_pieces (id) ON DELETE CASCADE,
  text      TEXT NOT NULL,
  embedding BLOB NOT NULL
) STRICT;
CREATE INDEX archive_chunks_piece ON archive_chunks (piece_id);

-- ---------------------------------------------------------------- sources
CREATE TABLE source_items (
  id                TEXT PRIMARY KEY,
  title             TEXT NOT NULL CHECK (length(trim(title)) > 0),
  kind              TEXT NOT NULL CHECK (kind IN ('voice_memo', 'call', 'note')),
  content_hash      TEXT NOT NULL UNIQUE,
  storage_path      TEXT,
  mime              TEXT NOT NULL,
  status            TEXT NOT NULL CHECK (status IN ('transcribing', 'mapping', 'extracting', 'ready', 'nothing_postable', 'failed')),
  transcript_text   TEXT,
  speakers          TEXT CHECK (speakers IS NULL OR (json_valid(speakers) AND json_type(speakers) = 'array')),
  creator_speaker   TEXT,
  consent_confirmed INTEGER NOT NULL DEFAULT 0 CHECK (consent_confirmed IN (0, 1)),
  extraction_log    TEXT CHECK (extraction_log IS NULL OR json_valid(extraction_log)),
  error             TEXT,
  created_at        TEXT NOT NULL,
  -- calls are only processed with everyone's consent
  CHECK (kind <> 'call' OR consent_confirmed = 1),
  -- something to read: an audio file or a transcript
  CHECK (storage_path IS NOT NULL OR transcript_text IS NOT NULL),
  -- claims are attributed relative to the creator, so drafting needs to know who that is
  CHECK (status NOT IN ('extracting', 'ready', 'nothing_postable') OR creator_speaker IS NOT NULL)
) STRICT;
CREATE INDEX source_items_created ON source_items (created_at DESC);

CREATE TABLE transcript_segments (
  id             TEXT PRIMARY KEY,
  source_item_id TEXT NOT NULL REFERENCES source_items (id) ON DELETE CASCADE,
  position       INTEGER NOT NULL CHECK (position >= 0),
  speaker        TEXT NOT NULL,
  start_ms       INTEGER CHECK (start_ms IS NULL OR start_ms >= 0),
  end_ms         INTEGER CHECK (end_ms IS NULL OR end_ms >= start_ms),
  char_start     INTEGER NOT NULL CHECK (char_start >= 0),
  char_end       INTEGER NOT NULL CHECK (char_end >= char_start),
  text           TEXT NOT NULL,
  UNIQUE (source_item_id, position)
) STRICT;

CREATE TABLE claims (
  id             TEXT PRIMARY KEY,
  source_item_id TEXT NOT NULL REFERENCES source_items (id) ON DELETE CASCADE,
  text           TEXT NOT NULL CHECK (length(trim(text)) > 0),
  speaker        TEXT NOT NULL,
  is_creator     INTEGER NOT NULL CHECK (is_creator IN (0, 1)),
  char_start     INTEGER NOT NULL CHECK (char_start >= 0),
  char_end       INTEGER NOT NULL CHECK (char_end > char_start),
  quote          TEXT NOT NULL CHECK (length(quote) = char_end - char_start),
  embedding      BLOB NOT NULL,
  retired        INTEGER NOT NULL DEFAULT 0 CHECK (retired IN (0, 1)),
  retired_reason TEXT,
  CHECK (retired = 1 OR retired_reason IS NULL)
) STRICT;
CREATE INDEX claims_source ON claims (source_item_id, char_start);

CREATE TABLE angles (
  id                 TEXT PRIMARY KEY,
  source_item_id     TEXT NOT NULL REFERENCES source_items (id) ON DELETE CASCADE,
  position           INTEGER NOT NULL CHECK (position >= 0),
  lead_claim_id      TEXT NOT NULL REFERENCES claims (id) ON DELETE CASCADE,
  claim_ids          TEXT NOT NULL CHECK (json_valid(claim_ids) AND json_type(claim_ids) = 'array' AND json_array_length(claim_ids) > 0),
  rationale          TEXT NOT NULL,
  closest_piece_id   TEXT REFERENCES archive_pieces (id) ON DELETE SET NULL,
  closest_similarity REAL CHECK (closest_similarity IS NULL OR closest_similarity BETWEEN -1 AND 1),
  retired_match      INTEGER NOT NULL DEFAULT 0 CHECK (retired_match IN (0, 1)),
  UNIQUE (source_item_id, position)
) STRICT;
CREATE INDEX angles_lead_claim ON angles (lead_claim_id);
CREATE INDEX angles_closest_piece ON angles (closest_piece_id);

-- ---------------------------------------------------------------- runs and drafts
CREATE TABLE runs (
  id                 TEXT PRIMARY KEY,
  source_item_id     TEXT NOT NULL REFERENCES source_items (id) ON DELETE RESTRICT,
  condition          TEXT NOT NULL CHECK (condition IN ('gate', 'context_only')),
  seed               INTEGER NOT NULL,
  memory_enabled     INTEGER NOT NULL CHECK (memory_enabled IN (0, 1)),
  format             TEXT NOT NULL CHECK (format IN ('post', 'thread')),
  angle_choice       TEXT NOT NULL CHECK (angle_choice IN ('picked', 'custom', 'auto_angle')),
  angle_claim_ids    TEXT NOT NULL CHECK (json_valid(angle_claim_ids) AND json_type(angle_claim_ids) = 'array' AND json_array_length(angle_claim_ids) > 0),
  custom_angle       TEXT,
  status             TEXT NOT NULL CHECK (status IN ('generating', 'gate_failed', 'in_review', 'decided', 'failed')),
  model_versions     TEXT NOT NULL CHECK (json_valid(model_versions)),
  prompt_archive_ids TEXT CHECK (prompt_archive_ids IS NULL OR json_valid(prompt_archive_ids)),
  error              TEXT,
  created_at         TEXT NOT NULL,
  ready_at           TEXT,
  CHECK (angle_choice <> 'custom' OR custom_angle IS NOT NULL)
) STRICT;
CREATE INDEX runs_source ON runs (source_item_id);
CREATE INDEX runs_created ON runs (created_at DESC);
CREATE INDEX runs_status ON runs (status);

CREATE TABLE drafts (
  id             TEXT PRIMARY KEY,
  run_id         TEXT NOT NULL UNIQUE REFERENCES runs (id) ON DELETE CASCADE,
  generated_text TEXT NOT NULL,
  gate_status    TEXT NOT NULL CHECK (gate_status IN ('clean', 'flagged', 'gate_failed')),
  gate_error     TEXT,
  voice_score    TEXT CHECK (voice_score IS NULL OR json_valid(voice_score)),
  confirmed_hash TEXT,
  confirmed_at   TEXT,
  posted_at      TEXT,
  posted_url     TEXT CHECK (posted_url IS NULL OR posted_url LIKE 'https://%'),
  note           TEXT,
  created_at     TEXT NOT NULL,
  CHECK ((confirmed_hash IS NULL) = (confirmed_at IS NULL)),
  -- nothing is marked posted without a confirmed final text
  CHECK (posted_at IS NULL OR confirmed_hash IS NOT NULL),
  CHECK (gate_status <> 'gate_failed' OR gate_error IS NOT NULL)
) STRICT;

CREATE TABLE draft_sentences (
  id            TEXT PRIMARY KEY,
  draft_id      TEXT NOT NULL REFERENCES drafts (id) ON DELETE CASCADE,
  post_position INTEGER NOT NULL CHECK (post_position >= 1),
  position      INTEGER NOT NULL CHECK (position >= 1),
  text          TEXT NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('assertion', 'connective')),
  supports      TEXT NOT NULL CHECK (json_valid(supports) AND json_type(supports) = 'array'),
  checks        TEXT NOT NULL CHECK (json_valid(checks)),
  UNIQUE (draft_id, post_position, position)
) STRICT;

CREATE TABLE decisions (
  id                  TEXT PRIMARY KEY,
  draft_id            TEXT NOT NULL REFERENCES drafts (id) ON DELETE CASCADE,
  decision            TEXT NOT NULL CHECK (decision IN ('accept', 'edit_then_accept', 'reject')),
  reject_reason       TEXT CHECK (reject_reason IN ('not_me', 'wrong_claim', 'repeat', 'not_worth_posting', 'other')),
  reject_note         TEXT,
  final_posts         TEXT CHECK (final_posts IS NULL OR (json_valid(final_posts) AND json_type(final_posts) = 'array')),
  final_text          TEXT,
  text_hash           TEXT,
  edit_ratio          REAL CHECK (edit_ratio IS NULL OR edit_ratio BETWEEN 0 AND 1),
  claim_set_changed   INTEGER CHECK (claim_set_changed IS NULL OR claim_set_changed IN (0, 1)),
  overrides           TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(overrides) AND json_type(overrides) = 'array'),
  recheck             TEXT CHECK (recheck IS NULL OR json_valid(recheck)),
  recheck_status      TEXT CHECK (recheck_status IN ('clean', 'flagged', 'gate_failed')),
  assist              TEXT CHECK (assist IN ('reviewer')),
  time_to_decision_ms INTEGER CHECK (time_to_decision_ms IS NULL OR time_to_decision_ms >= 0),
  decided_at          TEXT NOT NULL,
  -- a rejection has a reason and no final text; an accept has a checked final text and no reason
  CHECK (
    (decision = 'reject' AND reject_reason IS NOT NULL AND final_text IS NULL)
    OR (decision <> 'reject' AND reject_reason IS NULL AND final_text IS NOT NULL AND text_hash IS NOT NULL AND recheck_status IS NOT NULL)
  )
) STRICT;
CREATE INDEX decisions_draft ON decisions (draft_id, decided_at);

CREATE TABLE retired_angles (
  id         TEXT PRIMARY KEY,
  piece_id   TEXT REFERENCES archive_pieces (id) ON DELETE CASCADE,
  claim_id   TEXT REFERENCES claims (id) ON DELETE CASCADE,
  text       TEXT NOT NULL,
  reason     TEXT NOT NULL CHECK (length(trim(reason)) > 0),
  embedding  BLOB NOT NULL,
  created_at TEXT NOT NULL,
  -- an angle is retired from exactly one place
  CHECK ((piece_id IS NULL) <> (claim_id IS NULL))
) STRICT;
CREATE INDEX retired_angles_piece ON retired_angles (piece_id);
CREATE INDEX retired_angles_claim ON retired_angles (claim_id);

CREATE TABLE calibration_labels (
  id         TEXT PRIMARY KEY,
  piece_a    TEXT NOT NULL REFERENCES archive_pieces (id) ON DELETE CASCADE,
  piece_b    TEXT NOT NULL REFERENCES archive_pieces (id) ON DELETE CASCADE,
  similarity REAL NOT NULL CHECK (similarity BETWEEN -1 AND 1),
  same_angle INTEGER NOT NULL CHECK (same_angle IN (0, 1)),
  created_at TEXT NOT NULL,
  -- pairs are stored once, in id order
  CHECK (piece_a < piece_b),
  UNIQUE (piece_a, piece_b)
) STRICT;
CREATE INDEX calibration_labels_piece_b ON calibration_labels (piece_b);

CREATE TABLE agent_runs (
  id          TEXT PRIMARY KEY,
  run_id      TEXT NOT NULL REFERENCES runs (id) ON DELETE CASCADE,
  agent       TEXT NOT NULL CHECK (agent IN ('reviewer', 'scorer', 'decision')),
  status      TEXT NOT NULL CHECK (status IN ('running', 'done', 'failed')),
  output      TEXT CHECK (output IS NULL OR json_valid(output)),
  trace       TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(trace)),
  model       TEXT NOT NULL,
  version     TEXT NOT NULL,
  error       TEXT,
  ms          INTEGER CHECK (ms IS NULL OR ms >= 0),
  started_at  TEXT NOT NULL,
  finished_at TEXT,
  UNIQUE (run_id, agent),
  CHECK (status <> 'done' OR output IS NOT NULL),
  CHECK (status <> 'failed' OR error IS NOT NULL)
) STRICT;

CREATE TABLE drift_snapshots (
  id                TEXT PRIMARY KEY,
  week              TEXT NOT NULL UNIQUE,
  homogeneity_ratio REAL,
  archive_p90       REAL,
  centroid_distance REAL,
  features          TEXT NOT NULL CHECK (json_valid(features)),
  created_at        TEXT NOT NULL
) STRICT;
