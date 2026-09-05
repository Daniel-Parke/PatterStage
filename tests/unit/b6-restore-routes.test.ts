/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports -- two modules the contract creates are read lazily so a missing one reds its tests, not the suite */
// ═══════════════════════════════════════════════════════════════
// B6 oracle, group restore (T-0100), the server half.
//
// Written before the product code moved. Contract section 6 (Restore), the
// route and helper lines:
//
//   * readShippedPackCounts(): the pack the app ships, read from disk only
//     (7 profiles, 12 templates, 8 categories, 4 skills, 5 tool bundles, 5
//     memory facts, Bob), a missing file counting 0, never throwing, never
//     touching getDb;
//   * GET /api/seed answers { state, pack };
//   * POST /api/seed refuses under read-only first; a replace snapshots the
//     database ('pre-restore') BEFORE the Hermes import and the seed, a merge
//     never does; a snapshot that fails answers 500 "Refused: …" and runs
//     nothing; the answer carries { ...result, imported, backup }; an audit
//     line seed.restore names target/mode[/slug|/templateId];
//   * POST /api/seed/clean snapshots ('pre-clean') before cleanDevData and
//     refuses the same way; the answer is { removed, counts, backup };
//   * describeRestoreResult(target, mode, result, name?) is the one sentence
//     the page and the toast both say.
//
// The reds here are the implementation's to-do list. The doubles are the
// same ones tests/unit/seed-api.test.ts uses, plus the two the contract adds
// (api-auth.requireNotReadOnly, catalog-seed.readShippedPackCounts) and the
// backup helper.
//
// THE BACKUP HELPER DOES NOT EXIST YET. `jest.mock("@/lib/db/backup")` would
// throw at registration today, because moduleNameMapper insists a mapped name
// resolves. The mock is therefore keyed on the module's ABSOLUTE .ts path with
// `virtual: true`: jest accepts that today, and once src/lib/db/backup.ts
// exists the mapped import resolves to that same path and takes the mock.
// (Verified against an existing module before this file was written.)
//
// Type-tolerance: `readShippedPackCounts` and `describeRestoreResult` are read
// through loose casts, as tests/unit/b5-first-run-and-active-days.test.ts does,
// so the tests tsconfig does not red on the shapes before they exist.
// ═══════════════════════════════════════════════════════════════

import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

// ── doubles ──────────────────────────────────────────────────

const mockRequireNotReadOnly = jest.fn((..._a: unknown[]): unknown => null);
jest.mock("@/lib/api-auth", () => ({
  requireNotReadOnly: (...a: unknown[]) => mockRequireNotReadOnly(...a),
}));

const mockAppendAuditLine = jest.fn();
jest.mock("@/lib/audit-log", () => ({
  appendAuditLine: (...a: unknown[]) => mockAppendAuditLine(...a),
}));

const mockImportHermesState = jest.fn((..._a: unknown[]): unknown => ({
  root: { success: true, slug: "default", backupPath: null, error: null },
  skills: [],
  profiles: [],
}));
jest.mock("@/modules/hermes/lib/state-import", () => ({
  importHermesStateFromDisk: (...a: unknown[]) => mockImportHermesState(...a),
}));

const mockHermesHome = mkdtempSync(join(tmpdir(), "ps-b6-restore-home-"));
jest.mock("@/modules/hermes/lib/home", () => ({
  getHermesHome: () => mockHermesHome,
}));

const SEED_RESULT = {
  root: 1,
  profiles: 7,
  templates: 12,
  categories: 8,
  skills: 4,
  tools: 5,
  memories: 5,
  pushed: 8,
};
const mockRunCatalogSeed = jest.fn((..._a: unknown[]) => ({ ...SEED_RESULT }));
const mockGetSeedState = jest.fn((): unknown => ({ lastRun: "2026-09-01T00:00:00.000Z" }));
const PACK = {
  catalogVersion: "patterstage-professional-v1",
  root: 1,
  profiles: 7,
  templates: 12,
  categories: 8,
  skills: 4,
  tools: 5,
  memories: 5,
};
const mockReadShippedPackCounts = jest.fn(() => ({ ...PACK }));
jest.mock("@/lib/seed/catalog-seed", () => ({
  runCatalogSeed: (...a: unknown[]) => mockRunCatalogSeed(...a),
  getSeedState: () => mockGetSeedState(),
  readShippedPackCounts: () => mockReadShippedPackCounts(),
}));

