-- ============================================================
-- control-hub.db — Migration 011: Profile Source of Truth
-- ============================================================
-- Removes the legacy SQLite agent_profiles table entirely.
--
-- Background:
--   The agent_profiles table previously held seed-bob/seed-daniel entries
--   created by migrations 002/007 (seed data). All application code
--   (missions, cron, teams, kanban) now stores Hermes profile names
--   directly as TEXT — e.g. 'default', 'swe', 'qa' — bypassing the UUID
--   lookup that agent_profiles required.
--
--   The agent_profiles table was never the "real" source of truth for
--   Hermes profiles; ~/.hermes/profiles/<name>/ is. The SQLite table was
--   only used as a local cache during the Mission Control era.
--
-- Unique constraint note:
--   team_members has UNIQUE(team_id, profile_id). After migrating both
--   seed-bob and seed-daniel to 'default', two members of seed-team-eng
--   would both have profile_id='default', violating this constraint.
--   To resolve, seed-member-daniel (the specialist) is deleted since
--   seed-member-bob (the leader) is preserved.
--
-- Order of operations:
--   1. Guard
--   2. Disable FK enforcement (for this migration only)
--   3. Delete duplicate team_member that would violate UNIQUE after migration
--   4. Migrate missions: profile_id → 'default'
--   5. Migrate teams: leader_id → 'default'  (was NOT NULL, no ON DELETE SET NULL)
--   6. Migrate remaining team_members: profile_id → 'default'
--   7. Migrate kanban_cards: assignee_profile_id → 'default'
--   8. Migrate goal_steps: assigned_profile_id → 'default'
--   9. Drop agent_profiles table
--  10. Drop orphaned indexes from agent_profiles
--  11. Re-enable FK enforcement

CREATE TABLE IF NOT EXISTS _mg11_guard (x INTEGER);
DROP TABLE IF EXISTS _mg11_guard;

-- Disable FK enforcement for this migration only.
-- agent_profiles.id is about to be dropped; we update all referencing
-- columns to 'default' BEFORE dropping so no FK violation occurs.
-- Re-enabled immediately after.
PRAGMA foreign_keys = off;

-- Resolve UNIQUE(team_id, profile_id) conflict before it happens.
-- seed-team-eng has two members: seed-bob (leader) and seed-daniel (specialist).
-- After migration both would have profile_id='default' → UNIQUE violation.
-- Solution: delete seed-member-daniel (specialist), keep seed-member-bob (leader).
DELETE FROM team_members WHERE id = 'seed-member-daniel';

-- Migrate missions (profile_id REFERENCES agent_profiles(id) ON DELETE SET NULL)
-- After: plain Hermes profile name string, no FK
UPDATE missions SET profile_id = 'default'
  WHERE profile_id = 'seed-bob' OR profile_id = 'seed-daniel';

-- Migrate teams leader (leader_id TEXT NOT NULL REFERENCES agent_profiles(id))
-- leader_id has no ON DELETE clause — must update to 'default' before dropping
UPDATE teams SET leader_id = 'default'
  WHERE leader_id = 'seed-bob' OR leader_id = 'seed-daniel';

-- Migrate remaining team_members: profile_id → 'default'
UPDATE team_members SET profile_id = 'default'
  WHERE profile_id IN ('seed-bob', 'seed-daniel');

-- Migrate kanban card assignees (assignee_profile_id REFERENCES ... ON DELETE SET NULL)
UPDATE kanban_cards SET assignee_profile_id = 'default'
  WHERE assignee_profile_id IN ('seed-bob', 'seed-daniel');

-- Migrate goal step assignees (assigned_profile_id REFERENCES ... ON DELETE SET NULL)
UPDATE goal_steps SET assigned_profile_id = 'default'
  WHERE assigned_profile_id IN ('seed-bob', 'seed-daniel');

-- Drop the legacy agent_profiles table
DROP TABLE IF EXISTS agent_profiles;

-- Remove orphaned indexes that referenced agent_profiles
DROP INDEX IF EXISTS idx_profiles_status;
DROP INDEX IF EXISTS idx_profiles_name;

-- Re-enable FK enforcement
PRAGMA foreign_keys = on;
