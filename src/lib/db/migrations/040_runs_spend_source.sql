-- ============================================================
-- 040_runs_spend_source.sql — a runs row says which feature spent the money
--
-- Story Weaver drives callLLM directly and creates no runs row, so every
-- chapter it writes is invisible to the spend console and to the hard stop
-- (T-0108, D87). Spend is mined from `runs.usage_json`, and the only source
-- discriminator was the structural `composer_node_run_id IS NOT NULL`, which
-- can say "agent or composer" and nothing else.
--
-- `spend_source` names the feature. `story_id` links the row back to the
-- story that spent it. The link is ON DELETE SET NULL, not CASCADE: deleting
-- a story must not delete the record that money was spent.
--
-- Runs exactly once, behind the applier's version gate: this file is one
-- exec(), so a re-run against a database that already has the columns would
-- stop at the first duplicate-column error and skip the backfill below.
-- ============================================================

ALTER TABLE runs ADD COLUMN story_id TEXT REFERENCES stories(id) ON DELETE SET NULL;
ALTER TABLE runs ADD COLUMN spend_source TEXT NOT NULL DEFAULT 'agent'
  CHECK (spend_source IN ('agent', 'composer', 'research', 'story'));

-- Classify what is already there from the one signal the old schema had.
UPDATE runs SET spend_source = 'composer' WHERE composer_node_run_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_runs_story ON runs(story_id) WHERE story_id IS NOT NULL;
