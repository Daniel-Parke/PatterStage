-- ============================================================
-- 021_composer.sql — Composer graph orchestrator
--
-- Composer runs a DIRECTED GRAPH of stages (nodes) with conditional + looping
-- edges and human-in-the-loop gates. A workflow is a reusable definition; a
-- run is an execution instance; a node-run is one stage execution (= one agent
-- run on Hermes, via the shared runtime/run substrate). Distinct from Missions
-- (which stay simple). Idempotent: CREATE ... IF NOT EXISTS.
--
-- runs.composer_node_run_id is added in TS (guarded ALTER) so reconcile can
-- tell a mission-run from a composer stage-run.
-- ============================================================

-- ── Definition (template graph) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS composer_workflows (
  id          TEXT PRIMARY KEY,
  -- Stable key for seeded/idempotent workflows (NULL for user-created).
  key         TEXT UNIQUE,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  version     INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS composer_nodes (
  id          TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL REFERENCES composer_workflows(id) ON DELETE CASCADE,
  key         TEXT NOT NULL,               -- unique within a workflow (e.g. 'plan')
  label       TEXT NOT NULL,
  -- Stage type (review/validate/research/hypothesise/plan/build_tests/implement/
  -- test/documentation/pr/unit_test/integration_test/acceptance_test/
  -- final_assessment/custom). Not CHECK-locked so workflows can add stages.
  kind        TEXT NOT NULL DEFAULT 'custom',
  gate        TEXT NOT NULL DEFAULT 'auto' CHECK (gate IN ('hil', 'auto')),
  is_start    INTEGER NOT NULL DEFAULT 0 CHECK (is_start IN (0, 1)),
  is_terminal INTEGER NOT NULL DEFAULT 0 CHECK (is_terminal IN (0, 1)),
  config_json TEXT,
  pos         INTEGER NOT NULL DEFAULT 0,  -- display order
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_composer_nodes_workflow ON composer_nodes(workflow_id);

CREATE TABLE IF NOT EXISTS composer_edges (
  id           TEXT PRIMARY KEY,
  workflow_id  TEXT NOT NULL REFERENCES composer_workflows(id) ON DELETE CASCADE,
  from_node_id TEXT NOT NULL REFERENCES composer_nodes(id) ON DELETE CASCADE,
  to_node_id   TEXT NOT NULL REFERENCES composer_nodes(id) ON DELETE CASCADE,
  -- Guard for routing: always | on_pass | on_fail | on_approve | on_reject | custom.
  condition    TEXT NOT NULL DEFAULT 'always',
  label        TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_composer_edges_workflow ON composer_edges(workflow_id);
CREATE INDEX IF NOT EXISTS idx_composer_edges_from ON composer_edges(from_node_id);

-- ── Execution (run instance) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS composer_runs (
  id              TEXT PRIMARY KEY,
  workflow_id     TEXT NOT NULL REFERENCES composer_workflows(id),
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'running', 'awaiting_approval', 'completed', 'failed', 'cancelled')),
  current_node_id TEXT REFERENCES composer_nodes(id),
  input           TEXT,
  context_json    TEXT,           -- accumulating workflow state (research, plan, verdicts, …)
  profile_name    TEXT,           -- agent profile the stages run under
  error           TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at    TEXT
);
CREATE INDEX IF NOT EXISTS idx_composer_runs_active ON composer_runs(status)
  WHERE status IN ('pending', 'running', 'awaiting_approval');

CREATE TABLE IF NOT EXISTS composer_node_runs (
  id              TEXT PRIMARY KEY,
  composer_run_id TEXT NOT NULL REFERENCES composer_runs(id) ON DELETE CASCADE,
  node_id         TEXT NOT NULL REFERENCES composer_nodes(id),
  attempt         INTEGER NOT NULL DEFAULT 1,    -- increments on loop re-entry
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),
  run_id          TEXT REFERENCES runs(id) ON DELETE SET NULL,
  input           TEXT,
  output          TEXT,
  verdict_json    TEXT,           -- { pass: bool, reasons: [], suggestions: [] }
  error           TEXT,
  started_at      TEXT,
  completed_at    TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_composer_node_runs_run ON composer_node_runs(composer_run_id);

CREATE TABLE IF NOT EXISTS composer_approvals (
  id              TEXT PRIMARY KEY,
  composer_run_id TEXT NOT NULL REFERENCES composer_runs(id) ON DELETE CASCADE,
  node_id         TEXT NOT NULL REFERENCES composer_nodes(id),
  action          TEXT NOT NULL CHECK (action IN ('accept', 'reject', 'review', 'add_feature')),
  approved        INTEGER NOT NULL CHECK (approved IN (0, 1)),
  note            TEXT,
  decided_by      TEXT NOT NULL DEFAULT 'user',
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_composer_approvals_run ON composer_approvals(composer_run_id);
