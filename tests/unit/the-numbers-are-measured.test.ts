/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports -- better-sqlite3's package root is not newable under the jest transform; same construction as agent-progression-immutability.test.ts */

// T-0081 acceptance oracle, behavioural half. Its sibling
// `the-numbers-stop-lying.test.ts` proves no meta key is an orphan; this proves
// the numbers actually move, which is the part a source scan cannot reach.
//
// Every test here is one of the five causes behind two QA findings:
//
//   /api/status   reports skillsCount and sessionsCount from a meta table
//                 nothing writes. The existing test mocked the getter and
//                 asserted the echo -- proving the plumbing while the tap was
//                 dry (the T-0075 class).
//   RC-A          progression is captured only inside GET /api/stats, so an
//                 API-driven pass never captures and the reader returns rows
//                 that were never written.
//   RC-C          countAgentActiveDays matches `profile_name = ?`; a root-agent
//                 run stores NULL. Its sibling coalesces. So one run counts for
//                 XP and not for active days.
//   RC-D          the root agent is absent from /api/agents/experience, which
//                 lists profiles only -- and it is the agent a default install
//                 actually uses.
//   runsCompleted counts every run whatever its status, under a name and a UI
//                 label that both say "completed".

import { join } from "path";

import { execBaselineSchema } from "../helpers/baseline-db";
import { applyAgentProgressionMigration } from "@/lib/db/apply-agent-progression-migration";

let testDb: import("better-sqlite3").Database | null = null;

jest.mock("@/lib/db", () => ({
  getDb: () => testDb!,
  inTransaction: <T,>(fn: () => T) => testDb!.transaction(fn)(),
  ensureDb: () => undefined,
  uuid: () => `id-${Math.random().toString(36).slice(2)}`,
  now: () => new Date().toISOString(),
}));

const mockCountSkills = jest.fn();
jest.mock("@/lib/skills-repository", () => ({
  countSkills: () => mockCountSkills(),
}));

const mockListSessions = jest.fn();
jest.mock("@/lib/sessions/session-repository", () => ({
  listSessions: (...a: unknown[]) => mockListSessions(...a),
}));

jest.mock("@/lib/sync", () => ({ ensureSyncLayer: jest.fn() }));
jest.mock("@/lib/api-logger", () => ({
  logApiError: jest.fn(),
  serverErrorFromCatch: jest.requireActual("@/lib/api-logger").serverErrorFromCatch,
}));

const mockGetDashboardStats = jest.fn();
jest.mock("@/lib/stats/stats-repository", () => ({
  getDashboardStats: () => mockGetDashboardStats(),
}));

const mockListProfiles = jest.fn();
jest.mock("@/modules/hermes/lib/profiles-repository", () => ({
  listProfiles: () => mockListProfiles(),
}));

const mockGetAgentPerformance = jest.fn();
jest.mock("@/lib/stats/agent-stats", () => ({
  getAgentPerformance: () => mockGetAgentPerformance(),
}));

import { GET as statusGet } from "@/app/api/status/route";
import { GET as progressionGet } from "@/app/api/agents/progression/route";
import { GET as experienceGet } from "@/app/api/agents/experience/route";
import { countAgentActiveDays } from "@/lib/stats/agent-stats-repository";
import { agentExperienceFromPerformance } from "@/lib/stats/agent-experience";
import { profileOptionsFor } from "@/components/composer/profile-options";
import { AGENT_PROGRESSION_COMPUTATION_VERSION } from "@/lib/stats/agent-progression";
import type { AgentPerformance } from "@/lib/stats/agent-stats";

const migrationsDir = join(process.cwd(), "src", "lib", "db", "migrations");

function perf(over: Partial<AgentPerformance> = {}): AgentPerformance {
  return {
    slug: "default",
    name: "Bob",
    runs: 5,
    runsCompleted: 3,
    missionsCompleted: 1,
    missionsFailed: 0,
    totalTokens: 1_000,
    avgDurationSec: 4,
    skills: 2,
    toolsets: 1,
    ...over,
  } as AgentPerformance;
}

beforeEach(() => {
  // Same construction as agent-progression-immutability.test.ts: the package
  // root is not directly newable under the jest transform.
  const Database = require("better-sqlite3/lib/index.js") as typeof import("better-sqlite3");
  testDb = new (Database as unknown as new (path: string) => import("better-sqlite3").Database)(
    ":memory:",
  );
  execBaselineSchema(testDb);
  applyAgentProgressionMigration(testDb, migrationsDir);
  jest.clearAllMocks();
  mockCountSkills.mockReturnValue(0);
  mockListSessions.mockReturnValue({ sessions: [], total: 0, totals: {} });
});

