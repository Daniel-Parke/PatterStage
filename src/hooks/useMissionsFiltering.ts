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

import { useEffect, useMemo, useState } from "react";

import type { ManagedCategory } from "@/components/missions/CategoryManagerModal";
import type { MissionTemplate } from "@/components/missions/TemplateModals";
import type { MissionRow } from "@/hooks/missions-page-types";
import {
  filterMissions,
  computeMissionCategoryPills,
  computeTemplateCategoryPills,
  filterGroupedTemplates,
} from "@/lib/missions/mission-filters";
import { missionBoardColumn } from "@/lib/missions/mission-board";

export interface UseMissionsFilteringArgs {
  missions: MissionRow[];
  templates: MissionTemplate[];
  categories: ManagedCategory[];
  /**
   * The mission a `?mission=<id>` deep link arrived on, or null. Only the
   * deep link, never a plain row click. See the effect below.
   */
  deepLinkedMissionId: string | null;
}

export function useMissionsFiltering({
  missions,
  templates,
  categories,
  deepLinkedMissionId,
}: UseMissionsFilteringArgs) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [missionCategoryFilter, setMissionCategoryFilter] = useState("all");
  const [collapsedColumns, setCollapsedColumns] = useState<Record<string, boolean>>({
    successful: true,
    failed: true,
  });

  // Arriving from a session's "open the parent mission" link expands the
  // column that mission lands in.
  //
  // Completed and Failed start collapsed to five rows, and a mission old
  // enough to have a session in the list is usually past row five. Without
  // this, following the link opened a detail panel inside a column that
  // never rendered it, and the link read as broken, the exact failure the
  // deep link was added to remove. Expanding is what the user would have
  // done by pressing "Show all", so it is their own next click, taken for
  // them. Keyed on the deep-linked id ONLY: a plain row click must leave
  // the collapse state alone.
  useEffect(() => {
    if (!deepLinkedMissionId) return;
    const mission = missions.find((m) => m.id === deepLinkedMissionId);
    if (!mission) return;
    const column = missionBoardColumn(mission);
    setCollapsedColumns((prev) =>
      prev[column] ? { ...prev, [column]: false } : prev,
    );
  }, [deepLinkedMissionId, missions]);

  const filtered = useMemo(
    () => filterMissions(missions, { filter, missionCategoryFilter, search }),
    [missions, filter, search, missionCategoryFilter],
  );

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
    templateCategoryPills,
    missionCategoryPills,
    filteredGrouped,
  };
}
