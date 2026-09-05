-- ============================================================
-- patterstage.db — Baseline Schema (v1)
-- Single migration replacing the historical 001–032 chain.
-- ============================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ── missions ─────────────────────────────────────────────────
CREATE TABLE missions (
  id                   TEXT PRIMARY KEY,
  name                 TEXT NOT NULL,
  prompt               TEXT NOT NULL,
  profile_id           TEXT DEFAULT 'default',
  status               TEXT NOT NULL DEFAULT 'queued'
                         CHECK (status IN ('queued', 'dispatched', 'successful', 'failed')),
  result               TEXT,
  session_id           TEXT,
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at           TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at           TEXT,
  local_dirs           TEXT NOT NULL DEFAULT '[]',
  references_          TEXT NOT NULL DEFAULT '[]',
  skills               TEXT NOT NULL DEFAULT '[]',
  suggested_toolsets   TEXT NOT NULL DEFAULT '[]',
  goals                TEXT NOT NULL DEFAULT '[]',
  model_id             TEXT,
  provider             TEXT,
  profile_name         TEXT,
  mission_time_minutes INTEGER,
  timeout_minutes      INTEGER,
  schedule             TEXT,
  cron_job_id          TEXT,
  category_id          TEXT,
  output_format        TEXT,
  constraints          TEXT,
  run_id               TEXT
);

CREATE INDEX idx_missions_status   ON missions(status);
CREATE INDEX idx_missions_profile  ON missions(profile_id);
CREATE INDEX idx_missions_session  ON missions(session_id);
CREATE INDEX idx_mission_cron_job  ON missions(cron_job_id) WHERE cron_job_id IS NOT NULL;
CREATE INDEX idx_missions_category ON missions(category_id);

