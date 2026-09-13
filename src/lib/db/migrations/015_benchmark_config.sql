-- ============================================================
-- 015_benchmark_config.sql — record the (Agent + LLM) unit + augmentation tags
--
-- A benchmark target is an inseparable unit: an agent profile AND the LLM it
-- runs on ("no human without the brain"). These additive columns record the
-- exact brain used, the execution mode, and whether skills/tools/memory were
-- active, so a result is interpretable and reproducible.
--
-- NOTE: ALTER TABLE ADD COLUMN is NOT idempotent (a re-run errors "duplicate
-- column"). The wired applier (apply-benchmark-config-migration.ts) is
-- version-guarded AND runs each statement in its own try/catch, so a partial
-- apply self-heals. See [[db-migration-applier-footgun]].
-- ============================================================

ALTER TABLE benchmark_runs ADD COLUMN model_id     TEXT;     -- registry model id (the brain)
ALTER TABLE benchmark_runs ADD COLUMN model_label  TEXT;     -- display label for the brain
ALTER TABLE benchmark_runs ADD COLUMN exec_mode    TEXT;     -- 'model' (brain-only) | 'agentic'
ALTER TABLE benchmark_runs ADD COLUMN used_skills  INTEGER;  -- 0/1 augmentation tags
ALTER TABLE benchmark_runs ADD COLUMN used_tools   INTEGER;
ALTER TABLE benchmark_runs ADD COLUMN used_memory  INTEGER;
ALTER TABLE benchmark_runs ADD COLUMN config_json  TEXT;     -- resolved augmentation + brain config

ALTER TABLE benchmark_item_results ADD COLUMN skills_used_json TEXT;
ALTER TABLE benchmark_item_results ADD COLUMN tools_used_json  TEXT;
ALTER TABLE benchmark_item_results ADD COLUMN memory_used      INTEGER;