afterEach(() => {
  testDb?.close();
  testDb = null;
});

async function bodyOf(res: { json: () => Promise<unknown> }) {
  return (await res.json()) as { data?: Record<string, unknown> };
}

describe("/api/status counts what is there, rather than a default", () => {
  it("reports the skills that actually exist", async () => {
    // The reported symptom: 40 skills installed, skillsCount: 0 forever,
    // because the key it read has no writer anywhere in the product.
    mockCountSkills.mockReturnValue(40);

    const body = await bodyOf(await statusGet());

    expect(body.data?.skillsCount).toBe(40);
  });

  it("reports the sessions that actually exist", async () => {
    mockListSessions.mockReturnValue({ sessions: [], total: 17, totals: {} });

    const body = await bodyOf(await statusGet());

    expect(body.data?.sessionsCount).toBe(17);
  });

  it("asks the repositories, not the meta table", async () => {
    // The assertion that distinguishes a fix from a coincidence. A route that
    // still read the meta key would pass the two tests above the moment
    // something started writing it -- and would go back to zero the moment that
    // writer moved. The count has to be measured on the read.
    await statusGet();

    expect(mockCountSkills).toHaveBeenCalled();
    expect(mockListSessions).toHaveBeenCalled();
  });

  it("GREEN CONTROL: zero really is zero on a fresh install", async () => {
    const body = await bodyOf(await statusGet());

    expect(body.data?.skillsCount).toBe(0);
    expect(body.data?.sessionsCount).toBe(0);
  });

  it("GREEN CONTROL: the meta-backed fields are untouched", async () => {
    // soulFile, configFile and memorySize are legitimately synced. This change
    // is about the two keys nobody wrote, not about abandoning the meta table.
    const body = await bodyOf(await statusGet());

    expect(body.data).toHaveProperty("soulFile");
    expect(body.data).toHaveProperty("configFile");
    expect(body.data).toHaveProperty("memorySize");
  });
});

describe("RC-A: reading progression captures it, so an API-only pass is not blind", () => {
  beforeEach(() => {
    mockGetDashboardStats.mockReturnValue({
      agents: [perf({ slug: "scout", name: "Scout" })],
      achievements: [],
    });
  });

  it("writes a snapshot for an agent that has never been captured", async () => {
    // The reported asymmetry: spend read live and progression read stored rows,
    // and nothing had ever written one because nobody had opened the dashboard.
    const body = (await (await progressionGet(
      { nextUrl: { searchParams: new URLSearchParams() } } as never,
    )).json()) as { data?: { snapshots?: { profileSlug: string }[] } };

    expect(body.data?.snapshots?.map((s) => s.profileSlug)).toContain("scout");
  });

  it("does not write a second row when nothing has moved", async () => {
    // The capture is a correction, not a heartbeat. Making the READER write
    // must not turn an append-only ledger into a poll log.
    const req = { nextUrl: { searchParams: new URLSearchParams() } } as never;
    await progressionGet(req);
    await progressionGet(req);
    await progressionGet(req);

    const rows = testDb!
      .prepare("SELECT COUNT(*) AS n FROM agent_progression_snapshots WHERE profile_slug = 'scout'")
      .get() as { n: number };

    expect(rows.n).toBe(1);
  });

  it("still answers when the capture fails", async () => {
    // A read must not become unavailable because a write it does on the side
    // could not happen. The stored rows are the answer; the capture is a
    // courtesy.
    mockGetDashboardStats.mockImplementation(() => {
      throw new Error("stats unavailable");
    });

    const res = await progressionGet({
      nextUrl: { searchParams: new URLSearchParams() },
    } as never);

    expect(res.status).toBe(200);
  });
});

