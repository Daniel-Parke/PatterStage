-- ============================================================
-- control-hub.db — Migration 029: Remove Teams Tables
-- ============================================================
-- Teams is dead code — full CRUD API, UI pages, components,
-- and tests, but no runtime consumer. Being replaced by Hermes
-- built-in kanban (see migration 031_hermes_kanban).
-- ============================================================

DROP TABLE IF EXISTS team_members;
DROP TABLE IF EXISTS teams;
