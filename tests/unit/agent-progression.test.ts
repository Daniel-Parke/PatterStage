/** @jest-environment node */
// The pure half of the per-Body progression capture: the inputs digest, the
// agent-scope filter, and the rule that decides whether a record is a
// correction. No database, so these are the assertions that can be read as
// statements about the design rather than about SQLite.

import { createHash } from "crypto";

import {
  ACHIEVEMENTS_SCOPE_INSTALL,
  AGENT_PROGRESSION_COMPUTATION_VERSION,
  agentScopedAchievements,
  buildAgentProgressionRecord,
  digestInputs,
  isCorrection,
  type AgentProgressionInputs,
  type CapturedAchievement,
} from "@/lib/stats/agent-progression";
import type { AgentProgressionSnapshotRow } from "@/lib/stats/agent-progression-repository";
import { evaluateAchievements, type RawMetrics } from "@/lib/stats/derive";
import type { AgentPerformance } from "@/lib/stats/agent-stats";

// countAgentActiveDays is the only IO buildAgentProgressionRecord reaches; the
// experience helper already degrades a failed read to 0, and a fixed 0 here
// keeps these tests about the record rather than about the runs table.
jest.mock("@/lib/stats/agent-stats-repository", () => ({
  countAgentActiveDays: () => 0,
}));

function metrics(over: Partial<RawMetrics> = {}): RawMetrics {
  return {
    completedMissions: 0,
    failedMissions: 0,
    completedRuns: 0,
    totalTokens: 0,
    stories: 0,
    schedulesEnabled: 0,
    scriptsEnabled: 0,
    longestStreak: 0,
    currentStreak: 0,
    completionHours: [],
    dispatchedMissions: 0,
    maxMissionsInADay: 0,
    chaptersGenerated: 0,
    storiesCompleted: 0,
    sessionsStarted: 0,
    schedulesCreated: 0,
    schedulesFired: 0,
    skillToggles: 0,
    personalityChanges: 0,
    modelConfigs: 0,
    chatMessages: 0,
    distinctProfiles: 0,
    distinctEventTypes: 0,
    eventCounts: {},
    facts: { profiles: 0, models: 0, credentials: 0, workflows: 0, memoryConfigured: false },
    ...over,
  };
}

function inputs(over: Partial<AgentProgressionInputs> = {}): AgentProgressionInputs {
  return {
    signals: {
      runsCompleted: 3,
      totalTokens: 2_000,
      activeDays: 2,
      skillsEnabled: 4,
      toolsetCount: 1,
      memoryFacts: 0,
    },
    measures: { "first-contact": 1, veteran: 12 },
    ...over,
  };
}

function agent(over: Partial<AgentPerformance> = {}): AgentPerformance {
  return {
    slug: "scout",
    name: "Scout",
    runs: 3,
    runsCompleted: 3,
    missionsCompleted: 2,
    missionsFailed: 0,
    totalTokens: 2_000,
    avgDurationSec: 5,
    skills: 4,
    toolsets: 1,
    ...over,
  };
}

function storedRow(over: Partial<AgentProgressionSnapshotRow> = {}): AgentProgressionSnapshotRow {
  return {
    id: 1,
    profileSlug: "scout",
    capturedAt: "2026-08-22T00:00:00Z",
    level: 1,
    levelTitle: "Hatchling",
    xp: 0,
    achievementsScope: ACHIEVEMENTS_SCOPE_INSTALL,
    achievementsJson: "[]",
    inputsJson: "{}",
    inputsDigest: "x",
    schemaVersion: 31,
    computationVersion: AGENT_PROGRESSION_COMPUTATION_VERSION,
    ...over,
  };
}

describe("digestInputs", () => {
  it("returns a digest that is the sha256 of the JSON it returns", () => {
    const { json, digest } = digestInputs(inputs());

    // The stored inputs_json is the preimage of the stored inputs_digest, so a
    // later reader in any language can verify a row with nothing but a hash.
    expect(createHash("sha256").update(json).digest("hex")).toBe(digest);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is independent of key insertion order, so equal inputs always agree", () => {
    const a = digestInputs({
      signals: {
        runsCompleted: 1,
        totalTokens: 2,
        activeDays: 3,
        skillsEnabled: 4,
        toolsetCount: 5,
        memoryFacts: 6,
      },
      measures: { alpha: 1, beta: 2 },
    });
    const b = digestInputs({
      measures: { beta: 2, alpha: 1 },
      signals: {
        memoryFacts: 6,
        toolsetCount: 5,
        skillsEnabled: 4,
        activeDays: 3,
        totalTokens: 2,
        runsCompleted: 1,
      },
    });

    expect(b.json).toBe(a.json);
    expect(b.digest).toBe(a.digest);
  });

  it("moves when any single input moves", () => {
    const base = digestInputs(inputs()).digest;

    expect(digestInputs(inputs({ measures: { "first-contact": 1, veteran: 13 } })).digest).not.toBe(
      base,
    );
    expect(
      digestInputs({ ...inputs(), signals: { ...inputs().signals, activeDays: 3 } }).digest,
    ).not.toBe(base);
  });
});

