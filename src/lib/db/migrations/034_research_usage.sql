-- ═══════════════════════════════════════════════════════════════
-- 034_research_usage.sql · Deep Research stops being invisible to spend
--
-- Deep Research is one of the three things in PatterStage that costs money, and
-- it was the only one whose cost the database could not answer for. The engine
-- drove callLLM directly and discarded the usage it returned, so `research_runs`
-- held query, status, provider, model_id and report, and not one token count.
--
-- The consequence was not merely a gap in a report. Migration 033 gave the
-- operator an optional HARD STOP on provider spend, and a hard stop can only
-- measure what was recorded. An install that leans on Deep Research was
-- under-counted, and could pass its own ceiling by an amount nothing in the
-- product could see. That is what T-0030 was filed to close.
--
-- ── WHY THESE COLUMNS ARE NULLABLE, AND WHY THAT MATTERS ───────
--
-- NULL and 0 are different facts here, and the whole point of the change turns
-- on keeping them apart:
--
--   NULL  nobody reported usage for this run. Its cost is UNKNOWN.
--   0     a provider reported zero tokens. That is a real measurement.
--
-- Every run that predates this migration is NULL, and must stay excluded from
-- the totals and stay DECLARED in the console's `unmeasured` list. Defaulting
-- these to 0 would have taken a real, uncounted cost and painted it as free,
-- which is the same lie the task exists to remove, moved one layer down where
-- it is harder to see. So: no DEFAULT, no backfill, no NOT NULL.
--
-- `total_tokens` is stored rather than derived because a provider's own total
-- can legitimately exceed prompt + completion: reasoning tokens and cached
-- reads are billed separately by several of them. Recomputing the sum here
-- would silently under-report exactly the models that cost the most.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE research_runs ADD COLUMN prompt_tokens INTEGER;
ALTER TABLE research_runs ADD COLUMN completion_tokens INTEGER;
ALTER TABLE research_runs ADD COLUMN total_tokens INTEGER;
