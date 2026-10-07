// skills-page-helpers.ts: pure derivations for the Skills Manager page.

import { groupByCategory, titleCaseCategory } from "@/lib/skills/skills-grouping";
import { filterByCaseInsensitiveSubstring } from "@/lib/ui/list-search";
import type { Skill } from "@/types/console";

/** A skill's enabled state with any in-flight optimistic toggle applied. */
export function effectiveSkillEnabled(
  skill: Skill,
  pending: Record<string, boolean>,
  fallback: boolean = skill.enabled,
): boolean {
  return pending[skill.name] ?? fallback;
}

/**
 * Case-insensitive search over name + description. The page hands it the WHOLE
 * catalogue, never the rendered window (T-0032, INV-1): a paged surface that
 * filters only its rendered rows reports "no matches" for skills it holds.
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
   * never off `category`: the page once seeded its collapse map with raw API
   * strings while the grid looked up by display label, so nothing ever matched.
   */
  key: string;
  /** Title-cased label for the eye. */
  category: string;
  skills: Skill[];
}

/**
 * Case-insensitive buckets, each sorted by name, labelled from the first item's
 * original case so "Creative" and "creative" do not split.
 */
export function groupCategories(skills: Skill[]): SkillCategoryGroup[] {
  return groupByCategory(skills, "Other").map(([key, items]) => ({
    key,
    category: titleCaseCategory(items[0].category) || titleCaseCategory(key),
    skills: [...items].sort((x, y) => x.name.localeCompare(y.name)),
  }));
}

// ── Paging: the window that keeps DOM node count off the catalogue size (178
// skills at once cost 5,450 nodes and 625 buttons). The page size is
// deliberately NOT exported: every consumer, tests included, reads the window
// through the helpers below, so there is no second place to change it.
const SKILL_PAGE_SIZE = 24;

/**
 * How large a section may be and still open with every category expanded.
 * Collapsing every category put a first viewport on screen with no skill name
 * in it (T-0125); four page windows renders in full for about what T-0032
 * budgeted for one open category of cards, now that a skill is a row.
 */
const SKILL_OPEN_BY_DEFAULT_MAX = 4 * SKILL_PAGE_SIZE;

/** Whether a section of this many skills opens with its categories expanded. */
export function categoriesOpenByDefault(sectionSize: number): boolean {
  return sectionSize <= SKILL_OPEN_BY_DEFAULT_MAX;
}

/** Pages a list of `total` rows occupies. Always at least 1, so no "page 1 of 0". */
export function pageCount(total: number, size: number = SKILL_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / size));
}

/**
 * Clamp a page index into range. The case that matters is the shrink: on page 3,
 * a search narrows to five rows, and unclamped the window slices past the end.
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
 * Scope a category key to its section: "Other" exists in both Active and
 * Inactive, and one shared key would expand and page both at once.
 */
export function categoryStateKey(scope: string, key: string): string {
  return `${scope}::${key}`;
}
