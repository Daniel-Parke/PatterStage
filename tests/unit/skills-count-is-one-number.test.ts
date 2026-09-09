/** @jest-environment node */

// ═══════════════════════════════════════════════════════════════
// One skills number on the Agents page, not two that disagree.
//
// The page renders both. app/agent/profiles/page.tsx draws
// AgentProfilesOverview (which contains AgentPerformanceStrip, and its
// "{a.skills} skills" comes from /api/stats via lib/stats/agent-stats.ts)
// twelve lines above AgentProfileList, whose "{profile.skillsCount} skills"
// comes from GET /api/agent/profiles via countProfileSkills.
//
// countProfileSkills was corrected to count the set the Skills page lists,
// the SQLite catalogue UNION the agent's skills tree, minus the effective
// denylist. agent-stats kept `countSkills() - disabled.length`, which is the
// arithmetic that correction removed: the catalogue alone as the ceiling, and
// a denylist full of disk-only keys taken off a base that never held them. On
// the install the finding came from, that renders 4 skills twelve lines above
// 78 skills, for the same agent, on the same screen. Consistently wrong became
// self-contradictory, so this file holds the two numbers against each other
// rather than against a constant.
//
// The second half is what the correction cost. countProfileSkills walks the
// skills tree, and the walk is profile-INDEPENDENT: skillsRootForProfile()
// takes no argument and always answers the default root. GET
// /api/agent/profiles called countProfileSkills once per profile, so P
// profiles bought P byte-identical recursive walks of one directory tree, plus
// P catalogue reads. The walk belongs above the loop.
// ═══════════════════════════════════════════════════════════════

// ── the leaves, mocked; the arithmetic and the loop under test are real ──

const mockListSkillKeys = jest.fn<string[], []>();
jest.mock("@/lib/skills-repository", () => ({
  listSkillKeys: () => mockListSkillKeys(),
}));

/** Records every walk of the skills tree, with the root it was handed. */
const mockDiskSkills = jest.fn<string[], [string]>();
jest.mock("@/modules/hermes/lib/skills-config", () => ({
  ...jest.requireActual("@/modules/hermes/lib/skills-config"),
  collectSkillDirectoryNames: (root: string) => mockDiskSkills(root),
}));

const SKILLS_ROOT = "/tmp/hermes/skills";
jest.mock("@/modules/hermes/lib/profile-paths", () => ({
  buildProfileHermesPathBundle: (slug: string) => ({
    soul: `/tmp/hermes/${slug}/SOUL.md`,
    agents: `/tmp/hermes/${slug}/AGENTS.md`,
    hermes: `/tmp/hermes/${slug}/HERMES.md`,
    userMemory: `/tmp/hermes/${slug}/memories/USER.md`,
    agentMemory: `/tmp/hermes/${slug}/memories/MEMORY.md`,
    config: `/tmp/hermes/${slug}/config.yaml`,
    skills: "/tmp/hermes/skills",
  }),
}));

// existsSync false everywhere keeps the denylist coming from the database
// rather than from a config.yaml this test does not have on disk.
jest.mock("fs", () => ({
  existsSync: () => false,
  readFileSync: () => "",
  readdirSync: () => [],
  statSync: () => ({ size: 0, mtime: new Date(0) }),
}));

/** The denylist per profile slug, as the database holds it. */
const denylists = new Map<string, string[]>();

interface Row {
  slug: string;
  displayName: string;
  description: string;
  personality: string;
  seedKey: string | null;
  syncedAt: string | null;
  syncError: string | null;
}
const rows = new Map<string, Row>();

jest.mock("@/lib/agent-root-repository", () => ({
  getAgentRoot: () => ({
    displayName: "Bob",
    description: "Main agent",
    personality: "technical",
    disabledSkillsJson: JSON.stringify(denylists.get("default") ?? []),
    platformToolsetsJson: "{}",
    syncedAt: null,
    syncError: null,
  }),
}));

