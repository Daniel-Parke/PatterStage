-- ============================================================
-- 014_benchmarks.sql — agent benchmarking runs + per-item results
--
-- Stores the DYNAMIC half of the benchmarking utility: one `benchmark_runs`
-- row per execution of a suite against one target (an agent profile run
-- through Hermes, or a bare model via the LLM layer), plus one
-- `benchmark_item_results` row per item × repeat. The STATIC half — the
-- suites and their answer keys — lives in version-controlled code
-- (src/lib/benchmarks/suites/*), never in the DB, so items stay private,
-- diffable and contamination-resistant, and answers never reach the client.
--
-- `status`, `target_kind` and `domain` are validated in TypeScript, NOT via a
-- SQL CHECK (a CHECK would force a migration whenever the taxonomy grows and
-- would reject forward-compatible writes from newer code against an older DB).
-- Idempotent: safe to run repeatedly on an existing database.
-- ============================================================

CREATE TABLE IF NOT EXISTS benchmark_runs (
  id            TEXT PRIMARY KEY,
  suite_key     TEXT NOT NULL,
  suite_version TEXT NOT NULL,
  target_kind   TEXT NOT NULL,                    -- 'agent' | 'model'
  target_ref    TEXT NOT NULL,                    -- profile slug | model id
  target_label  TEXT,                             -- display label
  repeats       INTEGER NOT NULL DEFAULT 1,
  seed          TEXT,
  status        TEXT NOT NULL DEFAULT 'pending',  -- pending|running|completed|failed|cancelled
  pair_id       TEXT,                             -- groups an agent+model compare pair
  summary_json  TEXT,                             -- BenchmarkSummary (per-domain scores, rating, variance)
  error         TEXT,
  started_at    TEXT,
  completed_at  TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_benchmark_runs_status ON benchmark_runs(status);
CREATE INDEX IF NOT EXISTS idx_benchmark_runs_target ON benchmark_runs(target_kind, target_ref);
CREATE INDEX IF NOT EXISTS idx_benchmark_runs_pair   ON benchmark_runs(pair_id);

CREATE TABLE IF NOT EXISTS benchmark_item_results (
  id                 TEXT PRIMARY KEY,
  benchmark_run_id   TEXT NOT NULL,
  item_id            TEXT NOT NULL,
  domain             TEXT NOT NULL,
  repeat_index       INTEGER NOT NULL DEFAULT 0,
  input_run_id       TEXT,                          -- backend run id (agent) or null (model)
  raw_output         TEXT,
  score              REAL,                          -- 0..1 per repeat; NULL for consistency (computed in aggregation)
  passed             INTEGER,                       -- 0/1; NULL for consistency
  grader             TEXT,
  grader_detail_json TEXT,
  latency_ms         INTEGER,
  input_tokens       INTEGER,
  output_tokens      INTEGER,
  cost_usd           REAL,
  created_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_benchmark_item_results_run ON benchmark_item_results(benchmark_run_id);
