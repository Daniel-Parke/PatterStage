-- ============================================================
-- control-hub.db — Migration 010: Cron Job Profile Field
-- ============================================================
-- Adds profile_name to cron_jobs so each cron job can target
-- a specific Hermes agent profile.
--
-- All cron jobs default to 'default' (Bob/main agent) so existing
-- jobs are not affected.
--
-- The hermes CLI dispatches with:
--   hermes --profile <profile_name> chat -q "<prompt>" ...

CREATE TABLE IF NOT EXISTS _mg10_guard (x INTEGER);
DROP TABLE IF EXISTS _mg10_guard;

ALTER TABLE cron_jobs ADD COLUMN profile_name TEXT NOT NULL DEFAULT 'default';