describe("RC-C: a root-agent run counts for active days too", () => {
  it("counts runs whose profile_name is NULL as the default agent's", () => {
    // runsByProfile coalesces NULL to "default" and this did not, so the SAME
    // run earned XP and contributed no active day. The two numbers on one
    // dashboard panel disagreed about whether the run happened.
    testDb!
      .prepare(
        `INSERT INTO runs (id, mission_id, status, profile_name, submitted_at, completed_at)
         VALUES ('r1', NULL, 'completed', NULL, '2026-08-30T10:00:00Z', '2026-08-30T10:01:00Z')`,
      )
      .run();

    expect(countAgentActiveDays("default")).toBe(1);
  });

  it("GREEN CONTROL: a named profile still counts only its own", () => {
    testDb!
      .prepare(
        `INSERT INTO runs (id, mission_id, status, profile_name, submitted_at, completed_at)
         VALUES ('r2', NULL, 'completed', 'scout', '2026-08-30T10:00:00Z', '2026-08-30T10:01:00Z')`,
      )
      .run();

    expect(countAgentActiveDays("scout")).toBe(1);
    expect(countAgentActiveDays("default")).toBe(0);
  });

  it("a run that FAILED is not an active day, even though it finished", () => {
    // Mutation found the gap: the existing control used a run with no
    // completed_at, and COUNT(DISTINCT date(NULL)) is 0 whether or not the
    // status filter is there -- so dropping the filter changed nothing and the
    // control proved nothing. A failed run DOES carry a completed_at, and it is
    // not a day the agent completed work.
    testDb!
      .prepare(
        `INSERT INTO runs (id, mission_id, status, profile_name, submitted_at, completed_at)
         VALUES ('rf', NULL, 'failed', NULL, '2026-08-30T10:00:00Z', '2026-08-30T10:01:00Z')`,
      )
      .run();

    expect(countAgentActiveDays("default")).toBe(0);
  });

  it("GREEN CONTROL: an unfinished run is not an active day", () => {
    testDb!
      .prepare(
        `INSERT INTO runs (id, mission_id, status, profile_name, submitted_at)
         VALUES ('r3', NULL, 'started', NULL, '2026-08-30T10:00:00Z')`,
      )
      .run();

    expect(countAgentActiveDays("default")).toBe(0);
  });
});

describe("RC-D: the agent a default install uses is on the experience board", () => {
  it("includes the root agent, not only named profiles", async () => {
    mockListProfiles.mockReturnValue([{ slug: "scout", displayName: "Scout" }]);
    mockGetAgentPerformance.mockReturnValue([
      perf({ slug: "default", name: "Bob" }),
      perf({ slug: "scout", name: "Scout" }),
    ]);

    const body = (await (await experienceGet()).json()) as {
      data?: { entries?: { targetRef: string }[] };
    };

    expect(body.data?.entries?.map((e) => e.targetRef)).toContain("default");
  });

  it("GREEN CONTROL: named profiles are still there, still ranked", async () => {
    mockListProfiles.mockReturnValue([{ slug: "scout", displayName: "Scout" }]);
    mockGetAgentPerformance.mockReturnValue([
      perf({ slug: "default", name: "Bob", runsCompleted: 1 }),
      perf({ slug: "scout", name: "Scout", runsCompleted: 90 }),
    ]);

    const body = (await (await experienceGet()).json()) as {
      data?: { entries?: { targetRef: string; rank: number }[] };
    };

    expect(body.data?.entries?.[0]?.targetRef).toBe("scout");
    expect(body.data?.entries?.[0]?.rank).toBe(1);
  });

  it("does not list the root agent twice when a profile is also named default", async () => {
    mockListProfiles.mockReturnValue([{ slug: "default", displayName: "Bob" }]);
    mockGetAgentPerformance.mockReturnValue([perf({ slug: "default", name: "Bob" })]);

    const body = (await (await experienceGet()).json()) as {
      data?: { entries?: { targetRef: string }[] };
    };

    expect(body.data?.entries?.filter((e) => e.targetRef === "default")).toHaveLength(1);
  });
});

describe("runsCompleted counts completed runs", () => {
  it("does not count a run that failed", () => {
    // The field is named runsCompleted and the panel labels it "Runs
    // completed". Counting every status under that name is a claim the data
    // does not support -- and it disagrees with activeDays, which has always
    // filtered on completion.
    const xp = agentExperienceFromPerformance(perf({ runs: 10, runsCompleted: 3 }));

    expect(xp.signals.runsCompleted).toBe(3);
  });

  it("GREEN CONTROL: an agent whose runs all completed is unchanged", () => {
    const xp = agentExperienceFromPerformance(perf({ runs: 4, runsCompleted: 4 }));

    expect(xp.signals.runsCompleted).toBe(4);
  });
});

