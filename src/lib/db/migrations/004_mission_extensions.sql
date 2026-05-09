-- ============================================================
-- control-hub.db — Migration 004: Mission Extension Fields
-- ============================================================
-- Adds: local_dirs, references, skills, goals as JSON text columns
-- to the missions table. Goals moves from prompt-parsing to
-- a dedicated column for reliable storage and display.

CREATE TABLE IF NOT EXISTS _mg4_guard (x INTEGER);
DROP TABLE IF EXISTS _mg4_guard;

-- Add new columns if they don't already exist (idempotent)
-- local_dirs: JSON array of working directory paths
ALTER TABLE missions ADD COLUMN local_dirs TEXT NOT NULL DEFAULT '[]';

-- references: JSON array of reference URLs / file names
ALTER TABLE missions ADD COLUMN references_ TEXT NOT NULL DEFAULT '[]';

-- skills: JSON array of skill names to attach to the mission
ALTER TABLE missions ADD COLUMN skills TEXT NOT NULL DEFAULT '[]';

-- goals: JSON array of goal strings (previously embedded in prompt)
ALTER TABLE missions ADD COLUMN goals TEXT NOT NULL DEFAULT '[]';
