-- ═══════════════════════════════════════════════════════════════
-- 030_neutral_column_names.sql — take the vendor's name out of PatterStage's
-- own schema (owner ruling, 2026-07-25)
--
-- Two columns in tables PatterStage owns were named after the agent framework,
-- so a grep of core found "hermes" even after every Hermes-shaped FILE moved
-- into src/modules/hermes/ (docs/adr/0005-product-modules.md).
--
--   agent_root.hermes_md      -> framework_md
--   cron_jobs.hermes_job_id   -> external_job_id
--
-- WHY THESE NAMES.
--   `framework_md` and not `agent_md`: agent_root already has `agents_md`
--   (AGENTS.md), and two columns one character apart is a defect waiting to
--   happen. The file this column caches is the FRAMEWORK's own instruction file,
--   and `framework` is already this codebase's word for that (FrameworkType,
--   FrameworkAdapter, the frameworks registry).
--
--   `external_job_id` and not `agent_job_id`: the value is an identifier minted
--   by a system outside PatterStage, which is the whole fact about it. Scheduling
--   is PatterStage-owned now (the `schedules` table); this column survives only
--   as the legacy bridge that maps a Hermes cron job back to a mission.
--
-- SAFETY. ALTER TABLE ... RENAME COLUMN preserves data, type, constraints and
-- default; it is not a copy. Requires SQLite >= 3.25 and better-sqlite3 ships
-- 3.53. The index on the renamed column is renamed too, because SQLite rewrites
-- the index's column reference but keeps its old NAME, and an index called
-- idx_cron_hermes_id over external_job_id is exactly the stale signpost this
-- migration exists to remove.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE agent_root RENAME COLUMN hermes_md TO framework_md;

ALTER TABLE cron_jobs RENAME COLUMN hermes_job_id TO external_job_id;

DROP INDEX IF EXISTS idx_cron_hermes_id;
CREATE INDEX IF NOT EXISTS idx_cron_external_id
  ON cron_jobs(external_job_id) WHERE external_job_id IS NOT NULL;
