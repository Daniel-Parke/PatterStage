/** @jest-environment node */
// Pure Agent Experience XP + level (stats/agent-experience.ts).

import { computeAgentXp, computeAgentLevel, AGENT_XP, type AgentExperienceSignals } from "@/lib/stats/agent-experience";

function sig(over: Partial<AgentExperienceSignals> = {}): AgentExperienceSignals {
  return {
    runsCompleted: 0,
    totalTokens: 0,
    activeDays: 0,
    skillsEnabled: 0,
    toolsetCount: 0,
    memoryFacts: 0,
    ...over,
  };
}

describe("computeAgentXp", () => {
  it("weights usage + footprint per the table", () => {
    const xp = computeAgentXp(sig({ runsCompleted: 2, skillsEnabled: 1, activeDays: 1 }));
    expect(xp).toBe(2 * AGENT_XP.perRun + 1 * AGENT_XP.perSkill + 1 * AGENT_XP.perActiveDay);
  });

  it("scales tokens at half an xp per 1k", () => {
    expect(computeAgentXp(sig({ totalTokens: 10_000 }))).toBe(Math.round(10 * AGENT_XP.perThousandTokens));
  });

  it("is monotonic in runs", () => {
    expect(computeAgentXp(sig({ runsCompleted: 5 }))).toBeGreaterThan(computeAgentXp(sig({ runsCompleted: 1 })));
  });
});

describe("computeAgentLevel", () => {
  it("starts at level 1 'Hatchling' with no xp", () => {
    const lvl = computeAgentLevel(0);
    expect(lvl.level).toBe(1);
    expect(lvl.title).toBe("Hatchling");
    expect(lvl.progress).toBeGreaterThanOrEqual(0);
  });

  it("climbs and relabels with the agent title set", () => {
    const lvl = computeAgentLevel(computeAgentXp(sig({ runsCompleted: 50, skillsEnabled: 8, activeDays: 20 })));
    expect(lvl.level).toBeGreaterThan(1);
    expect(lvl.title).not.toBe("Initiate"); // not the operator vocabulary
  });
});
