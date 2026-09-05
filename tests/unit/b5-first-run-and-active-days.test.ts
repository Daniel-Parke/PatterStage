/** @jest-environment node */
// ═══════════════════════════════════════════════════════════════
// B5 oracle, group first-run-and-bundle (T-0099).
//
// Written before the product code moved. It held four contracts; two of them
// have since been outlived rather than broken, and what is left is:
//
//   (C) settleFirstRunFacts latches a gateway that was once reachable so a
//       single failed probe cannot flip the dashboard's story (D57), while
//       every other fact follows the newest reading;
//   (D) getInsightsBundle reports activeDays for the same clamped window
//       it uses for everything else, read from distinctActiveDays(n).
//
// (A) and (B) were retired by B17 (T-0111). They pinned the four-step
// first-run checklist and the rule that the model fact never decided whether
// it showed. The quests replaced that checklist wholesale, so `firstRunSteps`
// and `shouldShowFirstRun` no longer exist to test; what the dashboard now
// shows in their place is pinned by group G of
// b5-dashboard-is-an-operations-board.test.tsx. The gateway latch stayed, and
// so does the group that proves it.
//
// The pre-B5 type shims this file carried are gone with them: B5 landed, and
// the two groups below read the real exported types.
// ═══════════════════════════════════════════════════════════════

const distinctActiveDays = jest.fn<string[], [number?]>();
const dailyCountsByType = jest.fn();
const countByHourAllTypes = jest.fn();

jest.mock("@/lib/analytics/analytics-repository", () => ({
  distinctActiveDays: (...a: [number?]) => distinctActiveDays(...a),
  dailyCountsByType: (...a: unknown[]) => dailyCountsByType(...a),
  countByHourAllTypes: (...a: unknown[]) => countByHourAllTypes(...a),
}));
jest.mock("@/lib/analytics/run-aggregates", () => ({
  getRunDurationBuckets: jest.fn(() => []),
  getModelUsage: jest.fn(() => []),
  getTopMissions: jest.fn(() => []),
}));

import {
  settleFirstRunFacts as settle,
  type FirstRunFacts as Facts,
} from "@/lib/dashboard/first-run-steps";
import { getInsightsBundle, type InsightsBundle } from "@/lib/analytics/insights-bundle";

const activeDaysOf = (bundle: InsightsBundle): number => bundle.activeDays;

// ── fixtures ────────────────────────────────────────────────────

const FRESH: Facts = {
  frameworkName: "Hermes",
  frameworkAvailable: false,
  sessionCount: 0,
  missionCount: 0,
};

const LIVE: Facts = {
  frameworkName: "Hermes",
  frameworkAvailable: true,
  sessionCount: 35,
  missionCount: 4,
};

// ───────────────────────────────────────────────────────────────
// (C) settleFirstRunFacts latches the gateway
// ───────────────────────────────────────────────────────────────

describe("settleFirstRunFacts (C)", () => {
  const REMOTE: Facts = {
    frameworkName: "Hermes",
    frameworkAvailable: false,
    gatewayReachable: true,
    gatewayUrl: "http://192.168.1.50:8642",
    sessionCount: 0,
    missionCount: 0,
  };

  it("is exported as a function", () => {
    expect(typeof settle).toBe("function");
  });

  it("with no previous reading, returns the next reading unchanged", () => {
    expect(settle(null, REMOTE)).toEqual(REMOTE);
    expect(settle(null, FRESH)).toEqual(FRESH);
  });

  it("keeps the gateway reachable when the next probe says false", () => {
    const settled = settle(REMOTE, {
      ...REMOTE,
      gatewayReachable: false,
      gatewayUrl: "http://192.168.1.50:8642",
    });
    expect(settled.gatewayReachable).toBe(true);
    expect(settled.gatewayUrl).toBe("http://192.168.1.50:8642");
  });

  it("keeps the gateway reachable, and its previous URL, when the next reading has neither", () => {
    const next: Facts = {
      frameworkName: "Hermes",
      frameworkAvailable: false,
      sessionCount: 0,
      missionCount: 0,
    };
    const settled = settle(REMOTE, next);
    expect(settled.gatewayReachable).toBe(true);
    expect(settled.gatewayUrl).toBe("http://192.168.1.50:8642");
  });

  it("prefers the next reading's URL when it has one", () => {
    const settled = settle(REMOTE, {
      ...REMOTE,
      gatewayReachable: undefined,
      gatewayUrl: "http://10.0.0.9:8642",
    });
    expect(settled.gatewayReachable).toBe(true);
    expect(settled.gatewayUrl).toBe("http://10.0.0.9:8642");
  });

  it("does not invent a gateway that was never reachable", () => {
    const settled = settle(FRESH, { ...FRESH, gatewayReachable: false });
    expect(settled.gatewayReachable).toBe(false);
    // The contract only says the field comes from next; false and undefined
    // are both "not reachable", so pin the property, not the representation.
    const settledUndefined = settle(FRESH, FRESH);
    expect(settledUndefined.gatewayReachable).not.toBe(true);
  });

  it("takes the counts from the next reading, not the previous one", () => {
    const settled = settle(
      { ...REMOTE, sessionCount: 3, missionCount: 1 },
      { ...REMOTE, sessionCount: 9, missionCount: 4 },
    );
    expect(settled.sessionCount).toBe(9);
    expect(settled.missionCount).toBe(4);
  });

  it("does not latch frameworkAvailable: a false reading after a true one stays false", () => {
    const settled = settle(
      { ...LIVE, gatewayReachable: true, gatewayUrl: "http://192.168.1.50:8642" },
      { ...LIVE, frameworkAvailable: false, gatewayReachable: true, gatewayUrl: "http://192.168.1.50:8642" },
    );
    expect(settled.frameworkAvailable).toBe(false);
  });

  it("does not latch modelConfigured: a false reading after a true one stays false", () => {
    const settled = settle(
      { ...LIVE, modelConfigured: true },
      { ...LIVE, modelConfigured: false },
    );
    expect(settled.modelConfigured).toBe(false);
    // Same as the gateway: "not latched" is the property, undefined-vs-false
    // is a representation the contract never draws.
    const cleared = settle({ ...LIVE, modelConfigured: true }, { ...LIVE });
    expect(cleared.modelConfigured).not.toBe(true);
  });

  it("takes the framework name from the next reading", () => {
    const settled = settle(REMOTE, { ...REMOTE, frameworkName: "OpenClaw" });
    expect(settled.frameworkName).toBe("OpenClaw");
  });
});

