-- ============================================================
-- control-hub.db — Migration 011: Profile Source of Truth
-- ============================================================
-- Migrates all profile references from the legacy SQLite
-- agent_profiles table (seed-bob, seed-daniel) to Hermes
-- profile names used everywhere else in the system.
--
-- Changes:
--   - missions.profile_id: 'seed-bob' → 'default'
--   - teams.leader_id: 'seed-bob' → 'default'
--   - team_members.profile_id: 'seed-bob' → 'default', 'seed-daniel' → 'default'
--   - kanban_cards.assignee_profile_id: 'seed-bob' → 'default'
--   - goal_steps.assigned_profile_id: any seed-* → 'default'
--   - Drop the legacy agent_profiles table (no longer needed)
--   - Remove agent_profiles FK indexes

CREATE TABLE IF NOT EXISTS _mg11_guard (x INTEGER);
DROP TABLE IF EXISTS _mg11_guard;

-- Migrate missions
UPDATE missions SET profile_id = 'default' WHERE profile_id = 'seed-bob' OR profile_id = 'seed-daniel';

-- Migrate teams leader
UPDATE teams SET leader_id = 'default' WHERE leader_id = 'seed-bob' OR leader_id = 'seed-daniel';

-- Migrate team members
UPDATE team_members SET profile_id = 'default' WHERE profile_id IN ('seed-bob', 'seed-daniel');

-- Migrate kanban card assignees
UPDATE kanban_cards SET assignee_profile_id = 'default' WHERE assignee_profile_id IN ('seed-bob', 'seed-daniel');

-- Migrate goal steps
UPDATE goal_steps SET assigned_profile_id = 'default' WHERE assigned_profile_id IN ('seed-bob', 'seed-daniel');

-- Drop the legacy agent_profiles table
DROP TABLE IF EXISTS agent_profiles;

-- Drop orphaned indexes (they referenced agent_profiles which is now gone)
DROP INDEX IF EXISTS idx_profiles_status;
DROP INDEX IF EXISTS idx_profiles_name;
