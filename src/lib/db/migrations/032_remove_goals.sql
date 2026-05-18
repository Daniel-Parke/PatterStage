-- ============================================================
-- control-hub.db — Migration 032: Remove Persistent Goals System
-- ============================================================
-- Drops the goals, goal_kanban_tasks, and goal_checkpoints tables
-- added by migration 031, as the Goals page and its supporting
-- infrastructure have been removed.
-- ============================================================

DROP TABLE IF EXISTS goal_checkpoints;
DROP TABLE IF EXISTS goal_kanban_tasks;
DROP TABLE IF EXISTS goals;
