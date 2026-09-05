-- 022_memory_providers.sql — PatterStage-owned memory provider config (schema v22)
--
-- Makes PatterStage (not ~/.hermes/hindsight/config.json) the source of truth
-- for WHICH memory provider is active and HOW to reach it (host/port/bank/…).
-- This ends the recurring "ports/paths/db mixed up" pain: the endpoint is now
-- editable in the DB / UI without touching Hermes files. The interface is
-- provider-agnostic so Mem0/Zep/a PatterStage-native store can be added later.

CREATE TABLE IF NOT EXISTS memory_providers (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  type        TEXT    NOT NULL UNIQUE,            -- 'hindsight' | 'holographic' | …
  label       TEXT    NOT NULL DEFAULT '',
  enabled     INTEGER NOT NULL DEFAULT 0,
  is_active   INTEGER NOT NULL DEFAULT 0,         -- exactly one row should be active
  config_json TEXT    NOT NULL DEFAULT '{}',      -- { host, port, bank, … } provider-specific
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
