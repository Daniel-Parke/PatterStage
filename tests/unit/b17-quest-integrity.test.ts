/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports -- the quest modules do not exist yet; a static import would fail typecheck:tests instead of failing this test for the contract reason */

// ═══════════════════════════════════════════════════════════════
// B17 oracle, integrity: nothing in the quest content may point at a thing
// that is not there.
//
// The plan's own verification line: "integrity test (every screen is a
// registry route, every earns/teaches id exists, every proof event is in the
// taxonomy)". This file is that, plus the three couplings the contract adds
// because they are gates that will bite:
//
//   * the four chain achievements are real ACHIEVEMENT_DEFS entries, their
//     icons are registered in AchievementBadge.ICONS, and `curriculum` is
//     scoped OUT of the agent's record — ADR-0004 decision 5 forbids an
//     agent-scoped achievement that moves when a Rec Room counter moves, and
//     `curriculum` spans chapter 6;
//   * AGENT_PROGRESSION_COMPUTATION_VERSION is bumped, because four new defs
//     change the stored answer for unchanged inputs and its own docblock
//     rules the bump;
//   * docs/quests.md carries the generated block.
//
// Written before src/lib/quests/ and docs/quests.md exist.
// ═══════════════════════════════════════════════════════════════

import { existsSync, readFileSync } from "fs";
import { join } from "path";

import { ANALYTICS_EVENT_TYPES, type AnalyticsEventType } from "@/lib/analytics/event-types";
import { allModuleRoutes } from "@/lib/modules/registry";
import {
  ACHIEVEMENT_DEFS,
  achievementScope,
  achievementTier,
  type RawMetrics,
  type StoreFacts,
} from "@/lib/stats/derive";
import { ICONS } from "@/components/achievements/AchievementBadge";
import { AGENT_PROGRESSION_COMPUTATION_VERSION } from "@/lib/stats/agent-progression";

const ROOT = process.cwd();

// ── the shapes the contract names ───────────────────────────────

type QuestProof =
  | { kind: "event"; event: AnalyticsEventType; target: number }
  | { kind: "fact"; fact: keyof StoreFacts; target: number };

type QuestRequirement = "gateway" | "memory" | "composer" | "host-scheduler";

interface QuestDef {
  id: string;
  chapter: number;
  title: string;
  action: string;
  proof: QuestProof;
  screen: string;
  teaches: string[];
  requires?: QuestRequirement;
  earns?: string;
}

interface QuestChapter {
  number: number;
  id: string;
  title: string;
  blurb: string;
  seeAlso?: { label: string; href: string }[];
}

interface DefsModule {
  QUEST_DEFS: QuestDef[];
  QUEST_CHAPTERS: QuestChapter[];
  CONCEPT_IDS: readonly string[];
  CONCEPT_LABELS: Record<string, string>;
  HOST_REQUIREMENT_COPY: Record<QuestRequirement, string>;
  proofMet: (proof: QuestProof, m: RawMetrics) => boolean;
  questsMet: (m: RawMetrics) => number;
  questsMetInChapter: (m: RawMetrics, chapter: number) => number;
}

function defs(): DefsModule {
  return require("@/lib/quests/quest-defs") as DefsModule;
}

