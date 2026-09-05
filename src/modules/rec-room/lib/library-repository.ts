// ═══════════════════════════════════════════════════════════════
// story-weaver/library-repository.ts — the reusable character + theme library
//
// Backs the Characters and Themes pages and the import pickers on the story
// create page. Soft-deleted (deleted_at) to match `stories`, so removing a
// character a story was built from does not rewrite history.
// ═══════════════════════════════════════════════════════════════

import { randomUUID } from "crypto";

import { getDb, now } from "@/lib/db";
import { parseStringArrayOrEmpty } from "@/lib/db/parse-json";
import type { CharacterSheet, StoryTheme } from "@/modules/rec-room/types";

// ── Characters ─────────────────────────────────────────────────

interface CharacterRow {
  id: string;
  name: string;
  role: string;
  description: string;
  personality: string;
  backstory: string;
  appearance: string;
  speech_patterns: string;
  relationships: string;
  tags: string;
  created_at: string;
  updated_at: string;
}

function rowToCharacter(row: CharacterRow): CharacterSheet {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    description: row.description,
    personality: parseStringArrayOrEmpty(row.personality),
    backstory: row.backstory,
    appearance: row.appearance,
    speechPatterns: row.speech_patterns,
    relationships: row.relationships,
    tags: parseStringArrayOrEmpty(row.tags),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Fields a caller may set. `id`, `createdAt` and `updatedAt` are ours. */
export type CharacterInput = Omit<CharacterSheet, "id" | "createdAt" | "updatedAt">;

export function listCharacters(): CharacterSheet[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM story_characters WHERE deleted_at IS NULL ORDER BY name COLLATE NOCASE ASC`,
    )
    .all() as CharacterRow[];
  return rows.map(rowToCharacter);
}

export function getCharacter(id: string): CharacterSheet | null {
  const row = getDb()
    .prepare(`SELECT * FROM story_characters WHERE id = ? AND deleted_at IS NULL`)
    .get(id) as CharacterRow | undefined;
  return row ? rowToCharacter(row) : null;
}

export function createCharacter(input: CharacterInput): CharacterSheet {
  const id = randomUUID();
  const ts = now();
  getDb()
    .prepare(
      `INSERT INTO story_characters
         (id, name, role, description, personality, backstory, appearance,
          speech_patterns, relationships, tags, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      input.name,
      input.role,
      input.description,
      JSON.stringify(input.personality ?? []),
      input.backstory,
      input.appearance,
      input.speechPatterns,
      input.relationships,
      JSON.stringify(input.tags ?? []),
      ts,
      ts,
    );
  return getCharacter(id)!;
}

export function updateCharacter(id: string, input: CharacterInput): CharacterSheet | null {
  const existing = getCharacter(id);
  if (!existing) return null;
  getDb()
    .prepare(
      `UPDATE story_characters
          SET name = ?, role = ?, description = ?, personality = ?, backstory = ?,
              appearance = ?, speech_patterns = ?, relationships = ?, tags = ?,
              updated_at = ?
        WHERE id = ? AND deleted_at IS NULL`,
    )
    .run(
      input.name,
      input.role,
      input.description,
      JSON.stringify(input.personality ?? []),
      input.backstory,
      input.appearance,
      input.speechPatterns,
      input.relationships,
      JSON.stringify(input.tags ?? []),
      now(),
      id,
    );
  return getCharacter(id);
}

export function deleteCharacter(id: string): boolean {
  const res = getDb()
    .prepare(`UPDATE story_characters SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL`)
    .run(now(), id);
  return res.changes > 0;
}

// ── Themes ─────────────────────────────────────────────────────

interface ThemeRow {
  id: string;
  name: string;
  premise: string;
  genre: string;
  era: string;
  setting: string;
  mood: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

function rowToTheme(row: ThemeRow): StoryTheme {
  return {
    id: row.id,
    name: row.name,
    premise: row.premise,
    genre: parseStringArrayOrEmpty(row.genre),
    era: row.era,
    setting: row.setting,
    mood: parseStringArrayOrEmpty(row.mood),
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type ThemeInput = Omit<StoryTheme, "id" | "createdAt" | "updatedAt">;

export function listThemes(): StoryTheme[] {
  const rows = getDb()
    .prepare(`SELECT * FROM story_themes WHERE deleted_at IS NULL ORDER BY name COLLATE NOCASE ASC`)
    .all() as ThemeRow[];
  return rows.map(rowToTheme);
}

function getTheme(id: string): StoryTheme | null {
  const row = getDb()
    .prepare(`SELECT * FROM story_themes WHERE id = ? AND deleted_at IS NULL`)
    .get(id) as ThemeRow | undefined;
  return row ? rowToTheme(row) : null;
}

export function createTheme(input: ThemeInput): StoryTheme {
  const id = randomUUID();
  const ts = now();
  getDb()
    .prepare(
      `INSERT INTO story_themes
         (id, name, premise, genre, era, setting, mood, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      input.name,
      input.premise,
      JSON.stringify(input.genre ?? []),
      input.era,
      input.setting,
      JSON.stringify(input.mood ?? []),
      input.notes,
      ts,
      ts,
    );
  return getTheme(id)!;
}

export function updateTheme(id: string, input: ThemeInput): StoryTheme | null {
  const existing = getTheme(id);
  if (!existing) return null;
  getDb()
    .prepare(
      `UPDATE story_themes
          SET name = ?, premise = ?, genre = ?, era = ?, setting = ?, mood = ?,
              notes = ?, updated_at = ?
        WHERE id = ? AND deleted_at IS NULL`,
    )
    .run(
      input.name,
      input.premise,
      JSON.stringify(input.genre ?? []),
      input.era,
      input.setting,
      JSON.stringify(input.mood ?? []),
      input.notes,
      now(),
      id,
    );
  return getTheme(id);
}

export function deleteTheme(id: string): boolean {
  const res = getDb()
    .prepare(`UPDATE story_themes SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL`)
    .run(now(), id);
  return res.changes > 0;
}
