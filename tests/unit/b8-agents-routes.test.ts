/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports -- better-sqlite3's package root is not newable under the jest transform */

// ═══════════════════════════════════════════════════════════════
// B8 oracle, the server half (T-0102, D18, D24, D26, D28).
//
// Written before the product code moved.
//
//   D18 (blocker) "Clone From: Default (Bob)" is the modal's default choice
//        and the create route skips it: `if (cloneFrom && cloneFrom !== "default")`.
//        The most-used path therefore writes generic boilerplate over the
//        clone the operator asked for, and answers 200.
//   D24  The 409 for a name that slugifies to "default" tells the operator to
//        "Rename the root agent from Operations". Nothing in the product
//        renames the root agent, so the sentence sends them looking for a
//        control that does not exist. Decision 16 says it should, so the
//        control is built and the sentence points at it.
//   D26  GET /api/agent/profiles decides a file "exists" with existsSync on
//        the Hermes path, while the editor reads the managed row first. A
//        profile whose files live only in the database shows five "missing"
//        badges over files that open full of content.
//   D28  PUT /api/agent/files/hermes?profile=qa ignores writeManagedFileContent's
//        false, pushes, and answers 200 having written nothing.
//
// The database is real and in memory, the Hermes home is a real temp
// directory, and the push is stubbed: what is under test is what the route
// decides, not what the agent framework does with it.
// ═══════════════════════════════════════════════════════════════

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import { execBaselineSchema } from "../helpers/baseline-db";

let testDb: import("better-sqlite3").Database | null = null;

jest.mock("@/lib/db", () => {
  const actualCrypto = jest.requireActual("crypto") as typeof import("crypto");
  return {
    getDb: () => testDb!,
    inTransaction: <T,>(fn: () => T) => testDb!.transaction(fn)(),
    uuid: () => actualCrypto.randomUUID(),
    now: () => new Date().toISOString(),
    ensureDb: () => undefined,
  };
});

const hermesHome = mkdtempSync(join(tmpdir(), "ps-b8-agents-"));

jest.mock("@/modules/hermes/lib/profile-paths", () => {
  const { buildHermesPathBundle } = jest.requireActual(
    "@/modules/hermes/lib/paths",
  ) as typeof import("@/modules/hermes/lib/paths");
  const resolveHome = (slug: string) =>
    slug === "default" ? hermesHome : join(hermesHome, "profiles", slug);
  return {
    getHermesDefaultRoot: () => hermesHome,
    resolveProfileHermesHome: resolveHome,
    buildProfileHermesPathBundle: (slug: string) => buildHermesPathBundle(resolveHome(slug)),
    isProfileHermesHome: (home: string) => /[\\/]profiles[\\/][^\\/]+$/.test(home),
  };
});

jest.mock("@/modules/hermes/lib/agent-runtime", () => {
  const { buildHermesPathBundle } = jest.requireActual(
    "@/modules/hermes/lib/paths",
  ) as typeof import("@/modules/hermes/lib/paths");
  return {
    getActiveHermesPaths: () => buildHermesPathBundle(hermesHome),
    getActiveHermesHome: () => hermesHome,
  };
});

// The push is the agent framework's business, not this route's.
const mockPushProfile = jest.fn(() => ({ success: true, error: null, filesWritten: [] }));
jest.mock("@/modules/hermes/lib/profile-push", () => ({
  ...(jest.requireActual("@/modules/hermes/lib/profile-push") as Record<string, unknown>),
  pushProfileToHermes: (...a: unknown[]) => mockPushProfile(...(a as [])),
}));

jest.mock("@/lib/audit-log", () => ({ appendAuditLine: jest.fn() }));
jest.mock("@/lib/analytics/record-event", () => ({ recordEvent: jest.fn() }));

import { NextRequest } from "next/server";

import { getAgentRoot, updateAgentRoot } from "@/lib/agent-root-repository";
import { getProfile, upsertProfile } from "@/modules/hermes/lib/profiles-repository";

const BOB_SOUL = "# Bob\n\nBob speaks plainly and finishes what he starts.\n";
const BOB_AGENTS = "# Bob's development guide\n\nRun the gate before you claim anything.\n";
const BOB_CONFIG = "skills:\n  disabled: []\nagent:\n  personality: warm\n";

