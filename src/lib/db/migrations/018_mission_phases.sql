-- ============================================================
-- 018_mission_phases.sql — Mission V2 multi-phase orchestration (foundation)
--
-- Additive only. New tables model a mission as an ordered list of PHASES
-- (Prepare → Implement → Test → Release, or custom), each holding an ordered
-- list of ACTIONS (the flexible per-phase steps: test/review/validate/plan/…)
-- and ending in a gate (human-in-loop or auto). `mission_approvals` is the
-- audit trail for gate decisions.
--
-- Column adds to missions/runs (version, current_phase_id, phase_action_id)
-- are applied in TS (columnExists-guarded) — see apply-mission-phases-migration.ts.
--
-- V1 missions are unaffected: a V1 mission simply has no phase rows and
-- missions.version stays 'v1'. Idempotent: safe to run repeatedly.
-- ============================================================

CREATE TABLE IF NOT EXISTS mission_phases (
  id                TEXT PRIMARY KEY,
  mission_id        TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  position          INTEGER NOT NULL DEFAULT 0,
  name              TEXT NOT NULL DEFAULT '',
  -- Conventional kinds: prepare | implement | test | release | custom.
  -- Not CHECK-constrained so users can author custom phases.
  kind              TEXT NOT NULL DEFAULT 'custom',
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','running','awaiting_approval','approved','rejected','completed','failed','skipped')),
  gate              TEXT NOT NULL DEFAULT 'auto' CHECK (gate IN ('hil','auto')),
  -- Resolved gate decision: 'approved' | 'rejected' | NULL (undecided).
  approval_decision TEXT,
  approval_note     TEXT,
  decided_at        TEXT,
  started_at        TEXT,
  completed_at      TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_mission_phases_mission ON mission_phases(mission_id);

CREATE TABLE IF NOT EXISTS mission_phase_actions (
  id          TEXT PRIMARY KEY,
  phase_id    TEXT NOT NULL REFERENCES mission_phases(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL DEFAULT 0,
  -- Conventional kinds: test | bug_report | review | validate | task | plan |
  -- implement | integration | acceptance | deployment | custom. Not CHECK-
  -- constrained so phases can mix arbitrary actions.
  kind        TEXT NOT NULL DEFAULT 'task',
  status      TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','running','completed','failed','skipped')),
  -- The agent run that executed this action (when it dispatched one).
  run_id      TEXT REFERENCES runs(id) ON DELETE SET NULL,
  output      TEXT,
  error       TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_mission_phase_actions_phase ON mission_phase_actions(phase_id);

CREATE TABLE IF NOT EXISTS mission_approvals (
  id          TEXT PRIMARY KEY,
  phase_id    TEXT NOT NULL REFERENCES mission_phases(id) ON DELETE CASCADE,
  decided_by  TEXT NOT NULL DEFAULT 'user',
  approved    INTEGER NOT NULL CHECK (approved IN (0, 1)),
  note        TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_mission_approvals_phase ON mission_approvals(phase_id);
