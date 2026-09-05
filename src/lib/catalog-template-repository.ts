// ═══════════════════════════════════════════════════════════════
// catalog-template-repository.ts — Seeded mission templates in SQLite
// ═══════════════════════════════════════════════════════════════

import { getDb, now } from "./db";
import { parseStringArrayOrEmpty } from "./db/parse-json";

export interface CatalogTemplateRow {
  id: string;
  seedKey: string | null;
  name: string;
  icon: string;
  color: string;
  categoryId: string | null;
  profileSlug: string;
  description: string;
  instruction: string;
  context: string;
  goals: string[];
  outputFormat: string;
  constraints: string;
  suggestedSkills: string[];
  suggestedToolsets: string[];
  localDirs: string[];
  references: string[];
  missionTimeMinutes: number | null;
  timeoutMinutes: number;
}

interface DbRow {
  id: string;
  seed_key: string | null;
  name: string;
  icon: string;
  color: string;
  category_id: string | null;
  profile_slug: string;
  description: string;
  instruction: string;
  context: string;
  goals: string;
  output_format: string;
  constraints: string;
  suggested_skills: string;
  suggested_toolsets: string;
  local_dirs: string;
  references_json: string;
  mission_time_minutes: number | null;
  timeout_minutes: number;
}

function rowToTemplate(row: DbRow): CatalogTemplateRow {
  return {
    id: row.id,
    seedKey: row.seed_key,
    name: row.name,
    icon: row.icon,
    color: row.color,
    categoryId: row.category_id,
    profileSlug: row.profile_slug,
    description: row.description,
    instruction: row.instruction,
    context: row.context,
    goals: parseStringArrayOrEmpty(row.goals),
    outputFormat: row.output_format,
    constraints: row.constraints,
    suggestedSkills: parseStringArrayOrEmpty(row.suggested_skills),
    suggestedToolsets: parseStringArrayOrEmpty(row.suggested_toolsets ?? "[]"),
    localDirs: parseStringArrayOrEmpty(row.local_dirs),
    references: parseStringArrayOrEmpty(row.references_json),
    missionTimeMinutes: row.mission_time_minutes,
    timeoutMinutes: row.timeout_minutes,
  };
}

export function listCatalogTemplates(): CatalogTemplateRow[] {
  const rows = getDb()
    .prepare("SELECT * FROM catalog_templates ORDER BY name COLLATE NOCASE")
    .all() as DbRow[];
  return rows.map(rowToTemplate);
}

export function getCatalogTemplate(id: string): CatalogTemplateRow | null {
  const row = getDb()
    .prepare("SELECT * FROM catalog_templates WHERE id = ?")
    .get(id) as DbRow | undefined;
  return row ? rowToTemplate(row) : null;
}

export function upsertCatalogTemplate(
  row: CatalogTemplateRow & { seedKey?: string | null },
): CatalogTemplateRow {
  const ts = now();
  getDb()
    .prepare(
      `INSERT INTO catalog_templates (
        id, seed_key, name, icon, color, category_id, profile_slug, description,
        instruction, context, goals, output_format, constraints,
        suggested_skills, suggested_toolsets, local_dirs, references_json,
        mission_time_minutes, timeout_minutes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        seed_key = COALESCE(excluded.seed_key, catalog_templates.seed_key),
        name = excluded.name,
        icon = excluded.icon,
        color = excluded.color,
        category_id = excluded.category_id,
        profile_slug = excluded.profile_slug,
        description = excluded.description,
        instruction = excluded.instruction,
        context = excluded.context,
        goals = excluded.goals,
        output_format = excluded.output_format,
        constraints = excluded.constraints,
        suggested_skills = excluded.suggested_skills,
        suggested_toolsets = excluded.suggested_toolsets,
        local_dirs = excluded.local_dirs,
        references_json = excluded.references_json,
        mission_time_minutes = excluded.mission_time_minutes,
        timeout_minutes = excluded.timeout_minutes,
        updated_at = excluded.updated_at`,
    )
    .run(
      row.id,
      row.seedKey ?? null,
      row.name,
      row.icon,
      row.color,
      row.categoryId,
      row.profileSlug,
      row.description,
      row.instruction,
      row.context,
      JSON.stringify(row.goals),
      row.outputFormat,
      row.constraints,
      JSON.stringify(row.suggestedSkills),
      JSON.stringify(row.suggestedToolsets ?? []),
      JSON.stringify(row.localDirs),
      JSON.stringify(row.references),
      row.missionTimeMinutes,
      row.timeoutMinutes,
      ts,
      ts,
    );
  return getCatalogTemplate(row.id)!;
}
