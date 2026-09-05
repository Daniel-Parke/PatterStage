/** @jest-environment node */

// B4 (T-0098) oracle, the agent group: profile.created, profile.pushed,
// profile.pulled, toolset.saved, personality.changed and config.saved.
//
// Written before the emits exist, so the positive tests are red on exactly one
// line: the ledger entry. The contract they hold is the one every emit in this
// batch answers to. An event is written AFTER the write it describes succeeded,
// never before it and never from a path that did not write. So each route gets
// at least one test where the write itself fails or is refused at or past the
// point of writing, and the ledger stays empty. Those are green today and stay
// green; an emit placed above the write turns them red, which is the point.
//
// The doubles mirror the suites that already exercise these handlers
// (profiles-api, a-saved-change-says-it-was-saved, b1-sync-routes-answer-
// with-the-outcome, profiles-toolsets-api, files-route-refuses-corrupt-config,
// config-put-refuses-unparseable-yaml), so the real handler runs over the same
// seams. `fs` is a stub: nothing here touches a disk or a database.

jest.mock("@/lib/analytics/record-event", () => ({ recordEvent: jest.fn() }));

const mockExistsSync = jest.fn();
const mockReadFileSync = jest.fn();
const mockWriteFileSync = jest.fn();
jest.mock("fs", () => ({
  existsSync: (...a: unknown[]) => mockExistsSync(...a),
  readFileSync: (...a: unknown[]) => mockReadFileSync(...a),
  writeFileSync: (...a: unknown[]) => mockWriteFileSync(...a),
  mkdirSync: jest.fn(),
  renameSync: jest.fn(),
  unlinkSync: jest.fn(),
  copyFileSync: jest.fn(),
  statSync: jest.fn(),
  readdirSync: jest.fn(() => []),
  rmSync: jest.fn(),
}));

const HERMES = "/tmp/b4-hermes";
jest.mock("@/modules/hermes/lib/agent-runtime", () => ({
  getActiveHermesHome: jest.fn(() => HERMES),
  getHermesDefaultRoot: jest.fn(() => HERMES),
  getActiveHermesPaths: jest.fn(() => ({
    root: HERMES,
    profiles: `${HERMES}/profiles`,
    config: `${HERMES}/config.yaml`,
    env: `${HERMES}/.env`,
    auth: `${HERMES}/auth.json`,
    soul: `${HERMES}/SOUL.md`,
    hermes: `${HERMES}/HERMES.md`,
    agents: `${HERMES}/AGENTS.md`,
    userMemory: `${HERMES}/memories/USER.md`,
    agentMemory: `${HERMES}/memories/MEMORY.md`,
    skills: `${HERMES}/skills`,
    sessions: `${HERMES}/sessions`,
    logs: `${HERMES}/logs`,
    backups: `${HERMES}/backups`,
    cronJobs: `${HERMES}/cron/jobs.json`,
    memoryDb: `${HERMES}/memory_store.db`,
  })),
  getAgentLlmEndpoints: jest.fn(() => ({
    apiUrl: "http://127.0.0.1:9/v1/chat/completions",
    gatewayBase: "http://127.0.0.1:9",
  })),
}));

jest.mock("@/modules/hermes/lib/profile-paths", () => ({
  getHermesDefaultRoot: () => HERMES,
  resolveProfileHermesHome: (slug: string) =>
    slug === "default" ? HERMES : `${HERMES}/profiles/${slug}`,
  buildProfileHermesPathBundle: (slug: string) => {
    const home = slug === "default" ? HERMES : `${HERMES}/profiles/${slug}`;
    return {
      soul: `${home}/SOUL.md`,
      agents: `${home}/AGENTS.md`,
      hermes: `${home}/HERMES.md`,
      userMemory: `${home}/memories/USER.md`,
      agentMemory: `${home}/memories/MEMORY.md`,
      config: `${home}/config.yaml`,
      env: `${home}/.env`,
      auth: `${home}/auth.json`,
    };
  },
}));

