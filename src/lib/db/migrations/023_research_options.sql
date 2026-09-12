-- 023_research_options.sql — Deep Research run config + saved presets (v23)
--
-- research_runs.config_json captures the options a run used (model, search
-- provider, depth/breadth) so the report + the HTML export can show "how it was
-- run". research_presets stores reusable Deep Research configurations.
-- (research_runs.config_json is added via a guarded ALTER in the apply step.)

CREATE TABLE IF NOT EXISTS research_presets (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  config_json TEXT NOT NULL DEFAULT '{}',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
