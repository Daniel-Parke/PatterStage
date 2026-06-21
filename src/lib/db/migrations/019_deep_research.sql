-- ============================================================
-- 019_deep_research.sql — native DeepResearch runs + steps (Laboratory)
--
-- A `research_runs` row is one research task (a query → a synthesized report)
-- from pending → terminal. Each `research_steps` row is one step in the loop
-- (plan/search/visit/reason/synthesize) so the UI can stream/replay progress.
-- Inference is provider-flexible (reuses callLLM): model_id null = the Hermes
-- agent's default; otherwise a registry model (local endpoint or cloud).
-- Idempotent: safe to run repeatedly.
-- ============================================================

CREATE TABLE IF NOT EXISTS research_runs (
  id           TEXT PRIMARY KEY,
  query        TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  -- Search backend used (serper | tavily | brave | searxng | none).
  provider     TEXT,
  -- Registry model id for inference, or NULL = the Hermes default model.
  model_id     TEXT,
  report       TEXT,
  error        TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_research_runs_active ON research_runs(status)
  WHERE status IN ('pending', 'running');

CREATE TABLE IF NOT EXISTS research_steps (
  id           TEXT PRIMARY KEY,
  run_id       TEXT NOT NULL REFERENCES research_runs(id) ON DELETE CASCADE,
  position     INTEGER NOT NULL DEFAULT 0,
  kind         TEXT NOT NULL DEFAULT 'reason'
                 CHECK (kind IN ('plan', 'search', 'visit', 'reason', 'synthesize')),
  input        TEXT,
  output       TEXT,
  sources_json TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_research_steps_run ON research_steps(run_id);
