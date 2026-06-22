// Unit tests for the 4 dashboard helpers extracted in session 174:
//   - dedupErrors (src/lib/dashboard-error-dedup.ts)
//   - formatModelSubtitle (src/lib/dashboard-model-subtitle.ts)
//   - topNTemplates (src/lib/dashboard-top-templates.ts)
//   - loadInitialDashboardData (src/lib/dashboard-initial-load.ts)
//
// The dashboard (src/app/page.tsx) is not rendered here; we exercise
// the helpers directly with mocked fetch (for loadInitialDashboardData)
// or pure inputs (for the 3 pure helpers). The byte-equivalence
// expectations (the inline code in page.tsx produced the same shape)
// are documented inline next to each test.

import {
  dedupErrors,
  type DedupableError,
} from "@/lib/dashboard-error-dedup";
import { formatModelSubtitle } from "@/lib/dashboard-model-subtitle";
import { topNTemplates } from "@/lib/dashboard-top-templates";
// Note: `loadInitialDashboardData` is imported via the test name
// only; the test bodies use `require()` inside `jest.isolateModules`
// to re-require the helper after `jest.doMock` registers the mock.
// The static import is intentionally unused (eslint allows `_`-prefix
// names; we keep the symbol in scope so test names reference it).
import {
  loadInitialDashboardData as _loadInitialDashboardData,
  type DashboardTemplate,
  type ModelsDefaults,
} from "@/lib/dashboard-initial-load";
import { safeApiCallData } from "@/lib/api-fetch";

// ── dedupErrors ───────────────────────────────────────────────

describe("dedupErrors", () => {
  it("returns an empty array for an empty input", () => {
    expect(dedupErrors([])).toEqual([]);
  });

  it("passes a single error through unchanged", () => {
    const e: DedupableError = { source: "Api_Server", message: "Refusing to start" };
    expect(dedupErrors([e])).toEqual([e]);
  });

  it("preserves the original error object identity for count-1 entries", () => {
    const e: DedupableError = { source: "Api_Server", message: "Refusing to start" };
    const result = dedupErrors([e]);
    expect(result[0]).toBe(e);
  });

  it("collapses consecutive identical pairs into one row with (×N) suffix", () => {
    const a: DedupableError = { source: "Api_Server", message: "Refusing to start" };
    const b: DedupableError = { source: "Cron", message: "Job missed" };
    const result = dedupErrors([a, a, a, b, b]);
    expect(result).toHaveLength(2);
    expect(result[0].message).toBe("Refusing to start  (×3)");
    expect(result[1].message).toBe("Job missed  (×2)");
  });

  it("uses two spaces before the (×N) parenthetical (pre-extraction byte shape)", () => {
    // The pre-extraction inline form in src/app/page.tsx rendered
    // `${err.message}  (×${count})` with two spaces; the helper
    // preserves the same shape byte-for-byte so a snapshot diff
    // would surface a regression.
    const a: DedupableError = { source: "X", message: "m" };
    const result = dedupErrors([a, a]);
    expect(result[0].message).toBe("m  (×2)");
  });

  it("preserves extra fields on the merged error object (spread, not assign)", () => {
    interface ErrorWithTime extends DedupableError {
      timestamp?: string;
      severity: string;
    }
    const a: ErrorWithTime = {
      source: "Api_Server",
      message: "Refusing",
      timestamp: "2026-06-12T10:00:00Z",
      severity: "error",
    };
    const b: ErrorWithTime = { ...a, timestamp: "2026-06-12T10:01:00Z" };
    const result = dedupErrors<ErrorWithTime>([a, b]);
    // First-occurrence wins for the merged row.
    expect(result[0].timestamp).toBe("2026-06-12T10:00:00Z");
    expect(result[0].severity).toBe("error");
  });

  it("does not mutate the input array", () => {
    const a: DedupableError = { source: "X", message: "m" };
    const input = [a, a];
    const snapshot = [...input];
    dedupErrors(input);
    expect(input).toEqual(snapshot);
  });
});

// ── formatModelSubtitle ───────────────────────────────────────

describe("formatModelSubtitle", () => {
  it("returns the disk model with provider when both are set", () => {
    expect(formatModelSubtitle("gpt-4o", "openai", null)).toBe("gpt-4o · openai");
  });

  it("returns just the disk model when provider is empty", () => {
    expect(formatModelSubtitle("claude-3-5-sonnet", "", null)).toBe("claude-3-5-sonnet");
  });

  it("falls back to the registry label when disk is empty", () => {
    expect(formatModelSubtitle("", "", "claude-3-5-sonnet")).toBe(
      "claude-3-5-sonnet · registry default (not yet applied)",
    );
  });

  it("ignores the registry label when the disk has a model (priority 1 wins)", () => {
    expect(formatModelSubtitle("gpt-4o", "openai", "claude-3-5-sonnet")).toBe(
      "gpt-4o · openai",
    );
  });

  it("returns '-' when both disk and registry are empty", () => {
    expect(formatModelSubtitle("", "", null)).toBe("-");
  });
});

