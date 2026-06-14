-- ============================================================
-- 010_game_tables — RPG/Gacha gamification (cosmetic-only, additive).
-- All CREATE ... IF NOT EXISTS so the applier is idempotent.
-- ============================================================

-- Operator account state (single row).
CREATE TABLE IF NOT EXISTS game_player (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  cores         INTEGER NOT NULL DEFAULT 0,
  shards        INTEGER NOT NULL DEFAULT 0,
  pity          INTEGER NOT NULL DEFAULT 0,
  equipped_json TEXT NOT NULL DEFAULT '{}',
  season_id     TEXT,
  last_seen_at  TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO game_player (id) VALUES (1);

-- Sticky unlock ledger (achievements + first-time rewards).
CREATE TABLE IF NOT EXISTS game_unlocks (
  kind        TEXT NOT NULL,
  ref_id      TEXT NOT NULL,
  unlocked_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (kind, ref_id)
);

-- Per-period quest progress + claims.
CREATE TABLE IF NOT EXISTS game_quests (
  period_key   TEXT NOT NULL,
  quest_id     TEXT NOT NULL,
  progress     INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  claimed_at   TEXT,
  PRIMARY KEY (period_key, quest_id)
);

-- Owned cosmetics.
CREATE TABLE IF NOT EXISTS game_inventory (
  item_id     TEXT PRIMARY KEY,
  count       INTEGER NOT NULL DEFAULT 1,
  obtained_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Idempotent award ledger + activity feed. The partial unique index makes
-- one-time awards (achievement:<id>, quest:<periodKey>:<id>) insert-once.
CREATE TABLE IF NOT EXISTS game_events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  type         TEXT NOT NULL,
  ref_id       TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_game_events_award
  ON game_events(type, ref_id) WHERE ref_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_game_events_created ON game_events(created_at DESC);

-- Per-agent character state (level derived from xp; cosmetics equippable).
CREATE TABLE IF NOT EXISTS game_agent (
  slug          TEXT PRIMARY KEY,
  xp            INTEGER NOT NULL DEFAULT 0,
  equipped_json TEXT NOT NULL DEFAULT '{}',
  favorite      INTEGER NOT NULL DEFAULT 0,
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
