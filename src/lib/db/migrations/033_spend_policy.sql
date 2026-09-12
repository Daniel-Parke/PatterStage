-- ═══════════════════════════════════════════════════════════════
-- 033_spend_policy.sql · the operator's optional provider-spend budget
--
-- LLM provider spend is the only thing in PatterStage that costs money. Agent
-- runs, Composer stages and Deep Research all resolve to tokens somebody pays
-- for, and until now nothing in the product could be told to care.
--
-- WO-0014 asked for a budget. The operator ruled on it on 2026-07-26, and the
-- ruling is the reason this table looks the way it does:
--
--   "We should just have a warning here, AND the ability for the user to have a
--    hard stop, but we should not force this in a way that is awkward for
--    users."
--
-- ── WHERE THE FIGURE LIVES, AND WHY IT MOVED ───────────────────
--
-- The original acceptance put the figure in the venture state file, which the
-- v2 recompile retired. It is a USER SETTING, so it belongs in the database
-- beside the other settings a person changes, not in a governing file a person
-- has to edit by hand. `retention_policy` (migration 032) is the shape this
-- follows: a small declared table, seeded switched off, read through a
-- repository, changed by an explicit act.
--
-- ── ONE ROW, AND WHY THE SHAPE IS ENFORCED HERE ────────────────
--
-- Three of the four columns carry a CHECK, and one CHECK spans two columns.
-- They are not decoration. This is the table that governs money, and the layer
-- where "cannot" is cheaper than "should not":
--
--   id = 1              There is one budget. A second row would mean two
--                       ceilings and no way to say which one bound.
--
--   limit_usd           NULL IS THE SHIPPED STATE AND IT MEANS "no budget".
--                       Not zero, which would mean "spend nothing" and would
--                       stop a fresh install dead. The seed below is NULL on
--                       every install, fresh and upgraded alike, and it is
--                       INSERT OR IGNORE so a re-run cannot overwrite a figure
--                       the operator already chose. An install with no figure
--                       shows its spend and warns about nothing.
--                       > 0 when set, because a ceiling of zero or less is a
--                       typo every time, and executing a typo about money is
--                       the failure this row exists to prevent.
--
--   period              day | week | month, and only those, because those are
--                       the three windows the spend law knows how to compute a
--                       calendar start for. A period this code cannot measure
--                       would silently measure something else.
--
--   hard_stop           0 is the shipped state AND the default when a figure is
--                       first set. A figure alone WARNS. Stopping work is a
--                       second, separate, deliberate act.
--
--   hard_stop = 0 OR limit_usd IS NOT NULL
--                       The one CHECK that spans both columns, and the most
--                       important line in this file. A stop with no ceiling
--                       beside it is not a strict setting, it is an outage: it
--                       would refuse every unattended dispatch forever with no
--                       number anybody could raise. The database refuses to
--                       hold that pair, in either direction, so neither a bad
--                       write nor a future bug can create it. Clearing the
--                       figure and disarming the stop must happen in the same
--                       statement, which is exactly what the repository does.
--
-- ── WHAT THIS MIGRATION DOES NOT DO ────────────────────────────
--
-- It arms nothing, blocks nothing and pre-configures nothing. An install that
-- takes this upgrade behaves on the next tick exactly as it did on the last
-- one. The only observable change is that the console can now show what has
-- been spent, which it could always have computed and never did.
--
-- Idempotent: safe to run repeatedly on an existing database.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS spend_policy (
  id         INTEGER PRIMARY KEY CHECK (id = 1),
  -- NULL = no budget. The shipped state. See the header before changing this.
  limit_usd  REAL CHECK (limit_usd IS NULL OR limit_usd > 0),
  period     TEXT    NOT NULL DEFAULT 'month' CHECK (period IN ('day', 'week', 'month')),
  hard_stop  INTEGER NOT NULL DEFAULT 0 CHECK (hard_stop IN (0, 1)),
  updated_at TEXT    NOT NULL DEFAULT (datetime('now')),
  -- A stop is only ever armed beside a figure it can be measured against.
  CHECK (hard_stop = 0 OR limit_usd IS NOT NULL)
);

-- OR IGNORE: an install that already has a policy row keeps the operator's own
-- figure, period and switch. A re-run must never re-arm, disarm or reset one.
INSERT OR IGNORE INTO spend_policy (id, limit_usd, period, hard_stop)
VALUES (1, NULL, 'month', 0);