const CLEAN_RESULT = {
  removed: {
    workflows: [{ id: "w1", label: "Testy" }, { id: "w2", label: "Test flow" }],
    stories: [{ id: "s1", label: "Untitled Story" }, { id: "s2", label: "Test Story 2026" }],
    missions: [{ id: "m1", label: "Test mission" }],
  },
  counts: { workflows: 2, stories: 2, missions: 1, total: 5 },
};
const mockCleanDevData = jest.fn(() => ({ ...CLEAN_RESULT }));
const mockPreviewDevDataCleanup = jest.fn(() => ({ ...CLEAN_RESULT.removed }));
jest.mock("@/lib/seed/clean-dev-data", () => ({
  cleanDevData: () => mockCleanDevData(),
  previewDevDataCleanup: () => mockPreviewDevDataCleanup(),
}));

const SNAPSHOT = {
  name: "patterstage.pre-restore.20260905T101500Z.db",
  path: "/home/me/patterstage/data/backups/db/patterstage.pre-restore.20260905T101500Z.db",
  bytes: 425984,
  takenAt: "2026-09-05T10:15:00.000Z",
  kind: "snapshot",
};
const mockSnapshotDatabase = jest.fn((..._a: unknown[]): Promise<unknown> => Promise.resolve({ ...SNAPSHOT }));
jest.mock(
  require("path").resolve(__dirname, "..", "..", "src", "lib", "db", "backup.ts"),
  () => ({
    snapshotDatabase: (...a: unknown[]) => mockSnapshotDatabase(...a),
  }),
  { virtual: true },
);

// For the REAL readShippedPackCounts (jest.requireActual below): the agent
// half is reached through the composition root, which this test never needs,
// and the repositories must load without a database.
jest.mock("@/lib/modules/server", () => ({ SERVER_MODULES: [] }));
jest.mock("@/lib/skills-repository", () => ({ upsertSkill: jest.fn(), getSkill: jest.fn(() => null) }));
jest.mock("@/lib/catalog-template-repository", () => ({
  upsertCatalogTemplate: jest.fn(),
  getCatalogTemplate: jest.fn(() => null),
}));
jest.mock("@/lib/tool-catalog-repository", () => ({
  upsertToolBundle: jest.fn(),
  getToolBundle: jest.fn(() => null),
}));
jest.mock("@/lib/memory/memory-catalog-repository", () => ({ upsertMemoryFact: jest.fn() }));

// ── pre-B6 type shims (see header) ───────────────────────────

interface PackCounts {
  catalogVersion: string;
  root: number;
  profiles: number;
  templates: number;
  categories: number;
  skills: number;
  tools: number;
  memories: number;
}

type CatalogSeedModule = typeof import("@/lib/seed/catalog-seed") & {
  readShippedPackCounts?: () => PackCounts;
};

/** The real module, mocks on its dependencies still in force. */
function actualCatalogSeed(): CatalogSeedModule {
  return jest.requireActual("@/lib/seed/catalog-seed") as CatalogSeedModule;
}

type RestoreResultInput = Record<string, unknown>;
type Describe = (target: string, mode: string, result: RestoreResultInput, name?: string) => string;

/** The helper the contract creates at src/lib/seed/describe-restore-result.ts. */
function describeRestoreResult(): Describe {
  const mod = require("@/lib/seed/describe-restore-result") as { describeRestoreResult?: Describe };
  if (typeof mod.describeRestoreResult !== "function") {
    throw new Error("describe-restore-result exports no describeRestoreResult function");
  }
  return mod.describeRestoreResult;
}

// ── helpers ──────────────────────────────────────────────────