jest.mock("@/lib/paths", () => ({
  PS_DATA_DIR: "/tmp/b4-data",
  PATHS: {
    missions: "/tmp/b4-data/missions",
    patterStageDb: "/tmp/b4-data/patterstage.db",
    templates: "/tmp/b4-data/templates",
    stories: "/tmp/b4-data/stories",
    recroom: "/tmp/b4-data/recroom",
    workspaces: "/tmp/b4-data/workspaces",
    auditLog: "/tmp/b4-data/audit",
    psScripts: "/tmp/b4-data/scripts",
    psHardwareLogs: "/tmp/b4-data/logs",
  },
  getPsScriptsDir: () => "/tmp/b4-data/scripts",
  getPsHardwareLogDir: () => "/tmp/b4-data/logs",
  readEnv: () => undefined,
}));

jest.mock("@/lib/db", () => ({
  ensureDb: jest.fn(),
  getDb: jest.fn(),
  now: () => "2026-09-05T00:00:00Z",
  uuid: () => "b4-uuid",
  inTransaction: <T,>(fn: () => T) => fn(),
}));
jest.mock("@/lib/api-auth", () => ({}));
jest.mock("@/lib/audit-log", () => ({ appendAuditLine: jest.fn() }));
jest.mock("@/lib/api-logger", () => ({
  logApiError: jest.fn(),
  serverErrorFromCatch: jest.requireActual("@/lib/api-logger").serverErrorFromCatch,
}));
jest.mock("@/lib/system-repository", () => ({
  getMetaPair: jest.fn(() => []),
  setMultipleStats: jest.fn(),
  deleteMetaPair: jest.fn(),
}));

// ── profiles repository + root ──────────────────────────────────────────────
type Row = { slug: string; displayName: string; description: string; personality: string; configYaml: string; soulMd: string; agentsMd: string; seedKey: string | null; syncedAt: string | null; syncError: string | null; createdAt: string; updatedAt: string };
const rows = new Map<string, Row>();
function seedRow(slug: string): void {
  rows.set(slug, {
    slug, displayName: slug, description: "", personality: "technical",
    configYaml: "", soulMd: "", agentsMd: "", seedKey: null,
    syncedAt: null, syncError: null, createdAt: "", updatedAt: "",
  });
}
const mockUpsertProfile = jest.fn();
const mockUpdateProfileContent = jest.fn();
jest.mock("@/modules/hermes/lib/profiles-repository", () => ({
  listProfiles: () => [...rows.values()],
  getProfile: (slug: string) => rows.get(slug) ?? null,
  upsertProfile: (input: { slug: string }) => {
    mockUpsertProfile(input);
    seedRow(input.slug);
    return rows.get(input.slug);
  },
  updateProfileContent: (...a: unknown[]) => mockUpdateProfileContent(...a),
  defaultConfigYaml: (p: string) => `agent:\n  personality: ${p}\n`,
  hydratePlatformToolsetsForSlug: jest.fn(),
}));
jest.mock("@/lib/agent-root-repository", () => ({
  getAgentRoot: jest.fn(() => ({
    id: 1, displayName: "Bob", description: "", personality: "technical",
    configYaml: "", soulMd: "", agentsMd: "", frameworkMd: "", userMd: "", memoryMd: "",
    disabledSkillsJson: "[]", platformToolsetsJson: "{}", syncedAt: null, syncError: null, updatedAt: "",
  })),
  updateAgentRoot: jest.fn(),
  setAgentRootSyncStatus: jest.fn(),
}));
jest.mock("@/modules/hermes/lib/profile-drift", () => ({
  detectProfileDrift: () => ({ drifted: false, fields: [], syncError: null }),
  detectRootDrift: () => ({ drifted: false, fields: [], syncError: null }),
}));
jest.mock("@/modules/hermes/lib/profile-counts", () => ({
  countProfileSkills: () => 0,
  countProfileToolsets: () => 0,
}));