function baseMetrics(over: Partial<RawMetrics> = {}): RawMetrics {
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

const CHAIN_IDS = ["first-hour", "agent-shaper", "clockmaker", "curriculum"] as const;

// ═══════════════════════════════════════════════════════════════
// the three couplings the plan names
// ═══════════════════════════════════════════════════════════════

describe("every quest's screen is a registry route", () => {
  it("points only at hrefs src/lib/modules/registry.ts owns", () => {
    const routes = new Set(allModuleRoutes());
    const strangers = defs()
      .QUEST_DEFS.filter((q) => !routes.has(q.screen))
      .map((q) => `${q.id} -> ${q.screen}`);
    expect(strangers).toEqual([]);
  });

  it("carries the route verbatim: no query string, no hash, no trailing slash", () => {
    // The registry is the single source for the rail, the titles, the e2e
    // matrix, Help deep-links AND quest hrefs. A quest that decorates the
    // href stops being checkable against it.
    const decorated = defs()
      .QUEST_DEFS.filter((q) => /[?#]/.test(q.screen) || (q.screen.length > 1 && q.screen.endsWith("/")))
      .map((q) => `${q.id} -> ${q.screen}`);
    expect(decorated).toEqual([]);
  });

  it("a chapter's See also links are registry routes too", () => {
    const routes = new Set(allModuleRoutes());
    const strangers: string[] = [];
    for (const c of defs().QUEST_CHAPTERS) {
      for (const s of c.seeAlso ?? []) if (!routes.has(s.href)) strangers.push(`${c.id} -> ${s.href}`);
    }
    expect(strangers).toEqual([]);
  });
});

describe("every proof event is in the taxonomy B4 closed", () => {
  it("names no event type that does not exist", () => {
    const known = new Set<string>(ANALYTICS_EVENT_TYPES);
    const invented = defs()
      .QUEST_DEFS.filter((q) => q.proof.kind === "event" && !known.has(q.proof.event))
      .map((q) => `${q.id} -> ${(q.proof as { event: string }).event}`);
    expect(invented).toEqual([]);
  });

  it("names no store fact that the stats reader does not measure", () => {
    const known = new Set(Object.keys(baseMetrics().facts));
    const invented = defs()
      .QUEST_DEFS.filter((q) => q.proof.kind === "fact" && !known.has(String(q.proof.fact)))
      .map((q) => `${q.id} -> ${String((q.proof as { fact: string }).fact)}`);
    expect(invented).toEqual([]);
  });

  it("is never proven by a failure: a mission that failed is not a quest", () => {
    const failures = new Set(["mission.failed", "research.failed", "composer.run_failed"]);
    const bad = defs()
      .QUEST_DEFS.filter((q) => q.proof.kind === "event" && failures.has(q.proof.event))
      .map((q) => q.id);
    expect(bad).toEqual([]);
  });

  it("is never proven by an event nothing emits yet", () => {
    // research.cancelled lands with B14 and help.opened with B16. A quest
    // pinned to one of those is unwinnable on this tree.
    const unemitted = new Set(["research.cancelled", "help.opened"]);
    const bad = defs()
      .QUEST_DEFS.filter((q) => q.proof.kind === "event" && unemitted.has(q.proof.event))
      .map((q) => q.id);
    expect(bad).toEqual([]);
  });

  it("asks for a positive target", () => {
    expect(defs().QUEST_DEFS.filter((q) => !(q.proof.target >= 1)).map((q) => q.id)).toEqual([]);
  });
});

describe("every earns and teaches id exists", () => {
  it("earns only achievements ACHIEVEMENT_DEFS actually defines", () => {
    const known = new Set(ACHIEVEMENT_DEFS.map((a) => a.id));
    const missing = defs()
      .QUEST_DEFS.filter((q) => q.earns !== undefined && !known.has(q.earns))
      .map((q) => `${q.id} -> ${q.earns}`);
    expect(missing).toEqual([]);
  });

  it("teaches only concepts from the vocabulary decision 5 fixed", () => {
    const known = new Set(defs().CONCEPT_IDS);
    const missing: string[] = [];
    for (const q of defs().QUEST_DEFS) for (const t of q.teaches) if (!known.has(t)) missing.push(`${q.id} -> ${t}`);
    expect(missing).toEqual([]);
  });

  it("gives every concept id a label, so a Teaches chip is never blank", () => {
    const unlabelled = defs().CONCEPT_IDS.filter((id) => !defs().CONCEPT_LABELS[id]);
    expect(unlabelled).toEqual([]);
  });

  it("earns each achievement at most once across the whole programme", () => {
    const earned = defs().QUEST_DEFS.map((q) => q.earns).filter((e): e is string => e !== undefined);
    expect(new Set(earned).size).toBe(earned.length);
  });
});

describe("the catalogue is well formed", () => {
  it("has unique ids, addressed <chapter>.<step>, and a chapter that exists", () => {
    const d = defs();
    const ids = d.QUEST_DEFS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    const chapters = new Set(d.QUEST_CHAPTERS.map((c) => c.number));
    for (const q of d.QUEST_DEFS) {
      expect(q.id).toMatch(/^[1-7]\.\d+$/);
      expect(q.id.startsWith(`${q.chapter}.`)).toBe(true);
      expect(chapters.has(q.chapter)).toBe(true);
    }
  });

  it("gives every chapter at least one quest", () => {
    const counted = new Set(defs().QUEST_DEFS.map((q) => q.chapter));
    expect(defs().QUEST_CHAPTERS.filter((c) => !counted.has(c.number)).map((c) => c.id)).toEqual([]);
  });

  it("says one sentence per quest, in the house voice", () => {
    // docs/COPY.md: sentence case, no em dash, no governance id on a screen.
    const offenders: string[] = [];
    for (const q of defs().QUEST_DEFS) {
      if (!q.title.trim() || !q.action.trim()) offenders.push(`${q.id}: empty`);
      if (/[—]/.test(q.title) || /[—]/.test(q.action)) offenders.push(`${q.id}: em dash`);
      if (/\b(ADR-\d|WG-[A-Z]|RUL-[A-Z]|T-\d{4})/.test(`${q.title} ${q.action}`)) offenders.push(`${q.id}: governance id`);
      if (!q.action.trim().endsWith(".")) offenders.push(`${q.id}: action is not a sentence`);
    }
    expect(offenders).toEqual([]);
  });

  it("names a requirement only from the four the plan allows, and says why for each", () => {
    const allowed = new Set(["gateway", "memory", "composer", "host-scheduler"]);
    const bad = defs()
      .QUEST_DEFS.filter((q) => q.requires !== undefined && !allowed.has(q.requires))
      .map((q) => `${q.id} -> ${String(q.requires)}`);
    expect(bad).toEqual([]);
    for (const req of allowed) {
      expect(typeof defs().HOST_REQUIREMENT_COPY[req as QuestRequirement]).toBe("string");
      expect(defs().HOST_REQUIREMENT_COPY[req as QuestRequirement].length).toBeGreaterThan(20);
    }
  });

  it("tells the operator, in the host-scheduler sentence, exactly what decision 10 says", () => {
    const copy = defs().HOST_REQUIREMENT_COPY["host-scheduler"];
    expect(copy).toMatch(/windows/i);
    expect(copy).not.toMatch(/\b(ADR-\d|T-\d{4})/);
  });
});

// ═══════════════════════════════════════════════════════════════
// the chain achievements
// ═══════════════════════════════════════════════════════════════

describe("the four chain achievements", () => {
  const chain = () => ACHIEVEMENT_DEFS.filter((a) => (CHAIN_IDS as readonly string[]).includes(a.id));

  it("are in ACHIEVEMENT_DEFS: First Hour, Agent Shaper, Clockmaker, Curriculum", () => {
    expect(chain().map((a) => a.id).sort()).toEqual([...CHAIN_IDS].sort());
  });

  it("register their icons, so no badge falls back to a silent Medal", () => {
    // The length check first: without it this passes vacuously while the four
    // defs are still missing, and an oracle that is green before the work is
    // done is not an oracle.
    expect(chain()).toHaveLength(CHAIN_IDS.length);
    expect(chain().filter((a) => !(a.icon in ICONS)).map((a) => `${a.id}:${a.icon}`)).toEqual([]);
  });

  it("measure the quest proofs, not the latch, so the ordering inside the stats read holds", () => {
    // evaluateAchievements runs BEFORE evaluateQuests; a chain achievement
    // that read the latch would read a value that does not exist yet.
    const d = defs();
    const all = baseMetrics();
    for (const t of ANALYTICS_EVENT_TYPES) all.eventCounts[t] = 5;
    all.facts = { profiles: 5, models: 5, credentials: 5, workflows: 5, memoryConfigured: true };

    const byId = new Map(ACHIEVEMENT_DEFS.map((a) => [a.id, a]));
    expect(byId.get("first-hour")!.measure(all)).toBe(d.questsMetInChapter(all, 1));
    expect(byId.get("agent-shaper")!.measure(all)).toBe(d.questsMetInChapter(all, 3));
    expect(byId.get("clockmaker")!.measure(all)).toBe(d.questsMetInChapter(all, 4));
    expect(byId.get("curriculum")!.measure(all)).toBe(d.questsMet(all));
    expect(byId.get("curriculum")!.target).toBe(d.QUEST_DEFS.length);
    expect(byId.get("first-hour")!.measure(baseMetrics())).toBe(0);
  });

  it("scopes Curriculum out of the agent's record (ADR-0004 decision 5)", () => {
    // It spans chapter 6, whose proofs are Rec Room counters. An agent scope
    // would let creative play inflate the Body's record, which
    // tests/unit/stats-derive.test.ts already forbids.
    expect(achievementScope(ACHIEVEMENT_DEFS.find((a) => a.id === "curriculum")!)).toBe("recroom");
  });

  it("keeps the other three insensitive to every Rec Room counter", () => {
    const recroomEvents: AnalyticsEventType[] = ["story.created", "story.chapter_generated", "story.completed"];
    for (const id of ["first-hour", "agent-shaper", "clockmaker"]) {
      const def = ACHIEVEMENT_DEFS.find((a) => a.id === id)!;
      expect(achievementScope(def)).toBe("agent");
      const probe = baseMetrics({ stories: 9999, storiesCompleted: 9999, chaptersGenerated: 9999 });
      for (const t of recroomEvents) probe.eventCounts[t] = 9999;
      expect(def.measure(probe)).toBe(def.measure(baseMetrics()));
    }
  });

  it("is tiered, so the trophy case can rank it", () => {
    expect(achievementTier("first-hour")).toBe("rare");
    expect(achievementTier("agent-shaper")).toBe("epic");
    expect(achievementTier("clockmaker")).toBe("epic");
    expect(achievementTier("curriculum")).toBe("legendary");
  });

  it("bumps the progression computation version, because the stored answer moved", () => {
    expect(AGENT_PROGRESSION_COMPUTATION_VERSION).toBeGreaterThanOrEqual(3);
  });
});

// ═══════════════════════════════════════════════════════════════
// docs/quests.md
// ═══════════════════════════════════════════════════════════════

describe("docs/quests.md carries a generated block", () => {
  // docs/reference/quests.md, not docs/quests.md. This contract was written
  // before B15's re-tier landed, and that batch's own oracle allows exactly
  // five files at the top of docs/: the index and the four GitHub looks for.
  // The ledger is a reference page, so it lives in the reference tier.
  const path = join(ROOT, "docs", "reference", "quests.md");

  it("exists", () => {
    expect(existsSync(path)).toBe(true);
  });

  it("delimits the generated half so a stale block is a red build", () => {
    const src = readFileSync(path, "utf-8");
    expect(src).toContain("<!-- generated:quests -->");
    expect(src).toContain("<!-- /generated:quests -->");
  });

  it("lists every chapter and every quest, inside the markers", () => {
    const src = readFileSync(path, "utf-8");
    const block = src.slice(src.indexOf("<!-- generated:quests -->"), src.indexOf("<!-- /generated:quests -->"));
    for (const c of defs().QUEST_CHAPTERS) expect(block).toContain(c.title);
    for (const q of defs().QUEST_DEFS) {
      expect(block).toContain(q.id);
      expect(block).toContain(q.title);
    }
  });

  it("is reachable: docs/README.md links it, or check-doc-links cannot see it", () => {
    expect(readFileSync(join(ROOT, "docs", "README.md"), "utf-8")).toContain("quests.md");
  });
});
