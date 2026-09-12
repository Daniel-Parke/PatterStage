-- ═══════════════════════════════════════════════════════════════
-- 032_retention.sql · declared retention for the two readings tables
--
-- WG-ARCH-008 (RUL-ARCH-008, ruled by the operator) says PatterStage keeps ONE
-- patterstage.db, but that `analytics_events` and `chat_messages` are declared
-- the READINGS class: each one names its owner, its consumer, its retention
-- window and its prune path, and the physical split is designed now so it can be
-- executed if volume ever forces it. This migration is where the first three
-- become data instead of prose. The fourth, the split, is written out at the
-- bottom of this header and in ADR-0009.
--
-- WHY THOSE TWO TABLES AND NOTHING ELSE. They are the only append-only tables in
-- the schema with no expiry column and no natural ceiling. Every other table is
-- bounded by something a person does: missions, models, schedules and profiles
-- are created and deleted by hand; `runs` is bounded by dispatches. These two
-- grow with USE, on machines belonging to people the operator has never met and
-- cannot ask about disk space.
--
--   analytics_events   owner:    src/lib/analytics/analytics-repository.ts
--                                (insertEvent, reached through recordEvent).
--                      consumer: the Insights page via GET /api/analytics, and
--                                the dashboard's achievements and daily streak
--                                via src/lib/stats/stats-repository.ts.
--
--   chat_messages      owner:    src/lib/chat-repository.ts.
--                      consumer: the Chat surface, which reads a whole
--                                conversation transcript, plus the run
--                                reconciliation that matches an assistant turn
--                                to the run that produced it.
--
-- ── THE WINDOWS, AND THE ARITHMETIC BEHIND THEM ────────────────
--
-- A number with no reasoning is how data loss gets justified later, so here is
-- the reasoning. The rule is: the window is longer than the longest read any
-- live consumer performs, with headroom, and never shorter.
--
--   analytics_events   400 days, floor 365.
--                      The longest bounded read in the code is 365 days:
--                      maxCountInSingleDay, countByTypeAndHour and
--                      countByHourAllTypes all default sinceDays = 365. The
--                      Insights page offers 7, 30 and 90. So 365 is the number
--                      below which a live chart starts showing a smaller answer,
--                      and it is the floor the CHECK below enforces. 400 is 365
--                      plus five weeks, which covers a machine that was switched
--                      off for a month and a prune that runs late, so the
--                      365-day reads are never clipped at the edge.
--
--   chat_messages      365 days, floor 30.
--                      Chat has no windowed consumer: its reader is the
--                      transcript itself, which is unbounded by construction, so
--                      no window can be derived from the code and the number has
--                      to be argued instead. A year of no activity on a
--                      conversation is the argument. It is also user-authored
--                      content, which is the one class where keeping less is the
--                      safer default rather than the riskier one, and a year is
--                      already generous against that. The floor is 30 because
--                      nothing shorter than a month can plausibly mean "I no
--                      longer need this", and the floor exists to catch a
--                      mistyped 3 that would otherwise be executed literally.
--
-- The floors are CHECK constraints, not documentation. An operator can widen a
-- window freely; the database refuses to narrow one past the point where a
-- consumer would notice.
--
-- ── NOTHING IS DELETED UNTIL SOMEBODY ASKS ─────────────────────
--
-- `enabled` is seeded 0 for BOTH tables, on every install, fresh and existing
-- alike, and the seed is INSERT OR IGNORE so re-running the migration never
-- overwrites a choice already made. An install with five weeks of history that
-- takes this upgrade loses exactly nothing: the migration adds two bookkeeping
-- tables and changes no row of either readings table. The prune runs only when
-- an operator has turned the policy on AND has passed --apply on the command
-- line. There is no HTTP route and no scheduler wiring, deliberately: the one
-- thing in this system that destroys data is not reachable by a click or a
-- timer.
--
-- ── THE PRUNE PATH ─────────────────────────────────────────────
--
--   npx tsx scripts/tooling/retention-prune.ts             status and dry run
--   npx tsx scripts/tooling/retention-prune.ts --enable analytics_events
--   npx tsx scripts/tooling/retention-prune.ts --apply     the only deleting form
--
-- The logic is src/lib/retention/, the SQL is retention-repository.ts, and every
-- --apply invocation writes a row per table into `retention_prune_runs` below.
--
-- ORDERING, WHICH IS THE PART THAT MATTERS. Migration 031 records an agent's
-- level and achievements so recorded growth outlives the events it was derived
-- from. The prune therefore captures progression FIRST, then checks that the
-- newest capture is at or after the cutoff it is about to delete behind, and
-- REFUSES rather than proceeds if it is not. A row this database cannot prove
-- was captured does not get deleted.
--
-- ── THE SPLIT, WRITTEN NOW SO IT CAN BE EXECUTED LATER ─────────
--
-- RUL-ARCH-008 asks for the physical split to be designed now. It is NOT shipped
-- as an inert .sql file, because docs/MIGRATION.md is explicit that a migration
-- nothing calls does nothing on any install forever, and a numbered file sitting
-- unwired is a trap rather than a plan. The design lives here and in ADR-0009:
--
--   Trigger    analytics_events past 1,000,000 rows or chat_messages past
--              250,000 rows, whichever comes first, WITH retention already
--              enabled. Retention is the cheap answer and has to be tried first;
--              the split is for an install that is still growing with the
--              window applied. `retention-prune.ts` prints the live row count
--              against these thresholds, so the trigger is observable and does
--              not depend on anybody remembering to look.
--   Move       both tables, their indexes and this policy pair into
--              patterstage-readings.db, attached with ATTACH DATABASE and
--              addressed as readings.analytics_events.
--   Seam       already in place: every statement against either table is inside
--              a repository file, so the change is the connection module and the
--              two repositories, not the callers.
--   Cost       cross-database joins and one more file to back up. Nothing joins
--              these tables to the records core today, which is why the split is
--              cheap enough to defer and cheap enough to keep designed.
--
-- Idempotent: safe to run repeatedly on an existing database.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS retention_policy (
  -- Only the two declared readings tables. A third table joining the prune is a
  -- decision, so it costs a migration to widen this list rather than an INSERT.
  table_name  TEXT PRIMARY KEY
              CHECK (table_name IN ('analytics_events', 'chat_messages')),
  owner       TEXT    NOT NULL,
  consumer    TEXT    NOT NULL,
  enabled     INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  retain_days INTEGER NOT NULL,
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  -- The floors, enforced. Widening a window is always allowed; narrowing one
  -- past the longest live consumer read is refused by the database.
  CHECK (
    (table_name = 'analytics_events' AND retain_days >= 365)
    OR (table_name = 'chat_messages' AND retain_days >= 30)
  )
);

