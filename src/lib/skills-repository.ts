// ═══════════════════════════════════════════════════════════════
// skills-repository.ts — Global skills catalog in SQLite
// ═══════════════════════════════════════════════════════════════

import { getDb, now } from "./db";

type SkillSource = "bundled" | "custom" | "hub";

export interface SkillRow {
  skillKey: string;
  displayName: string;
  description: string;
  category: string;
  content: string;
  source: SkillSource;
  syncedAt: string | null;
  syncError: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DbRow {
  skill_key: string;
  display_name: string;
  description: string;
  category: string;
  content: string;
  source: string;
  synced_at: string | null;
  sync_error: string | null;
  created_at: string;
  updated_at: string;
}

const SELECT_COLS = `
  skill_key, display_name, description, category, content, source,
  synced_at, sync_error, created_at, updated_at
`;

// The same columns MINUS `content`, with the body's length computed in SQLite
// instead. `content` is the whole SKILL.md body: across a real catalog that is
// megabytes of text, and three of the five `listSkills()` callers never read a
// single character of it (they want the keys, the count, or the size). Reading
// it anyway cost 5.5 ms per call at 178 skills and grows linearly with the
// catalog, so the metadata-only shape below exists for those callers.
//
// `LENGTH(content)` counts CHARACTERS, where the old `row.content.length`
// counted UTF-16 code units. The two differ only for astral-plane characters
// (emoji), and only in `contentLength`, which is a fallback used to show a
// skill's size when its disk file is missing. Nothing branches on it.
const SELECT_META_COLS = `
  skill_key, display_name, description, category, LENGTH(content) AS content_length,
  source, synced_at, sync_error, created_at, updated_at
`;

function rowToSkill(row: DbRow): SkillRow {
  return {
    skillKey: row.skill_key,
    displayName: row.display_name,
    description: row.description,
    category: row.category,
    content: row.content,
    source: row.source as SkillSource,
    syncedAt: row.synced_at,
    syncError: row.sync_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listSkills(): SkillRow[] {
  const rows = getDb()
    .prepare(`SELECT ${SELECT_COLS} FROM skills ORDER BY skill_key COLLATE NOCASE`)
    .all() as DbRow[];
  return rows.map(rowToSkill);
}

/** A catalog row with the body's LENGTH in place of the body itself. */
export interface SkillCatalogEntry extends Omit<SkillRow, "content"> {
  /** Character length of the stored SKILL.md body. */
  contentLength: number;
}

interface DbMetaRow extends Omit<DbRow, "content"> {
  content_length: number;
}

/**
 * Every skill's metadata, in the same order as `listSkills()`, without the
 * SKILL.md bodies. Use this whenever the body is not going to be read.
 */
export function listSkillCatalog(): SkillCatalogEntry[] {
  const rows = getDb()
    .prepare(`SELECT ${SELECT_META_COLS} FROM skills ORDER BY skill_key COLLATE NOCASE`)
    .all() as DbMetaRow[];
  return rows.map((row) => ({
    skillKey: row.skill_key,
    displayName: row.display_name,
    description: row.description,
    category: row.category,
    contentLength: row.content_length,
    source: row.source as SkillSource,
    syncedAt: row.synced_at,
    syncError: row.sync_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/** Just the catalog keys, in `listSkills()` order. */
export function listSkillKeys(): string[] {
  const rows = getDb()
    .prepare("SELECT skill_key FROM skills ORDER BY skill_key COLLATE NOCASE")
    .all() as Array<{ skill_key: string }>;
  return rows.map((r) => r.skill_key);
}

/** How many skills the catalog holds. */
export function countSkills(): number {
  const row = getDb().prepare("SELECT COUNT(*) AS n FROM skills").get() as
    | { n: number }
    | undefined;
  return row?.n ?? 0;
}

export function getSkill(skillKey: string): SkillRow | null {
  const row = getDb()
    .prepare(`SELECT ${SELECT_COLS} FROM skills WHERE skill_key = ?`)
    .get(skillKey) as DbRow | undefined;
  return row ? rowToSkill(row) : null;
}

export interface UpsertSkillInput {
  skillKey: string;
  displayName?: string;
  description?: string;
  category?: string;
  content: string;
  source?: SkillSource;
}

export function upsertSkill(input: UpsertSkillInput): SkillRow {
  const ts = now();
  const existing = getSkill(input.skillKey);
  getDb()
    .prepare(
      `INSERT INTO skills (
        skill_key, display_name, description, category, content, source,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(skill_key) DO UPDATE SET
        display_name = excluded.display_name,
        description = excluded.description,
        category = excluded.category,
        content = excluded.content,
        source = COALESCE(excluded.source, skills.source),
        updated_at = excluded.updated_at`,
    )
    .run(
      input.skillKey,
      input.displayName ?? existing?.displayName ?? input.skillKey,
      input.description ?? existing?.description ?? "",
      input.category ?? existing?.category ?? "",
      input.content,
      input.source ?? existing?.source ?? "custom",
      existing?.createdAt ?? ts,
      ts,
    );
  return getSkill(input.skillKey)!;
}

export function setSkillSyncStatus(
  skillKey: string,
  syncedAt: string | null,
  syncError: string | null,
): void {
  getDb()
    .prepare(
      "UPDATE skills SET synced_at = ?, sync_error = ?, updated_at = ? WHERE skill_key = ?",
    )
    .run(syncedAt, syncError, now(), skillKey);
}

/** Match the SKILL.md frontmatter block (--- on its own line, body, --- on its own line). */
const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---/;

/**
 * Strip the YAML frontmatter block from a SKILL.md-style document,
 * returning the body content. If no frontmatter is present, the
 * content is returned unchanged. Used by routes that render the
 * markdown body separately from the parsed metadata.
 *
 * Behaviour matches the previous inline implementation byte-for-byte:
 * the post-strip body is trimmed (so leading blank lines after the
 * `---` fence are removed), but a content that has no frontmatter
 * is returned verbatim.
 */
export function stripSkillFrontmatter(content: string): string {
  const match = content.match(FRONTMATTER_PATTERN);
  return match ? content.slice(match[0].length).trim() : content;
}

/** Parse SKILL.md frontmatter for name/description. */
export function parseSkillFrontmatter(content: string): {
  name: string;
  description: string;
  category: string;
} {
  const match = content.match(FRONTMATTER_PATTERN);
  let name = "";
  let description = "";
  let category = "";
  if (match) {
    const block = match[1];
    const nameM = block.match(/^name:\s*(.+)$/m);
    const descM = block.match(/^description:\s*(.+)$/m);
    const tagsM = block.match(/tags:\s*\[([^\]]*)\]/);
    if (nameM) name = nameM[1].trim().replace(/^["']|["']$/g, "");
    if (descM) description = descM[1].trim().replace(/^["']|["']$/g, "");
    if (tagsM) {
      const first = tagsM[1].split(",")[0]?.trim().replace(/^["']|["']$/g, "");
      if (first) category = first;
    }
  }
  return { name, description, category };
}

/** Derive category from row data or skill key path — single source of truth. */
export function deriveCategory(row: { category: string; skillKey: string }): string {
  return row.category || row.skillKey.split("/")[0] || "uncategorized";
}