describe("RC-B: the Composer picker sends a slug", () => {
  const PROFILES = [
    { id: "default", name: "Bob (local default)", description: "", isDefault: true },
    { id: "scout", name: "Scout", description: "" },
  ];

  it("uses the profile id as the value, not its display name", () => {
    // A run launched under "Bob (local default)" stored that string in
    // runs.profile_name, where every per-agent aggregate looks for a slug. The
    // run was not mis-attributed; it was attributed to nobody and dropped.
    const options = profileOptionsFor(PROFILES);

    expect(options.find((o) => o.label.includes("Bob"))?.value).toBe("default");
    expect(options.find((o) => o.label === "Scout")?.value).toBe("scout");
  });

  it("never offers a value with a space in it", () => {
    // The shape of the bug, stated as a property. Slugs do not contain spaces;
    // display names routinely do.
    for (const option of profileOptionsFor(PROFILES)) {
      expect(option.value).not.toMatch(/\s/);
    }
  });

  it("GREEN CONTROL: the labels stay human", () => {
    // The point is not to show operators slugs. They pick a name and the
    // product sends the identifier.
    expect(profileOptionsFor(PROFILES).map((o) => o.label)).toContain("Bob (local default)");
  });

  it("GREEN CONTROL: the empty default-profile option is still first", () => {
    const options = profileOptionsFor(PROFILES);

    expect(options[0]?.value).toBe("");
  });

  it("survives an empty or missing profile list", () => {
    expect(profileOptionsFor([])).toHaveLength(1);
    expect(profileOptionsFor(undefined)).toHaveLength(1);
  });
});

describe("the aggregate that PRODUCES runsCompleted counts correctly", () => {
  // Mutation found this gap. Every test above hands `runsCompleted` in on a
  // fixture, so `runsByProfile` -- the function that derives it from the runs
  // table -- was measured by nobody. Deleting its status check entirely
  // changed no result. This drives the real aggregation against real rows.
  //
  // agent-stats is mocked at the top of this file for the route tests, so the
  // real implementation is pulled in explicitly here.
  const { getAgentPerformance: realGetAgentPerformance } = jest.requireActual(
    "@/lib/stats/agent-stats",
  ) as typeof import("@/lib/stats/agent-stats");

  function seedRoot(): void {
    // The baseline schema already seeds the singleton root row, so this only
    // has to name it. OR IGNORE rather than an INSERT, because the row being
    // there is the normal case and this test is not about creating it.
    testDb!
      .prepare("INSERT OR IGNORE INTO agent_root (id, display_name) VALUES (1, 'Bob')")
      .run();
  }

  function seedRun(id: string, status: string, profile: string | null): void {
    testDb!
      .prepare(
        `INSERT INTO runs (id, mission_id, status, profile_name, submitted_at, completed_at)
         VALUES (?, NULL, ?, ?, '2026-08-30T10:00:00Z', '2026-08-30T10:01:00Z')`,
      )
      .run(id, status, profile);
  }

  it("separates runs from runs that completed", () => {
    seedRoot();
    seedRun("a", "completed", null);
    seedRun("b", "failed", null);
    seedRun("c", "cancelled", null);

    const root = realGetAgentPerformance().find((p) => p.slug === "default");

    expect(root?.runs).toBe(3);
    expect(root?.runsCompleted).toBe(1);
  });

  it("counts nothing as completed when nothing completed", () => {
    seedRoot();
    seedRun("a", "failed", null);
    seedRun("b", "started", null);

    expect(realGetAgentPerformance().find((p) => p.slug === "default")?.runsCompleted).toBe(0);
  });

  it("GREEN CONTROL: an agent whose runs all completed reports both the same", () => {
    seedRoot();
    seedRun("a", "completed", null);
    seedRun("b", "completed", null);

    const root = realGetAgentPerformance().find((p) => p.slug === "default");

    expect(root?.runs).toBe(2);
    expect(root?.runsCompleted).toBe(2);
  });

  it("attributes a NULL profile to the root agent, as it always has", () => {
    // The coalescing half of RC-C, on the aggregate side. Stated here as well
    // as on countAgentActiveDays because the whole defect was the two
    // disagreeing.
    seedRoot();
    seedRun("a", "completed", null);
    seedRun("b", "completed", "scout");

    expect(realGetAgentPerformance().find((p) => p.slug === "default")?.runs).toBe(1);
  });
});

describe("the formula version moved when the formula did", () => {
  it("is at least 2, because runsCompleted changed meaning", () => {
    // Mutation found that nothing pinned the bump: the immutability test
    // asserts a ROW carries the version in force, which stays true whatever
    // that version is. This is the other half -- T-0081 changed what
    // runsCompleted and activeDays measure, so the stored answer moves for
    // unchanged history, and reverting the number while keeping the formula
    // change would make two incomparable rows look comparable. That is the one
    // thing this field exists to prevent.
    expect(AGENT_PROGRESSION_COMPUTATION_VERSION).toBeGreaterThanOrEqual(2);
  });
});