-- ── credentials ─────────────────────────────────────────────
CREATE TABLE credentials (
  id          TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  provider    TEXT NOT NULL,
  api_key     TEXT NOT NULL,
  key_hint    TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_credentials_provider ON credentials(provider);

-- ── models ──────────────────────────────────────────────────
CREATE TABLE models (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  provider        TEXT NOT NULL,
  model_id        TEXT NOT NULL,
  base_url        TEXT,
  context_length  INTEGER,
  credentials_id  TEXT REFERENCES credentials(id) ON DELETE SET NULL,
  import_key      TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_models_provider    ON models(provider);
CREATE INDEX idx_models_credentials ON models(credentials_id);
CREATE UNIQUE INDEX idx_models_import_key ON models(import_key) WHERE import_key IS NOT NULL;

-- ── model_defaults ──────────────────────────────────────────
CREATE TABLE model_defaults (
  id         TEXT PRIMARY KEY,
  task_type  TEXT NOT NULL UNIQUE,
  model_id   TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── model_fallbacks ─────────────────────────────────────────
CREATE TABLE model_fallbacks (
  id                TEXT PRIMARY KEY,
  model_id          TEXT REFERENCES models(id) ON DELETE CASCADE,
  position          INTEGER NOT NULL,
  enabled           INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  override_base_url TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_fallbacks_position ON model_fallbacks(position);

-- ── fallback_config ─────────────────────────────────────────
CREATE TABLE fallback_config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO fallback_config (key, value) VALUES
  ('restore_primary_on_fallback', 'true'),
  ('fallback_notification', 'true'),
  ('api_max_retries', '3');

-- ── cron_jobs ───────────────────────────────────────────────
CREATE TABLE cron_jobs (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  prompt              TEXT NOT NULL DEFAULT '',
  skills              TEXT NOT NULL DEFAULT '[]',
  model               TEXT NOT NULL DEFAULT '',
  provider            TEXT NOT NULL DEFAULT '',
  base_url            TEXT,
  schedule            TEXT NOT NULL,
  schedule_display    TEXT NOT NULL DEFAULT '',
  repeat_json         TEXT NOT NULL DEFAULT '{"times":1,"completed":0}',
  enabled             INTEGER NOT NULL DEFAULT 1,
  state               TEXT NOT NULL DEFAULT 'scheduled',
  deliver             TEXT NOT NULL DEFAULT 'none',
  script              TEXT,
  profile_name        TEXT NOT NULL DEFAULT 'default',
  hermes_job_id       TEXT UNIQUE,
  source              TEXT NOT NULL DEFAULT 'ch',
  orphan              INTEGER NOT NULL DEFAULT 0,
  next_run_at         TEXT,
  last_run_at         TEXT,
  last_status         TEXT,
  last_delivery_error TEXT,
  workdir             TEXT NOT NULL DEFAULT '',
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_cron_hermes_id  ON cron_jobs(hermes_job_id) WHERE hermes_job_id IS NOT NULL;
CREATE INDEX idx_cron_source     ON cron_jobs(source);
CREATE INDEX idx_cron_orphan     ON cron_jobs(orphan);
CREATE INDEX idx_cron_enabled    ON cron_jobs(enabled);

-- ── sessions ────────────────────────────────────────────────
CREATE TABLE sessions (
  id            TEXT PRIMARY KEY,
  agent_type    TEXT NOT NULL DEFAULT 'hermes',
  source        TEXT NOT NULL,
  mission_id    TEXT REFERENCES missions(id) ON DELETE SET NULL,
  profile_name  TEXT,
  model_id      TEXT,
  provider      TEXT,
  title         TEXT,
  size          INTEGER NOT NULL DEFAULT 0,
  started_at    TEXT NOT NULL,
  ended_at      TEXT,
  status        TEXT NOT NULL DEFAULT 'active',
  exit_code     INTEGER,
  error         TEXT
);

CREATE INDEX idx_sessions_mission_id   ON sessions(mission_id);
CREATE INDEX idx_sessions_agent_source ON sessions(agent_type, source);
CREATE INDEX idx_sessions_started_at   ON sessions(started_at DESC);

-- ── schedules (PatterStage-owned scheduler — replaces Hermes jobs.json) ──
-- The "when to run" decision lives HERE, not in the agent. The scheduler tick
-- computes due rows from next_run_at and dispatches a run via the runtime.
CREATE TABLE schedules (
  id               TEXT PRIMARY KEY,
  mission_id       TEXT REFERENCES missions(id) ON DELETE CASCADE,
  name             TEXT NOT NULL DEFAULT '',
  schedule         TEXT NOT NULL,                       -- canonical: 5-field cron or interval shorthand
  schedule_display TEXT NOT NULL DEFAULT '',
  enabled          INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  catch_up_policy  TEXT NOT NULL DEFAULT 'fire_once'
                     CHECK (catch_up_policy IN ('fire_once', 'skip')),
  repeat_times     INTEGER,                             -- NULL = infinite
  repeat_done      INTEGER NOT NULL DEFAULT 0,
  profile_name     TEXT,
  next_run_at      TEXT,                                -- drives restart-safe firing
  last_run_at      TEXT,
  last_run_id      TEXT,
  last_status      TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_schedules_next_run ON schedules(next_run_at) WHERE enabled = 1;
CREATE INDEX idx_schedules_mission  ON schedules(mission_id);

-- ── runs (one agent execution; replaces pid/status-file IPC) ──
-- id is the PatterStage-owned run id (also the Idempotency-Key); run_id is the
-- backend's id. Reconciled by polling the runtime, not status.json files.
CREATE TABLE runs (
  id           TEXT PRIMARY KEY,
  run_id       TEXT,
  mission_id   TEXT REFERENCES missions(id) ON DELETE CASCADE,
  schedule_id  TEXT REFERENCES schedules(id) ON DELETE SET NULL,
  profile_name TEXT,
  session_id   TEXT,
  status       TEXT NOT NULL DEFAULT 'started'
                 CHECK (status IN ('started', 'completed', 'failed', 'cancelled')),
  output       TEXT,
  usage_json   TEXT,
  error        TEXT,
  submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_runs_active   ON runs(status) WHERE status = 'started';
CREATE INDEX idx_runs_mission  ON runs(mission_id);
CREATE INDEX idx_runs_run_id   ON runs(run_id) WHERE run_id IS NOT NULL;

-- ── stories ─────────────────────────────────────────────────
CREATE TABLE stories (
  id               TEXT PRIMARY KEY,
  title            TEXT NOT NULL,
  config           TEXT NOT NULL DEFAULT '{}',
  master_prompt    TEXT,
  story_arc        TEXT,
  rolling_summary  TEXT,
  chapters         TEXT NOT NULL DEFAULT '[]',
  chapter_contents TEXT NOT NULL DEFAULT '{}',
  status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('generating', 'active', 'complete', 'failed')),
  generation_error TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at       TEXT
);

CREATE INDEX idx_stories_status ON stories(status);

-- ── sync_registry ───────────────────────────────────────────
CREATE TABLE sync_registry (
  source_name    TEXT PRIMARY KEY,
  last_synced_at TEXT NOT NULL,
  source_mtime   TEXT,
  status         TEXT DEFAULT 'ok',
  error          TEXT,
  synced_count   INTEGER DEFAULT 0
);

-- ── gateway_platforms ───────────────────────────────────────
CREATE TABLE gateway_platforms (
  platform          TEXT PRIMARY KEY,
  enabled           INTEGER NOT NULL DEFAULT 0,
  bot_token_present INTEGER NOT NULL DEFAULT 0,
  last_synced_at    TEXT NOT NULL
);

-- ── error_log_entries ───────────────────────────────────────
CREATE TABLE error_log_entries (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  source      TEXT NOT NULL,
  message     TEXT NOT NULL,
  timestamp   TEXT,
  severity    TEXT DEFAULT 'error',
  ingested_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_errors_timestamp ON error_log_entries(timestamp DESC);

-- ── mission_categories ──────────────────────────────────────
CREATE TABLE mission_categories (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT 'cyan',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  seed_key    TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX idx_mission_categories_name
  ON mission_categories(lower(name));

CREATE UNIQUE INDEX idx_mission_categories_seed_key
  ON mission_categories(seed_key) WHERE seed_key IS NOT NULL;

-- ── agent_profiles (PatterStage source of truth) ─────────────
CREATE TABLE agent_profiles (
  slug            TEXT PRIMARY KEY,
  display_name    TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  personality     TEXT NOT NULL DEFAULT 'technical',
  config_yaml     TEXT NOT NULL DEFAULT '',
  soul_md         TEXT NOT NULL DEFAULT '',
  agents_md       TEXT NOT NULL DEFAULT '',
  user_md         TEXT NOT NULL DEFAULT '',
  memory_md       TEXT NOT NULL DEFAULT '',
  disabled_skills TEXT NOT NULL DEFAULT '[]',
  platform_toolsets TEXT NOT NULL DEFAULT '{}',
  seed_key        TEXT,
  synced_at       TEXT,
  sync_error      TEXT,
  -- Per-profile gateway endpoint (each Hermes profile is its own gateway
  -- process on its own port/key). NULL = use the default gateway.
  gateway_host    TEXT,
  gateway_port    INTEGER,
  api_key_ref     TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX idx_agent_profiles_seed_key
  ON agent_profiles(seed_key) WHERE seed_key IS NOT NULL;

CREATE UNIQUE INDEX idx_agent_profiles_slug_lower
  ON agent_profiles(lower(slug));

-- ── agent_root (Bob / default local Hermes agent) ─────────────
CREATE TABLE agent_root (
  id                  INTEGER PRIMARY KEY CHECK (id = 1),
  display_name        TEXT NOT NULL DEFAULT 'Bob',
  description         TEXT NOT NULL DEFAULT '',
  personality         TEXT NOT NULL DEFAULT 'technical',
  config_yaml         TEXT NOT NULL DEFAULT '',
  soul_md             TEXT NOT NULL DEFAULT '',
  agents_md           TEXT NOT NULL DEFAULT '',
  hermes_md           TEXT NOT NULL DEFAULT '',
  user_md             TEXT NOT NULL DEFAULT '',
  memory_md           TEXT NOT NULL DEFAULT '',
  disabled_skills     TEXT NOT NULL DEFAULT '[]',
  platform_toolsets   TEXT NOT NULL DEFAULT '{}',
  synced_at           TEXT,
  sync_error          TEXT,
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO agent_root (id, display_name, description)
VALUES (1, 'Bob', 'Local Hermes default agent at HERMES_HOME');

-- ── skills (global Hermes skills catalog) ─────────────────────
CREATE TABLE skills (
  skill_key       TEXT PRIMARY KEY,
  display_name    TEXT NOT NULL DEFAULT '',
  description     TEXT NOT NULL DEFAULT '',
  category        TEXT NOT NULL DEFAULT '',
  content         TEXT NOT NULL DEFAULT '',
  source          TEXT NOT NULL DEFAULT 'custom',
  synced_at       TEXT,
  sync_error      TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_skills_category ON skills(category);
CREATE INDEX idx_skills_source ON skills(source);

-- ── catalog_templates (seeded mission templates) ─────────────
CREATE TABLE catalog_templates (
  id                  TEXT PRIMARY KEY,
  seed_key            TEXT,
  name                TEXT NOT NULL,
  icon                TEXT NOT NULL DEFAULT 'target',
  color               TEXT NOT NULL DEFAULT 'cyan',
  category_id         TEXT,
  profile_slug        TEXT NOT NULL DEFAULT 'default',
  description         TEXT NOT NULL DEFAULT '',
  instruction         TEXT NOT NULL DEFAULT '',
  context             TEXT NOT NULL DEFAULT '',
  goals               TEXT NOT NULL DEFAULT '[]',
  output_format       TEXT NOT NULL DEFAULT '',
  constraints         TEXT NOT NULL DEFAULT '',
  suggested_skills    TEXT NOT NULL DEFAULT '[]',
  suggested_toolsets  TEXT NOT NULL DEFAULT '[]',
  local_dirs          TEXT NOT NULL DEFAULT '[]',
  references_json     TEXT NOT NULL DEFAULT '[]',
  mission_time_minutes INTEGER,
  timeout_minutes     INTEGER NOT NULL DEFAULT 30,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX idx_catalog_templates_seed_key
  ON catalog_templates(seed_key) WHERE seed_key IS NOT NULL;

-- ── agent_processes ─────────────────────────────────────────
CREATE TABLE agent_processes (
  id            TEXT PRIMARY KEY,
  type          TEXT NOT NULL,
  name          TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'idle',
  pid           INTEGER,
  model         TEXT,
  turns         INTEGER DEFAULT 0,
  last_activity TEXT,
  last_seen_at  TEXT NOT NULL
);
