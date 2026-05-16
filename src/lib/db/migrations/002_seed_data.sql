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

-- ── Sample board: PatterTech Launch ───────────────────────────────
INSERT OR IGNORE INTO kanban_boards (id, name, description, created_at, updated_at) VALUES
  ('seed-board-launch',
   'PatterTech Launch',
   'Core workstreams for getting PatterTech off the ground',
   datetime('now'), datetime('now'));

-- Columns: Backlog · In Progress · Review · Done
INSERT OR IGNORE INTO kanban_columns (id, board_id, title, color, position) VALUES
  ('seed-col-backlog',     'seed-board-launch', 'Backlog',     'purple', 0),
  ('seed-col-inprogress',  'seed-board-launch', 'In Progress', 'cyan',   1),
  ('seed-col-review',      'seed-board-launch', 'Review',      'orange', 2),
  ('seed-col-done',        'seed-board-launch', 'Done',        'green',  3);

-- Backlog cards
INSERT OR IGNORE INTO kanban_cards (id, board_id, column_id, title, description, position) VALUES
  ('seed-card-1', 'seed-board-launch', 'seed-col-backlog',
   'Define product vision for Q2',
   'Articulate the core value proposition, target users, and success metrics for Q2 launch.',
   0),
  ('seed-card-2', 'seed-board-launch', 'seed-col-backlog',
   'Research competitor landscape',
   'Analyse top 5 competitors: pricing, features, positioning, and gaps we can exploit.',
   1),
  ('seed-card-3', 'seed-board-launch', 'seed-col-backlog',
   'Set up CI/CD pipeline',
   'Configure GitHub Actions for automated tests, builds, and deployments to staging.',
   2);

-- In Progress cards
INSERT OR IGNORE INTO kanban_cards (id, board_id, column_id, title, description, position) VALUES
  ('seed-card-4', 'seed-board-launch', 'seed-col-inprogress',
   'Build MVP landing page',
   'Create a high-converting landing page with hero, features, testimonials, and CTA sections.',
   0),
  ('seed-card-5', 'seed-board-launch', 'seed-col-inprogress',
   'Write API documentation',
   'Document all REST endpoints with request/response examples using OpenAPI spec.',
   1);

-- Review cards
INSERT OR IGNORE INTO kanban_cards (id, board_id, column_id, title, description, position) VALUES
  ('seed-card-6', 'seed-board-launch', 'seed-col-review',
   'Design brand assets',
   'Logo, colour palette, typography, and icon set consistent with the PatterTech identity.',
   0);

-- Done cards
INSERT OR IGNORE INTO kanban_cards (id, board_id, column_id, title, description, position) VALUES
  ('seed-card-7', 'seed-board-launch', 'seed-col-done',
   'Register domain',
   'pattertech.com and pattertech.io registered and DNS configured.',
   0),
  ('seed-card-8', 'seed-board-launch', 'seed-col-done',
   'Set up monitoring',
   'Deployed Uptime Kuma for 24/7 endpoint monitoring with Discord alerting.',
   1);

-- ── Sample team: Engineering ──────────────────────────────────────
INSERT OR IGNORE INTO teams (id, name, description, leader_id, created_at, updated_at) VALUES
  ('seed-team-eng',
   'Engineering',
   'Core engineering team building PatterTech products',
   'seed-bob',
   datetime('now'), datetime('now'));

INSERT OR IGNORE INTO team_members (id, team_id, profile_id, role) VALUES
  ('seed-member-bob',   'seed-team-eng', 'seed-bob',   'leader'),
  ('seed-member-daniel','seed-team-eng', 'seed-daniel', 'specialist');

-- ── Seed data note ──────────────────────────────────────────────
-- Initial seed missions were removed in migration 028.
-- Templates are managed separately via the templates system.
-- See src/app/api/templates/ for built-in templates.
--