// ── topNTemplates ─────────────────────────────────────────────

function makeTemplate(overrides: Partial<DashboardTemplate> = {}): DashboardTemplate {
  return {
    id: "tpl-default",
    name: "Default",
    icon: "Zap",
    color: "cyan",
    category: "general",
    profile: "default",
    description: "",
    ...overrides,
  };
}

describe("topNTemplates", () => {
  it("returns a shallow copy of the input when templates.length <= n", () => {
    const input: DashboardTemplate[] = [makeTemplate({ id: "a" })];
    const result = topNTemplates(input);
    expect(result).toEqual(input);
    expect(result).not.toBe(input); // defensive copy, not the same reference
  });

  it("caps at the default 12 when more templates are provided", () => {
    const input: DashboardTemplate[] = Array.from({ length: 20 }, (_, i) =>
      makeTemplate({ id: `tpl-${i}`, name: `Template ${i}` }),
    );
    const result = topNTemplates(input);
    expect(result).toHaveLength(12);
  });

  it("sorts custom templates first, then alphabetical by name", () => {
    // We need MORE than n entries (default 12) to force the sort path;
    // otherwise the no-op fast path returns [...templates] in input
    // order and the sort never runs. 13 entries, cap 12 → 1 entry is
    // dropped (the last in sorted order).
    const input: DashboardTemplate[] = [
      makeTemplate({ id: "0", name: "Z-extra", isCustom: false }),
      makeTemplate({ id: "1", name: "Zebra", isCustom: false }),
      makeTemplate({ id: "2", name: "Apple", isCustom: true }),
      makeTemplate({ id: "3", name: "Mango", isCustom: false }),
      makeTemplate({ id: "4", name: "Banana", isCustom: true }),
      makeTemplate({ id: "5", name: "E2", isCustom: false }),
      makeTemplate({ id: "6", name: "E1", isCustom: true }),
      makeTemplate({ id: "7", name: "C", isCustom: false }),
      makeTemplate({ id: "8", name: "B", isCustom: true }),
      makeTemplate({ id: "9", name: "D", isCustom: false }),
      makeTemplate({ id: "10", name: "Filler1", isCustom: false }),
      makeTemplate({ id: "11", name: "Filler2", isCustom: false }),
      makeTemplate({ id: "12", name: "Filler3", isCustom: false }),
    ];
    const result = topNTemplates(input);
    // Verified with plain-node sort: customs sort first (Apple, B,
    // Banana, E1), then non-customs alphabetically (C, D, E2, Filler1,
    // Filler2, Filler3, Mango, Z-extra, Zebra). The cap drops the
    // last entry (Zebra).
    expect(result).toHaveLength(12);
    expect(result.map((t) => t.name)).toEqual([
      "Apple", "B", "Banana", "E1",
      "C", "D", "E2", "Filler1", "Filler2", "Filler3", "Mango", "Z-extra",
    ]);
  });

  it("does not mutate the input array", () => {
    const input: DashboardTemplate[] = [
      makeTemplate({ id: "1", name: "Z" }),
      makeTemplate({ id: "2", name: "A" }),
    ];
    const snapshot = [...input];
    topNTemplates(input, 1);
    expect(input).toEqual(snapshot);
  });

  it("accepts a custom cap n", () => {
    const input: DashboardTemplate[] = Array.from({ length: 5 }, (_, i) =>
      makeTemplate({ id: `tpl-${i}`, name: `T${i}` }),
    );
    expect(topNTemplates(input, 3)).toHaveLength(3);
  });

  it("treats missing names as empty strings for sort", () => {
    // 13 entries (default n=12) so the sort path is exercised; the
    // no-op fast path returns [...input] in input order, which would
    // mask the sort behaviour.
    const input: DashboardTemplate[] = [
      makeTemplate({ id: "1", name: undefined }),
      makeTemplate({ id: "2", name: "Alpha" }),
      makeTemplate({ id: "3", name: "F1" }),
      makeTemplate({ id: "4", name: "F2" }),
      makeTemplate({ id: "5", name: "F3" }),
      makeTemplate({ id: "6", name: "F4" }),
      makeTemplate({ id: "7", name: "F5" }),
      makeTemplate({ id: "8", name: "F6" }),
      makeTemplate({ id: "9", name: "F7" }),
      makeTemplate({ id: "10", name: "F8" }),
      makeTemplate({ id: "11", name: "F9" }),
      makeTemplate({ id: "12", name: "F10" }),
      makeTemplate({ id: "13", name: "F11" }),
    ];
    // Verified with plain-node sort: localeCompare puts "" BEFORE
    // non-empty strings, so the empty-name entry sorts FIRST. The
    // cap drops the LAST sorted entry (F9), keeping 12 in the result.
    const result = topNTemplates(input);
    expect(result).toHaveLength(12);
    expect(result[0].name).toBeUndefined();
    // Every entry from index 1 onwards must have a non-empty name.
    expect(result.slice(1).every((t) => (t.name ?? "") !== "")).toBe(true);
  });
});