async function postProfile(body: unknown) {
  const { POST } = await import("@/app/api/agent/profiles/route");
  const res = await POST(
    new NextRequest("http://localhost/api/agent/profiles", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
  return { status: res.status, json: (await res.json()) as { data?: Record<string, unknown>; error?: string } };
}

async function getProfiles() {
  const { GET } = await import("@/app/api/agent/profiles/route");
  const res = await GET(new NextRequest("http://localhost/api/agent/profiles"));
  const body = (await res.json()) as { data?: { profiles?: Array<Record<string, unknown>> } };
  return body.data?.profiles ?? [];
}

beforeEach(() => {
  const Database = require("better-sqlite3/lib/index.js") as typeof import("better-sqlite3");
  testDb = new (Database as unknown as new (p: string) => import("better-sqlite3").Database)(":memory:");
  testDb.pragma("foreign_keys = ON");
  execBaselineSchema(testDb);
  rmSync(hermesHome, { recursive: true, force: true });
  mkdirSync(hermesHome, { recursive: true });
  jest.clearAllMocks();
  mockPushProfile.mockReturnValue({ success: true, error: null, filesWritten: [] });
  updateAgentRoot({
    displayName: "Bob",
    soulMd: BOB_SOUL,
    agentsMd: BOB_AGENTS,
    configYaml: BOB_CONFIG,
    personality: "warm",
  });
});

afterEach(() => {
  testDb?.close();
  testDb = null;
});

afterAll(() => rmSync(hermesHome, { recursive: true, force: true }));

// ── FUSE ────────────────────────────────────────────────────────

describe("FUSE: this file writes only where it is allowed to", () => {
  it("resolves the Hermes home inside the OS temp directory", () => {
    const { getHermesDefaultRoot } = require("@/modules/hermes/lib/profile-paths") as {
      getHermesDefaultRoot: () => string;
    };
    expect(getHermesDefaultRoot().startsWith(tmpdir())).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// D18: the clone the modal offers by default
// ═══════════════════════════════════════════════════════════════

describe("Clone From: Default clones the root agent", () => {
  it("copies Bob's SOUL.md, AGENTS.md, config.yaml and personality", async () => {
    const { status } = await postProfile({ name: "Researcher", cloneFrom: "default" });

    expect(status).toBe(200);
    const created = getProfile("researcher");
    expect(created).not.toBeNull();
    expect(created!.soulMd).toBe(BOB_SOUL);
    expect(created!.agentsMd).toBe(BOB_AGENTS);
    expect(created!.configYaml).toBe(BOB_CONFIG);
    expect(created!.personality).toBe("warm");
  });

  it("does not write the boilerplate over it", async () => {
    await postProfile({ name: "Researcher", cloneFrom: "default" });

    const created = getProfile("researcher");
    expect(created!.soulMd).not.toMatch(/You are a subject matter expert/);
  });

  it("GREEN CONTROL: cloning a named profile still copies that one", async () => {
    upsertProfile({
      slug: "qa",
      displayName: "QA",
      description: "",
      personality: "technical",
      configYaml: "skills:\n  disabled: []\n",
      soulMd: "# QA\n\nReproduce first.\n",
      agentsMd: "# QA guide\n",
    });

    await postProfile({ name: "QA Two", cloneFrom: "qa" });

    expect(getProfile("qa-two")!.soulMd).toBe("# QA\n\nReproduce first.\n");
  });

  it("GREEN CONTROL: no clone source still writes the boilerplate", async () => {
    await postProfile({ name: "Blank Slate", cloneFrom: "" });

    expect(getProfile("blank-slate")!.soulMd).toMatch(/You are a subject matter expert/);
  });
});

// ═══════════════════════════════════════════════════════════════
// D24: the root agent has a name, and it can be changed
// ═══════════════════════════════════════════════════════════════

describe("the root agent's display name", () => {
  async function putRoot(body: unknown) {
    // Loaded lazily so a missing route reds these tests rather than the suite.
    const mod = (await import("@/app/api/agent/root/route" as string)) as {
      PUT?: (r: NextRequest) => Promise<Response>;
    };
    if (typeof mod.PUT !== "function") {
      throw new Error("src/app/api/agent/root/route.ts exports no PUT (contract D24)");
    }
    const res = await mod.PUT(
      new NextRequest("http://localhost/api/agent/root", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
    return { status: res.status, json: (await res.json()) as { data?: Record<string, unknown>; error?: string } };
  }

  it("PUT /api/agent/root renames it, in PatterStage only", async () => {
    const { status } = await putRoot({ displayName: "Atlas" });

    expect(status).toBe(200);
    expect(getAgentRoot().displayName).toBe("Atlas");
    // The rename is PatterStage's own label. Nothing about the agent's files
    // on disk changes, which is the whole reason it is safe to offer.
    expect(getAgentRoot().soulMd).toBe(BOB_SOUL);
  });

  it("the profiles listing answers the new name", async () => {
    await putRoot({ displayName: "Atlas" });

    const rootRow = (await getProfiles()).find((p) => p.isDefault);
    expect(rootRow?.name).toBe("Atlas");
  });

  it("stores the name without its padding", async () => {
    await putRoot({ displayName: "   Atlas   " });

    expect(getAgentRoot().displayName).toBe("Atlas");
  });

  it("refuses a body that asks for nothing", async () => {
    const { status } = await putRoot({});

    expect(status).toBe(400);
    expect(getAgentRoot().displayName).toBe("Bob");
  });

  it("refuses a blank name rather than leaving the agent unnamed", async () => {
    const { status } = await putRoot({ displayName: "   " });

    expect(status).toBe(400);
    expect(getAgentRoot().displayName).toBe("Bob");
  });

  it("the create refusal points at a control that now exists", async () => {
    const { status, json } = await postProfile({ name: "Default" });

    expect(status).toBe(409);
    // It used to say "Rename the root agent from Operations", a page that
    // never had the control. Whatever it says now must not send the operator
    // somewhere that cannot help them.
    expect(String(json.error)).not.toMatch(/from Operations/);
    expect(String(json.error)).toMatch(/default/);
  });
});

// ═══════════════════════════════════════════════════════════════
// D26: a file the editor can open is not missing
// ═══════════════════════════════════════════════════════════════

describe("the file list agrees with the editor", () => {
  beforeEach(() => {
    upsertProfile({
      slug: "qa",
      displayName: "QA",
      description: "Quality",
      personality: "technical",
      configYaml: "skills:\n  disabled: []\n",
      soulMd: "# QA\n\nReproduce first.\n",
      agentsMd: "# QA guide\n",
    });
  });

  it("a managed file held only in the database reports as present", async () => {
    // Nothing was written to disk for this profile, which is the state every
    // install is in until the first push.
    const qa = (await getProfiles()).find((p) => p.id === "qa");
    const files = (qa?.files ?? []) as Array<{ key: string; exists: boolean }>;

    expect(files.find((f) => f.key === "soul")?.exists).toBe(true);
    expect(files.find((f) => f.key === "agent")?.exists).toBe(true);
    expect(files.find((f) => f.key === "config")?.exists).toBe(true);
  });

  it("a managed file that is empty in both places is still missing", async () => {
    const qa = (await getProfiles()).find((p) => p.id === "qa");
    const files = (qa?.files ?? []) as Array<{ key: string; exists: boolean }>;

    // USER.md and MEMORY.md were never written for this profile.
    expect(files.find((f) => f.key === "user")?.exists).toBe(false);
  });

  it("GREEN CONTROL: a file on disk still reports as present", async () => {
    const dir = join(hermesHome, "profiles", "qa", "memories");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "USER.md"), "# User\n\nPrefers short answers.\n", "utf-8");

    const qa = (await getProfiles()).find((p) => p.id === "qa");
    const files = (qa?.files ?? []) as Array<{ key: string; exists: boolean; size: number }>;
    const user = files.find((f) => f.key === "user");

    expect(user?.exists).toBe(true);
    expect(user!.size).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// D28: a write that cannot happen says so
// ═══════════════════════════════════════════════════════════════

describe("PUT /api/agent/files/hermes for a named profile", () => {
  async function putFile(key: string, profile: string, content: string) {
    const { PUT } = await import("@/app/api/agent/files/[key]/route");
    const res = await PUT(
      new NextRequest(`http://localhost/api/agent/files/${key}?profile=${profile}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content }),
      }),
      { params: Promise.resolve({ key }) },
    );
    return { status: res.status, json: (await res.json()) as { error?: string } };
  }

  beforeEach(() => {
    upsertProfile({
      slug: "qa",
      displayName: "QA",
      description: "",
      personality: "technical",
      configYaml: "skills:\n  disabled: []\n",
      soulMd: "# QA\n",
      agentsMd: "# QA guide\n",
    });
  });

  it("answers 400 and pushes nothing, instead of 200 having written nothing", async () => {
    const { status, json } = await putFile("hermes", "qa", "# Framework\n");

    expect(status).toBe(400);
    expect(String(json.error)).toMatch(/HERMES\.md/);
    expect(mockPushProfile).not.toHaveBeenCalled();
  });

  it("GREEN CONTROL: SOUL.md for the same profile still saves", async () => {
    const { status } = await putFile("soul", "qa", "# QA\n\nRewritten.\n");

    expect(status).toBe(200);
    expect(getProfile("qa")!.soulMd).toBe("# QA\n\nRewritten.\n");
  });

  it("GREEN CONTROL: HERMES.md for the root agent still saves", async () => {
    const { status } = await putFile("hermes", "default", "# Framework\n\nRewritten.\n");

    expect(status).toBe(200);
    expect(getAgentRoot().frameworkMd).toBe("# Framework\n\nRewritten.\n");
  });
});
