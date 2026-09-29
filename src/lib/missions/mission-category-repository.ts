// ═══════════════════════════════════════════════════════════════
// mission-category-repository.ts — User-managed mission categories
// ═══════════════════════════════════════════════════════════════

import { copyFileSync, existsSync, lstatSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "fs";

import { getDb, inTransaction, now, uuid } from "../db";
import { PATHS } from "../host/paths";
import { listCatalogTemplates } from "../templates/catalog-template-repository";
import { invalidateTemplatesCache } from "../templates/template-list-cache";

export interface MissionCategory {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  seedKey: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CategoryRow {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  seed_key: string | null;
  created_at: string;
  updated_at: string;
}

const ALLOWED_COLORS = new Set([
  "cyan",
  "purple",
  "pink",
  "green",
  "orange",
  "blue",
  "red",
]);

function rowToCategory(row: CategoryRow): MissionCategory {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    sortOrder: row.sort_order,
    seedKey: row.seed_key,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function slugifyCategoryName(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "category";
}

function explicitTemplateCategory(raw: Record<string, unknown>): string | null | undefined {
  if (raw.categoryId === null) return null;
  if (typeof raw.categoryId === "string") return raw.categoryId;
  if (raw.category_id === null) return null;
  if (typeof raw.category_id === "string") return raw.category_id;
  return undefined;
}

function templateBelongsToCategory(raw: Record<string, unknown>, categoryId: string): boolean {
  const explicit = explicitTemplateCategory(raw);
  if (explicit !== undefined) return explicit === categoryId;
  return typeof raw.category === "string" && slugifyCategoryName(raw.category) === categoryId;
}

function uniqueCategoryId(baseSlug: string): string {
  let candidate = baseSlug;
  let n = 2;
  while (getCategory(candidate)) {
    candidate = `${baseSlug}-${n}`;
    n += 1;
  }
  return candidate;
}

function hasMissionCategoriesTable(): boolean {
  try {
    const row = getDb()
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'mission_categories'",
      )
      .get() as { name: string } | undefined;
    return Boolean(row);
  } catch {
    return false;
  }
}

function listCategories(): MissionCategory[] {
  if (!hasMissionCategoriesTable()) {
    throw new Error(
      "mission_categories table is missing — run database migrations (restart PatterStage or npm run db:migrate)",
    );
  }
  const rows = getDb()
    .prepare(
      "SELECT * FROM mission_categories ORDER BY sort_order ASC, lower(name) ASC",
    )
    .all() as CategoryRow[];
  return rows.map(rowToCategory);
}

export function getCategory(id: string): MissionCategory | null {
  const row = getDb()
    .prepare("SELECT * FROM mission_categories WHERE id = ?")
    .get(id) as CategoryRow | undefined;
  return row ? rowToCategory(row) : null;
}

function getCategoryByName(name: string): MissionCategory | null {
  const row = getDb()
    .prepare("SELECT * FROM mission_categories WHERE lower(name) = lower(?)")
    .get(name.trim()) as CategoryRow | undefined;
  return row ? rowToCategory(row) : null;
}

export function countMissionsInCategory(categoryId: string): number {
  const row = getDb()
    .prepare(
      "SELECT COUNT(*) AS c FROM missions WHERE deleted_at IS NULL AND category_id = ?",
    )
    .get(categoryId) as { c: number };
  return row.c ?? 0;
}

export function countTemplatesInCategory(categoryId: string): number {
  let count = 0;

  // Built-in catalog templates live in the DB. /api/templates resolves each to
  // `categoryId ?? "general"` — count them the SAME way so the categories API
  // agrees with the dashboard breakdown. (Previously this only scanned disk
  // custom templates, so every built-in template was invisible to the count —
  // the "general: 1, everything else: 0" mismatch the QA flagged.)
  for (const t of listCatalogTemplates()) {
    const cid = t.categoryId ?? "general";
    if (cid === categoryId) count += 1;
  }

  // Custom templates are stored as JSON on disk.
  const dir = PATHS.templates;
  if (existsSync(dir)) {
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".json")) continue;
      try {
        const raw = JSON.parse(
          readFileSync(dir + "/" + file, "utf-8"),
        ) as Record<string, unknown>;
        if (templateBelongsToCategory(raw, categoryId)) count += 1;
      } catch {
        // skip invalid files
      }
    }
  }
  return count;
}

