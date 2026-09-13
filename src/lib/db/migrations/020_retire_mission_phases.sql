-- ============================================================
-- 020_retire_mission_phases.sql — remove the superseded Mission-V2 phase model
--
-- The linear mission-phase foundation (018) is superseded by the Composer graph
-- orchestrator. It was flag-gated and never used (no data). Drop the tables
-- (children before parents). Column removals on missions/runs are applied in TS
-- (DROP COLUMN, best-effort) — see apply-retire-mission-phases-migration.ts.
-- Idempotent: DROP TABLE IF EXISTS.
-- ============================================================

DROP TABLE IF EXISTS mission_approvals;
DROP TABLE IF EXISTS mission_phase_actions;
DROP TABLE IF EXISTS mission_phases;
