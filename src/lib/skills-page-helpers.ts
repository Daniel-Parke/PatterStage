// ═══════════════════════════════════════════════════════════════
// skills-page-helpers.ts: pure derivations for the Skills Manager page
// ═══════════════════════════════════════════════════════════════
//
// Extracted from app/operations/skills/page.tsx so the optimistic-toggle
// resolution + search/grouping/paging derivations are pure + unit-testable.

import { groupByCategory, titleCaseCategory } from "@/lib/skills-grouping";
import { filterByCaseInsensitiveSubstring } from "@/lib/list-search";
import type { Skill } from "@/types/console";

/**
 * The "effective" enabled state of a skill after applying any pending
 * optimistic toggle. Reads `pending[skill.name]` (the in-flight mutation)
 * and falls back to the supplied value (defaults to the server's
 * `skill.enabled`).
 */
export function effectiveSkillEnabled(
  skill: Skill,
  pending: Record<string, boolean>,
  fallback: boolean = skill.enabled,
): boolean {
  return pending[skill.name] ?? fallback;
}

/**
 * Case-insensitive search over a skill's name + description.
 *
 * This runs over whatever list it is handed, and the page hands it the WHOLE
 * catalogue rather than the rendered window. That is the invariant worth
 * stating out loud (T-0032, INV-1): the moment a paged surface filters only
 * the rows it happens to have rendered, the search box starts reporting "no
 * matches" for skills that are sitting right there in the catalogue.
 */
export function filterBySearch(skills: Skill[], search: string) {
  return filterByCaseInsensitiveSubstring(skills, search, [
    (s) => s.name,
    (s) => s.description,
  ]);
}

/** One category bucket: a stable state key, a display label, and its skills. */
export interface SkillCategoryGroup {
  /**
   * The case-normalised grouping key. Collapse and paging state key off THIS,
   * never off `category`. The page used to seed its collapse map with the
   * API's raw category strings while the grid looked state up by the
   * title-cased display label, so no lookup ever matched and every category
   * rendered open no matter what the map said.
   */
  key: string;
  /** Title-cased label for the eye. */
  category: string;
  skills: Skill[];
}

/**
 * Case-insensitive grouping into buckets, each sorted by name. The display
 * name is the title-cased first item's original case, which keeps a polished
 * label even when the underlying category values vary in case (the "Creative"
 * vs "creative" mismatch class of bug).
 */
export function groupCategories(skills: Skill[]): SkillCategoryGroup[] {
  return groupByCategory(skills, "Other").map(([key, items]) => ({
    key,
    category: titleCaseCategory(items[0].category) || titleCaseCategory(key),
    skills: [...items].sort((x, y) => x.name.localeCompare(y.name)),
  }));
}

// ── Paging ─────────────────────────────────────────────────────────────────
//
// The window that keeps DOM node count off the catalogue size. 178 skills
// rendered at once cost 5,450 nodes and 625 buttons; one window costs a fixed
// slice of that, and the cost stops moving when the catalogue grows.

// Rows rendered per page, in a category body and in the search results alike.
// Deliberately NOT exported: every consumer, tests included, reads the window
// size through the paging helpers below, so there is one source of truth and no
// second place to change it.
const SKILL_PAGE_SIZE = 24;

/** Pages a list of `total` rows occupies. Always at least 1, so no "page 1 of 0". */
export function pageCount(total: number, size: number = SKILL_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / size));
}

/**
 * Clamp a page index into range.
 *
 * The case that matters is the shrink: the user is on page 3 of a category and
 * types a search that narrows it to five rows. Unclamped, the window slices
 * past the end and they stare at an empty list that has results in it.
 */
export function clampPage(
  page: number,
  total: number,
  size: number = SKILL_PAGE_SIZE,
): number {
  return Math.min(Math.max(0, page), pageCount(total, size) - 1);
}

/** The rows for a zero-based page, with the page index clamped into range. */
export function pageSlice<T>(
  items: readonly T[],
  page: number,
  size: number = SKILL_PAGE_SIZE,
): T[] {
  const start = clampPage(page, items.length, size) * size;
  return items.slice(start, start + size);
}

/** Human range for a pager: "25-48 of 60", or "0 of 0" for an empty list. */
export function pageRangeLabel(
  total: number,
  page: number,
  size: number = SKILL_PAGE_SIZE,
): string {
  if (total === 0) return "0 of 0";
  const start = clampPage(page, total, size) * size;
  return `${start + 1}-${Math.min(start + size, total)} of ${total}`;
}

/**
 * Scope a category key to the section it is rendered in.
 *
 * "Other" exists in both the Active and the Inactive section. One shared key
 * would make expanding it in one section expand it in the other, and page 3 of
 * one would silently become page 3 of the other.
 */
export function categoryStateKey(scope: string, key: string): string {
  return `${scope}::${key}`;
}