// ───────────────────────────────────────────────────────────────
// (D) the bundle reports active days for its own window
// ───────────────────────────────────────────────────────────────

describe("getInsightsBundle.activeDays (D)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    dailyCountsByType.mockReturnValue([
      { date: "2026-09-03", counts: { "mission.dispatched": 2, "mission.completed": 1 } },
      { date: "2026-09-04", counts: { "mission.failed": 1, "help.opened": 3 } },
    ]);
    countByHourAllTypes.mockReturnValue(new Array(24).fill(0));
    distinctActiveDays.mockReturnValue([]);
  });

  it("days 7: asks the repository for distinct active days over 7 and reports their count", () => {
    distinctActiveDays.mockReturnValue(["2026-09-01", "2026-09-03", "2026-09-04"]);
    const bundle = getInsightsBundle(7);
    expect(distinctActiveDays).toHaveBeenCalledWith(7);
    expect(activeDaysOf(bundle)).toBe(3);
  });

  it("days 90: same window, a different count", () => {
    const twelve = Array.from({ length: 12 }, (_, i) => `2026-08-${String(i + 1).padStart(2, "0")}`);
    distinctActiveDays.mockReturnValue(twelve);
    const bundle = getInsightsBundle(90);
    expect(distinctActiveDays).toHaveBeenCalledWith(90);
    expect(activeDaysOf(bundle)).toBe(12);
  });

  it("days 0 clamps to 1 for the active-days read as well", () => {
    distinctActiveDays.mockReturnValue(["2026-09-04"]);
    const bundle = getInsightsBundle(0);
    expect(bundle.days).toBe(1);
    expect(distinctActiveDays).toHaveBeenCalledWith(1);
    expect(activeDaysOf(bundle)).toBe(1);
  });

  it("days 1000 clamps to 365 for the active-days read as well", () => {
    distinctActiveDays.mockReturnValue([]);
    const bundle = getInsightsBundle(1000);
    expect(bundle.days).toBe(365);
    expect(distinctActiveDays).toHaveBeenCalledWith(365);
    expect(activeDaysOf(bundle)).toBe(0);
  });

  it("reports zero active days, not undefined, on an empty install", () => {
    distinctActiveDays.mockReturnValue([]);
    expect(activeDaysOf(getInsightsBundle(30))).toBe(0);
  });

  it("GREEN CONTROL: the existing fields keep working alongside activeDays", () => {
    const bundle = getInsightsBundle(7);
    expect(bundle.categorySeries.map((s) => s.key)).toContain("missions");
    expect(bundle.categoryDaily).toHaveLength(2);
    expect(bundle.categoryDaily[0].values.missions).toBe(3);
    expect(bundle.categoryDaily[1].values.help).toBe(3);
    expect(bundle.successTrend).toEqual([
      { date: "2026-09-03", completed: 1, failed: 0 },
      { date: "2026-09-04", completed: 0, failed: 1 },
    ]);
    expect(bundle.hourOfDay).toHaveLength(24);
    expect(dailyCountsByType).toHaveBeenCalledWith(7);
    expect(countByHourAllTypes).toHaveBeenCalledWith(7);
  });
});
