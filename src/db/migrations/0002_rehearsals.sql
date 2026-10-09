-- Audience rehearsals (creator-os-mirofish). Copy into src/db/migrations/ with the next free number.
CREATE TABLE rehearsals (
  id              TEXT PRIMARY KEY,
  run_id          TEXT NOT NULL REFERENCES runs (id) ON DELETE CASCADE,
  status          TEXT NOT NULL CHECK (status IN ('queued', 'ontology', 'graph', 'preparing', 'running', 'reporting', 'done', 'failed')),
  progress        INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  text_hash       TEXT NOT NULL,
  settings_json   TEXT NOT NULL CHECK (json_valid(settings_json)),
  project_id      TEXT,
  graph_id        TEXT,
  simulation_id   TEXT,
  result_json     TEXT CHECK (result_json IS NULL OR json_valid(result_json)),
  state_json      TEXT CHECK (state_json IS NULL OR json_valid(state_json)),
  interviews_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(interviews_json) AND json_type(interviews_json) = 'array'),
  error           TEXT,
  created_at      TEXT NOT NULL,
  finished_at     TEXT,
  CHECK (status <> 'done' OR result_json IS NOT NULL),
  CHECK (status <> 'failed' OR error IS NOT NULL)
) STRICT;
CREATE INDEX rehearsals_run ON rehearsals (run_id, created_at);
