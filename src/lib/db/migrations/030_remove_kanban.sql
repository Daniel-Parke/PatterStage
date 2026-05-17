-- ============================================================
-- control-hub.db — Migration 030: Remove Custom Kanban Tables
-- ============================================================
-- Removes the custom kanban implementation (boards, columns,
-- cards, goal sessions) that was an incomplete reimplementation
-- of Hermes' built-in kanban system.
-- ============================================================

DROP TABLE IF EXISTS goal_steps;
DROP TABLE IF EXISTS goal_sessions;
DROP TABLE IF EXISTS kanban_cards;
DROP TABLE IF EXISTS kanban_columns;
DROP TABLE IF EXISTS kanban_boards;
