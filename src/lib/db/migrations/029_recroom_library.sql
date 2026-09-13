-- ═══════════════════════════════════════════════════════════════
-- 029_recroom_library.sql — Story Weaver's reusable character + theme library
--
-- The Characters and Themes pages, and the character/theme import on the story
-- create page, have shipped since V3 and have never worked: they POST
-- `action: "characters"` / `action: "themes"` to /api/stories, which has only
-- ever handled create|list|load|update|delete|continue|extend. Every request
-- 400'd and the page swallowed the error, so the library always looked empty.
--
-- The UI, the types (CharacterSheet / StoryTheme) and the import flow were all
-- already built. This is the storage they were written against.
--
-- List columns (personality, tags, genre, mood) are JSON arrays of strings, the
-- same convention the stories table uses for chapters/config.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS story_characters (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  role             TEXT NOT NULL DEFAULT '',
  description      TEXT NOT NULL DEFAULT '',
  personality      TEXT NOT NULL DEFAULT '[]',
  backstory        TEXT NOT NULL DEFAULT '',
  appearance       TEXT NOT NULL DEFAULT '',
  speech_patterns  TEXT NOT NULL DEFAULT '',
  relationships    TEXT NOT NULL DEFAULT '',
  tags             TEXT NOT NULL DEFAULT '[]',
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at       TEXT
);

CREATE INDEX IF NOT EXISTS idx_story_characters_live
  ON story_characters (deleted_at, name);

CREATE TABLE IF NOT EXISTS story_themes (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  premise     TEXT NOT NULL DEFAULT '',
  genre       TEXT NOT NULL DEFAULT '[]',
  era         TEXT NOT NULL DEFAULT '',
  setting     TEXT NOT NULL DEFAULT '',
  mood        TEXT NOT NULL DEFAULT '[]',
  notes       TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at  TEXT
);

CREATE INDEX IF NOT EXISTS idx_story_themes_live
  ON story_themes (deleted_at, name);
