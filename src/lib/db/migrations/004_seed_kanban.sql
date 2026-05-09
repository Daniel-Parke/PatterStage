-- ============================================================
-- control-hub.db — Migration 004: Default Kanban Board Seed
-- ============================================================
-- Creates a useful default "Operations Board" with example cards
-- spanning engineering, research, and operations workstreams.

CREATE TABLE IF NOT EXISTS _mg4b_guard (x INTEGER);
DROP TABLE IF EXISTS _mg4b_guard;

-- Default: PatterTech Operations Board
INSERT OR IGNORE INTO kanban_boards (id, name, description, created_at, updated_at) VALUES
  ('board-default-ops',
   'Operations Board',
   'Manage day-to-day workstreams across engineering, research, and business',
   datetime('now'), datetime('now'));

-- Columns: Backlog · To Do · In Progress · Review · Done
INSERT OR IGNORE INTO kanban_columns (id, board_id, title, color, position) VALUES
  ('col-ops-backlog',    'board-default-ops', 'Backlog',     'purple', 0),
  ('col-ops-todo',       'board-default-ops', 'To Do',       'orange', 1),
  ('col-ops-inprogress', 'board-default-ops', 'In Progress', 'cyan',   2),
  ('col-ops-review',     'board-default-ops', 'Review',      'pink',   3),
  ('col-ops-done',       'board-default-ops', 'Done',        'green',  4);

-- Backlog cards
INSERT OR IGNORE INTO kanban_cards (id, board_id, column_id, title, description, position) VALUES
  ('ops-card-1', 'board-default-ops', 'col-ops-backlog',
   'Define Q3 product roadmap',
   'Outline the top 5 initiatives for Q3 based on customer feedback, market analysis, and team capacity.',
   0),
  ('ops-card-2', 'board-default-ops', 'col-ops-backlog',
   'Audit and streamline agent skill library',
   'Review all skills across profiles — deprecate duplicates, fill gaps, and write missing documentation for key workflows.',
   1),
  ('ops-card-3', 'board-default-ops', 'col-ops-backlog',
   'Research LLM context window optimisation techniques',
   'Survey sparse attention, KV cache eviction policies, and summarisation strategies for long-context models.',
   2);

-- To Do cards
INSERT OR IGNORE INTO kanban_cards (id, board_id, column_id, title, description, position) VALUES
  ('ops-card-4', 'board-default-ops', 'col-ops-todo',
   'Set up automated regression test suite',
   'Cover the top 20 critical paths in Control Hub with Playwright E2E tests. Integrate into CI pipeline.',
   0),
  ('ops-card-5', 'board-default-ops', 'col-ops-todo',
   'Design multi-agent task decomposition patterns',
   'Prototype how complex missions can be automatically split into sub-tasks and dispatched to specialist agents.',
   1);

-- In Progress cards
INSERT OR IGNORE INTO kanban_cards (id, board_id, column_id, title, description, position) VALUES
  ('ops-card-6', 'board-default-ops', 'col-ops-inprogress',
   'Migrate missions to new prompt structure',
   'Add localDirs, references, and skills fields to mission creation form and API. Update prompt injection order.',
   0);

-- Review cards
INSERT OR IGNORE INTO kanban_cards (id, board_id, column_id, title, description, position) VALUES
  ('ops-card-7', 'board-default-ops', 'col-ops-review',
   'Review and merge PR #32',
   'Consolidate UI layout fixes: pl-64 removed, PageWrapper deleted, sidebar padding restored to original patterns.',
   0);

-- Done cards
INSERT OR IGNORE INTO kanban_cards (id, board_id, column_id, title, description, position) VALUES
  ('ops-card-8', 'board-default-ops', 'col-ops-done',
   'Fix Hindsight Python path bug',
   'Changed `local` → `.local` in resolvePython(). Buffer increased from 1MB to 10MB. All memories now load correctly.',
   0),
  ('ops-card-9', 'board-default-ops', 'col-ops-done',
   'Fix Story Weaver chapter title storage',
   'Chapter titles are now extracted via JSON.parse and stored in chapterOutlines array. All chapters display titles.',
   0);