async function postSeed(body: unknown) {
  const { POST } = await import("@/app/api/seed/route");
  const { NextRequest } = await import("next/server");
  const req = new NextRequest("http://localhost/api/seed", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
  const res = await POST(req);
  const json = (await res.json()) as { data?: Record<string, unknown>; error?: string };
  return { res, json };
}

async function postClean() {
  const { POST } = await import("@/app/api/seed/clean/route");
  const { NextRequest } = await import("next/server");
  const req = new NextRequest("http://localhost/api/seed/clean", { method: "POST" });
  const res = await POST(req);
  const json = (await res.json()) as { data?: Record<string, unknown>; error?: string };
  return { res, json };
}

function firstCall(fn: jest.Mock): number {
  return fn.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY;
}

const EM_DASH = "—";

let consoleError: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  mockRequireNotReadOnly.mockReturnValue(null);
  mockSnapshotDatabase.mockImplementation(() => Promise.resolve({ ...SNAPSHOT }));
  rmSync(mockHermesHome, { recursive: true, force: true });
  mkdirSync(mockHermesHome, { recursive: true });
  consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
});

afterAll(() => rmSync(mockHermesHome, { recursive: true, force: true }));

// ───────────────────────────────────────────────────────────────
// readShippedPackCounts
// ───────────────────────────────────────────────────────────────

describe("readShippedPackCounts reads the pack the app ships", () => {
  it("is exported from catalog-seed", () => {
    expect(typeof actualCatalogSeed().readShippedPackCounts).toBe("function");
  });

  it("counts Bob, 7 profiles, 12 templates, 8 categories, 4 skills, 5 tool bundles and 5 memory facts from data/seed", () => {
    const counts = actualCatalogSeed().readShippedPackCounts!();
    expect(counts).toEqual({
      catalogVersion: "patterstage-professional-v1",
      root: 1,
      profiles: 7,
      templates: 12,
      categories: 8,
      skills: 4,
      tools: 5,
      memories: 5,
    });
  });

  it("never opens the database", () => {
    const db = require("@/lib/db") as { getDb: jest.Mock; ensureDb: jest.Mock };
    db.getDb.mockClear();
    db.ensureDb.mockClear();
    actualCatalogSeed().readShippedPackCounts!();
    expect(db.getDb).not.toHaveBeenCalled();
    expect(db.ensureDb).not.toHaveBeenCalled();
  });

  it("counts a missing file as 0 and never throws, against a repo root with only a two-profile manifest", () => {
    const fakeRoot = mkdtempSync(join(tmpdir(), "ps-b6-restore-pack-"));
    try {
      mkdirSync(join(fakeRoot, "data", "seed", "profiles"), { recursive: true });
      writeFileSync(
        join(fakeRoot, "data", "seed", "profiles", "manifest.json"),
        JSON.stringify({ version: "1", profiles: [{ slug: "qa" }, { slug: "swe" }] }),
      );
      let counts: PackCounts | undefined;
      jest.isolateModules(() => {
        jest.doMock("@/lib/seed/seed-paths", () => ({
          REPO_ROOT: fakeRoot,
          seedPath: (...parts: string[]) => join(fakeRoot, "data/seed", ...parts),
        }));
        const mod = jest.requireActual("@/lib/seed/catalog-seed") as CatalogSeedModule;
        expect(() => {
          counts = mod.readShippedPackCounts!();
        }).not.toThrow();
      });
      jest.dontMock("@/lib/seed/seed-paths");
      expect(counts).toBeDefined();
      expect(counts!.profiles).toBe(2);
      expect(counts!.templates).toBe(0);
      expect(counts!.categories).toBe(0);
      expect(counts!.skills).toBe(0);
      expect(counts!.tools).toBe(0);
      expect(counts!.memories).toBe(0);
      expect(counts!.root).toBe(0);
    } finally {
      rmSync(fakeRoot, { recursive: true, force: true });
    }
  });

  it("counts root 1 only when agent-root/config.yaml exists", () => {
    const fakeRoot = mkdtempSync(join(tmpdir(), "ps-b6-restore-pack-"));
    try {
      mkdirSync(join(fakeRoot, "data", "seed", "agent-root"), { recursive: true });
      writeFileSync(join(fakeRoot, "data", "seed", "agent-root", "config.yaml"), "model:\n  default: x\n");
      let counts: PackCounts | undefined;
      jest.isolateModules(() => {
        jest.doMock("@/lib/seed/seed-paths", () => ({
          REPO_ROOT: fakeRoot,
          seedPath: (...parts: string[]) => join(fakeRoot, "data/seed", ...parts),
        }));
        const mod = jest.requireActual("@/lib/seed/catalog-seed") as CatalogSeedModule;
        counts = mod.readShippedPackCounts!();
      });
      jest.dontMock("@/lib/seed/seed-paths");
      expect(counts!.root).toBe(1);
      expect(counts!.profiles).toBe(0);
    } finally {
      rmSync(fakeRoot, { recursive: true, force: true });
    }
  });
});

