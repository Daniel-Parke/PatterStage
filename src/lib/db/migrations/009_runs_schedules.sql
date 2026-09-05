-- ============================================================
-- 009_runs_schedules.sql — PatterStage-owned runs + scheduler
-- Adds the `schedules` (CH owns the timer) and `runs` (HTTP run
-- lifecycle, replacing pid/status-file IPC) tables. Column adds to
-- missions/agent_profiles are applied in TS (columnExists-guarded).
-- Idempotent: safe to run repeatedly on an existing database.
-- ============================================================

CREATE TABLE IF NOT EXISTS schedules (
  id               TEXT PRIMARY KEY,
  mission_id       TEXT REFERENCES missions(id) ON DELETE CASCADE,
  name             TEXT NOT NULL DEFAULT '',
  schedule         TEXT NOT NULL,
  schedule_display TEXT NOT NULL DEFAULT '',
  enabled          INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  catch_up_policy  TEXT NOT NULL DEFAULT 'fire_once'
                     CHECK (catch_up_policy IN ('fire_once', 'skip')),
  repeat_times     INTEGER,
  repeat_done      INTEGER NOT NULL DEFAULT 0,
  profile_name     TEXT,
  next_run_at      TEXT,
  last_run_at      TEXT,
  last_run_id      TEXT,
  last_status      TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_schedules_next_run ON schedules(next_run_at) WHERE enabled = 1;
CREATE INDEX IF NOT EXISTS idx_schedules_mission  ON schedules(mission_id);

CREATE TABLE IF NOT EXISTS runs (
  id           TEXT PRIMARY KEY,
  run_id       TEXT,
  mission_id   TEXT REFERENCES missions(id) ON DELETE CASCADE,
  schedule_id  TEXT REFERENCES schedules(id) ON DELETE SET NULL,
  profile_name TEXT,
  session_id   TEXT,
  status       TEXT NOT NULL DEFAULT 'started'
                 CHECK (status IN ('started', 'completed', 'failed', 'cancelled')),
  output       TEXT,
  usage_json   TEXT,
  error        TEXT,
  submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_runs_active  ON runs(status) WHERE status = 'started';
CREATE INDEX IF NOT EXISTS idx_runs_mission ON runs(mission_id);
CREATE INDEX IF NOT EXISTS idx_runs_run_id  ON runs(run_id) WHERE run_id IS NOT NULL;