// ── push / pull / discovery ─────────────────────────────────────────────────
type SyncR = { success: boolean; slug: string; backupPath: string | null; error: string | null };
const okR = (slug: string): SyncR => ({ success: true, slug, backupPath: null, error: null });
const badR = (slug: string, error = "ENOENT: no such file or directory"): SyncR =>
  ({ success: false, slug, backupPath: null, error });

const mockPushProfile = jest.fn();
const mockPushRoot = jest.fn();
const mockPushAllProfiles = jest.fn();
const mockPushAllSkills = jest.fn();
const mockPushSkill = jest.fn();
jest.mock("@/modules/hermes/lib/profile-push", () => ({
  pushProfileToHermes: (slug: string) => mockPushProfile(slug),
  pushRootToHermes: () => mockPushRoot(),
  pushAllProfiles: (o: unknown) => mockPushAllProfiles(o),
  pushAllSkillsToHermes: () => mockPushAllSkills(),
  pushSkillToHermes: (k: string) => mockPushSkill(k),
}));

const mockPullProfile = jest.fn();
const mockPullRoot = jest.fn();
const mockPullSkill = jest.fn();
jest.mock("@/modules/hermes/lib/profile-pull", () => ({
  pullProfileFromHermes: (slug: string, o: unknown) => mockPullProfile(slug, o),
  pullRootFromHermes: (o: unknown) => mockPullRoot(o),
  pullSkillFromHermes: (k: string) => mockPullSkill(k),
}));
const mockImportAllSkills = jest.fn();
jest.mock("@/modules/hermes/lib/profile-discovery", () => ({
  importAllSkillsFromDisk: () => mockImportAllSkills(),
  discoverLocalProfiles: () => [],
  importDiscoveredProfile: jest.fn(),
}));

// ── the patch/push seam the toolsets and files routes write through ─────────
const mockApply = jest.fn();
const mockPushOrFail = jest.fn();
jest.mock("@/modules/hermes/handlers/profile-patch", () => ({
  applyProfileOrRootPatchOrFail: (...a: unknown[]) => mockApply(...a),
  pushProfileOrRootOrFail: (...a: unknown[]) => mockPushOrFail(...a),
}));

// The real writeManagedFileContent answers whether the write happened, and
// the route reads that answer now (T-0102, D28), so the double has to give
// the same shape or every managed PUT here is a 400.
const mockWriteManaged = jest.fn().mockReturnValue(true);
jest.mock("@/modules/hermes/lib/agent-file-store", () => ({
  isManagedKey: (key: string) =>
    ["soul", "agent", "user", "memory", "config", "hermes"].includes(key),
  writeManagedFileContent: (...a: unknown[]) => mockWriteManaged(...a),
  readManagedFileContent: () => null,
}));

// ── the one config.yaml writer ──────────────────────────────────────────────
const mockWriteConfig = jest.fn();
jest.mock("@/modules/hermes/lib/hermes-config-write", () => ({
  writeHermesConfigFile: (...a: unknown[]) => mockWriteConfig(...a),
}));

import { NextRequest, NextResponse } from "next/server";

import { recordEvent } from "@/lib/analytics/record-event";
import { POST as createProfile } from "@/app/api/agent/profiles/route";
import { POST as syncPush } from "@/app/api/agent/profiles/sync/push/route";
import { POST as syncPull } from "@/app/api/agent/profiles/sync/pull/route";
import { PUT as putToolsets } from "@/app/api/agent/profiles/[id]/toolsets/route";
import { PUT as putFile } from "@/app/api/agent/files/[key]/route";
import { PUT as putConfig } from "@/app/api/config/route";

function jsonReq(url: string, method: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
const params = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) });
type Envelope = { data?: { success?: boolean; error?: string; [k: string]: unknown }; error?: string };

