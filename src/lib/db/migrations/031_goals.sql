-- ============================================================
-- control-hub.db — Migration 031: Persistent Goals System
-- ============================================================
-- Adds tables for tracking persistent goals with checkpoints,
-- linked kanban tasks, and optional mission/parent goal refs.
-- ============================================================

CREATE TABLE IF NOT EXISTS goals (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  description   TEXT,
  status        TEXT NOT NULL DEFAULT 'active',
  priority      INTEGER DEFAULT 3,
  category      TEXT,
  mission_id    TEXT REFERENCES missions(id) ON DELETE SET NULL,
  parent_goal_id TEXT REFERENCES goals(id) ON DELETE SET NULL,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  completed_at  INTEGER
);

CREATE TABLE IF NOT EXISTS goal_kanban_tasks (
  goal_id   TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  task_id   TEXT NOT NULL,
  PRIMARY KEY (goal_id, task_id)
);

CREATE TABLE IF NOT EXISTS goal_checkpoints (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  goal_id      TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  completed    INTEGER DEFAULT 0,
  completed_at INTEGER,
  order_index  INTEGER NOT NULL
);
