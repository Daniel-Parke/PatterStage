-- ═══════════════════════════════════════════════════════════════
-- 036_research_gather_health.sql · how much of the evidence was actually gathered
--
-- Deep Research already counted its search attempts and its search failures.
-- Both numbers were thrown away at the end of the run, and the caller read them
-- for exactly ONE case: every single search failed, which fails the run outright
-- and says so.
--
-- Everything short of total outage was invisible. Five failures out of eight is
-- a report written from three sources instead of eight, marked `completed`, with
-- a confident tone and a citation list that looks exactly like a healthy run's.
-- The operator has no way to know, at the time or afterwards, that most of the
-- gather did not happen.
--
-- Visits were worse than searches: `if (page)` skipped a failed page read
-- silently and counted nothing at all, so a run where every page fetch was
-- blocked -- paywalls, robots, timeouts -- reported the same as one where every
-- page was read in full.
--
-- ── WHY NULLABLE, WITH NO DEFAULT ──────────────────────────────
--
-- The same rule as 034's token columns, for the same reason:
--
--   NULL  this run predates the counters. How much it gathered is UNKNOWN.
--   0     the run measured zero. That is a real observation.
--
-- `DEFAULT 0` would make every historical run read as a clean gather -- zero
-- attempts, zero failures -- which is a confident claim about runs nobody
-- measured. That is the same lie the counters exist to remove, moved one layer
-- down where it is harder to see.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE research_runs ADD COLUMN search_attempts INTEGER;
ALTER TABLE research_runs ADD COLUMN search_failures INTEGER;
ALTER TABLE research_runs ADD COLUMN visit_attempts INTEGER;
ALTER TABLE research_runs ADD COLUMN visit_failures INTEGER;
