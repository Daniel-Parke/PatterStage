-- T-0158: browser authentication state, separate from Hermes sessions.
-- Times are Unix milliseconds so idle and absolute expiry have exact boundaries.
CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY,
  secret_hash BLOB NOT NULL UNIQUE CHECK (length(secret_hash) = 32),
  created_at_ms INTEGER NOT NULL,
  last_active_at_ms INTEGER NOT NULL,
  idle_expires_at_ms INTEGER NOT NULL,
  absolute_expires_at_ms INTEGER NOT NULL,
  revoked_at_ms INTEGER,
  boot_generation TEXT NOT NULL,
  token_binding BLOB NOT NULL CHECK (length(token_binding) = 32),
  CHECK (last_active_at_ms >= created_at_ms)
);
