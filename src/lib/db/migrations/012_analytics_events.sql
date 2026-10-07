-- ============================================================
-- 012_analytics_events.sql — interaction event log (analytics + achievements)
-- Append-only log of meaningful PatterStage interactions (missions dispatched,
-- stories written, schedules fired, …). Feeds the Insights page and the
-- derived achievements. `event_type` is validated in TypeScript (recordEvent),
-- NOT via a SQL CHECK — a CHECK would force a migration per new event type and
-- would reject forward-compatible writes from newer code against an older DB.
-- Idempotent: safe to run repeatedly on an existing database.
-- ============================================================

CREATE TABLE IF NOT EXISTS analytics_events (
  id            TEXT PRIMARY KEY,
  event_type    TEXT NOT NULL,
  entity_type   TEXT,
  entity_id     TEXT,
  profile       TEXT,
  metadata_json TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_type         ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created      ON analytics_events(created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_type_created ON analytics_events(event_type, created_at);
