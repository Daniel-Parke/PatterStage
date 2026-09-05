/** @jest-environment node */
/**
 * B1 (T-0095), D125, D19, D11: three sync endpoints answered 200 with
 * `success: false` buried in the body where no client reads it.
 *
 * T-0082 fixed this for the profile PUSH route with two helpers: a single
 * target that failed is a 500 whose message names the target and the reason,
 * and a batch with failures is a 200 whose `data.success` is false and whose
 * `data.error` names every failure. The pull route, the import route and the
 * models push route never got the helpers, so a pull that could not read the
 * disk toasted "Pulled from Hermes" and a model push the assembler refused
 * toasted "Model pushed to Hermes".
 *
 * One shape for every sync answer, and the helpers live in one place.
 */
jest.mock("@/lib/api-logger", () => ({ logApiError: jest.fn(), serverErrorFromCatch: jest.fn() }));
jest.mock("@/lib/db", () => ({ ensureDb: jest.fn() }));

type R = { success: boolean; slug: string; backupPath: string | null; error: string | null };
const okR = (slug: string): R => ({ success: true, slug, backupPath: null, error: null });
const badR = (slug: string, error: string): R => ({ success: false, slug, backupPath: null, error });

const mockPullProfile = jest.fn();
const mockPullRoot = jest.fn();
const mockPullSkill = jest.fn();
jest.mock("@/modules/hermes/lib/profile-pull", () => ({
  pullProfileFromHermes: (...a: unknown[]) => mockPullProfile(...a),
  pullRootFromHermes: (...a: unknown[]) => mockPullRoot(...a),
  pullSkillFromHermes: (...a: unknown[]) => mockPullSkill(...a),
}));

const mockImportAllSkills = jest.fn();
const mockDiscover = jest.fn();
const mockImportDiscovered = jest.fn();
jest.mock("@/modules/hermes/lib/profile-discovery", () => ({
  importAllSkillsFromDisk: () => mockImportAllSkills(),
  discoverLocalProfiles: () => mockDiscover(),
  importDiscoveredProfile: (slug: string) => mockImportDiscovered(slug),
}));
jest.mock("@/modules/hermes/lib/profiles-repository", () => ({
  listProfiles: () => [{ slug: "qa" }, { slug: "ops" }],
}));

const mockPushModel = jest.fn();
jest.mock("@/modules/hermes/lib/sync-manager", () => ({
  pushModelToHermes: (id: string) => mockPushModel(id),
  pushCredential: jest.fn(() => ({ success: true, details: [], backupPath: null })),
}));
jest.mock("@/lib/models-repository", () => ({ getModelWithKey: () => null }));

import { NextRequest } from "next/server";

