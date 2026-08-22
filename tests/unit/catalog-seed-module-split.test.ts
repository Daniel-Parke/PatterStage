/** @jest-environment node */
// ═══════════════════════════════════════════════════════════════
// The seed has two owners, and core orchestrates without naming either.
//
// catalog-seed used to seed PatterStage's OWN catalogs (mission categories,
// skills, tool bundles, memory facts, template packs) AND agent_profiles /
// agent_root AND push the result to the agent's filesystem, all in one 566-line
// file. The agent-shaped half moved to the hermes module; core kept the
// orchestration, the once-only meta flag and the recorded state.
//
// The property that matters is that a build with NO agent module still seeds the
// core catalogs and reports zero for the rest. That is the correct answer, not a
// failure, and it is the case nobody would notice breaking.
// ═══════════════════════════════════════════════════════════════

const mockSeedAgentCatalog = jest.fn();
const mockPublishSkill = jest.fn();
let modules: unknown[] = [];

jest.mock("@/lib/modules/server", () => ({
  get SERVER_MODULES() {
    return modules;
  },
}));

const mockUpsertSkill = jest.fn();
jest.mock("@/lib/skills-repository", () => ({
  upsertSkill: (...a: unknown[]) => mockUpsertSkill(...a),
  getSkill: jest.fn(() => null),
}));

jest.mock("@/lib/catalog-template-repository", () => ({
  upsertCatalogTemplate: jest.fn(),
  getCatalogTemplate: jest.fn(() => null),
}));
jest.mock("@/lib/tool-catalog-repository", () => ({
  upsertToolBundle: jest.fn(),
  getToolBundle: jest.fn(() => null),
}));
jest.mock("@/lib/memory/memory-catalog-repository", () => ({ upsertMemoryFact: jest.fn() }));
jest.mock("@/lib/db", () => ({
  ensureDb: jest.fn(),
  getDb: jest.fn(() => ({
    exec: jest.fn(),
    prepare: jest.fn(() => ({ get: () => ({ c: 0 }), run: jest.fn(), all: () => [] })),
  })),
}));
jest.mock("@/lib/fs/fs-helpers", () => ({ ensureDir: jest.fn() }));
jest.mock("fs", () => {
  const actual = jest.requireActual("fs");
  return { ...actual, writeFileSync: jest.fn() };
});

import { runCatalogSeed } from "@/lib/seed/catalog-seed";

const withAgentModule = () => [
  { id: "rec-room" }, // supplies neither capability
  {
    id: "hermes",
    seedAgentCatalog: (...a: unknown[]) => mockSeedAgentCatalog(...a),
    publishSkill: (...a: unknown[]) => mockPublishSkill(...a),
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  modules = withAgentModule();
  mockSeedAgentCatalog.mockReturnValue({ root: 1, profiles: 6, pushed: 7 });
});

describe("runCatalogSeed delegates the agent half", () => {
  it("passes the target, slug and mode straight through", () => {
    runCatalogSeed({ target: "profiles", slug: "qa", mode: "merge", confirmOverride: true });

    expect(mockSeedAgentCatalog).toHaveBeenCalledWith({
      target: "profiles",
      slug: "qa",
      mode: "merge",
      confirmOverride: true,
    });
  });

  it("aggregates the module's counts into its own result", () => {
    const r = runCatalogSeed({ target: "all", mode: "replace" });

    expect(r.root).toBe(1);
    expect(r.profiles).toBe(6);
    expect(r.pushed).toBe(7);
  });

  it("narrows a core-only target to 'other' so the module can skip its own work", () => {
    // `--target templates` must not seed profiles, but a slug supplied alongside
    // it still reaches the module: that is how one profile gets repaired.
    runCatalogSeed({ target: "templates", mode: "merge" });

    expect(mockSeedAgentCatalog).toHaveBeenCalledWith(
      expect.objectContaining({ target: "other" }),
    );
  });

  it("still seeds the core catalogs and reports zero when NO module supplies the capability", () => {
    // The case nobody would notice breaking: a PatterStage install with no agent
    // framework. Seeding must not throw and must not claim work it did not do.
    modules = [{ id: "rec-room" }];

    const r = runCatalogSeed({ target: "all", mode: "merge" });

    expect(r.root).toBe(0);
    expect(r.profiles).toBe(0);
    expect(r.pushed).toBe(0);
    // Core's own half still ran.
    expect(r).toHaveProperty("templates");
    expect(r).toHaveProperty("categories");
  });

  it("publishes each seeded skill through the module, not by importing it", () => {
    runCatalogSeed({ target: "skills", mode: "replace" });

    // Every skill the core repository accepted is offered to the module.
    expect(mockPublishSkill.mock.calls.length).toBe(mockUpsertSkill.mock.calls.length);
  });

  it("survives a module whose publish throws, because a missing agent is not a seed failure", () => {
    // The module guards this itself, but core guards it too: this runs on the
    // boot path via ensureCatalogSeededOnce, and core must not depend on every
    // module remembering to be best-effort. The pre-split code had the same
    // try/catch at this call site, and the split briefly lost it.
    mockPublishSkill.mockImplementation(() => {
      throw new Error("agent not installed");
    });
    expect(() => runCatalogSeed({ target: "skills", mode: "replace" })).not.toThrow();
  });

  it("keeps the core catalogs when a module's own seed throws", () => {
    // One faulty module must not discard work core already did, nor kill boot.
    mockSeedAgentCatalog.mockImplementation(() => {
      throw new Error("agent_profiles is locked");
    });

    const r = runCatalogSeed({ target: "all", mode: "merge" });

    expect(r.root).toBe(0);
    expect(r.profiles).toBe(0);
    expect(r).toHaveProperty("categories");
  });
});
