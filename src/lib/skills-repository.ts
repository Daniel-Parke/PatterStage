// ═══════════════════════════════════════════════════════════════
// skills-repository.ts — Global skills catalog in SQLite
// ═══════════════════════════════════════════════════════════════

import { db, now } from "./db";

export type SkillSource = "bundled" | "custom" | "hub";

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
  const rows = db()
    .prepare(`SELECT ${SELECT_COLS} FROM skills ORDER BY skill_key COLLATE NOCASE`)
    .all() as DbRow[];
  return rows.map(rowToSkill);
}

export function getSkill(skillKey: string): SkillRow | null {
  const row = db()
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
  db()
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

export function deleteSkill(skillKey: string): boolean {
  const result = db().prepare("DELETE FROM skills WHERE skill_key = ?").run(skillKey);
  return result.changes > 0;
}

export function setSkillSyncStatus(
  skillKey: string,
  syncedAt: string | null,
  syncError: string | null,
): void {
  db()
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
