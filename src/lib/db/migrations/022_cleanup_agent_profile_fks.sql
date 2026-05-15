-- 022_cleanup_agent_profile_fks.sql
-- Remove dead FK references to agent_profiles table (dropped in migration 011)
-- These FKs are dangling — SQLite ignores them but they're messy.
-- We rebuild each affected table without the REFERENCES clause.
-- Data is preserved in-place.

PRAGMA foreign_keys = off;

-- ── missions ──────────────────────────────────────────
CREATE TABLE missions_new (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    profile_id TEXT NOT NULL DEFAULT 'default',
    goal TEXT,
    status TEXT NOT NULL DEFAULT 'idle',
    source TEXT NOT NULL DEFAULT 'manual',
    agent_type TEXT NOT NULL DEFAULT 'hermes',
    leader_id TEXT,
    team_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    started_at TEXT,
    completed_at TEXT,
    model_id TEXT,
    provider TEXT,
    profile_name TEXT,
    schedule TEXT,
    timeout_minutes INTEGER DEFAULT 60,
    priority INTEGER DEFAULT 0,
    tags TEXT,
    metadata_json TEXT,
    result_summary TEXT,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3
);
INSERT INTO missions_new SELECT * FROM missions;
DROP TABLE missions;
ALTER TABLE missions_new RENAME TO missions;

-- ── teams ─────────────────────────────────────────────
CREATE TABLE teams_new (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    leader_id TEXT NOT NULL DEFAULT 'default',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO teams_new SELECT * FROM teams;
DROP TABLE teams;
ALTER TABLE teams_new RENAME TO teams;

-- ── team_members ──────────────────────────────────────
CREATE TABLE team_members_new (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL,
    profile_id TEXT NOT NULL DEFAULT 'default',
    role TEXT NOT NULL DEFAULT 'member',
    joined_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO team_members_new SELECT * FROM team_members;
DROP TABLE team_members;
ALTER TABLE team_members_new RENAME TO team_members;

-- ── kanban_cards ──────────────────────────────────────
CREATE TABLE kanban_cards_new (
    id TEXT PRIMARY KEY,
    board_id TEXT NOT NULL,
    column_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    assignee_profile_id TEXT NOT NULL DEFAULT 'default',
    priority INTEGER DEFAULT 0,
    status TEXT DEFAULT 'todo',
    tags TEXT,
    due_date TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO kanban_cards_new SELECT * FROM kanban_cards;
DROP TABLE kanban_cards;
ALTER TABLE kanban_cards_new RENAME TO kanban_cards;

-- ── goal_steps ────────────────────────────────────────
CREATE TABLE goal_steps_new (
    id TEXT PRIMARY KEY,
    goal_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    assigned_profile_id TEXT NOT NULL DEFAULT 'default',
    status TEXT DEFAULT 'pending',
    priority INTEGER DEFAULT 0,
    order_index INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO goal_steps_new SELECT * FROM goal_steps;
DROP TABLE goal_steps;
ALTER TABLE goal_steps_new RENAME TO goal_steps;

PRAGMA foreign_keys = on;
