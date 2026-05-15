-- 022_cleanup_agent_profile_fks.sql
-- Remove dead FK references to agent_profiles table (dropped in migration 011)
-- These FKs are dangling — SQLite ignores them but they're messy.
-- We rebuild each affected table without the REFERENCES clause.
-- Data is preserved in-place.
-- Column lists are explicit to match the actual schema after all migrations.

PRAGMA foreign_keys = off;

-- ── missions (20 cols: 001_init + 005_rebuild + 013_add) ────
CREATE TABLE missions_new (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    prompt       TEXT NOT NULL,
    profile_id   TEXT DEFAULT 'default',
    status       TEXT NOT NULL DEFAULT 'queued'
                   CHECK (status IN ('queued', 'dispatched', 'successful', 'failed')),
    result       TEXT,
    session_id   TEXT,
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at   TEXT,
    local_dirs   TEXT NOT NULL DEFAULT '[]',
    references_  TEXT NOT NULL DEFAULT '[]',
    skills       TEXT NOT NULL DEFAULT '[]',
    goals        TEXT NOT NULL DEFAULT '[]',
    model_id     TEXT,
    provider     TEXT,
    profile_name TEXT,
    mission_time_minutes INTEGER,
    timeout_minutes INTEGER,
    schedule     TEXT
);
INSERT INTO missions_new (
    id, name, prompt, profile_id, status, result, session_id,
    created_at, updated_at, deleted_at,
    local_dirs, references_, skills, goals,
    model_id, provider, profile_name,
    mission_time_minutes, timeout_minutes, schedule
)
SELECT
    id, name, prompt, profile_id, status, result, session_id,
    created_at, updated_at, deleted_at,
    local_dirs, references_, skills, goals,
    model_id, provider, profile_name,
    mission_time_minutes, timeout_minutes, schedule
FROM missions;
DROP TABLE missions;
ALTER TABLE missions_new RENAME TO missions;
CREATE INDEX IF NOT EXISTS idx_missions_status   ON missions(status);
CREATE INDEX IF NOT EXISTS idx_missions_profile  ON missions(profile_id);
CREATE INDEX IF NOT EXISTS idx_missions_session  ON missions(session_id);

-- ── teams (7 cols: 001_init) ────────────────────────────────
-- Original: leader_id TEXT NOT NULL REFERENCES agent_profiles(id)
CREATE TABLE teams_new (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    leader_id   TEXT NOT NULL DEFAULT 'default',
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at  TEXT
);
INSERT INTO teams_new (id, name, description, leader_id, created_at, updated_at, deleted_at)
SELECT id, name, description, leader_id, created_at, updated_at, deleted_at FROM teams;
DROP TABLE teams;
ALTER TABLE teams_new RENAME TO teams;
CREATE INDEX IF NOT EXISTS idx_teams_leader ON teams(leader_id);

-- ── team_members (5 cols: 001_init) ─────────────────────────
-- Original: profile_id TEXT NOT NULL REFERENCES agent_profiles(id) ON DELETE CASCADE
CREATE TABLE team_members_new (
    id         TEXT PRIMARY KEY,
    team_id    TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    profile_id TEXT NOT NULL DEFAULT 'default',
    role       TEXT NOT NULL CHECK (role IN ('leader', 'specialist', 'reviewer', 'observer')),
    joined_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO team_members_new (id, team_id, profile_id, role, joined_at)
SELECT id, team_id, profile_id, role, joined_at FROM team_members;
DROP TABLE team_members;
ALTER TABLE team_members_new RENAME TO team_members;
CREATE INDEX IF NOT EXISTS idx_members_team    ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_members_profile ON team_members(profile_id);

-- ── kanban_cards (13 cols: 001_init) ────────────────────────
-- Original: assignee_profile_id TEXT REFERENCES agent_profiles(id) ON DELETE SET NULL
CREATE TABLE kanban_cards_new (
    id                  TEXT PRIMARY KEY,
    board_id            TEXT NOT NULL REFERENCES kanban_boards(id) ON DELETE CASCADE,
    column_id           TEXT NOT NULL REFERENCES kanban_columns(id) ON DELETE CASCADE,
    title               TEXT NOT NULL,
    description         TEXT NOT NULL DEFAULT '',
    position            INTEGER NOT NULL DEFAULT 0,
    status              TEXT NOT NULL DEFAULT 'todo'
                          CHECK (status IN ('backlog', 'todo', 'in_progress', 'review', 'done', 'blocked')),
    assignee_profile_id TEXT DEFAULT 'default',
    labels              TEXT NOT NULL DEFAULT '[]',
    mission_ids         TEXT NOT NULL DEFAULT '[]',
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at          TEXT
);
INSERT INTO kanban_cards_new (
    id, board_id, column_id, title, description, position, status,
    assignee_profile_id, labels, mission_ids,
    created_at, updated_at, deleted_at
)
SELECT
    id, board_id, column_id, title, description, position, status,
    assignee_profile_id, labels, mission_ids,
    created_at, updated_at, deleted_at
FROM kanban_cards;
DROP TABLE kanban_cards;
ALTER TABLE kanban_cards_new RENAME TO kanban_cards;
CREATE INDEX IF NOT EXISTS idx_cards_board  ON kanban_cards(board_id);
CREATE INDEX IF NOT EXISTS idx_cards_col   ON kanban_cards(column_id);

-- ── goal_steps (11 cols: 001_init) ──────────────────────────
-- Original: assigned_profile_id TEXT REFERENCES agent_profiles(id) ON DELETE SET NULL
CREATE TABLE goal_steps_new (
    id                  TEXT PRIMARY KEY,
    session_id          TEXT NOT NULL REFERENCES goal_sessions(id) ON DELETE CASCADE,
    step_index          INTEGER NOT NULL,
    goal                TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'active', 'done', 'failed', 'skipped')),
    mission_id          TEXT,
    assigned_profile_id TEXT DEFAULT 'default',
    completed_at        TEXT,
    error               TEXT,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO goal_steps_new (
    id, session_id, step_index, goal, status, mission_id,
    assigned_profile_id, completed_at, error,
    created_at, updated_at
)
SELECT
    id, session_id, step_index, goal, status, mission_id,
    assigned_profile_id, completed_at, error,
    created_at, updated_at
FROM goal_steps;
DROP TABLE goal_steps;
ALTER TABLE goal_steps_new RENAME TO goal_steps;
CREATE INDEX IF NOT EXISTS idx_steps_session ON goal_steps(session_id);
CREATE INDEX IF NOT EXISTS idx_steps_status  ON goal_steps(status);

PRAGMA foreign_keys = on;