jest.mock("@/modules/hermes/lib/profiles-repository", () => ({
  listProfiles: () => [...rows.values()],
  getProfile: (slug: string) => rows.get(slug) ?? null,
  getDisabledSkills: (slug: string) => denylists.get(slug) ?? [],
  hydratePlatformToolsetsForSlug: () => null,
  upsertProfile: jest.fn(),
  defaultConfigYaml: () => "",
}));

// The composition root, mocked the way agent-roster.test.ts mocks it, and
// bound to the REAL counter: core may not import the hermes module (ADR-0005),
// so the strip's number reaches it through here. The binding this stands in for
// is asserted against the real module at the bottom of this file.
jest.mock("@/lib/modules/server", () => ({
  SERVER_MODULES: [
    { id: "rec-room" }, // a module with no agents, and so no counter
    {
      id: "hermes",
      createAgentSkillsCounter: () =>
        (
          jest.requireActual(
            "@/modules/hermes/lib/profile-counts",
          ) as typeof import("@/modules/hermes/lib/profile-counts")
        ).createProfileSkillsCounter(),
    },
  ],
}));

// ── the stats half's own reads ───────────────────────────────────

// No `countSkills` here, and none in the module either: the repository's
// `SELECT COUNT(*) FROM skills` went with the arithmetic that used it. This
// file first ran red with that mock in place, so the failure it measured was
// the real old sum (4 against the card's 78) rather than a missing export.
jest.mock("@/lib/stats/agent-stats-repository", () => ({
  readRunProfileRows: () => [
    {
      profile_name: null,
      status: "completed",
      usage_json: null,
      submitted_at: "2026-09-01T00:00:00.000Z",
      completed_at: "2026-09-01T00:00:04.000Z",
    },
  ],
  readMissionStatusCountsByProfile: () => [],
  readAgentRootStatsRow: () => ({
    display_name: "Bob",
    personality: "technical",
    platform_toolsets: "{}",
  }),
  readAgentProfileStatsRows: () =>
    [...rows.values()].map((r) => ({
      slug: r.slug,
      display_name: r.displayName,
      personality: r.personality,
      platform_toolsets: "{}",
    })),
}));

// ── the route half's neighbours ──────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories are hoisted above imports
jest.mock("@/lib/db", () => require("../helpers/mocks").dbMock());
jest.mock("@/lib/audit-log", () => ({ appendAuditLine: jest.fn() }));
jest.mock("@/lib/analytics/record-event", () => ({ recordEvent: jest.fn() }));
jest.mock("@/modules/hermes/lib/profile-push", () => ({
  pushProfileToHermes: jest.fn(() => ({ success: true, slug: "", backupPath: null, error: null })),
}));
jest.mock("@/modules/hermes/lib/profile-drift", () => ({
  detectProfileDrift: () => ({ slug: "", drifted: false, fields: [], syncError: null }),
  detectRootDrift: () => ({ drifted: false, fields: [], syncError: null }),
}));
jest.mock("@/modules/hermes/lib/agent-file-store", () => ({
  isManagedKey: () => false,
  readManagedFileContent: () => null,
}));
jest.mock("@/lib/fs/path-security", () => ({
  requireSafeProfileName: (p: string | null) => ({ profile: p || "default" }),
}));

import { NextRequest } from "next/server";

import { getAgentPerformance } from "@/lib/stats/agent-stats";
import { countProfileSkills } from "@/modules/hermes/lib/profile-counts";

// ── fixtures: the shape of the install the finding came from ─────

/** The four rows the seed puts in SQLite. */
const CATALOGUE = ["code-review", "step-plan", "summarize", "web-research"];

/** Seventy-four more sitting in the agent's skills tree and nowhere else. */
const DISK = Array.from({ length: 74 }, (_, i) => `pack/skill-${String(i + 1).padStart(2, "0")}`);

/** 78, which is what the Skills page lists. */
const TOTAL = CATALOGUE.length + DISK.length;

function profile(slug: string, disabled: string[] = []): void {
  rows.set(slug, {
    slug,
    displayName: slug,
    description: "",
    personality: "technical",
    seedKey: null,
    syncedAt: null,
    syncError: null,
  });
  denylists.set(slug, disabled);
}