function post(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
type Envelope = { data?: { success?: boolean; error?: string; [k: string]: unknown }; error?: string };

beforeEach(() => {
  jest.clearAllMocks();
  mockPullProfile.mockImplementation((slug: string) => okR(slug));
  mockPullRoot.mockReturnValue(okR("default"));
  mockPullSkill.mockImplementation((key: string) => okR(key));
  mockImportAllSkills.mockReturnValue([okR("skill-a")]);
  mockDiscover.mockReturnValue([]);
  mockImportDiscovered.mockImplementation((slug: string) => okR(slug));
});

const PULL = "http://localhost/api/agent/profiles/sync/pull";
const IMPORT = "http://localhost/api/agent/profiles/sync/import";
const MODEL_PUSH = "http://localhost/api/models/sync/push";

describe("POST /api/agent/profiles/sync/pull", () => {
  it("a single profile that could not be pulled is a 500 naming the slug and the reason", async () => {
    mockPullProfile.mockReturnValue(badR("qa", "ENOENT: profiles/qa/SOUL.md"));
    const { POST } = await import("@/app/api/agent/profiles/sync/pull/route");
    const res = await POST(post(PULL, { slug: "qa" }));
    expect(res.status).toBe(500);
    const body = (await res.json()) as Envelope;
    expect(body.error).toContain("qa");
    expect(body.error).toContain("ENOENT");
  });

  it("the root is answered the same way", async () => {
    mockPullRoot.mockReturnValue(badR("default", "config.yaml did not parse"));
    const { POST } = await import("@/app/api/agent/profiles/sync/pull/route");
    const res = await POST(post(PULL, { root: true }));
    expect(res.status).toBe(500);
    expect(((await res.json()) as Envelope).error).toContain("config.yaml did not parse");
  });

  it("one skill is answered the same way", async () => {
    mockPullSkill.mockReturnValue(badR("web-search", "SKILL.md missing"));
    const { POST } = await import("@/app/api/agent/profiles/sync/pull/route");
    const res = await POST(post(PULL, { skillKey: "web-search" }));
    expect(res.status).toBe(500);
    expect(((await res.json()) as Envelope).error).toContain("web-search");
  });

  it("a batch with one failure is a 200 whose data says so and names the failure", async () => {
    mockPullProfile.mockImplementation((slug: string) =>
      slug === "ops" ? badR("ops", "EACCES: profiles/ops") : okR(slug),
    );
    const { POST } = await import("@/app/api/agent/profiles/sync/pull/route");
    const res = await POST(post(PULL, { all: true }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Envelope;
    expect(body.data?.success).toBe(false);
    expect(body.data?.error).toContain("ops");
    expect(body.data?.error).toContain("EACCES");
    // The eleven that worked are still reported.
    expect(Array.isArray(body.data?.profiles)).toBe(true);
    expect((body.data?.profiles as R[]).length).toBe(2);
  });

  it("a skills batch with one failure is answered the same way", async () => {
    mockImportAllSkills.mockReturnValue([okR("skill-a"), badR("skill-b", "frontmatter invalid")]);
    const { POST } = await import("@/app/api/agent/profiles/sync/pull/route");
    const res = await POST(post(PULL, { skills: true }));
    const body = (await res.json()) as Envelope;
    expect(res.status).toBe(200);
    expect(body.data?.success).toBe(false);
    expect(body.data?.error).toContain("skill-b");
  });

  it("GREEN CONTROL: a clean single pull and a clean batch say success with no error", async () => {
    const { POST } = await import("@/app/api/agent/profiles/sync/pull/route");
    const single = (await (await POST(post(PULL, { slug: "qa" }))).json()) as Envelope;
    expect(single.data?.success).toBe(true);
    const batch = (await (await POST(post(PULL, { all: true }))).json()) as Envelope;
    expect(batch.data?.success).toBe(true);
    expect(batch.data?.error).toBeUndefined();
  });
});

describe("POST /api/agent/profiles/sync/import", () => {
  it("one discovered profile that could not be imported is a 500 naming it", async () => {
    mockImportDiscovered.mockReturnValue(badR("legacy", "SOUL.md unreadable"));
    const { POST } = await import("@/app/api/agent/profiles/sync/import/route");
    const res = await POST(post(IMPORT, { slug: "legacy" }));
    expect(res.status).toBe(500);
    const body = (await res.json()) as Envelope;
    expect(body.error).toContain("legacy");
    expect(body.error).toContain("SOUL.md unreadable");
  });

  it("importing every discovered profile with one failure says so", async () => {
    mockDiscover.mockReturnValue([
      { slug: "a", inDatabase: false },
      { slug: "b", inDatabase: false },
    ]);
    mockImportDiscovered.mockImplementation((slug: string) =>
      slug === "b" ? badR("b", "config.yaml did not parse") : okR(slug),
    );
    const { POST } = await import("@/app/api/agent/profiles/sync/import/route");
    const res = await POST(post(IMPORT, { importAllDiscovered: true }));
    const body = (await res.json()) as Envelope;
    expect(res.status).toBe(200);
    expect(body.data?.success).toBe(false);
    expect(body.data?.error).toContain("b");
    expect(body.data?.error).toContain("config.yaml did not parse");
  });

  it("importing skills with one failure says so", async () => {
    mockImportAllSkills.mockReturnValue([badR("skill-z", "no SKILL.md")]);
    const { POST } = await import("@/app/api/agent/profiles/sync/import/route");
    const body = (await (await POST(post(IMPORT, { importSkills: true }))).json()) as Envelope;
    expect(body.data?.success).toBe(false);
    expect(body.data?.error).toContain("skill-z");
  });
});

describe("POST /api/models/sync/push", () => {
  it("a push the assembler refused is a 500 naming the model and the reason", async () => {
    mockPushModel.mockReturnValue({
      success: false,
      backupPath: null,
      details: [{ action: "error", detail: "config.yaml did not parse, refusing to write over it" }],
    });
    const { POST } = await import("@/app/api/models/sync/push/route");
    const res = await POST(post(MODEL_PUSH, { modelId: "m-1" }));
    expect(res.status).toBe(500);
    const body = (await res.json()) as Envelope;
    expect(body.error).toContain("m-1");
    expect(body.error).toContain("config.yaml did not parse");
  });

  it("GREEN CONTROL: a push that happened is a 200 with success true", async () => {
    mockPushModel.mockReturnValue({ success: true, backupPath: null, details: [] });
    const { POST } = await import("@/app/api/models/sync/push/route");
    const res = await POST(post(MODEL_PUSH, { modelId: "m-1" }));
    expect(res.status).toBe(200);
    expect(((await res.json()) as Envelope).data?.success).toBe(true);
  });
});