// ───────────────────────────────────────────────────────────────
// GET /api/seed
// ───────────────────────────────────────────────────────────────

describe("GET /api/seed", () => {
  it("answers { state, pack }, the pack from readShippedPackCounts", async () => {
    const { GET } = await import("@/app/api/seed/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { state: { lastRun: string }; pack: PackCounts } };
    expect(body.data.state.lastRun).toBe("2026-09-01T00:00:00.000Z");
    expect(body.data.pack).toEqual(PACK);
    expect(mockReadShippedPackCounts).toHaveBeenCalledTimes(1);
  });

  it("carries the pack even when the seed has never run (state null)", async () => {
    mockGetSeedState.mockReturnValueOnce(null);
    const { GET } = await import("@/app/api/seed/route");
    const res = await GET();
    const body = (await res.json()) as { data: { state: unknown; pack: PackCounts } };
    expect(body.data.state).toBeNull();
    expect(body.data.pack.profiles).toBe(7);
    expect(body.data.pack.templates).toBe(12);
  });
});

// ───────────────────────────────────────────────────────────────
// POST /api/seed
// ───────────────────────────────────────────────────────────────

describe("POST /api/seed", () => {
  it("refuses under read-only, naming 'restore', before touching anything", async () => {
    const { NextResponse } = await import("next/server");
    mockRequireNotReadOnly.mockReturnValue(
      NextResponse.json(
        { error: "PatterStage is in read-only mode: restore (unset PS_READ_ONLY to allow writes)." },
        { status: 503 },
      ),
    );
    const { res, json } = await postSeed({ target: "all", mode: "replace" });
    expect(res.status).toBe(503);
    expect(json.error).toMatch(/read-only/);
    expect(json.error).toMatch(/restore/);
    expect(mockRequireNotReadOnly).toHaveBeenCalledWith("restore");
    expect(mockSnapshotDatabase).not.toHaveBeenCalled();
    expect(mockImportHermesState).not.toHaveBeenCalled();
    expect(mockRunCatalogSeed).not.toHaveBeenCalled();
    expect(mockAppendAuditLine).not.toHaveBeenCalled();
  });

  it("a replace snapshots the database ('pre-restore') BEFORE the Hermes import and the seed", async () => {
    // A Hermes home with a config.yaml, so the import step runs and the order
    // among all three is observable.
    writeFileSync(join(mockHermesHome, "config.yaml"), "model:\n  default: x\n");
    const { res } = await postSeed({ target: "all", mode: "replace" });
    expect(res.status).toBe(200);
    expect(mockSnapshotDatabase).toHaveBeenCalledTimes(1);
    expect(mockSnapshotDatabase).toHaveBeenCalledWith("pre-restore");
    expect(mockImportHermesState).toHaveBeenCalledTimes(1);
    expect(mockRunCatalogSeed).toHaveBeenCalledTimes(1);
    expect(firstCall(mockSnapshotDatabase)).toBeLessThan(firstCall(mockImportHermesState));
    expect(firstCall(mockImportHermesState)).toBeLessThan(firstCall(mockRunCatalogSeed));
  });

  it("a replace answers { ...result, imported, backup }", async () => {
    const { json } = await postSeed({ target: "all", mode: "replace" });
    expect(json.data).toEqual({ ...SEED_RESULT, imported: null, backup: SNAPSHOT });
  });

  it("a replace of one profile carries the same backup and seeds only that slug", async () => {
    const { json } = await postSeed({ target: "profiles", mode: "replace", slug: "qa" });
    expect(mockSnapshotDatabase).toHaveBeenCalledWith("pre-restore");
    expect(mockRunCatalogSeed).toHaveBeenCalledWith(
      expect.objectContaining({ target: "profiles", mode: "replace", slug: "qa" }),
    );
    expect(json.data?.backup).toEqual(SNAPSHOT);
  });

  it("a merge never snapshots, and answers backup null", async () => {
    const { res, json } = await postSeed({ target: "all", mode: "merge" });
    expect(res.status).toBe(200);
    expect(mockSnapshotDatabase).not.toHaveBeenCalled();
    expect(mockRunCatalogSeed).toHaveBeenCalledTimes(1);
    expect(json.data).toHaveProperty("backup", null);
    expect(json.data?.profiles).toBe(7);
  });

  it("an empty body is a merge (the default), so it never snapshots either", async () => {
    const { json } = await postSeed({});
    expect(mockSnapshotDatabase).not.toHaveBeenCalled();
    expect(mockRunCatalogSeed).toHaveBeenCalledWith(expect.objectContaining({ target: "all", mode: "merge" }));
    expect(json.data).toHaveProperty("backup", null);
  });

  it("a snapshot that fails answers 500 'Refused: could not take a backup before restoring (<reason>)' and runs nothing", async () => {
    writeFileSync(join(mockHermesHome, "config.yaml"), "model:\n  default: x\n");
    mockSnapshotDatabase.mockImplementationOnce(() => Promise.reject(new Error("disk full")));
    const { res, json } = await postSeed({ target: "all", mode: "replace" });
    expect(res.status).toBe(500);
    expect(json.error).toBe("Refused: could not take a backup before restoring (disk full)");
    expect(mockImportHermesState).not.toHaveBeenCalled();
    expect(mockRunCatalogSeed).not.toHaveBeenCalled();
  });

  it.each([
    [{ target: "all", mode: "replace" }, "all/replace"],
    [{ target: "all", mode: "merge" }, "all/merge"],
    [{ target: "root", mode: "replace" }, "root/replace"],
    [{ target: "profiles", mode: "replace", slug: "qa" }, "profiles/replace/qa"],
    [{ target: "templates", mode: "replace", templateId: "bug-hunt" }, "templates/replace/bug-hunt"],
    [{ target: "categories", mode: "replace" }, "categories/replace"],
  ])("audits seed.restore for %j as resource %s", async (body, resource) => {
    await postSeed(body);
    expect(mockAppendAuditLine).toHaveBeenCalledWith(
      expect.objectContaining({ action: "seed.restore", resource, ok: true }),
    );
  });

  it("GREEN CONTROL: the seed still runs with the parsed target and mode", async () => {
    await postSeed({ target: "categories", mode: "replace" });
    expect(mockRunCatalogSeed).toHaveBeenCalledWith(
      expect.objectContaining({ target: "categories", mode: "replace" }),
    );
  });
});

// ───────────────────────────────────────────────────────────────
// POST /api/seed/clean
// ───────────────────────────────────────────────────────────────

describe("POST /api/seed/clean", () => {
  it("snapshots the database ('pre-clean') before removing anything", async () => {
    const { res } = await postClean();
    expect(res.status).toBe(200);
    expect(mockSnapshotDatabase).toHaveBeenCalledTimes(1);
    expect(mockSnapshotDatabase).toHaveBeenCalledWith("pre-clean");
    expect(mockCleanDevData).toHaveBeenCalledTimes(1);
    expect(firstCall(mockSnapshotDatabase)).toBeLessThan(firstCall(mockCleanDevData));
  });

  it("answers { removed, counts, backup }", async () => {
    const { json } = await postClean();
    expect(json.data).toEqual({ ...CLEAN_RESULT, backup: SNAPSHOT });
  });

  it("a snapshot that fails answers 500 'Refused: could not take a backup before removing test data (<reason>)' and removes nothing", async () => {
    mockSnapshotDatabase.mockImplementationOnce(() => Promise.reject(new Error("disk full")));
    const { res, json } = await postClean();
    expect(res.status).toBe(500);
    expect(json.error).toBe("Refused: could not take a backup before removing test data (disk full)");
    expect(mockCleanDevData).not.toHaveBeenCalled();
    expect(mockAppendAuditLine).not.toHaveBeenCalled();
  });

  it("GREEN CONTROL: still audits seed.clean_dev_data with the count", async () => {
    await postClean();
    expect(mockAppendAuditLine).toHaveBeenCalledWith(
      expect.objectContaining({ action: "seed.clean_dev_data", resource: "5 items", ok: true }),
    );
  });
});

// ───────────────────────────────────────────────────────────────
// describeRestoreResult
// ───────────────────────────────────────────────────────────────

describe("describeRestoreResult, the one sentence for what a restore did", () => {
  const FULL = { ...SEED_RESULT, imported: null, backup: null };
  const NO_IMPORT = {
    root: { success: true, slug: "default", backupPath: null, error: null },
    skills: [],
    profiles: [],
  };

  it("all/replace: every count and the agents pushed", () => {
    expect(describeRestoreResult()("all", "replace", FULL)).toBe(
      "Restored Bob, 7 agents, 12 templates, 8 categories, 4 skills, 5 tool bundles and 5 memory facts · pushed 8 agents to Hermes",
    );
  });

  it("all/replace with nothing pushed omits the push clause", () => {
    expect(describeRestoreResult()("all", "replace", { ...FULL, pushed: 0 })).toBe(
      "Restored Bob, 7 agents, 12 templates, 8 categories, 4 skills, 5 tool bundles and 5 memory facts",
    );
  });

  it("all/replace counts agents, not files: pushed 3 reads 'pushed 3 agents'", () => {
    const text = describeRestoreResult()("all", "replace", { ...FULL, pushed: 3 });
    expect(text).toContain("pushed 3 agents to Hermes");
    expect(text).not.toMatch(/files/);
  });

  it("all/merge with nothing new says nothing was missing, even though categories and memories are always re-counted", () => {
    const text = describeRestoreResult()("all", "merge", {
      root: 0,
      profiles: 0,
      templates: 0,
      categories: 8,
      skills: 0,
      tools: 0,
      memories: 5,
      pushed: 0,
      imported: null,
      backup: null,
    });
    expect(text).toBe("Nothing was missing: everything the pack ships is already installed.");
  });

  it("all/merge that added two agents says so and does not claim nothing was missing", () => {
    const text = describeRestoreResult()("all", "merge", {
      root: 0,
      profiles: 2,
      templates: 0,
      categories: 8,
      skills: 0,
      tools: 0,
      memories: 5,
      pushed: 2,
      imported: null,
      backup: null,
    });
    expect(text).toMatch(/^Added what was missing/);
    expect(text).toMatch(/2 agents/);
    expect(text).not.toMatch(/Nothing was missing/);
  });

  it("a merge that added agents but pushed none omits the push clause too", () => {
    // Sweep survivor `describe-push-clause-always`. The replace branch is
    // covered; the merge branch has its own copy of the clause and had no case
    // where `pushed` was 0 and something was still added.
    const text = describeRestoreResult()("all", "merge", {
      root: 0,
      profiles: 2,
      templates: 0,
      categories: 8,
      skills: 0,
      tools: 0,
      memories: 5,
      pushed: 0,
      imported: null,
      backup: null,
    });

    expect(text).toBe("Added what was missing: 2 agents");
  });

  it("root: 'Restored Bob and pushed him to Hermes' when pushed", () => {
    expect(describeRestoreResult()("root", "replace", { ...FULL, root: 1, pushed: 1 })).toBe(
      "Restored Bob and pushed him to Hermes",
    );
  });

  it("root: 'Restored Bob' when the push did not land", () => {
    expect(describeRestoreResult()("root", "replace", { ...FULL, root: 1, pushed: 0 })).toBe("Restored Bob");
  });

  it("root: 'Bob already had content, nothing changed' on a 0", () => {
    expect(describeRestoreResult()("root", "merge", { ...FULL, root: 0, pushed: 0 })).toBe(
      "Bob already had content, nothing changed",
    );
  });

  it("one profile: 'Restored {name} and pushed it to Hermes'", () => {
    expect(describeRestoreResult()("profiles", "replace", { ...FULL, profiles: 1, pushed: 1 }, "QA Engineer")).toBe(
      "Restored QA Engineer and pushed it to Hermes",
    );
  });

  it("one profile whose push failed says so and points at the sync status", () => {
    expect(describeRestoreResult()("profiles", "replace", { ...FULL, profiles: 1, pushed: 0 }, "QA Engineer")).toBe(
      "Restored QA Engineer, but could not push it to Hermes (see the agent's sync status)",
    );
  });

  it("one template: 'Restored the {name} template'", () => {
    expect(describeRestoreResult()("templates", "replace", { ...FULL, templates: 1 }, "Bug hunt")).toBe(
      "Restored the Bug hunt template",
    );
  });

  it("categories: 'Restored 8 categories', the count from the result", () => {
    expect(describeRestoreResult()("categories", "replace", { ...FULL, categories: 8 })).toBe(
      "Restored 8 categories",
    );
  });

  it("prefixes the Hermes import only when it actually imported something", () => {
    const imported = { ...NO_IMPORT, profiles: [{ success: true, slug: "ops", backupPath: null, error: null }] };
    expect(describeRestoreResult()("all", "replace", { ...FULL, imported })).toBe(
      "Imported your existing Hermes files first · Restored Bob, 7 agents, 12 templates, 8 categories, 4 skills, 5 tool bundles and 5 memory facts · pushed 8 agents to Hermes",
    );
  });

  it("prefixes the import when the root pull wrote a backup, which is the only sign of a real root import", () => {
    const imported = {
      ...NO_IMPORT,
      root: { success: true, slug: "default", backupPath: "/h/SOUL.md.bak", error: null },
    };
    expect(describeRestoreResult()("root", "replace", { ...FULL, root: 1, pushed: 1, imported })).toMatch(
      /^Imported your existing Hermes files first · Restored Bob/,
    );
  });

  it("never claims an import on the already-imported short-circuit (empty arrays, no backup, root.success true)", () => {
    expect(describeRestoreResult()("all", "replace", { ...FULL, imported: NO_IMPORT })).not.toMatch(/Imported/);
  });

  it("appends the backup path when the route took one", () => {
    expect(describeRestoreResult()("categories", "replace", { ...FULL, categories: 8, backup: SNAPSHOT })).toBe(
      `Restored 8 categories · backup saved: ${SNAPSHOT.path}`,
    );
  });

  it("uses no em dash in any sentence it produces", () => {
    const describe = describeRestoreResult();
    const outputs = [
      describe("all", "replace", { ...FULL, backup: SNAPSHOT }),
      describe("all", "merge", { ...FULL, root: 0, profiles: 0, templates: 0, skills: 0, tools: 0, pushed: 0 }),
      describe("root", "replace", { ...FULL, root: 0, pushed: 0 }),
      describe("profiles", "replace", { ...FULL, profiles: 1, pushed: 0 }, "QA Engineer"),
      describe("templates", "replace", { ...FULL, templates: 1 }, "Bug hunt"),
    ];
    for (const text of outputs) expect(text).not.toContain(EM_DASH);
  });
});

// A tidy-up so a stray fixture home never outlives the run.
afterAll(() => {
  if (existsSync(mockHermesHome)) rmSync(mockHermesHome, { recursive: true, force: true });
});