describe("agentScopedAchievements", () => {
  it("keeps the achievements that describe the Body", () => {
    const captured = agentScopedAchievements(evaluateAchievements(metrics({ completedMissions: 1 })));
    const ids = captured.map((a) => a.id);

    expect(ids).toContain("first-contact");
    expect(ids).toContain("token-baron");
    expect(captured.find((a) => a.id === "first-contact")).toMatchObject({
      current: 1,
      target: 1,
      unlocked: true,
    });
  });

  it("drops every Rec Room achievement, per ADR-0004 decision 5", () => {
    const ids = agentScopedAchievements(evaluateAchievements(metrics())).map((a) => a.id);

    for (const recroom of ["storyteller", "novelist", "saga-weaver", "wordsmith", "epic-scribe"]) {
      expect(ids).not.toContain(recroom);
    }
  });

  it("no Rec Room count can move a single agent-scoped measure", () => {
    // ADR-0004 decision 5 says creative activity never touches the agent's
    // record. This holds it mechanically: writing fiction moves these three
    // metrics and nothing else, so if a future achievement definition started
    // reading one of them into an agent-scoped measure, this goes red.
    const quiet = agentScopedAchievements(evaluateAchievements(metrics()));
    const busyRecRoom = agentScopedAchievements(
      evaluateAchievements(metrics({ stories: 40, storiesCompleted: 12, chaptersGenerated: 300 })),
    );

    expect(busyRecRoom).toEqual(quiet);
  });

  it("orders by id, so two captures of the same state serialise identically", () => {
    const captured = agentScopedAchievements(evaluateAchievements(metrics()));
    expect(captured.map((a) => a.id)).toEqual([...captured.map((a) => a.id)].sort());
  });
});

describe("buildAgentProgressionRecord", () => {
  it("records the level, the versions and the subject of the achievements", () => {
    const achievements = agentScopedAchievements(evaluateAchievements(metrics()));
    const record = buildAgentProgressionRecord(agent(), achievements);

    expect(record.profileSlug).toBe("scout");
    expect(record.level).toBeGreaterThanOrEqual(1);
    expect(record.levelTitle).toBeTruthy();
    expect(record.xp).toBeGreaterThan(0);
    expect(record.computationVersion).toBe(AGENT_PROGRESSION_COMPUTATION_VERSION);
    expect(record.achievementsScope).toBe(ACHIEVEMENTS_SCOPE_INSTALL);
  });

  it("digests the per-profile signals together with the value each achievement measured", () => {
    const achievements = agentScopedAchievements(
      evaluateAchievements(metrics({ completedMissions: 4 })),
    );
    const record = buildAgentProgressionRecord(agent(), achievements);
    const parsed = JSON.parse(record.inputsJson) as AgentProgressionInputs;

    expect(parsed.signals.runsCompleted).toBe(3);
    expect(parsed.measures["first-contact"]).toBe(4);
    expect(createHash("sha256").update(record.inputsJson).digest("hex")).toBe(record.inputsDigest);
  });

  it("is deterministic: the same agent and achievements give the same bytes", () => {
    const achievements = agentScopedAchievements(evaluateAchievements(metrics()));
    const a = buildAgentProgressionRecord(agent(), achievements);
    const b = buildAgentProgressionRecord(agent(), achievements);

    expect(b.inputsJson).toBe(a.inputsJson);
    expect(b.inputsDigest).toBe(a.inputsDigest);
  });
});

describe("isCorrection", () => {
  const achievements: CapturedAchievement[] = [
    { id: "first-contact", current: 1, target: 1, unlocked: true, tier: "common", points: 10 },
    { id: "veteran", current: 3, target: 100, unlocked: false, tier: "epic", points: 50 },
  ];
  const record = buildAgentProgressionRecord(agent(), achievements);

  it("is true when the profile has no row yet", () => {
    expect(isCorrection(record, undefined)).toBe(true);
  });

  it("is false when level, xp and the unlocked set all match", () => {
    const previous = storedRow({
      level: record.level,
      xp: record.xp,
      achievementsJson: JSON.stringify(achievements),
    });
    expect(isCorrection(record, previous)).toBe(false);
  });

  it("is true when the xp moved", () => {
    const previous = storedRow({
      level: record.level,
      xp: record.xp - 1,
      achievementsJson: JSON.stringify(achievements),
    });
    expect(isCorrection(record, previous)).toBe(true);
  });

  it("is true when an achievement unlocked, even at identical xp", () => {
    const previous = storedRow({
      level: record.level,
      xp: record.xp,
      achievementsJson: JSON.stringify([
        achievements[0],
        { ...achievements[1], unlocked: false },
        { id: "extra", current: 0, target: 1, unlocked: true, tier: "common", points: 10 },
      ]),
    });
    expect(isCorrection(record, previous)).toBe(true);
  });

  it("ignores progress toward a still-locked achievement", () => {
    // Otherwise every token processed would append a row, and the ledger would
    // be a log rather than a record of what the agent reached.
    const previous = storedRow({
      level: record.level,
      xp: record.xp,
      achievementsJson: JSON.stringify([achievements[0], { ...achievements[1], current: 99 }]),
    });
    expect(isCorrection(record, previous)).toBe(false);
  });

  it("treats an unreadable stored row as different, so a fresh row is appended", () => {
    expect(isCorrection(record, storedRow({ achievementsJson: "not json" }))).toBe(true);
    expect(isCorrection(record, storedRow({ achievementsJson: '{"not":"an array"}' }))).toBe(true);
  });
});
