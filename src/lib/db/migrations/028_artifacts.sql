-- ═══════════════════════════════════════════════════════════════
-- 028_artifacts.sql — unified registry of agent-produced artifacts
--
-- Agent runs (Composer stages, Deep Research, Missions) produce deliverables —
-- today these are TEXT/markdown/JSON outputs (Hermes returns only text, no
-- files). This table catalogs them so users can collect, view, and download
-- them in one place. Future-proofed: `content_type` distinguishes inline text
-- from a real on-disk file or a remote URL, so binary file artifacts slot in
-- later (when the agent runtime can emit files) without a schema change.
--
-- `source_run_id` is a loose link (it may reference research_runs / composer_runs
-- / runs depending on `source_kind`), so there is intentionally NO foreign key.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS artifacts (
  id             TEXT PRIMARY KEY,
  source_kind    TEXT NOT NULL,                          -- research | composer | mission | chat | manual
  source_run_id  TEXT,                                   -- the run that produced it (kind-dependent table)
  source_node_id TEXT,                                   -- composer node-run id, when applicable
  name           TEXT NOT NULL,
  description    TEXT,
  mime_type      TEXT NOT NULL DEFAULT 'text/markdown',  -- text/markdown | text/html | application/json | text/csv | text/plain
  content_type   TEXT NOT NULL DEFAULT 'inline',         -- inline | file_path | url
  content        TEXT,                                   -- inline payload (when content_type='inline')
  file_path      TEXT,                                   -- future: real file on disk
  url            TEXT,                                   -- future: remote URL
  size_bytes     INTEGER NOT NULL DEFAULT 0,
  tags_json      TEXT NOT NULL DEFAULT '[]',
  created_at     TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_artifacts_source ON artifacts(source_kind, source_run_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_created ON artifacts(created_at);
