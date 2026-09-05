-- ============================================================
-- 041_schedule_kind.sql — a schedule row can name a script, not only a mission
--
-- Decision 10. Native Windows has no crontab, so the Scripts page's Schedule
-- button had nowhere to write. PatterStage already owns a restart-safe timer
-- for missions (the scheduler tick); this lets that same timer carry a host
-- script, at the honest cost that it only fires while PatterStage is running.
--
-- No backfill. `kind` DEFAULTs to 'mission', which is what every existing row
-- is, so this file is safe to re-run and the applier's version gate is a
-- performance guard rather than a correctness one. (execMigrationFile execs
-- the whole file in ONE call and the already-applied guard swallows only the
-- FIRST duplicate-column error, so a backfill here would have to be moved
-- into the applier.)
-- ============================================================

ALTER TABLE schedules ADD COLUMN kind TEXT NOT NULL DEFAULT 'mission'
  CHECK (kind IN ('mission', 'script'));
ALTER TABLE schedules ADD COLUMN script_name TEXT;

CREATE INDEX IF NOT EXISTS idx_schedules_kind ON schedules(kind);
