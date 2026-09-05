// ═══════════════════════════════════════════════════════════════
// mission-filters.ts — pure selectors for the missions page
// ═══════════════════════════════════════════════════════════════
//
// Extracted from useMissionsPage so the board-filtering, count, and
// category-pill logic is pure + unit-testable in isolation (the hook
// just wraps each in a useMemo). Every function is generic over the
// minimal field set it reads, so there is no import cycle back to the
// hook's MissionRow type.

import {
  missionBoardColumn,
} from "@/lib/missions/mission-board";
import {
  categoryFilterPills,
  groupTemplatesByCategory,
  type CategoryLike,
  type CategoryCount,
} from "@/lib/missions/mission-categories";
import { getCategoryIdFromTemplate } from "@/lib/missions/mission-composer-utils";
import type { MissionCategory } from "@/lib/missions/mission-category-repository";
import type { MissionTemplate } from "@/components/missions/TemplateModals";

/** Minimal mission shape the selectors read (subset of MissionRow). */
export type MissionFilterFields = {
  name: string;
  prompt: string;
  status: string;
  queuedForRun?: boolean;
  categoryId?: string | null;
};

export interface MissionFilterCriteria {
  /** Active board column filter ("all" | board column). */
  filter: string;
  /** Category filter ("all" | "__uncategorized__" | categoryId). */
  missionCategoryFilter: string;
  /** Free-text search over name + prompt. */
  search: string;
}

/**
 * Filter the missions list by board column, category, and search text.
 * Byte-equivalent to the inline `missions.filter(...)` the hook used.
 */
export function filterMissions<M extends MissionFilterFields>(
  missions: M[],
  { filter, missionCategoryFilter, search }: MissionFilterCriteria,
): M[] {
  return missions.filter((m) => {
    if (filter !== "all") {
      const column = missionBoardColumn(m);
      if (filter !== column) return false;
    }
    if (missionCategoryFilter !== "all") {
      if (missionCategoryFilter === "__uncategorized__") {
        if (m.categoryId) return false;
      } else if (m.categoryId !== missionCategoryFilter) {
        return false;
      }
    }
    if (
      search &&
      !m.name.toLowerCase().includes(search.toLowerCase()) &&
      !m.prompt.toLowerCase().includes(search.toLowerCase())
    )
      return false;
    return true;
  });
}

// computeMissionCounts and MissionCounts were here. They were a third count
// set, in a third vocabulary, rendered by nothing: the board counts its own
// columns and the strip beside it counted m.status. One counter now lives in
// mission-board.ts and both surfaces read it (T-0104, C126).

/** Category-filter pills for the missions board (includes Uncategorized). */
export function computeMissionCategoryPills<
  M extends { categoryId?: string | null },
>(
  missions: M[],
  categories: CategoryLike[] | MissionCategory[],
): CategoryCount[] {
  const counts: Record<string, number> = {};
  let uncategorized = 0;
  for (const m of missions) {
    if (!m.categoryId) {
      uncategorized += 1;
    } else {
      counts[m.categoryId] = (counts[m.categoryId] ?? 0) + 1;
    }
  }
  return categoryFilterPills(categories, counts, true, uncategorized);
}

/** Category-filter pills for the templates rail (no Uncategorized bucket). */
export function computeTemplateCategoryPills(
  templates: MissionTemplate[],
  categories: CategoryLike[] | MissionCategory[],
): CategoryCount[] {
  const counts: Record<string, number> = {};
  for (const t of templates) {
    const cid = getCategoryIdFromTemplate(t, "general")!;
    counts[cid] = (counts[cid] ?? 0) + 1;
  }
  return categoryFilterPills(categories, counts, false, 0);
}

type TemplateWithCategory = MissionTemplate & { categoryId?: string };

/**
 * Group templates by category, then narrow to the active category filter.
 * Byte-equivalent to the hook's inline `filteredGrouped` useMemo.
 */
export function filterGroupedTemplates(
  templates: MissionTemplate[],
  categories: CategoryLike[] | MissionCategory[],
  categoryFilter: string,
) {
  const grouped = groupTemplatesByCategory(
    templates as TemplateWithCategory[],
    categories,
  );
  if (categoryFilter === "all") return grouped;
  return grouped.filter((g) => {
    if (categoryFilter === "__uncategorized__") {
      return g.categoryId === null;
    }
    return g.categoryId === categoryFilter;
  });
}

/** Pending-toast copy for each dispatch mode. */
export function submitToastForDispatch(
  mode: "save" | "now" | "cron" | "queue",
): string {
  if (mode === "save") return "Saving draft...";
  if (mode === "queue") return "Queueing mission...";
  if (mode === "cron") return "Scheduling mission...";
  return "Dispatching mission...";
}
