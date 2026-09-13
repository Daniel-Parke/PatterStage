// Unit tests for the dashboard helpers extracted in session 174 (the fourth,
// loadInitialDashboardData, went in T-0129: every dashboard read is a
// useApiResource keyed on its endpoint now, and there is no second loader):
//   - dedupErrors (src/lib/dashboard/dashboard-error-dedup.ts)
//   - resolveModelReadiness (src/lib/models/model-readiness.ts), which took
//     over from formatModelSubtitle when the product's three answers to "do I
//     have a model?" were collapsed into one. The subtitle is one of its three
//     readers now, so the ladder it used to own is asserted there.
//   - topNTemplates (src/lib/dashboard-top-templates.ts)
//
// The dashboard (src/app/page.tsx) is not rendered here; we exercise
// the helpers directly with pure inputs. The byte-equivalence
// expectations (the inline code in page.tsx produced the same shape)
// are documented inline next to each test.

import {
  dedupErrors,
  type DedupableError,
} from "@/lib/dashboard/dashboard-error-dedup";
import { resolveModelReadiness } from "@/lib/models/model-readiness";
import { topNTemplates } from "@/lib/dashboard/dashboard-top-templates";
import type { DashboardTemplate } from "@/hooks/useDashboard";

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

// ── the header subtitle, now one reader of the readiness answer ──
//
// These five cases are the ones formatModelSubtitle held. The ladder is
// unchanged; the strings moved with it, and the middle case says "not sent to
// the agent yet" instead of "registry default (not yet applied)" because the
// dashboard is a novice screen and the reader does not have to know the
// product has a registry to act on it.

function subtitle(configModel: string, configProvider: string, registryLabel: string | null) {
  return resolveModelReadiness({ configModel, configProvider, registryLabel }).label;
}

describe("the model named in the dashboard header", () => {
  it("returns the config-file model with provider when both are set", () => {
    expect(subtitle("gpt-4o", "openai", null)).toBe("gpt-4o · openai");
  });

  it("returns just the config-file model when provider is empty", () => {
    expect(subtitle("claude-3-5-sonnet", "", null)).toBe("claude-3-5-sonnet");
  });

  it("falls back to the registry label when the config file is empty", () => {
    expect(subtitle("", "", "claude-3-5-sonnet")).toBe(
      "claude-3-5-sonnet · not sent to the agent yet",
    );
  });

  it("ignores the registry label when the config file has a model (priority 1 wins)", () => {
    expect(subtitle("gpt-4o", "openai", "claude-3-5-sonnet")).toBe("gpt-4o · openai");
  });

  it("returns '-' when both the config file and the registry are empty", () => {
    expect(subtitle("", "", null)).toBe("-");
  });

  it("only the config-file case counts as a model the agent can use", () => {
    // The half the subtitle could never say, and the half three screens each
    // guessed at: a name on screen is not the same as a model the agent has.
    expect(resolveModelReadiness({ configModel: "gpt-4o", configProvider: "openai", registryLabel: null }).ready).toBe(true);
    expect(resolveModelReadiness({ configModel: "", configProvider: "", registryLabel: "gpt-4o" }).ready).toBe(false);
    expect(resolveModelReadiness({ configModel: "", configProvider: "", registryLabel: null }).ready).toBe(false);
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

  // The default cap was 12 until U20 (T-0134): at 900px tall the strip was
  // cut at the fold. It is six, one row, and DispatchStrip reads the same
  // constant.
  it("caps at the default 6 when more templates are provided", () => {
    const input: DashboardTemplate[] = Array.from({ length: 20 }, (_, i) =>
      makeTemplate({ id: `tpl-${i}`, name: `Template ${i}` }),
    );
    const result = topNTemplates(input);
    expect(result).toHaveLength(6);
  });

  it("sorts custom templates first, then alphabetical by name", () => {
    // We need MORE than n entries to force the sort path; otherwise the
    // no-op fast path returns [...templates] in input order and the sort
    // never runs. 13 entries at the explicit cap of 12 → 1 entry is dropped
    // (the last in sorted order). The cap is passed, since U20 moved the
    // default to six; the ladder under test is the same.
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
    const result = topNTemplates(input, 12);
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
    // 13 entries at an explicit cap of 12 (the default is six since U20,
    // T-0134) so the sort path is exercised; the
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
    const result = topNTemplates(input, 12);
    expect(result).toHaveLength(12);
    expect(result[0].name).toBeUndefined();
    // Every entry from index 1 onwards must have a non-empty name.
    expect(result.slice(1).every((t) => (t.name ?? "") !== "")).toBe(true);
  });
});
