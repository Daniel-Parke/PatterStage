-- ═══════════════════════════════════════════════════════════════
-- 037_composer_node_cancelled.sql — a cancelled STAGE gets its own status
--
-- WHY. A Composer run could not be stopped at all: no endpoint, no control, and
-- no exit from a paused run except approving or rejecting its gate. Adding a
-- cancel needs somewhere honest to record the stage that was in flight when the
-- operator stopped it (T-0076).
--
-- WHY NOT REUSE A STATUS THAT ALREADY EXISTS. `failed` would recreate exactly
-- the defect 035 was written to remove: a deliberate act rendered as a crash,
-- a pink stage sitting under an orange run header. `skipped` is false — the
-- stage WAS running — and it is itself vocabulary nothing writes, so reusing it
-- would revive a dead status with the wrong meaning.
--
-- WHY ONLY ONE TABLE, WHERE 035 REBUILT TWO. `composer_runs` already admits
-- `cancelled`: it has since 021, and 035 carried it through. Only the node
-- table's CHECK is missing it. And nothing in the schema holds a foreign key
-- INTO composer_node_runs, so this rebuild has no inbound references to
-- preserve — strictly simpler than 035's, which had two tables pointing at
-- composer_runs.
--
-- The column list is explicit and the applier asserts it against the live table
-- before touching anything, for the reason 035 gives at length: the failure
-- mode of a stale list is not an error, it is a silent column drop.
-- ═══════════════════════════════════════════════════════════════

DROP TABLE IF EXISTS composer_node_runs_new;
CREATE TABLE composer_node_runs_new (
  id              TEXT PRIMARY KEY,
  composer_run_id TEXT NOT NULL REFERENCES composer_runs(id) ON DELETE CASCADE,
  node_id         TEXT NOT NULL REFERENCES composer_nodes(id),
  attempt         INTEGER NOT NULL DEFAULT 1,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped', 'rejected', 'cancelled')),
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