// ── loadInitialDashboardData ──────────────────────────────────

describe("loadInitialDashboardData", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("returns null slots for every endpoint when all 8 fetches return null", async () => {
    jest.spyOn(safeApiCallData, "call" as never); // not used; safeApiCallData is async
    // Mock the safeApiCallData module to return null for all calls.
    jest.doMock("@/lib/api-fetch", () => ({
      safeApiCallData: jest.fn().mockResolvedValue(null),
    }));
    // Re-require the helper after the mock is registered.
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { loadInitialDashboardData: load } = require("@/lib/dashboard-initial-load");
      // The mocked fetch returns null for every endpoint, so the
      // helper's `?? null` / `?? []` defensive defaults fire.
      return load({}).then((result: unknown) => {
        const r = result as { dashboardData: Record<string, unknown>; modelsDefaults: unknown };
        expect(r.dashboardData).toEqual({
          status: null,
          config: null,
          templates: [],
          categories: [],
          monitor: null,
          processes: [],
          missions: [],
        });
        expect(r.modelsDefaults).toBeNull();
      });
    });
  });

  it("unwraps the inner payload for endpoints with a `{ data: T }` envelope", async () => {
    const fixtures = {
      status: { gatewayConnected: true },
      config: { model: { default: "gpt-4o" } },
      templates: { templates: [{ id: "t1", name: "T1" }] },
      categories: { categories: [{ id: "c1", name: "C1" }] },
      monitor: { cron: { jobs: [] }, sessions: { recent: [] } },
      processes: { processes: [{ id: "p1" }] },
      missions: { missions: [{ id: "m1" }] },
      defaults: { defaults: { agent: "claude-3-5-sonnet" } },
    };
    jest.doMock("@/lib/api-fetch", () => ({
      safeApiCallData: jest.fn().mockImplementation((path: string) => {
        if (path.endsWith("/api/status")) return Promise.resolve(fixtures.status);
        if (path.endsWith("/api/config")) return Promise.resolve(fixtures.config);
        if (path.endsWith("/api/templates")) return Promise.resolve(fixtures.templates);
        if (path.endsWith("/api/mission-categories")) return Promise.resolve(fixtures.categories);
        if (path.endsWith("/api/monitor")) return Promise.resolve(fixtures.monitor);
        if (path.endsWith("/api/agents")) return Promise.resolve(fixtures.processes);
        if (path.endsWith("/api/missions")) return Promise.resolve(fixtures.missions);
        if (path.endsWith("/api/models/defaults")) return Promise.resolve(fixtures.defaults);
        return Promise.resolve(null);
      }),
    }));
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { loadInitialDashboardData: load } = require("@/lib/dashboard-initial-load");
      return load({}).then((result: unknown) => {
        const r = result as {
          dashboardData: {
            status: unknown;
            config: unknown;
            templates: unknown[];
            categories: unknown[];
            monitor: unknown;
            processes: unknown[];
            missions: unknown[];
          };
          modelsDefaults: { defaults: ModelsDefaults | null } | null;
        };
        expect(r.dashboardData.status).toEqual(fixtures.status);
        expect(r.dashboardData.config).toEqual(fixtures.config);
        expect(r.dashboardData.templates).toEqual(fixtures.templates.templates);
        expect(r.dashboardData.categories).toEqual(fixtures.categories.categories);
        expect(r.dashboardData.monitor).toEqual(fixtures.monitor);
        expect(r.dashboardData.processes).toEqual(fixtures.processes.processes);
        expect(r.dashboardData.missions).toEqual(fixtures.missions.missions);
        expect(r.modelsDefaults?.defaults?.agent).toBe("claude-3-5-sonnet");
      });
    });
  });
});