function install(defaultDisabled: string[] = []): void {
  mockListSkillKeys.mockReturnValue([...CATALOGUE]);
  mockDiskSkills.mockReturnValue([...DISK]);
  denylists.set("default", defaultDisabled);
}

function skillsOnStrip(slug: string): number {
  const agent = getAgentPerformance().find((a) => a.slug === slug);
  if (!agent) throw new Error(`no agent ${slug} on the strip`);
  return agent.skills;
}

beforeEach(() => {
  jest.clearAllMocks();
  rows.clear();
  denylists.clear();
});

describe("the strip and the card under it count the same skills", () => {
  it("the strip counts the disk tree too, and agrees with the card", () => {
    install();

    expect(skillsOnStrip("default")).toBe(countProfileSkills("default"));
    expect(skillsOnStrip("default")).toBe(TOTAL);
  });

  it("four disk skills switched off take four off both numbers", () => {
    // The symptom at the size that made it visible: the strip read 0 skills
    // with 74 still enabled, because each disk key came off a base of 4.
    install(DISK.slice(0, 4));

    expect(skillsOnStrip("default")).toBe(countProfileSkills("default"));
    expect(skillsOnStrip("default")).toBe(TOTAL - 4);
  });

  it("agrees on a named profile, from that profile's own denylist", () => {
    install();
    profile("baseline", [DISK[0], CATALOGUE[0]]);

    expect(skillsOnStrip("baseline")).toBe(countProfileSkills("baseline"));
    expect(skillsOnStrip("baseline")).toBe(TOTAL - 2);
  });

  it("GREEN CONTROL: an install with no skills at all counts zero on the strip", () => {
    mockListSkillKeys.mockReturnValue([]);
    mockDiskSkills.mockReturnValue([]);
    denylists.set("default", []);

    expect(skillsOnStrip("default")).toBe(0);
  });
});

describe("GET /api/agent/profiles walks the skills tree once, not once per profile", () => {
  async function listProfilesOverHttp(): Promise<Array<{ id: string; skillsCount: number }>> {
    const { GET } = await import("@/app/api/agent/profiles/route");
    const res = await GET(new NextRequest("http://127.0.0.1/api/agent/profiles"));
    const body = (await res.json()) as { data: { profiles: Array<{ id: string; skillsCount: number }> } };
    expect(res.status).toBe(200);
    return body.data.profiles;
  }

  it("reads the catalogue once for five profiles", async () => {
    install();
    profile("alpha");
    profile("beta");
    profile("gamma");
    profile("delta");

    const listed = await listProfilesOverHttp();

    expect(listed).toHaveLength(5);
    // The walk does not depend on the profile, so five profiles must not buy
    // five walks of the same tree.
    expect(mockDiskSkills).toHaveBeenCalledTimes(1);
    expect(mockDiskSkills).toHaveBeenCalledWith(SKILLS_ROOT);
    expect(mockListSkillKeys).toHaveBeenCalledTimes(1);
  });

  it("CORRECTNESS CONTROL: the hoist does not hand every profile the same answer", async () => {
    install([CATALOGUE[0]]);
    profile("alpha", [DISK[0], DISK[1]]);
    profile("beta");

    const listed = await listProfilesOverHttp();
    const countFor = (id: string) => listed.find((p) => p.id === id)?.skillsCount;

    expect(countFor("default")).toBe(TOTAL - 1);
    expect(countFor("alpha")).toBe(TOTAL - 2);
    expect(countFor("beta")).toBe(TOTAL);
  });
});

describe("the wiring the mocked composition root stands in for", () => {
  it("the hermes module hands core the same counter the cards use", async () => {
    install();

    const { hermesServerModule } = await import("@/modules/hermes/server");
    const count = hermesServerModule.createAgentSkillsCounter?.();

    // Not just "a function is bound": the same install must give the same
    // answer through the seam as it does through the card's own call.
    expect(count?.("default")).toBe(countProfileSkills("default"));
    expect(count?.("default")).toBe(TOTAL);
  });
});
