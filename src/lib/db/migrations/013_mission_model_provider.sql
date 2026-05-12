-- control-hub.db — Migration 013: Mission Model/Provider
-- Adds model_id and provider columns to the missions table so that
-- editing/re-dispatching a mission preserves the original model selection.

ALTER TABLE missions ADD COLUMN model_id TEXT;
ALTER TABLE missions ADD COLUMN provider TEXT;
ALTER TABLE missions ADD COLUMN profile_name TEXT;
ALTER TABLE missions ADD COLUMN mission_time_minutes INTEGER;
ALTER TABLE missions ADD COLUMN timeout_minutes INTEGER;
ALTER TABLE missions ADD COLUMN schedule TEXT;
