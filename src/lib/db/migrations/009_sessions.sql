-- 009_sessions.sql
-- Unified session registry: Control Hub is the source of truth for all agent sessions,
-- whether born from CLI, cron, or mission dispatch.
-- Hermes session files on disk are synced into this table; agent-native sessions
-- (missions, cron) are written here directly by the dispatch pipeline.

CREATE TABLE IF NOT EXISTS sessions (
  id            TEXT PRIMARY KEY,
  agent_type    TEXT NOT NULL DEFAULT 'hermes',
  source        TEXT NOT NULL,
  mission_id    TEXT REFERENCES missions(id) ON DELETE SET NULL,
  profile_name  TEXT,
  model_id      TEXT,
  provider      TEXT,
  title         TEXT,
  size          INTEGER NOT NULL DEFAULT 0,
  started_at    TEXT NOT NULL,
  ended_at      TEXT,
  status        TEXT NOT NULL DEFAULT 'active',
  exit_code     INTEGER,
  error         TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessions_mission_id   ON sessions(mission_id);
CREATE INDEX IF NOT EXISTS idx_sessions_agent_source ON sessions(agent_type, source);
CREATE INDEX IF NOT EXISTS idx_sessions_started_at   ON sessions(started_at DESC);
