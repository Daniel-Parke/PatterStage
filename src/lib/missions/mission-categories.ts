// ═══════════════════════════════════════════════════════════════
// mission-categories.ts — UI helpers for category grouping/filters
// ═══════════════════════════════════════════════════════════════

import type { MissionCategory } from "@/lib/missions/mission-category-repository";

export interface CategoryLike {
  id: string;
  name: string;
  color: string;
  seedKey?: string | null;
}

export const CATEGORY_COLOR_CLASSES: Record<string, string> = {
  cyan: "bg-neon-cyan/20 text-neon-cyan border-neon-cyan/40",
  purple: "bg-neon-purple/20 text-neon-purple border-neon-purple/40",
  pink: "bg-pink-500/20 text-pink-400 border-pink-500/40",
  green: "bg-neon-green/20 text-neon-green border-neon-green/40",
  orange: "bg-neon-orange/20 text-neon-orange border-neon-orange/40",
  blue: "bg-blue-500/20 text-blue-400 border-blue-500/40",
  red: "bg-red-500/20 text-red-400 border-red-500/40",
};

export function buildCategoryMap(
  categories: CategoryLike[] | MissionCategory[],
): Map<string, CategoryLike> {
  return new Map(categories.map((c) => [c.id, c]));
}

export function resolveCategoryDisplay(
  categoryId: string | null | undefined,
  map: Map<string, CategoryLike>,
): { id: string | null; name: string; color: string } {
  if (!categoryId) {
    return { id: null, name: "Uncategorized", color: "cyan" };
  }
  const cat = map.get(categoryId);
  if (cat) {
    return { id: cat.id, name: cat.name, color: cat.color };
  }
  return { id: categoryId, name: categoryId, color: "cyan" };
}

export interface CategoryCount {
  id: string;
  name: string;
  color: string;
  count: number;
  isDefault?: boolean;
}

export function categoryFilterPills(
  categories: CategoryLike[] | MissionCategory[],
  counts: Record<string, number>,
  includeUncategorized: boolean,
  uncategorizedCount: number,
): CategoryCount[] {
  const out: CategoryCount[] = [];
  for (const cat of categories) {
    const count = counts[cat.id] ?? 0;
    if (count > 0) {
      out.push({
        id: cat.id,
        name: cat.name,
        color: cat.color,
        count,
        isDefault: Boolean(cat.seedKey),
      });
    }
  }
  if (includeUncategorized && uncategorizedCount > 0) {
    out.push({
      id: "__uncategorized__",
      name: "Uncategorized",
      color: "cyan",
      count: uncategorizedCount,
    });
  }
  return out;
}

function groupByCategoryId<T>(
  items: T[],
  getCategoryId: (item: T) => string | null | undefined,
  categories: CategoryLike[] | MissionCategory[],
): Array<{ categoryId: string | null; label: string; color: string; items: T[] }> {
  const map = buildCategoryMap(categories);
  const buckets = new Map<string | null, T[]>();

  for (const item of items) {
    const cid = getCategoryId(item) ?? null;
    const list = buckets.get(cid) ?? [];
    list.push(item);
    buckets.set(cid, list);
  }

  const orderedIds: Array<string | null> = categories.map((c) => c.id);
  const seen = new Set(orderedIds);
  for (const cid of buckets.keys()) {
    if (cid !== null && !seen.has(cid)) {
      orderedIds.push(cid);
    }
  }
  if (buckets.has(null)) {
    orderedIds.push(null);
  }

  const groups: Array<{
    categoryId: string | null;
    label: string;
    color: string;
    items: T[];
  }> = [];

  for (const cid of orderedIds) {
    const itemsInBucket = buckets.get(cid);
    if (!itemsInBucket || itemsInBucket.length === 0) continue;
    const display = resolveCategoryDisplay(cid, map);
    groups.push({
      categoryId: cid,
      label: display.name,
      color: display.color,
      items: itemsInBucket,
    });
  }

  return groups;
}

export interface TemplateLike {
  id: string;
  name?: string;
  icon?: string;
  color?: string;
  description?: string;
  category?: string;
  categoryId?: string;
  isCustom?: boolean;
}

function getTemplateCategoryId(t: TemplateLike): string | null {
  if (t.categoryId) return t.categoryId;
  if (t.category) {
    const slug = t.category
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (slug === "general") return "general";
    if (slug === "engineering") return "engineering";
    return slug || null;
  }
  return null;
}

export function groupTemplatesByCategory<T extends TemplateLike>(
  templates: T[],
  categories: CategoryLike[] | MissionCategory[],
): Array<{ categoryId: string | null; label: string; color: string; items: T[] }> {
  return groupByCategoryId(templates, getTemplateCategoryId, categories);
}