-- OR IGNORE: an install that already has a policy row keeps the operator's own
-- enabled flag and window. A re-run must never re-arm or re-disarm a prune.
INSERT OR IGNORE INTO retention_policy (table_name, owner, consumer, enabled, retain_days) VALUES
  ('analytics_events',
   'src/lib/analytics/analytics-repository.ts',
   'GET /api/analytics (Insights) and src/lib/stats/stats-repository.ts (achievements, streak)',
   0, 400),
  ('chat_messages',
   'src/lib/chat-repository.ts',
   'the Chat surface (whole-conversation transcript) and run reconciliation',
   0, 365);

-- ── The deletion record ────────────────────────────────────────
-- A prune that leaves no trace is indistinguishable from a disk that emptied
-- itself. One row per table per --apply invocation, including the invocations
-- that deleted nothing and the ones that refused, because "it ran and declined"
-- is exactly what an operator needs when the disk is still full.
--
-- Dry runs are NOT recorded. They print and change nothing, so they are not
-- events in this database's history, and excluding them keeps this table's
-- growth tied to actual deletions rather than to how often somebody looked.
CREATE TABLE IF NOT EXISTS retention_prune_runs (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  ran_at                TEXT    NOT NULL DEFAULT (datetime('now')),
  table_name            TEXT    NOT NULL,
  -- pruned | refused | disabled | dry-run
  outcome               TEXT    NOT NULL,
  retain_days           INTEGER NOT NULL,
  -- The exact boundary used, so a later reader can check what the window meant
  -- on the day it ran rather than recomputing it from a window that may since
  -- have been widened.
  cutoff                TEXT    NOT NULL,
  rows_matched          INTEGER NOT NULL,
  rows_deleted          INTEGER NOT NULL,
  -- The progression capture the prune verified against. This is the evidence
  -- for the ordering claim: it says the record was written before the delete.
  progression_watermark TEXT,
  detail                TEXT    NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_retention_prune_runs_ran
  ON retention_prune_runs (ran_at DESC);

-- Append-only, enforced, for the same reason migration 031's record is: an audit
-- of deletions that can itself be quietly edited or deleted is not an audit.
-- The growth this costs is one row per table per applied prune, so a daily prune
-- of both tables writes about 730 rows a year, which is not a table that needs a
-- retention policy of its own.
CREATE TRIGGER IF NOT EXISTS retention_prune_runs_no_update
BEFORE UPDATE ON retention_prune_runs
BEGIN
  SELECT RAISE(ABORT, 'retention_prune_runs is append-only: a deletion record is never edited');
END;

CREATE TRIGGER IF NOT EXISTS retention_prune_runs_no_delete
BEFORE DELETE ON retention_prune_runs
BEGIN
  SELECT RAISE(ABORT, 'retention_prune_runs is append-only: a deletion record is never deleted');
END;