export function createCategory(data: {
  name: string;
  color?: string;
}): MissionCategory {
  const name = data.name.trim();
  if (!name) {
    throw new Error("Category name is required");
  }
  const existing = getCategoryByName(name);
  if (existing) {
    throw new Error("Category name already exists");
  }
  const color =
    data.color && ALLOWED_COLORS.has(data.color) ? data.color : "cyan";
  const id = uniqueCategoryId(slugifyCategoryName(name));
  const ts = now();
  const maxOrder = getDb()
    .prepare("SELECT COALESCE(MAX(sort_order), -1) AS m FROM mission_categories")
    .get() as { m: number };
  const sortOrder = (maxOrder.m ?? -1) + 1;

  getDb()
    .prepare(
      `INSERT INTO mission_categories (id, name, color, sort_order, seed_key, created_at, updated_at)
       VALUES (?, ?, ?, ?, NULL, ?, ?)`,
    )
    .run(id, name, color, sortOrder, ts, ts);

  return getCategory(id)!;
}

export function updateCategory(
  id: string,
  updates: { name?: string; color?: string; sortOrder?: number },
): MissionCategory | null {
  const existing = getCategory(id);
  if (!existing) return null;

  const sets: string[] = ["updated_at = ?"];
  const vals: unknown[] = [now()];

  if (updates.name !== undefined) {
    const name = updates.name.trim();
    if (!name) throw new Error("Category name is required");
    const dup = getCategoryByName(name);
    if (dup && dup.id !== id) {
      throw new Error("Category name already exists");
    }
    sets.push("name = ?");
    vals.push(name);
  }
  if (updates.color !== undefined) {
    const color = ALLOWED_COLORS.has(updates.color) ? updates.color : existing.color;
    sets.push("color = ?");
    vals.push(color);
  }
  if (updates.sortOrder !== undefined) {
    sets.push("sort_order = ?");
    vals.push(updates.sortOrder);
  }

  vals.push(id);
  getDb()
    .prepare(`UPDATE mission_categories SET ${sets.join(", ")} WHERE id = ?`)
    .run(...vals);

  return getCategory(id);
}

function reassignMissionsCategory(
  fromId: string,
  toId: string | null,
): void {
  getDb()
    .prepare(
      "UPDATE missions SET category_id = ?, updated_at = ? WHERE category_id = ?",
    )
    .run(toId, now(), fromId);
}

interface TemplateMove {
  path: string;
  stagedPath: string;
  backupPath: string;
  contents: string;
  replaced: boolean;
}

function planTemplateMoves(fromId: string, toId: string | null): TemplateMove[] {
  const dir = PATHS.templates;
  if (!existsSync(dir)) return [];
  const moves: TemplateMove[] = [];
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".json")) continue;
    const path = dir + "/" + file;
    if (!lstatSync(path).isFile()) continue;
    // A failed read may hide a reference to the source category. Abort the
    // move instead of deleting that category with an orphaned template.
    const contents = readFileSync(path, "utf-8");
    let raw: Record<string, unknown>;
    try {
      const value: unknown = JSON.parse(contents);
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      raw = value as Record<string, unknown>;
    } catch {
      // A readable but malformed file has no usable category reference.
      continue;
    }
    if (!templateBelongsToCategory(raw, fromId)) continue;
    raw.categoryId = toId;
    delete raw.category_id;
    delete raw.category;
    const suffix = `.category-${uuid()}`;
    moves.push({
      path,
      stagedPath: `${path}${suffix}.tmp`,
      backupPath: `${path}${suffix}.bak`,
      contents: JSON.stringify(raw, null, 2),
      replaced: false,
    });
  }
  return moves;
}

