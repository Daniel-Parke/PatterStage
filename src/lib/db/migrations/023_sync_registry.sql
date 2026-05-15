-- 023_sync_registry.sql
-- Tracks what data sources have been synced into the DB, when,
-- and whether the last sync succeeded or failed.

CREATE TABLE IF NOT EXISTS sync_registry (
    source_name TEXT PRIMARY KEY,
    last_synced_at TEXT NOT NULL,
    source_mtime TEXT,
    status TEXT DEFAULT 'ok',
    error TEXT,
    synced_count INTEGER DEFAULT 0
);
