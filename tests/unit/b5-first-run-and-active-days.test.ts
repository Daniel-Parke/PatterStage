/** @jest-environment node */
// ═══════════════════════════════════════════════════════════════
// B5 oracle, group first-run-and-bundle (T-0099).
//
// Written before the product code moved. Two modules, four contracts:
//
//   (A) the first-run checklist gains a "model" step between agent and
//       mission, done only when a model is configured, pointed at
//       /agent/models;
//   (B) the model fact never decides whether the panel shows at all;
//   (C) settleFirstRunFacts latches a gateway that was once reachable so a
//       single failed probe cannot flip the headline (D57), while every
//       other fact follows the newest reading;
//   (D) getInsightsBundle reports activeDays for the same clamped window
//       it uses for everything else, read from distinctActiveDays(n).
//
// Reds here are the implementation's to-do list. The few GREEN CONTROLs pin
// what B5 keeps: the agent step still leads and points at the docs, the
// other three hrefs survive, the panel still hides once a mission exists and
// still ignores the model fact when deciding to show.
//
// Type-tolerance: `npm run lint` type-checks tests/ (tsconfig.tests.json), and
// this file must not red that gate while it waits for B5. So the three shapes
// the contract adds (modelConfigured on the facts, "model" in the step id
// union, activeDays on the bundle, settleFirstRunFacts as an export) are read
// through loose intersection aliases and one cast each. Every runtime
// assertion is exactly what the contract says; only the compile-time view is
// loosened. Once B5 lands, strip `Facts`, `stepById`'s cast, `settle`'s
// namespace read and `activeDaysOf` so the file re-tightens to the real types.
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

import * as firstRun from "@/lib/dashboard/first-run-steps";
import {
  AGENT_INSTALL_DOCS,
  firstRunSteps,
  shouldShowFirstRun,
  type FirstRunFacts,
  type FirstRunStep,
} from "@/lib/dashboard/first-run-steps";
import { getInsightsBundle, type InsightsBundle } from "@/lib/analytics/insights-bundle";

// ── pre-B5 type shims (see header) ──────────────────────────────

/** FirstRunFacts plus the fact B5 adds. Identical to FirstRunFacts after B5. */
type Facts = FirstRunFacts & { modelConfigured?: boolean };

type Settle = (prev: Facts | null, next: Facts) => Facts;

/** The new export, read off the namespace so the import compiles before B5. */
const settle: Settle = (
  firstRun as typeof firstRun & { settleFirstRunFacts?: Settle }
).settleFirstRunFacts!;

const stepsOf = (facts: Facts): FirstRunStep[] => firstRunSteps(facts);
const show = (facts: Facts): boolean => shouldShowFirstRun(facts);

/** Step lookup by an id the union does not carry yet. */
const stepById = (steps: FirstRunStep[], id: string): FirstRunStep =>
  steps.find((s) => (s.id as string) === id)!;

const activeDaysOf = (bundle: InsightsBundle): number | undefined =>
  (bundle as InsightsBundle & { activeDays?: number }).activeDays;

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
// (A) the model step
// ───────────────────────────────────────────────────────────────

describe("firstRunSteps: the model step (A)", () => {
  it("has four steps in the order agent, model, mission, sessions", () => {
    expect(stepsOf(FRESH).map((s) => s.id)).toEqual([
      "agent",
      "model",
      "mission",
      "sessions",
    ]);
  });

  it("the model step is an in-app link to /agent/models", () => {
    const model = stepById(stepsOf(FRESH), "model");
    expect(model).toBeDefined();
    expect(model.href).toBe("/agent/models");
    expect(model.external).toBe(false);
  });

  it("reads as not done, titled 'Give your agent a model', when no model is configured", () => {
    const model = stepById(stepsOf({ ...FRESH, modelConfigured: false }), "model");
    expect(model.done).toBe(false);
    expect(model.title).toBe("Give your agent a model");
  });

  it("reads as not done when the model fact is missing altogether", () => {
    const model = stepById(stepsOf(FRESH), "model");
    expect(model.done).toBe(false);
    expect(model.title).toBe("Give your agent a model");
  });

  it("reads as done, titled 'A model is configured', once a model is configured", () => {
    const model = stepById(stepsOf({ ...LIVE, modelConfigured: true }), "model");
    expect(model.done).toBe(true);
    expect(model.title).toBe("A model is configured");
  });

  it.each([
    ["not configured", false],
    ["configured", true],
  ])("gives the model step one sentence of why (%s), and that sentence says 'model'", (_label, configured) => {
    const model = stepById(stepsOf({ ...FRESH, modelConfigured: configured }), "model");
    expect(model.detail.length).toBeGreaterThan(20);
    expect(model.detail).toMatch(/model/i);
  });

  it("ticks all four off against the facts", () => {
    const steps = stepsOf({
      frameworkName: "Hermes",
      frameworkAvailable: true,
      modelConfigured: true,
      sessionCount: 0,
      missionCount: 2,
    });
    expect(steps.map((s) => [s.id, s.done])).toEqual([
      ["agent", true],
      ["model", true],
      ["mission", true],
      ["sessions", false],
    ]);
  });

  it("GREEN CONTROL: the agent step still leads, pointed at the install docs", () => {
    const [agent] = stepsOf(FRESH);
    expect(agent.id).toBe("agent");
    expect(agent.done).toBe(false);
    expect(agent.external).toBe(true);
    expect(agent.href).toBe(AGENT_INSTALL_DOCS);
    expect(agent.title).toContain("Hermes");
  });

  it("GREEN CONTROL: the other three steps keep their hrefs", () => {
    const steps = stepsOf(FRESH);
    const agent = stepById(steps, "agent");
    const mission = stepById(steps, "mission");
    const sessions = stepById(steps, "sessions");
    expect(agent.href).toBe(AGENT_INSTALL_DOCS);
    expect(agent.external).toBe(true);
    expect(mission.href).toBe("/work/missions");
    expect(sessions.href).toBe("/results/sessions");
  });
});

// ───────────────────────────────────────────────────────────────
// (B) the model fact does not decide visibility
// ───────────────────────────────────────────────────────────────

describe("shouldShowFirstRun ignores the model fact (B)", () => {
  it("GREEN CONTROL: a live install hides the panel with modelConfigured true, false or undefined", () => {
    expect(show({ ...LIVE, modelConfigured: true })).toBe(false);
    expect(show({ ...LIVE, modelConfigured: false })).toBe(false);
    expect(show({ ...LIVE, modelConfigured: undefined })).toBe(false);
  });

  it("GREEN CONTROL: hides once a mission exists, even before the first transcript lands", () => {
    expect(show({ ...LIVE, sessionCount: 0, missionCount: 1 })).toBe(false);
  });
});

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
