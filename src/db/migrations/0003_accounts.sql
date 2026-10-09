-- migrate: foreign_keys=off
-- Accounts. Every creator signs in and sees only their own archive, sources, runs and numbers.
--
-- Ownership lives on the root tables (settings, archive_pieces, source_items, runs, retired_angles,
-- calibration_labels, drift_snapshots) as a NOT NULL user_id. Child rows (chunks, segments, claims,
-- angles, drafts, sentences, decisions, agent runs, rehearsals) belong to whoever owns their parent,
-- and the repositories reach them only through that parent.
--
-- Where a root row points at another root row, the foreign key includes user_id, so the database
-- itself refuses a run built on someone else's source or a label on someone else's archive piece.
--
-- Rebuilding a table that other tables reference needs foreign keys off (SQLite's documented
-- 12-step procedure); the header line above tells migrate.ts to do that and to run
-- foreign_key_check before committing.

CREATE TABLE users (
  id                  TEXT PRIMARY KEY,
  -- NULL email and password: the owner of data from before accounts, claimed by the first sign-up
  email               TEXT UNIQUE COLLATE NOCASE CHECK (email IS NULL OR (length(email) BETWEEN 3 AND 254 AND email = lower(trim(email)) AND email LIKE '%_@_%')),
  password_hash       TEXT,
  totp_secret         TEXT,
  totp_pending        TEXT,
  totp_last_step      INTEGER,
  created_at          TEXT NOT NULL,
  password_changed_at TEXT,
  CHECK ((email IS NULL) = (password_hash IS NULL)),
  CHECK (email IS NOT NULL OR (totp_secret IS NULL AND totp_pending IS NULL))
) STRICT;
-- at most one unclaimed owner
CREATE UNIQUE INDEX users_single_unclaimed ON users ((email IS NULL)) WHERE email IS NULL;

CREATE TABLE sessions (
  -- sha256 of the cookie value; the cookie itself is never stored
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at   TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  expires_at   TEXT NOT NULL,
  CHECK (expires_at > created_at)
) STRICT;
CREATE INDEX sessions_user ON sessions (user_id);
CREATE INDEX sessions_expires ON sessions (expires_at);

INSERT INTO users (id, email, password_hash, created_at)
SELECT lower(hex(randomblob(16))), NULL, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE EXISTS (SELECT 1 FROM settings) OR EXISTS (SELECT 1 FROM archive_pieces) OR EXISTS (SELECT 1 FROM source_items);

CREATE TEMP TABLE legacy_owner AS SELECT id FROM users WHERE email IS NULL;

-- ---------------------------------------------------------------- settings
CREATE TABLE settings_new (
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  key     TEXT NOT NULL,
  value   TEXT NOT NULL CHECK (json_valid(value)),
  PRIMARY KEY (user_id, key)
) STRICT;
INSERT INTO settings_new (user_id, key, value) SELECT (SELECT id FROM legacy_owner), key, value FROM settings;
DROP TABLE settings;
ALTER TABLE settings_new RENAME TO settings;

-- ---------------------------------------------------------------- archive
CREATE TABLE archive_pieces_new (
  id                 TEXT PRIMARY KEY,
  user_id            TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  external_id        TEXT NOT NULL,
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
  CHECK (retired = 1 OR retired_reason IS NULL),
  UNIQUE (user_id, external_id),
  UNIQUE (user_id, id)
) STRICT;
INSERT INTO archive_pieces_new (id, user_id, external_id, text, parts, published_at, url, embedding, embedding_provider, is_holdout, retired, retired_reason, created_at)
SELECT id, (SELECT id FROM legacy_owner), external_id, text, parts, published_at, url, embedding, embedding_provider, is_holdout, retired, retired_reason, created_at
FROM archive_pieces;
DROP TABLE archive_pieces;
ALTER TABLE archive_pieces_new RENAME TO archive_pieces;
CREATE INDEX archive_pieces_published ON archive_pieces (user_id, published_at DESC);
CREATE INDEX archive_pieces_reference ON archive_pieces (user_id, is_holdout);

-- ---------------------------------------------------------------- sources
CREATE TABLE source_items_new (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title             TEXT NOT NULL CHECK (length(trim(title)) > 0),
  kind              TEXT NOT NULL CHECK (kind IN ('voice_memo', 'call', 'note')),
  content_hash      TEXT NOT NULL,
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
  CHECK (kind <> 'call' OR consent_confirmed = 1),
  CHECK (storage_path IS NOT NULL OR transcript_text IS NOT NULL),
  CHECK (status NOT IN ('extracting', 'ready', 'nothing_postable') OR creator_speaker IS NOT NULL),
  -- the same recording can be uploaded by two creators, but only once by each
  UNIQUE (user_id, content_hash),
  UNIQUE (user_id, id)
) STRICT;
INSERT INTO source_items_new (id, user_id, title, kind, content_hash, storage_path, mime, status, transcript_text, speakers, creator_speaker, consent_confirmed, extraction_log, error, created_at)
SELECT id, (SELECT id FROM legacy_owner), title, kind, content_hash, storage_path, mime, status, transcript_text, speakers, creator_speaker, consent_confirmed, extraction_log, error, created_at
FROM source_items;
DROP TABLE source_items;
ALTER TABLE source_items_new RENAME TO source_items;
CREATE INDEX source_items_created ON source_items (user_id, created_at DESC);

