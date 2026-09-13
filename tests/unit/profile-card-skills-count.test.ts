/** @jest-environment node */

// ═══════════════════════════════════════════════════════════════
// The "N skills" on a profile card must be the skills that profile can use.
//
// Real-agent finding: a card read "4 skills" on an install whose Skills page
// listed 78, all of them enabled. `countProfileSkills` answered
// `countSkills() - disabled.length`, and `countSkills()` counts the SQLite
// catalogue only. The Skills page lists the catalogue UNION the skills on
// disk, so on this install the base was 4 while the truth was 78.
//
// The second half is worse than the size of the error. Every key an operator
// switches off goes on the profile's denylist, including the 74 that were
// never in the base, so four toggles on the Skills page drove the card to
// "0 skills" while 74 stayed enabled, and switching them back on left it
// pinned at zero until the denylist fell below four. The number moved against
// the thing its label names.
//
// The contract: the card's number is the number of skills enabled for that
// profile, which is |catalogue ∪ disk| minus the effective denylist. That is
// the same arithmetic GET /api/skills does for its `enabled` flag, so the card
// and the page it links to cannot disagree.
// ═══════════════════════════════════════════════════════════════

// ── the leaves, mocked; the arithmetic under test is real ────────

const mockCountSkills = jest.fn<number, []>();
const mockListSkillKeys = jest.fn<string[], []>();
jest.mock("@/lib/skills/skills-repository", () => ({
  countSkills: () => mockCountSkills(),
  listSkillKeys: () => mockListSkillKeys(),
}));

const mockGetAgentRoot = jest.fn<{ disabledSkillsJson: string }, []>();
jest.mock("@/lib/agents/agent-root-repository", () => ({
  getAgentRoot: () => mockGetAgentRoot(),
}));

const mockGetProfile = jest.fn<{ slug: string; disabledSkillsJson: string } | null, [string]>();
const mockGetDisabledSkills = jest.fn<string[], [string]>();
jest.mock("@/modules/hermes/lib/profiles-repository", () => ({
  getProfile: (slug: string) => mockGetProfile(slug),
  getDisabledSkills: (slug: string) => mockGetDisabledSkills(slug),
  hydratePlatformToolsetsForSlug: jest.fn(() => null),
}));

const mockDiskSkills = jest.fn<string[], []>();
jest.mock("@/modules/hermes/lib/skills-config", () => ({
  ...jest.requireActual("@/modules/hermes/lib/skills-config"),
  collectSkillDirectoryNames: () => mockDiskSkills(),
  skillsRootForProfile: () => "/tmp/hermes/skills",
}));

jest.mock("@/modules/hermes/lib/profile-paths", () => ({
  buildProfileHermesPathBundle: () => ({
    config: "/tmp/hermes/config.yaml",
    skills: "/tmp/hermes/skills",
  }),
}));

// existsSync false everywhere keeps the denylist coming from the database
// rather than from a YAML file this test does not have on disk.
jest.mock("fs", () => ({
  existsSync: () => false,
  readFileSync: () => "",
  readdirSync: () => [],
  statSync: () => ({ size: 0, mtime: new Date(0) }),
}));

import { countProfileSkills } from "@/modules/hermes/lib/profile-counts";

// ── fixtures: the shape of the install the finding came from ─────

/** The four rows the seed puts in SQLite. */
const CATALOGUE = ["code-review", "step-plan", "summarize", "web-research"];

/** Seventy-four more sitting in the agent's skills tree and nowhere else. */
const DISK = Array.from({ length: 74 }, (_, i) => `pack/skill-${String(i + 1).padStart(2, "0")}`);

const TOTAL = CATALOGUE.length + DISK.length; // 78, which is what the Skills page lists

function install(disabled: string[] = []) {
  mockCountSkills.mockReturnValue(CATALOGUE.length);
  mockListSkillKeys.mockReturnValue([...CATALOGUE]);
  mockDiskSkills.mockReturnValue([...DISK]);
  mockGetAgentRoot.mockReturnValue({ disabledSkillsJson: JSON.stringify(disabled) });
  mockGetProfile.mockImplementation((slug: string) =>
    slug === "baseline" ? { slug, disabledSkillsJson: JSON.stringify(disabled) } : null,
  );
  mockGetDisabledSkills.mockReturnValue(disabled);
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("the profile card counts the skills the profile can use", () => {
  it("counts the disk tree as well as the catalogue", () => {
    install();

    expect(countProfileSkills("default")).toBe(TOTAL);
  });

  it("subtracts exactly one for one skill switched off", () => {
    install([CATALOGUE[0]]);

    expect(countProfileSkills("default")).toBe(TOTAL - 1);
  });

  it("does not fall to zero when four disk skills are switched off", () => {
    // The reported symptom, at the size that made it visible: four toggles on
    // the Skills page and the card read "0 skills" with 74 still enabled.
    install(DISK.slice(0, 4));

    expect(countProfileSkills("default")).toBe(TOTAL - 4);
  });

  it("moves back up when a skill is switched on again", () => {
    install(DISK.slice(0, 6));
    const off = countProfileSkills("default");

    install(DISK.slice(0, 5));

    expect(countProfileSkills("default")).toBe(off + 1);
  });

  it("counts a named profile from its own denylist", () => {
    install([DISK[0], DISK[1]]);

    expect(countProfileSkills("baseline")).toBe(TOTAL - 2);
  });

  it("GREEN CONTROL: a profile with no row counts nothing", () => {
    install();

    expect(countProfileSkills("no-such-profile")).toBe(0);
  });

  it("GREEN CONTROL: an install with no skills at all counts zero", () => {
    mockCountSkills.mockReturnValue(0);
    mockListSkillKeys.mockReturnValue([]);
    mockDiskSkills.mockReturnValue([]);
    mockGetAgentRoot.mockReturnValue({ disabledSkillsJson: "[]" });

    expect(countProfileSkills("default")).toBe(0);
  });
});
