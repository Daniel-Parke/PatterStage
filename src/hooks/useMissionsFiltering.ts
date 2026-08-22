// ═══════════════════════════════════════════════════════════════
// useMissionsFiltering — board view state and its derived selectors
// ═══════════════════════════════════════════════════════════════
//
// Split out of useMissionsPage (Phase 4 god-file decomposition). Owns
// the five pieces of board view state the user drives (status filter,
// search text, the two category filters, the collapsed result columns)
// and the five memos derived from them. Every selector is a pure
// function in src/lib/missions/mission-filters.ts; this hook is the
// state plus the memo boundary, nothing else.

"use client";

import { useMemo, useState } from "react";

import type { ManagedCategory } from "@/components/missions/CategoryManagerModal";
import type { MissionTemplate } from "@/components/missions/TemplateModals";
import type { MissionRow } from "@/hooks/missions-page-types";
import {
  filterMissions,
  computeMissionCounts,
  computeMissionCategoryPills,
  computeTemplateCategoryPills,
  filterGroupedTemplates,
} from "@/lib/missions/mission-filters";

export interface UseMissionsFilteringArgs {
  missions: MissionRow[];
  templates: MissionTemplate[];
  categories: ManagedCategory[];
}

export function useMissionsFiltering({
  missions,
  templates,
  categories,
}: UseMissionsFilteringArgs) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [missionCategoryFilter, setMissionCategoryFilter] = useState("all");
  const [collapsedColumns, setCollapsedColumns] = useState<Record<string, boolean>>({
    successful: true,
    failed: true,
  });

  const filtered = useMemo(
    () => filterMissions(missions, { filter, missionCategoryFilter, search }),
    [missions, filter, search, missionCategoryFilter],
  );

  // Counts are a single .reduce() pass (see computeMissionCounts) whose 5
  // buckets are intentionally NON-mutually-exclusive — a `status:"queued"
  // && queuedForRun:true` mission increments both `active` and `queued`,
  // matching the original 5 independent .filter().length passes.
  const missionCounts = useMemo(() => computeMissionCounts(missions), [missions]);

  const templateCategoryPills = useMemo(
    () => computeTemplateCategoryPills(templates, categories),
    [templates, categories],
  );

  const missionCategoryPills = useMemo(
    () => computeMissionCategoryPills(missions, categories),
    [missions, categories],
  );

  const filteredGrouped = useMemo(
    () => filterGroupedTemplates(templates, categories, categoryFilter),
    [templates, categoryFilter, categories],
  );

  return {
    filter,
    setFilter,
    search,
    setSearch,
    categoryFilter,
    setCategoryFilter,
    missionCategoryFilter,
    setMissionCategoryFilter,
    collapsedColumns,
    setCollapsedColumns,
    filtered,
    missionCounts,
    templateCategoryPills,
    missionCategoryPills,
    filteredGrouped,
  };
}
