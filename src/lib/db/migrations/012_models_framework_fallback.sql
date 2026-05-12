-- ============================================================
-- control-hub.db — Migration 012: Model Frameworks, Extracted Defaults, Fallback Chain
-- ============================================================
--
-- Changes:
-- 1. Adds framework_id column to models table (Option B: single-table framework scoping)
-- 2. Creates model_defaults table (extracts 12 is_default_* booleans from models)
-- 3. Creates model_fallbacks table (ordered fallback chain)
-- 4. Creates fallback_config table (behavioural settings for fallback)
--

CREATE TABLE IF NOT EXISTS _mg12_guard (x INTEGER);
DROP TABLE IF EXISTS _mg12_guard;

-- ── Step 1: Add framework_id to models ──────────────────────
ALTER TABLE models ADD COLUMN framework_id TEXT;
UPDATE models SET framework_id = '*' WHERE framework_id IS NULL;

-- ── Step 2: Create model_defaults table ─────────────────────
CREATE TABLE model_defaults (
    id           TEXT PRIMARY KEY,
    framework_id TEXT NOT NULL,
    task_type    TEXT NOT NULL,
    model_id     TEXT,
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL,
    UNIQUE(framework_id, task_type)
);
CREATE INDEX idx_model_defaults_framework ON model_defaults(framework_id);

-- ── Step 3: Migrate existing defaults from is_default_* columns ──
-- For each task_type that has is_default_X = 1, create a Universal ('*') entry

INSERT INTO model_defaults (id, framework_id, task_type, model_id, created_at, updated_at)
SELECT
    lower(
        hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4'
        || substr(hex(randomblob(2)), 2) || '-'
        || substr('89ab', abs(random()) % 4 + 1, 1)
        || substr(hex(randomblob(2)), 2) || '-'
        || hex(randomblob(6))
    ),
    '*',
    slot,
    model_id,
    datetime('now'),
    datetime('now')
FROM (
    SELECT 'agent' AS slot, id AS model_id FROM models WHERE is_default_agent = 1
    UNION ALL SELECT 'hindsight', id FROM models WHERE is_default_hindsight = 1
    UNION ALL SELECT 'compression', id FROM models WHERE is_default_compression = 1
    UNION ALL SELECT 'vision', id FROM models WHERE is_default_vision = 1
    UNION ALL SELECT 'web_extract', id FROM models WHERE is_default_web_extract = 1
    UNION ALL SELECT 'session_search', id FROM models WHERE is_default_session_search = 1
    UNION ALL SELECT 'title_generation', id FROM models WHERE is_default_title_generation = 1
    UNION ALL SELECT 'skills_hub', id FROM models WHERE is_default_skills_hub = 1
    UNION ALL SELECT 'mcp', id FROM models WHERE is_default_mcp = 1
    UNION ALL SELECT 'triage_specifier', id FROM models WHERE is_default_triage_specifier = 1
    UNION ALL SELECT 'approval', id FROM models WHERE is_default_approval = 1
    UNION ALL SELECT 'delegation', id FROM models WHERE is_default_delegation = 1
);

-- ── Step 4: Drop old partial unique indexes FIRST (before dropping columns) ──
DROP INDEX IF EXISTS uniq_default_agent;
DROP INDEX IF EXISTS uniq_default_hindsight;
DROP INDEX IF EXISTS uniq_default_compression;
DROP INDEX IF EXISTS uniq_default_vision;
DROP INDEX IF EXISTS uniq_default_web_extract;
DROP INDEX IF EXISTS uniq_default_session_search;
DROP INDEX IF EXISTS uniq_default_title_generation;
DROP INDEX IF EXISTS uniq_default_skills_hub;
DROP INDEX IF EXISTS uniq_default_mcp;
DROP INDEX IF EXISTS uniq_default_triage_specifier;
DROP INDEX IF EXISTS uniq_default_approval;
DROP INDEX IF EXISTS uniq_default_delegation;

-- ── Step 5: Drop the 12 default columns from models ─────────
ALTER TABLE models DROP COLUMN is_default_agent;
ALTER TABLE models DROP COLUMN is_default_hindsight;
ALTER TABLE models DROP COLUMN is_default_compression;
ALTER TABLE models DROP COLUMN is_default_vision;
ALTER TABLE models DROP COLUMN is_default_web_extract;
ALTER TABLE models DROP COLUMN is_default_session_search;
ALTER TABLE models DROP COLUMN is_default_title_generation;
ALTER TABLE models DROP COLUMN is_default_skills_hub;
ALTER TABLE models DROP COLUMN is_default_mcp;
ALTER TABLE models DROP COLUMN is_default_triage_specifier;
ALTER TABLE models DROP COLUMN is_default_approval;
ALTER TABLE models DROP COLUMN is_default_delegation;

-- ── Step 6: Create framework index ──────────────────────────
CREATE INDEX idx_models_framework ON models(framework_id);

-- ── Step 7: Create model_fallbacks table ────────────────────
CREATE TABLE model_fallbacks (
    id              TEXT PRIMARY KEY,
    model_id        TEXT REFERENCES models(id) ON DELETE CASCADE,
    position        INTEGER NOT NULL,
    enabled         INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
    override_base_url TEXT,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);
CREATE INDEX idx_fallbacks_position ON model_fallbacks(position);

-- ── Step 8: Create fallback_config table ────────────────────
CREATE TABLE fallback_config (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Seed default fallback behaviour
INSERT OR IGNORE INTO fallback_config (key, value) VALUES
    ('restore_primary_on_fallback', 'true'),
    ('fallback_notification', 'true'),
    ('api_max_retries', '3');
