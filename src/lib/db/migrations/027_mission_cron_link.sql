-- ============================================================
-- control-hub.db — Migration 027: Mission ↔ Cron Job Link
-- ============================================================
-- Adds cron_job_id to missions so each mission can reference
-- its linked Hermes cron job. Cron jobs set hermes_job_id to
-- the mission ID for bidirectional lookup (getCronJobByHermesId).
--
-- This enables:
--   - Cron jobs created from mission dispatch (cron mode)
--   - Cancel/delete missions pauses/removes linked cron jobs
--   - Mission detail view shows linked cron job status
-- ============================================================

CREATE TABLE IF NOT EXISTS _mg27_guard (x INTEGER);
DROP TABLE IF EXISTS _mg27_guard;

ALTER TABLE missions ADD COLUMN cron_job_id TEXT;
CREATE INDEX idx_mission_cron_job ON missions(cron_job_id) WHERE cron_job_id IS NOT NULL;
