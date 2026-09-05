/** @jest-environment node */
/**
 * The dashboard on a fresh install used to be a wall of zeros with no next
 * step. These pin the rule that replaced it: an empty install reads as a
 * checklist, and the checklist gets out of the way once the install is live.
 */
import {
  AGENT_INSTALL_DOCS,
  firstRunSteps,
  shouldShowFirstRun,
  type FirstRunFacts,
} from "@/lib/dashboard/first-run-steps";

const FRESH: FirstRunFacts = {
  frameworkName: "Hermes",
  frameworkAvailable: false,
  sessionCount: 0,
  missionCount: 0,
};

const LIVE: FirstRunFacts = {
  frameworkName: "Hermes",
  frameworkAvailable: true,
  sessionCount: 35,
  missionCount: 4,
};

describe("shouldShowFirstRun", () => {
  it("shows on a brand-new install", () => {
    expect(shouldShowFirstRun(FRESH)).toBe(true);
  });

  it("hides on an install that is configured and has run something", () => {
    expect(shouldShowFirstRun(LIVE)).toBe(false);
  });

  it("keeps showing while there is no agent, however much else exists", () => {
    expect(shouldShowFirstRun({ ...LIVE, frameworkAvailable: false })).toBe(true);
  });

  it("shows for a configured install that has never run anything", () => {
    expect(
      shouldShowFirstRun({ ...LIVE, sessionCount: 0, missionCount: 0 }),
    ).toBe(true);
  });

  it("hides once a mission exists, even before the first transcript lands", () => {
    expect(shouldShowFirstRun({ ...LIVE, sessionCount: 0, missionCount: 1 })).toBe(false);
  });
});

describe("firstRunSteps", () => {
  it("leads with installing the agent, pointed at the install docs", () => {
    const [agent] = firstRunSteps(FRESH);
    expect(agent.id).toBe("agent");
    expect(agent.done).toBe(false);
    expect(agent.external).toBe(true);
    expect(agent.href).toBe(AGENT_INSTALL_DOCS);
    expect(agent.title).toContain("Hermes");
  });

  it("ticks each step off against the facts", () => {
    const steps = firstRunSteps({
      frameworkName: "Hermes",
      frameworkAvailable: true,
      sessionCount: 0,
      missionCount: 2,
    });
    expect(steps.map((s) => [s.id, s.done])).toEqual([
      ["agent", true],
      ["mission", true],
      ["sessions", false],
    ]);
  });

  it("routes the in-app steps at real pages, not the docs", () => {
    const steps = firstRunSteps(FRESH);
    const inApp = steps.filter((s) => !s.external);
    expect(inApp.map((s) => s.href)).toEqual(["/work/missions", "/results/sessions"]);
  });

  it("survives a framework with no name rather than saying 'Install undefined'", () => {
    const [agent] = firstRunSteps({ ...FRESH, frameworkName: "" });
    expect(agent.title).toBe("Install your agent");
  });

  it("gives every step one sentence of why, not an empty label", () => {
    for (const step of firstRunSteps(FRESH)) {
      expect(step.detail.length).toBeGreaterThan(20);
    }
  });
});
