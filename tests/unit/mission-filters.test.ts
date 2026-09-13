/** @jest-environment node */
// Pure selectors extracted from useMissionsPage (lib/missions/mission-filters.ts).

import {
  filterMissions,
  computeMissionCategoryPills,
  computeTemplateCategoryPills,
  filterGroupedTemplates,
  submitToastForDispatch,
  type MissionFilterFields,
} from "@/lib/missions/mission-filters";
import type { CategoryLike } from "@/lib/missions/mission-categories";
import type { MissionTemplate } from "@/components/missions/TemplateModals";

const m = (over: Partial<MissionFilterFields> = {}): MissionFilterFields => ({
  name: "Mission",
  prompt: "do the thing",
  status: "successful",
  ...over,
});

const categories: CategoryLike[] = [
  { id: "eng", name: "Engineering", color: "cyan", seedKey: "engineering" },
  { id: "ops", name: "Ops", color: "purple", seedKey: null },
];

describe("filterMissions", () => {
  const missions = [
    m({ name: "Alpha", status: "successful", categoryId: "eng" }),
    m({ name: "Beta", status: "failed", categoryId: "ops" }),
    m({ name: "Gamma", status: "queued", queuedForRun: false }), // draft
    m({ name: "Delta", status: "dispatched", prompt: "needle here" }),
  ];

  it("returns all when filter=all, no category, no search", () => {
    expect(
      filterMissions(missions, { filter: "all", missionCategoryFilter: "all", search: "" }),
    ).toHaveLength(4);
  });

  it("filters by board column", () => {
    const r = filterMissions(missions, {
      filter: "failed",
      missionCategoryFilter: "all",
      search: "",
    });
    expect(r.map((x) => x.name)).toEqual(["Beta"]);
  });

  it("filters by draft column (queued + not queuedForRun)", () => {
    const r = filterMissions(missions, {
      filter: "draft",
      missionCategoryFilter: "all",
      search: "",
    });
    expect(r.map((x) => x.name)).toEqual(["Gamma"]);
  });

  it("filters by category", () => {
    const r = filterMissions(missions, {
      filter: "all",
      missionCategoryFilter: "eng",
      search: "",
    });
    expect(r.map((x) => x.name)).toEqual(["Alpha"]);
  });

  it("filters __uncategorized__ (no categoryId)", () => {
    const r = filterMissions(missions, {
      filter: "all",
      missionCategoryFilter: "__uncategorized__",
      search: "",
    });
    expect(r.map((x) => x.name)).toEqual(["Gamma", "Delta"]);
  });

  it("search matches name OR prompt, case-insensitive", () => {
    expect(
      filterMissions(missions, { filter: "all", missionCategoryFilter: "all", search: "ALPHA" }),
    ).toHaveLength(1);
    expect(
      filterMissions(missions, { filter: "all", missionCategoryFilter: "all", search: "needle" }),
    ).toHaveLength(1);
  });
});

// computeMissionCounts was here. It was a third count set in a third
// vocabulary, rendered by nothing, and it disagreed with the board about which
// column a saved draft was in. The one counter lives in mission-board.ts now
// and b10-board-and-insights-agree.test.tsx holds it (T-0104, C126).

describe("computeMissionCategoryPills", () => {
  it("counts per-category + an Uncategorized bucket", () => {
    const pills = computeMissionCategoryPills(
      [m({ categoryId: "eng" }), m({ categoryId: "eng" }), m({})],
      categories,
    );
    expect(pills.find((p) => p.id === "eng")?.count).toBe(2);
    expect(pills.find((p) => p.id === "__uncategorized__")?.count).toBe(1);
  });
});

describe("computeTemplateCategoryPills", () => {
  it("buckets templates by categoryId, defaulting to general", () => {
    const tpls = [
      { id: "t1", categoryId: "eng" },
      { id: "t2" }, // → general
    ] as unknown as MissionTemplate[];
    const cats: CategoryLike[] = [
      ...categories,
      { id: "general", name: "General", color: "cyan", seedKey: "general" },
    ];
    const pills = computeTemplateCategoryPills(tpls, cats);
    expect(pills.find((p) => p.id === "eng")?.count).toBe(1);
    expect(pills.find((p) => p.id === "general")?.count).toBe(1);
  });
});

describe("filterGroupedTemplates", () => {
  const tpls = [
    { id: "t1", name: "A", categoryId: "eng" },
    { id: "t2", name: "B", categoryId: "ops" },
  ] as unknown as MissionTemplate[];

  it("returns every group when filter=all", () => {
    expect(filterGroupedTemplates(tpls, categories, "all")).toHaveLength(2);
  });

  it("narrows to a single category", () => {
    const r = filterGroupedTemplates(tpls, categories, "eng");
    expect(r).toHaveLength(1);
    expect(r[0].categoryId).toBe("eng");
  });
});

describe("submitToastForDispatch", () => {
  it.each([
    ["save", "Saving draft..."],
    ["queue", "Queueing mission..."],
    ["cron", "Scheduling mission..."],
    ["now", "Dispatching mission..."],
  ] as const)("%s → %s", (mode, copy) => {
    expect(submitToastForDispatch(mode)).toBe(copy);
  });
});
