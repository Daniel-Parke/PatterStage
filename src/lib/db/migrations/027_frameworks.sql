-- 027_frameworks.sql — DB-owned agent-framework registry (schema v27)
--
-- Makes PatterStage the source of truth for WHICH agent framework backs the
-- control plane (Hermes today) and its install/home config — mirroring the
-- memory_providers table. A pluggable FrameworkAdapter seam (src/lib/frameworks)
-- resolves the active row, so a second framework can be added behind the
-- interface without rewiring the runtime. The default 'hermes' row is seeded by
-- the applier.

CREATE TABLE IF NOT EXISTS frameworks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  type        TEXT    NOT NULL UNIQUE,            -- 'hermes' | …
  name        TEXT    NOT NULL DEFAULT '',
  enabled     INTEGER NOT NULL DEFAULT 0,
  is_active   INTEGER NOT NULL DEFAULT 0,         -- exactly one row should be active
  config_json TEXT    NOT NULL DEFAULT '{}',      -- { home, … } framework-specific
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
