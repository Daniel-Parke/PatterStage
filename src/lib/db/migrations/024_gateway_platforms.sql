-- 024_gateway_platforms.sql
-- Tracks which gateway platforms have tokens configured in .env.
-- Synced from .env on a schedule; never manipulated directly.

CREATE TABLE IF NOT EXISTS gateway_platforms (
    platform TEXT PRIMARY KEY,
    enabled INTEGER NOT NULL DEFAULT 0,
    bot_token_present INTEGER NOT NULL DEFAULT 0,
    last_synced_at TEXT NOT NULL
);
