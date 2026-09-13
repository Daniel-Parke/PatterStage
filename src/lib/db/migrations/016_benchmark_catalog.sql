-- ============================================================
-- 016_benchmark_catalog.sql — central catalog for fair-test seed components
--
-- The benchmark "source of truth" lives in the PatterStage DB, independent of
-- any user or agent: bundled Skills already live in `skills` (source='bundled');
-- this adds the two missing pillars so a fair test can toggle them:
--   • tool_catalog       — canonical default TOOL bundles (sets of Hermes toolset ids)
--   • seed_memory_facts  — canonical default MEMORY facts (loaded into the provider
--                          when a benchmark enables memory)
--
-- Idempotent (CREATE ... IF NOT EXISTS); seeded idempotently via seed_key.
-- ============================================================

CREATE TABLE IF NOT EXISTS tool_catalog (
  tool_key     TEXT PRIMARY KEY,
  display_name TEXT NOT NULL DEFAULT '',
  description  TEXT NOT NULL DEFAULT '',
  toolset_ids  TEXT NOT NULL DEFAULT '[]',   -- JSON array of Hermes toolset ids
  category     TEXT NOT NULL DEFAULT '',
  source       TEXT NOT NULL DEFAULT 'custom',
  seed_key     TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tool_catalog_seed_key
  ON tool_catalog(seed_key) WHERE seed_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS seed_memory_facts (
  id         TEXT PRIMARY KEY,
  content    TEXT NOT NULL,
  category   TEXT NOT NULL DEFAULT '',
  source     TEXT NOT NULL DEFAULT 'custom',
  seed_key   TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_seed_memory_facts_seed_key
  ON seed_memory_facts(seed_key) WHERE seed_key IS NOT NULL;
