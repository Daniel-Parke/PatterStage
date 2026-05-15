-- 025_error_log_entries.sql
-- Ingested error entries from gateway.log and errors.log.
-- Read by the monitor route instead of parsing raw log files per-request.

CREATE TABLE IF NOT EXISTS error_log_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    message TEXT NOT NULL,
    timestamp TEXT,
    severity TEXT DEFAULT 'error',
    ingested_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_errors_timestamp ON error_log_entries(timestamp DESC);
