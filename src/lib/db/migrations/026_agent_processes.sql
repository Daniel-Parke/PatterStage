-- 026_agent_processes.sql
-- Snapshot of running Hermes processes, synced periodically from `ps aux`.
-- The /api/agents route reads from this table instead of running execSync.

CREATE TABLE IF NOT EXISTS agent_processes (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'idle',
    pid INTEGER,
    model TEXT,
    turns INTEGER DEFAULT 0,
    last_activity TEXT,
    last_seen_at TEXT NOT NULL
);
