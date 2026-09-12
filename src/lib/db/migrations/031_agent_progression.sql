-- ═══════════════════════════════════════════════════════════════
-- 031_agent_progression.sql · the per-Body progression record
--
-- WHY THIS TABLE EXISTS. Progression is recomputed from raw history on every
-- read. An agent's level and XP come from `runs`; its achievements come from
-- `analytics_events` plus the live mission, session and schedule counts.
-- Retention (WG-ARCH-008) is about to start deleting rows from
-- `analytics_events` and `chat_messages`, and a recomputation taken after that
-- prune returns SMALLER numbers than one taken before it. An agent that had
-- earned an achievement would quietly un-earn it, and no reader could tell that
-- apart from the agent never having earned it at all.
--
-- WG-ARCH-003 rules that recorded growth survives the deletion of the history it
-- came from. This table is that record. It is numbered ahead of the retention
-- migration on purpose: the capture has to exist before the first prune runs,
-- because a prune cannot be undone.
--
-- APPEND ONLY, ENFORCED BY THE DATABASE. The two triggers at the bottom abort
-- every UPDATE and every DELETE on this table. A correction is a NEW ROW, never
-- an edit. That is what preserves the high-water mark of an agent's growth when
-- a later recomputation reads lower: the older row still says what it said.
--
-- The triggers, not the comment, are the guarantee. A note asking callers not to
-- update a table is a request. RAISE(ABORT) binds every future caller, including
-- one written by somebody who never read this file.
--
-- WHAT A ROW MEANS, column by column, because a record nobody can read is not a
-- record:
--
--   level / level_title / xp   The agent's own progression, per ADR-0004's
--                              per-Body rule. Derived from the six signals in
--                              inputs_json.signals and from nothing else.
--
--   achievements_scope         Names the subject of achievements_json, which is
--                              ADR-0004 decision 4 applied to a stored row.
--                              Today the only value is 'install': achievements
--                              are computed once for the whole install and are
--                              not per-profile, and writing them onto a profile
--                              row without saying so would make the row claim
--                              something the product does not measure. The
--                              column exists so that on the day a per-Body
--                              achievement computation lands, every row written
--                              before it still says honestly what it was.
--
--   achievements_json          The agent-scoped achievements only. Rec Room
--                              creative activity is excluded by ADR-0004
--                              decision 5, which says it never touches the
--                              agent's record. Each entry carries the
--                              MEASUREMENT (id, current, target, unlocked,
--                              tier, points) and not the presentation: name,
--                              icon and colour are content that lives in code
--                              and can be rejoined by id.
--
--   inputs_json                Every value that fed the two computations above:
--                              the per-profile signals, and the measured value
--                              each agent-scoped achievement consumed. Stored in
--                              full, because after the prune those inputs cannot
--                              be recovered from anywhere else on the machine.
--
--   inputs_digest              sha256 over the canonical form of inputs_json.
--                              It is what makes the row auditable. A reader
--                              recomputes it from inputs_json to check the row
--                              is internally consistent, and compares it against
--                              a digest taken from live data to answer the only
--                              question that matters later: would a
--                              recomputation have produced the same answer from
--                              the same inputs?
--
--   schema_version             The database schema at capture.
--
--   computation_version        The formula at capture. Two rows with the same
--                              inputs_digest and different answers are a formula
--                              change; two rows with different digests are a
--                              data change. Without both numbers those two cases
--                              are indistinguishable, and "the level moved"
--                              stops being answerable.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS agent_progression_snapshots (
  -- AUTOINCREMENT, not a bare rowid: it makes "a later row has a higher id" a
  -- schema guarantee rather than a consequence of nothing having been deleted.
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_slug         TEXT    NOT NULL,
  captured_at          TEXT    NOT NULL DEFAULT (datetime('now')),
  level                INTEGER NOT NULL,
  level_title          TEXT    NOT NULL,
  xp                   INTEGER NOT NULL,
  achievements_scope   TEXT    NOT NULL,
  achievements_json    TEXT    NOT NULL,
  inputs_json          TEXT    NOT NULL,
  inputs_digest        TEXT    NOT NULL,
  schema_version       INTEGER NOT NULL,
  computation_version  INTEGER NOT NULL
);

-- The read this table is built for is "the newest row for each profile".
CREATE INDEX IF NOT EXISTS idx_agent_progression_profile_latest
  ON agent_progression_snapshots (profile_slug, id DESC);

-- ── Immutability, enforced ─────────────────────────────────────
-- These are the acceptance criterion, in the only place that can actually hold
-- it. The write path has no UPDATE and no DELETE, and these make that true of
-- every other path as well.

CREATE TRIGGER IF NOT EXISTS agent_progression_snapshots_no_update
BEFORE UPDATE ON agent_progression_snapshots
BEGIN
  SELECT RAISE(ABORT, 'agent_progression_snapshots is append-only: a correction is a new row, never an edit');
END;

CREATE TRIGGER IF NOT EXISTS agent_progression_snapshots_no_delete
BEFORE DELETE ON agent_progression_snapshots
BEGIN
  SELECT RAISE(ABORT, 'agent_progression_snapshots is append-only: recorded growth is never deleted');
END;