export function deleteCategory(
  id: string,
  reassignToId?: string | null,
): boolean {
  const existing = getCategory(id);
  if (!existing) return false;
  if (reassignToId === id) {
    throw new Error("A category cannot be reassigned to itself");
  }
  const missionCount = countMissionsInCategory(id);
  const templateCount = countTemplatesInCategory(id);
  if ((missionCount > 0 || templateCount > 0) && reassignToId === undefined) {
    throw new Error("reassignToId required when category is in use");
  }
  if (reassignToId !== undefined && reassignToId !== null && !getCategory(reassignToId)) {
    throw new Error("Reassign target category not found");
  }

  const moves: TemplateMove[] = [];
  let restorationFailed = false;
  try {
    inTransaction(() => {
      moves.push(...planTemplateMoves(id, reassignToId ?? null));
      if (moves.length > 0 && reassignToId === undefined) {
        throw new Error("reassignToId required when category is in use");
      }
      for (const move of moves) {
        writeFileSync(move.stagedPath, move.contents, { encoding: "utf-8", flag: "wx", mode: 0o600 });
        copyFileSync(move.path, move.backupPath);
      }
      reassignMissionsCategory(id, reassignToId ?? null);
      getDb()
        .prepare("UPDATE catalog_templates SET category_id = ?, updated_at = ? WHERE category_id = ?")
        .run(reassignToId ?? null, now(), id);
      for (const move of moves) {
        renameSync(move.stagedPath, move.path);
        move.replaced = true;
      }
      getDb().prepare("DELETE FROM mission_categories WHERE id = ?").run(id);
    }, "immediate");
  } catch (error) {
    let recoveryError: unknown;
    for (const move of moves) {
      if (!move.replaced) continue;
      try {
        copyFileSync(move.backupPath, move.path);
      } catch (restoreError) {
        recoveryError = restoreError;
      }
    }
    if (recoveryError) {
      restorationFailed = true;
      throw new Error(`Category move failed and a template could not be restored; backup files remain in ${PATHS.templates}`, {
        cause: recoveryError,
      });
    }
    throw error;
  } finally {
    for (const move of moves) {
      try { rmSync(move.stagedPath, { force: true }); } catch { /* preserve the original failure */ }
      if (!restorationFailed) {
        try { rmSync(move.backupPath, { force: true }); } catch { /* preserve the original failure */ }
      }
    }
  }
  invalidateTemplatesCache();
  return true;
}

const DEFAULT_CATEGORY_SEED_SQL = `
INSERT OR IGNORE INTO mission_categories (id, name, color, sort_order, seed_key)
VALUES
  ('general', 'General', 'cyan', 0, 'ch.cat.general'),
  ('engineering', 'Engineering', 'purple', 1, 'ch.cat.engineering'),
  ('research', 'Research & Report', 'blue', 2, 'ch.cat.research'),
  ('quality', 'Quality & Testing', 'pink', 3, 'ch.cat.quality'),
  ('operations', 'Operations', 'orange', 4, 'ch.cat.operations'),
  ('data', 'Data & Analytics', 'green', 5, 'ch.cat.data'),
  ('creative', 'Creative & Content', 'purple', 6, 'ch.cat.creative'),
  ('maintenance', 'Maintenance', 'orange', 7, 'ch.cat.maintenance');
`;

/** Seed system categories when the table exists but has no rows. */
export function ensureDefaultCategories(): void {
  if (!hasMissionCategoriesTable()) return;
  const row = getDb()
    .prepare("SELECT COUNT(*) AS c FROM mission_categories")
    .get() as { c: number };
  if ((row.c ?? 0) > 0) return;
  getDb().exec(DEFAULT_CATEGORY_SEED_SQL);
}

function resolveTemplateCategoryIdWithoutDb(
  category?: string,
  categoryId?: string,
): string | undefined {
  if (categoryId === "general" || categoryId === "engineering") {
    return categoryId;
  }
  if (!category) return undefined;
  const slug = slugifyCategoryName(category);
  if (slug === "general" || category === "General") return "general";
  if (slug === "engineering" || category === "Engineering") return "engineering";
  return undefined;
}

/** Map legacy template category string to system category id. */
export function resolveTemplateCategoryId(
  category?: string,
  categoryId?: string,
): string | undefined {
  if (!hasMissionCategoriesTable()) {
    return resolveTemplateCategoryIdWithoutDb(category, categoryId);
  }
  if (categoryId && getCategory(categoryId)) {
    return categoryId;
  }
  if (!category) return undefined;
  const slug = slugifyCategoryName(category);
  if (getCategory(slug)) return slug;
  return resolveTemplateCategoryIdWithoutDb(category, categoryId);
}

/** List categories, seeding defaults when the table is empty. */
export function listCategoriesWithDefaults(): MissionCategory[] {
  ensureDefaultCategories();
  return listCategories();
}
