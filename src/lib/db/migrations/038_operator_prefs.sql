-- ═══════════════════════════════════════════════════════════════
-- 038_operator_prefs.sql — what the operator has set about the console itself
--
-- WHY. The rail's collapsed state, the dispatch strip's open state, which
-- quests are done or skipped, whether the first-run guide is hidden, the last
-- help page read: small facts about the console that used to live in
-- localStorage or nowhere, so they did not survive a browser, a device or a
-- reinstall, and a quest could be un-completed by retention deleting the
-- event that proved it (T-0097; B17 latches quest completion here).
--
-- WHY ONE TABLE OF JSON. Six keys today, a dozen at most; each is a small
-- JSON value validated against a per-key schema in
-- src/lib/operator-prefs-repository.ts before it is written. A column per
-- preference would mean a migration per preference. The allow-list is the
-- schema; this table is the store.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS operator_prefs (
  key        TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