-- ---------------------------------------------------------------- runs
CREATE TABLE runs_new (
  id                 TEXT PRIMARY KEY,
  user_id            TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  source_item_id     TEXT NOT NULL,
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
  CHECK (angle_choice <> 'custom' OR custom_angle IS NOT NULL),
  -- a run is always built on its owner's own source
  FOREIGN KEY (user_id, source_item_id) REFERENCES source_items (user_id, id) ON DELETE RESTRICT
) STRICT;
INSERT INTO runs_new (id, user_id, source_item_id, condition, seed, memory_enabled, format, angle_choice, angle_claim_ids, custom_angle, status, model_versions, prompt_archive_ids, error, created_at, ready_at)
SELECT id, (SELECT id FROM legacy_owner), source_item_id, condition, seed, memory_enabled, format, angle_choice, angle_claim_ids, custom_angle, status, model_versions, prompt_archive_ids, error, created_at, ready_at
FROM runs;
DROP TABLE runs;
ALTER TABLE runs_new RENAME TO runs;
CREATE INDEX runs_source ON runs (user_id, source_item_id);
CREATE INDEX runs_created ON runs (user_id, created_at DESC);
CREATE INDEX runs_status ON runs (user_id, status);

-- ---------------------------------------------------------------- retired angles
CREATE TABLE retired_angles_new (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  piece_id   TEXT,
  claim_id   TEXT REFERENCES claims (id) ON DELETE CASCADE,
  text       TEXT NOT NULL,
  reason     TEXT NOT NULL CHECK (length(trim(reason)) > 0),
  embedding  BLOB NOT NULL,
  created_at TEXT NOT NULL,
  CHECK ((piece_id IS NULL) <> (claim_id IS NULL)),
  FOREIGN KEY (user_id, piece_id) REFERENCES archive_pieces (user_id, id) ON DELETE CASCADE
) STRICT;
INSERT INTO retired_angles_new (id, user_id, piece_id, claim_id, text, reason, embedding, created_at)
SELECT id, (SELECT id FROM legacy_owner), piece_id, claim_id, text, reason, embedding, created_at FROM retired_angles;
DROP TABLE retired_angles;
ALTER TABLE retired_angles_new RENAME TO retired_angles;
CREATE INDEX retired_angles_user ON retired_angles (user_id, created_at);
CREATE INDEX retired_angles_piece ON retired_angles (user_id, piece_id);
CREATE INDEX retired_angles_claim ON retired_angles (claim_id);

-- ---------------------------------------------------------------- calibration labels
CREATE TABLE calibration_labels_new (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  piece_a    TEXT NOT NULL,
  piece_b    TEXT NOT NULL,
  similarity REAL NOT NULL CHECK (similarity BETWEEN -1 AND 1),
  same_angle INTEGER NOT NULL CHECK (same_angle IN (0, 1)),
  created_at TEXT NOT NULL,
  CHECK (piece_a < piece_b),
  UNIQUE (piece_a, piece_b),
  FOREIGN KEY (user_id, piece_a) REFERENCES archive_pieces (user_id, id) ON DELETE CASCADE,
  FOREIGN KEY (user_id, piece_b) REFERENCES archive_pieces (user_id, id) ON DELETE CASCADE
) STRICT;
INSERT INTO calibration_labels_new (id, user_id, piece_a, piece_b, similarity, same_angle, created_at)
SELECT id, (SELECT id FROM legacy_owner), piece_a, piece_b, similarity, same_angle, created_at FROM calibration_labels;
DROP TABLE calibration_labels;
ALTER TABLE calibration_labels_new RENAME TO calibration_labels;
CREATE INDEX calibration_labels_user ON calibration_labels (user_id);
CREATE INDEX calibration_labels_piece_b ON calibration_labels (user_id, piece_b);

-- ---------------------------------------------------------------- drift
CREATE TABLE drift_snapshots_new (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  week              TEXT NOT NULL,
  homogeneity_ratio REAL,
  archive_p90       REAL,
  centroid_distance REAL,
  features          TEXT NOT NULL CHECK (json_valid(features)),
  created_at        TEXT NOT NULL,
  UNIQUE (user_id, week)
) STRICT;
INSERT INTO drift_snapshots_new (id, user_id, week, homogeneity_ratio, archive_p90, centroid_distance, features, created_at)
SELECT id, (SELECT id FROM legacy_owner), week, homogeneity_ratio, archive_p90, centroid_distance, features, created_at FROM drift_snapshots;
DROP TABLE drift_snapshots;
ALTER TABLE drift_snapshots_new RENAME TO drift_snapshots;

DROP TABLE legacy_owner;