beforeEach(() => {
  jest.clearAllMocks();
  rows.clear();
  mockExistsSync.mockReturnValue(false);
  mockReadFileSync.mockReturnValue("");
  mockPushProfile.mockImplementation((slug: string) => okR(slug));
  mockPushRoot.mockReturnValue(okR("default"));
  mockPullProfile.mockImplementation((slug: string) => okR(slug));
  mockPullRoot.mockReturnValue(okR("default"));
  mockImportAllSkills.mockReturnValue([]);
  mockApply.mockImplementation((slug: string) => ({ profile: slug }));
  mockPushOrFail.mockImplementation((slug: string) => ({ profile: slug }));
});

// ═══════════════════════════════════════════════════════════════════════════
// 8. profile.created — POST /api/agent/profiles
// ═══════════════════════════════════════════════════════════════════════════
describe("POST /api/agent/profiles records profile.created", () => {
  const URL = "http://localhost/api/agent/profiles";

  it("the operator creates a profile, the row is written and pushed, and the ledger says so", async () => {
    const res = await createProfile(jsonReq(URL, "POST", { name: "Research Assistant" }));

    expect(res.status).toBe(200);
    expect(((await res.json()) as Envelope).data?.slug).toBe("research-assistant");
    expect(mockUpsertProfile).toHaveBeenCalled();
    expect(mockPushProfile).toHaveBeenCalledWith("research-assistant");
    expect(recordEvent).toHaveBeenCalledWith(
      "profile.created",
      expect.objectContaining({
        entityType: "profile",
        entityId: "research-assistant",
        profile: "research-assistant",
      }),
    );
  });

  it("the row was written but the push to Hermes failed: not a 2xx, and nothing in the ledger", async () => {
    // The write happened (upsert) and the route still answers failure because
    // the second half did not. An emit between the two would fire here.
    mockPushProfile.mockImplementation((slug: string) => badR(slug));

    const res = await createProfile(jsonReq(URL, "POST", { name: "Research Assistant" }));

    expect(res.status).toBe(500);
    expect(mockUpsertProfile).toHaveBeenCalled();
    expect(recordEvent).not.toHaveBeenCalled();
  });

  it("a name that already exists is a 409 and nothing in the ledger", async () => {
    seedRow("existing");

    const res = await createProfile(jsonReq(URL, "POST", { name: "Existing" }));

    expect(res.status).toBe(409);
    expect(recordEvent).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 9. profile.pushed — POST /api/agent/profiles/sync/push
// ═══════════════════════════════════════════════════════════════════════════
describe("POST /api/agent/profiles/sync/push records profile.pushed", () => {
  const URL = "http://localhost/api/agent/profiles/sync/push";

  it("one profile pushed: the ledger names it", async () => {
    const res = await syncPush(jsonReq(URL, "POST", { slug: "qa" }));

    expect(res.status).toBe(200);
    expect(((await res.json()) as Envelope).data?.success).toBe(true);
    expect(recordEvent).toHaveBeenCalledWith(
      "profile.pushed",
      expect.objectContaining({ entityType: "profile", entityId: "qa" }),
    );
  });

  it("the root agent pushed by { root: true }: the ledger calls it default", async () => {
    const res = await syncPush(jsonReq(URL, "POST", { root: true }));

    expect(res.status).toBe(200);
    expect(recordEvent).toHaveBeenCalledWith(
      "profile.pushed",
      expect.objectContaining({ entityType: "profile", entityId: "default" }),
    );
  });

  it("the root agent pushed by slug 'default' is the same entry", async () => {
    const res = await syncPush(jsonReq(URL, "POST", { slug: "default" }));

    expect(res.status).toBe(200);
    expect(recordEvent).toHaveBeenCalledWith(
      "profile.pushed",
      expect.objectContaining({ entityType: "profile", entityId: "default" }),
    );
  });

  it("push all: one entry for 'all' counting what succeeded in the batch", async () => {
    // The batch the route answers over is [...profileResults, rootResult].
    // The contract does not say whether the root is in the count, so the
    // fixture makes the question moot: the root fails, two profiles succeed
    // and one does not, and the count is 2 under either reading. The batch
    // still answers 200 with success false, and "at least one succeeded"
    // still holds.
    mockPushAllProfiles.mockReturnValue([okR("a"), okR("b"), badR("c")]);
    mockPushRoot.mockReturnValue(badR("default"));

    const res = await syncPush(jsonReq(URL, "POST", { all: true }));

    expect(res.status).toBe(200);
    expect(((await res.json()) as Envelope).data?.success).toBe(false);
    expect(recordEvent).toHaveBeenCalledWith(
      "profile.pushed",
      expect.objectContaining({
        entityType: "profile",
        entityId: "all",
        metadata: expect.objectContaining({ count: 2 }),
      }),
    );
  });

  it("one profile whose push failed: a 500, and nothing in the ledger", async () => {
    mockPushProfile.mockImplementation((slug: string) => badR(slug));

    const res = await syncPush(jsonReq(URL, "POST", { slug: "qa" }));

    expect(res.status).toBe(500);
    expect(recordEvent).not.toHaveBeenCalled();
  });

  it("the root whose push failed: a 500, and nothing in the ledger", async () => {
    mockPushRoot.mockReturnValue(badR("default"));

    const res = await syncPush(jsonReq(URL, "POST", { root: true }));

    expect(res.status).toBe(500);
    expect(recordEvent).not.toHaveBeenCalled();
  });

  it("push all where every push failed: the batch answers, and nothing in the ledger", async () => {
    mockPushAllProfiles.mockReturnValue([badR("a"), badR("b")]);
    mockPushRoot.mockReturnValue(badR("default"));

    const res = await syncPush(jsonReq(URL, "POST", { all: true }));

    expect(res.status).toBe(200);
    expect(((await res.json()) as Envelope).data?.success).toBe(false);
    expect(recordEvent).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 10. profile.pulled — POST /api/agent/profiles/sync/pull
// ═══════════════════════════════════════════════════════════════════════════
describe("POST /api/agent/profiles/sync/pull records profile.pulled", () => {
  const URL = "http://localhost/api/agent/profiles/sync/pull";

  it("one profile pulled: the ledger names it", async () => {
    const res = await syncPull(jsonReq(URL, "POST", { slug: "qa" }));

    expect(res.status).toBe(200);
    expect(((await res.json()) as Envelope).data?.success).toBe(true);
    expect(recordEvent).toHaveBeenCalledWith(
      "profile.pulled",
      expect.objectContaining({ entityType: "profile", entityId: "qa" }),
    );
  });

  it("the root agent pulled by { root: true }: the ledger calls it default", async () => {
    const res = await syncPull(jsonReq(URL, "POST", { root: true }));

    expect(res.status).toBe(200);
    expect(recordEvent).toHaveBeenCalledWith(
      "profile.pulled",
      expect.objectContaining({ entityType: "profile", entityId: "default" }),
    );
  });

  it("pull all: one entry for 'all' counting what succeeded in the batch", async () => {
    // listProfiles → qa and ops; qa pulls, ops does not, the root does not,
    // and the skills import returns nothing. The batch the route answers over
    // is [...profileResults, rootResult, ...skillResults] and, as with push,
    // the root fails so the count is 1 whether or not the root is counted.
    seedRow("qa");
    seedRow("ops");
    mockPullProfile.mockImplementation((slug: string) => (slug === "ops" ? badR(slug) : okR(slug)));
    mockPullRoot.mockReturnValue(badR("default"));

    const res = await syncPull(jsonReq(URL, "POST", { all: true }));

    expect(res.status).toBe(200);
    expect(((await res.json()) as Envelope).data?.success).toBe(false);
    expect(recordEvent).toHaveBeenCalledWith(
      "profile.pulled",
      expect.objectContaining({
        entityType: "profile",
        entityId: "all",
        metadata: expect.objectContaining({ count: 1 }),
      }),
    );
  });

  it("one profile whose pull failed: a 500, and nothing in the ledger", async () => {
    mockPullProfile.mockImplementation((slug: string) => badR(slug));

    const res = await syncPull(jsonReq(URL, "POST", { slug: "qa" }));

    expect(res.status).toBe(500);
    expect(recordEvent).not.toHaveBeenCalled();
  });

  it("pull all where every pull failed: the batch answers, and nothing in the ledger", async () => {
    seedRow("qa");
    mockPullProfile.mockImplementation((slug: string) => badR(slug));
    mockPullRoot.mockReturnValue(badR("default"));

    const res = await syncPull(jsonReq(URL, "POST", { all: true }));

    expect(res.status).toBe(200);
    expect(((await res.json()) as Envelope).data?.success).toBe(false);
    expect(recordEvent).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 11. toolset.saved — PUT /api/agent/profiles/[id]/toolsets
// ═══════════════════════════════════════════════════════════════════════════
describe("PUT /api/agent/profiles/[id]/toolsets records toolset.saved", () => {
  const url = (id: string) => `http://localhost/api/agent/profiles/${id}/toolsets`;
  const body = { platformToolsets: { cli: ["hermes-cli"] } };

  it("the operator saves a profile's toolsets, the patch lands, and the ledger names the profile", async () => {
    const res = await putToolsets(jsonReq(url("qa"), "PUT", body), params({ id: "qa" }));

    expect(res.status).toBe(200);
    expect(mockApply).toHaveBeenCalledWith("qa", expect.anything(), expect.anything(), expect.any(String));
    expect(recordEvent).toHaveBeenCalledWith(
      "toolset.saved",
      expect.objectContaining({ entityType: "toolset", entityId: "qa", profile: "qa" }),
    );
  });

  it("the root agent's toolsets are recorded against default", async () => {
    const res = await putToolsets(jsonReq(url("default"), "PUT", body), params({ id: "default" }));

    expect(res.status).toBe(200);
    expect(recordEvent).toHaveBeenCalledWith(
      "toolset.saved",
      expect.objectContaining({ entityType: "toolset", entityId: "default", profile: "default" }),
    );
  });

  it("the patch answers a failure response: that status goes out, and nothing in the ledger", async () => {
    mockApply.mockReturnValue(
      NextResponse.json({ error: "Saved to PatterStage, but the push to Hermes did not complete" }, { status: 500 }),
    );

    const res = await putToolsets(jsonReq(url("qa"), "PUT", body), params({ id: "qa" }));

    expect(res.status).toBe(500);
    expect(recordEvent).not.toHaveBeenCalled();
  });

  it("a profile that does not exist is the patch's 404, and nothing in the ledger", async () => {
    mockApply.mockReturnValue(NextResponse.json({ error: "Profile not found" }, { status: 404 }));

    const res = await putToolsets(jsonReq(url("ghost"), "PUT", body), params({ id: "ghost" }));

    expect(res.status).toBe(404);
    expect(recordEvent).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 12. personality.changed — PUT /api/agent/files/[key], SOUL.md only
// ═══════════════════════════════════════════════════════════════════════════
describe("PUT /api/agent/files/[key] records personality.changed for SOUL.md", () => {
  const url = (key: string, profile?: string) =>
    `http://localhost/api/agent/files/${key}${profile ? `?profile=${profile}` : ""}`;
  const body = { content: "# Soul\n\nYou are careful.\n", backup: false };

  it("the operator rewrites a profile's SOUL.md, it is stored and pushed, and the ledger names the profile", async () => {
    seedRow("qa");

    const res = await putFile(jsonReq(url("soul", "qa"), "PUT", body), params({ key: "soul" }));

    expect(res.status).toBe(200);
    expect(mockWriteManaged).toHaveBeenCalledWith("qa", "soul", body.content);
    expect(mockPushOrFail).toHaveBeenCalledWith("qa", expect.any(String));
    expect(recordEvent).toHaveBeenCalledWith(
      "personality.changed",
      expect.objectContaining({ entityType: "personality", entityId: "qa", profile: "qa" }),
    );
  });

  it("the root agent's SOUL.md is recorded against default", async () => {
    const res = await putFile(jsonReq(url("soul"), "PUT", body), params({ key: "soul" }));

    expect(res.status).toBe(200);
    expect(mockWriteManaged).toHaveBeenCalledWith("default", "soul", body.content);
    expect(recordEvent).toHaveBeenCalledWith(
      "personality.changed",
      expect.objectContaining({ entityType: "personality", entityId: "default", profile: "default" }),
    );
  });

  it("AGENTS.md written and pushed successfully is not a personality change", async () => {
    // Same branch of the route, different key. The emit is keyed on SOUL.md
    // and nothing else; a green write here must leave the ledger empty.
    seedRow("qa");

    const res = await putFile(jsonReq(url("agent", "qa"), "PUT", body), params({ key: "agent" }));

    expect(res.status).toBe(200);
    expect(mockWriteManaged).toHaveBeenCalledWith("qa", "agent", body.content);
    expect(recordEvent).not.toHaveBeenCalled();
  });

  it("SOUL.md stored but the push to Hermes failed: that status goes out, and nothing in the ledger", async () => {
    seedRow("qa");
    mockPushOrFail.mockReturnValue(
      NextResponse.json({ error: "Saved to PatterStage, but the push to Hermes did not complete" }, { status: 500 }),
    );

    const res = await putFile(jsonReq(url("soul", "qa"), "PUT", body), params({ key: "soul" }));

    expect(res.status).toBe(500);
    expect(mockWriteManaged).toHaveBeenCalled();
    expect(recordEvent).not.toHaveBeenCalled();
  });

  it("SOUL.md for a profile that does not exist is a 404 before any write, and nothing in the ledger", async () => {
    const res = await putFile(jsonReq(url("soul", "ghost"), "PUT", body), params({ key: "soul" }));

    expect(res.status).toBe(404);
    expect(mockWriteManaged).not.toHaveBeenCalled();
    expect(recordEvent).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 13. config.saved — PUT /api/config
// ═══════════════════════════════════════════════════════════════════════════
describe("PUT /api/config records config.saved", () => {
  const URL = "http://localhost/api/config";

  it("the operator saves a section, config.yaml is written, and the ledger names the section", async () => {
    const res = await putConfig(jsonReq(URL, "PUT", { section: "agent", values: { max_turns: 5 } }));

    expect(res.status).toBe(200);
    expect(mockWriteConfig).toHaveBeenCalledWith(`${HERMES}/config.yaml`, expect.stringContaining("max_turns: 5"));
    expect(recordEvent).toHaveBeenCalledWith(
      "config.saved",
      expect.objectContaining({ entityType: "config", entityId: "agent" }),
    );
  });

  it("the writer refuses the file: a 500, and nothing in the ledger", async () => {
    mockWriteConfig.mockImplementation(() => {
      throw new Error("config.yaml did not parse, refusing to write over it");
    });

    const res = await putConfig(jsonReq(URL, "PUT", { section: "agent", values: { max_turns: 5 } }));

    expect(res.status).toBe(500);
    expect(mockWriteConfig).toHaveBeenCalled();
    expect(recordEvent).not.toHaveBeenCalled();
  });

  it("a section that is not writable is a 403 before any write, and nothing in the ledger", async () => {
    const res = await putConfig(jsonReq(URL, "PUT", { section: "not-a-section", values: { a: 1 } }));

    expect(res.status).toBe(403);
    expect(mockWriteConfig).not.toHaveBeenCalled();
    expect(recordEvent).not.toHaveBeenCalled();
  });
});
