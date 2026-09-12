-- ═══════════════════════════════════════════════════════════════
-- 035_composer_rejected.sql — a rejected gate gets its own status
--
-- WHY A REBUILD. SQLite cannot ALTER a CHECK constraint, so widening the two
-- composer status vocabularies means the 12-step procedure from
-- sqlite.org/lang_altertable.html: create the replacement, copy, drop, rename,
-- recreate indexes. This is the FIRST table rebuild in this chain, so read the
-- notes here before writing the second.
--
-- WHY NOT REUSE `failed`. Rejecting a gate is a deliberate operator decision,
-- and the previous behaviour rendered it as a defect: a pink "failed" header
-- above a canvas still drawing the rejected gate GREEN, because the fail branch
-- wrote the run row and never the node-run. The operator ruled for a distinct
-- terminal state so the two can be told apart on sight (T-0069).
--
-- THE COLUMN LISTS ARE EXPLICIT, not `SELECT *`. A `SELECT *` copy silently
-- reorders or drops on any shape drift; the applier additionally asserts the
-- live column set matches these lists exactly and refuses to run if it does not,
-- because the failure mode of a wrong rebuild is data loss rather than an error.
--
-- PRAGMA foreign_keys AND THE TRANSACTION ARE THE APPLIER'S JOB, not this
-- file's: a pragma cannot change inside a transaction, and better-sqlite3's own
-- `transaction()` wrapper is what guarantees a rollback rather than a
-- half-rebuilt database. See apply-composer-rejected-migration.ts.
--
-- Verified against real SQLite before it was written: after the rebuild the
-- REFERENCES clauses in composer_node_runs and composer_approvals still point at
-- composer_runs, `PRAGMA foreign_key_check` is clean, ON DELETE CASCADE still
-- fires, both partial indexes are back, and the widened CHECK still refuses an
-- unknown status.
-- ═══════════════════════════════════════════════════════════════

DROP TABLE IF EXISTS composer_runs_new;
CREATE TABLE composer_runs_new (
  id              TEXT PRIMARY KEY,
  workflow_id     TEXT NOT NULL REFERENCES composer_workflows(id),
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'running', 'awaiting_approval', 'completed', 'failed', 'cancelled', 'rejected')),
  current_node_id TEXT REFERENCES composer_nodes(id),
  input           TEXT,
  context_json    TEXT,
  profile_name    TEXT,
  error           TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at    TEXT,
  parent_node_run_id TEXT
);
INSERT INTO composer_runs_new
  (id, workflow_id, status, current_node_id, input, context_json, profile_name, error,
   created_at, updated_at, completed_at, parent_node_run_id)
  SELECT id, workflow_id, status, current_node_id, input, context_json, profile_name, error,
         created_at, updated_at, completed_at, parent_node_run_id
    FROM composer_runs;
DROP TABLE composer_runs;
ALTER TABLE composer_runs_new RENAME TO composer_runs;
CREATE INDEX IF NOT EXISTS idx_composer_runs_active ON composer_runs(status)
  WHERE status IN ('pending', 'running', 'awaiting_approval');

DROP TABLE IF EXISTS composer_node_runs_new;
CREATE TABLE composer_node_runs_new (
  id              TEXT PRIMARY KEY,
  composer_run_id TEXT NOT NULL REFERENCES composer_runs(id) ON DELETE CASCADE,
  node_id         TEXT NOT NULL REFERENCES composer_nodes(id),
  attempt         INTEGER NOT NULL DEFAULT 1,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped', 'rejected')),
  run_id          TEXT REFERENCES runs(id) ON DELETE SET NULL,
  input           TEXT,
  output          TEXT,
  verdict_json    TEXT,
  error           TEXT,
  started_at      TEXT,
  completed_at    TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO composer_node_runs_new
  (id, composer_run_id, node_id, attempt, status, run_id, input, output, verdict_json, error,
   started_at, completed_at, created_at)
  SELECT id, composer_run_id, node_id, attempt, status, run_id, input, output, verdict_json, error,
         started_at, completed_at, created_at
    FROM composer_node_runs;
DROP TABLE composer_node_runs;
ALTER TABLE composer_node_runs_new RENAME TO composer_node_runs;
CREATE INDEX IF NOT EXISTS idx_composer_node_runs_run ON composer_node_runs(composer_run_id);
