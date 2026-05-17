-- ============================================================
-- control-hub.db — Seed Data (Sample Projects + Missions)
-- Version: 002
-- Description: Sample board, cards, team, and mission templates
--             to give new users a intuitive starting point.
-- ============================================================

-- Only run if tables exist ( idempotent — safe to re-run )
CREATE TABLE IF NOT EXISTS _seed_guard (x INTEGER);
DROP TABLE IF EXISTS _seed_guard;

-- ── Sample profiles ───────────────────────────────────────────────
INSERT OR IGNORE INTO agent_profiles (id, name, description, role, status) VALUES
  ('seed-bob',   'Bob',   'CEO of PatterTech — orchestrates all operations', 'agent', 'active'),
  ('seed-daniel','Daniel','Founder of PatterTech — strategic direction',       'agent', 'active');
-- Initial seed missions were removed in migration 028.
-- Templates are managed separately via the templates system.
-- See src/app/api/templates/ for built-in templates.
--
