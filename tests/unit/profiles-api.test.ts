/** @jest-environment node */

// Mock filesystem before importing the route
const mockExistsSync = jest.fn();
const mockMkdirSync = jest.fn();
const mockWriteFileSync = jest.fn();
const mockReadFileSync = jest.fn();
const mockStatSync = jest.fn();
const mockReaddirSync = jest.fn();
const mockRmSync = jest.fn();

jest.mock("fs", () => ({
  existsSync: mockExistsSync,
  mkdirSync: mockMkdirSync,
  writeFileSync: mockWriteFileSync,
  readFileSync: mockReadFileSync,
  statSync: mockStatSync,
  readdirSync: mockReaddirSync,
  rmSync: mockRmSync,
  renameSync: jest.fn(),
}));

jest.mock("@/modules/hermes/lib/agent-runtime", () => ({
  getActiveHermesHome: jest.fn(() => "/tmp/test-hermes"),
  getActiveHermesPaths: jest.fn(() => ({
    root: "/tmp/test-hermes",
    profiles: "/tmp/test-hermes/profiles",
    config: "/tmp/test-hermes/config.yaml",
    env: "/tmp/test-hermes/.env",
    soul: "/tmp/test-hermes/SOUL.md",
    hermes: "/tmp/test-hermes/HERMES.md",
    agents: "/tmp/test-hermes/AGENTS.md",
    skills: "/tmp/test-hermes/skills",
    sessions: "/tmp/test-hermes/sessions",
    logs: "/tmp/test-hermes/logs",
    backups: "/tmp/test-hermes/backups",
    cronJobs: "/tmp/test-hermes/cron/jobs.json",
    memoryDb: "/tmp/test-hermes/memory_store.db",
  })),
  getAgentLlmEndpoints: jest.fn(() => ({
    apiUrl: "http://127.0.0.1:9/v1/chat/completions",
    gatewayBase: "http://127.0.0.1:9",
  })),
}));

jest.mock("@/lib/paths", () => ({
  PS_DATA_DIR: "/tmp/ch-data",
  PATHS: {
    missions: "/tmp/ch-data/missions",
    patterStageDb: "/tmp/ch-data/control-hub.db",
    templates: "/tmp/ch-data/templates",
    stories: "/tmp/ch-data/stories",
    recroom: "/tmp/ch-data/recroom",
    workspaces: "/tmp/ch-data/workspaces",
    auditLog: "/tmp/ch-data/audit",
    psScripts: "/tmp/ch-data/scripts",
    psHardwareLogs: "/tmp/ch-data/logs",
  },
  getPsScriptsDir: () => "/tmp/ch-data/scripts",
  getPsHardwareLogDir: () => "/tmp/ch-data/logs",
}));

jest.mock("@/lib/api-logger", () => ({
  logApiError: jest.fn(),
  serverErrorFromCatch: jest.fn(
    (route: string, context: string, _error: unknown, message: string) => {
      const { logApiError: log } = jest.requireMock("@/lib/api-logger") as {
        logApiError: jest.Mock;
      };
      log(route, context, _error);
      const { NextResponse } = jest.requireActual("next/server") as {
        NextResponse: { json: (b: unknown, i?: { status: number }) => unknown };
      };
      return NextResponse.json({ error: message }, { status: 500 });
    },
  ),
}));

jest.mock("@/lib/fs/path-security", () => ({
  resolveSafeProfileName: (p: string | null) => {
    const profile = (p || "default").trim();
    if (profile === "default" || profile === "") return { ok: true, profile: "default" };
    if (/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(profile)) return { ok: true, profile };
    return { ok: false, error: "Invalid profile name" };
  },
  requireSafeProfileName: (p: string | null) => {
    const profile = (p || "default").trim();
    if (profile === "default" || profile === "") return { profile: "default" };
    if (/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(profile)) return { profile };
    const { NextResponse } = jest.requireActual("next/server") as {
      NextResponse: { json: (b: unknown, i?: { status: number }) => unknown };
    };
    return NextResponse.json({ error: "Invalid profile name" }, { status: 400 });
  },
}));

jest.mock("@/lib/api-auth", () => ({
}));

jest.mock("@/lib/audit-log", () => ({
  appendAuditLine: jest.fn(),
}));

const store = new Map<
  string,
  {
    slug: string;
    displayName: string;
    description: string;
    personality: string;
    configYaml: string;
    soulMd: string;
    agentsMd: string;
    seedKey: string | null;
    syncedAt: string | null;
    syncError: string | null;
    createdAt: string;
    updatedAt: string;
  }
>();

jest.mock("@/lib/db", () => ({
  ensureDb: jest.fn(),
}));

jest.mock("@/lib/agent-root-repository", () => ({
  getAgentRoot: jest.fn(() => ({
    id: 1,
    displayName: "Bob",
    description: "Main agent",
    personality: "technical",
    configYaml: "skills:\n  disabled: []\n",
    soulMd: "",
    agentsMd: "",
    frameworkMd: "",
    userMd: "",
    memoryMd: "",
    disabledSkillsJson: "[]",
    platformToolsetsJson: "{}",
    syncedAt: null,
    syncError: null,
    updatedAt: "",
  })),
}));

jest.mock("@/modules/hermes/lib/profiles-repository", () => ({
  listProfiles: jest.fn(() =>
    [...store.values()].map((r) => ({
      slug: r.slug,
      displayName: r.displayName,
      description: r.description,
      personality: r.personality,
      configYaml: r.configYaml,
      soulMd: r.soulMd,
      agentsMd: r.agentsMd,
      seedKey: r.seedKey,
      syncedAt: r.syncedAt,
      syncError: r.syncError,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
  ),
  getProfile: jest.fn((slug: string) => {
    const r = store.get(slug);
    if (!r) return null;
    return {
      slug: r.slug,
      displayName: r.displayName,
      description: r.description,
      personality: r.personality,
      configYaml: r.configYaml,
      soulMd: r.soulMd,
      agentsMd: r.agentsMd,
      seedKey: r.seedKey,
      syncedAt: r.syncedAt,
      syncError: r.syncError,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }),
  upsertProfile: jest.fn((input: { slug: string; displayName: string; description?: string; personality?: string; configYaml?: string; soulMd?: string; agentsMd?: string; seedKey?: string | null }) => {
    const ts = new Date().toISOString();
    const existing = store.get(input.slug);
    store.set(input.slug, {
      slug: input.slug,
      displayName: input.displayName,
      description: input.description ?? existing?.description ?? "",
      personality: input.personality ?? existing?.personality ?? "technical",
      configYaml: input.configYaml ?? existing?.configYaml ?? "",
      soulMd: input.soulMd ?? existing?.soulMd ?? "",
      agentsMd: input.agentsMd ?? existing?.agentsMd ?? "",
      seedKey: input.seedKey ?? existing?.seedKey ?? null,
      syncedAt: existing?.syncedAt ?? null,
      syncError: existing?.syncError ?? null,
      createdAt: existing?.createdAt ?? ts,
      updatedAt: ts,
    });
    return store.get(input.slug);
  }),
  defaultConfigYaml: jest.fn((p: string) => `agent:\n  personality: ${p}\nskills:\n  enabled: []\n`),
}));

jest.mock("@/modules/hermes/lib/profile-push", () => ({
  pushProfileToHermes: jest.fn(() => ({ success: true, slug: "", backupPath: null, error: null })),
}));

jest.mock("@/modules/hermes/lib/profile-drift", () => ({
  detectProfileDrift: jest.fn(() => ({ slug: "", drifted: false, fields: [], syncError: null })),
  detectRootDrift: jest.fn(() => ({ drifted: false, fields: [], syncError: null })),
}));

jest.mock("@/modules/hermes/lib/profile-counts", () => ({
  countProfileSkills: jest.fn(() => 0),
  countProfileToolsets: jest.fn(() => 0),
}));

jest.mock("@/modules/hermes/lib/profile-paths", () => ({
  buildProfileHermesPathBundle: jest.fn((slug: string) => ({
    soul: `/tmp/test-hermes/profiles/${slug}/SOUL.md`,
    agents: `/tmp/test-hermes/profiles/${slug}/AGENTS.md`,
    hermes: `/tmp/test-hermes/profiles/${slug}/HERMES.md`,
    userMemory: `/tmp/test-hermes/profiles/${slug}/memories/USER.md`,
    agentMemory: `/tmp/test-hermes/profiles/${slug}/memories/MEMORY.md`,
    config: `/tmp/test-hermes/profiles/${slug}/config.yaml`,
  })),
}));

import { NextRequest } from "next/server";
import { mockRequest } from "../helpers/api-test-helpers";

function makeRequest(url: string, method: string = "GET", body?: unknown) {
  return new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { "content-type": "application/json" } : undefined,
  });
}

describe("GET /api/agent/profiles", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    store.clear();
    mockExistsSync.mockReturnValue(false);
  });

  it("returns the default profile even without profiles directory", async () => {
    // config.yaml doesn't exist
    mockExistsSync.mockImplementation((p: string) => {
      if (p.includes("config.yaml")) return false;
      return false;
    });
    mockReaddirSync.mockReturnValue([]);

    const { GET } = await import("@/app/api/agent/profiles/route");
    const res = await GET(mockRequest("http://127.0.0.1/api/test"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data.profiles).toHaveLength(1);
    expect(data.data.profiles[0].id).toBe("default");
    expect(data.data.profiles[0].name).toBe("Bob (local default)");
    expect(data.data.profiles[0].isDefault).toBe(true);
    expect(data.data.profiles[0].isBundled).toBe(false);
  });

  it("includes profiles from the database", async () => {
    store.set("qa", {
      slug: "qa",
      displayName: "QA",
      description: "Quality",
      personality: "technical",
      configYaml: "",
      soulMd: "",
      agentsMd: "",
      seedKey: "ch.prof.qa",
      syncedAt: null,
      syncError: null,
      createdAt: "",
      updatedAt: "",
    });

    const { GET } = await import("@/app/api/agent/profiles/route");
    const res = await GET(mockRequest("http://127.0.0.1/api/test"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data.profiles).toHaveLength(2);
    const qaProfile = data.data.profiles.find((p: { id: string }) => p.id === "qa");
    expect(qaProfile).toBeDefined();
    expect(qaProfile.name).toBe("QA");
    expect(qaProfile.isBundled).toBe(true);
  });

  it("marks seeded profiles with isBundled: true", async () => {
    store.set("qa", {
      slug: "qa",
      displayName: "QA",
      description: "",
      personality: "technical",
      configYaml: "",
      soulMd: "",
      agentsMd: "",
      seedKey: "ch.prof.qa",
      syncedAt: null,
      syncError: null,
      createdAt: "",
      updatedAt: "",
    });
    store.set("custom-agent", {
      slug: "custom-agent",
      displayName: "Custom",
      description: "",
      personality: "technical",
      configYaml: "",
      soulMd: "",
      agentsMd: "",
      seedKey: null,
      syncedAt: null,
      syncError: null,
      createdAt: "",
      updatedAt: "",
    });

    const { GET } = await import("@/app/api/agent/profiles/route");
    const res = await GET(mockRequest("http://127.0.0.1/api/test"));
    const data = await res.json();

    const qa = data.data.profiles.find((p: { id: string }) => p.id === "qa");
    const custom = data.data.profiles.find((p: { id: string }) => p.id === "custom-agent");

    expect(qa.isBundled).toBe(true);
    expect(custom.isBundled).toBe(false);
  });

  it("uses display names from the database", async () => {
    store.set("swe", {
      slug: "swe",
      displayName: "SWE",
      description: "",
      personality: "technical",
      configYaml: "",
      soulMd: "",
      agentsMd: "",
      seedKey: "ch.prof.swe",
      syncedAt: null,
      syncError: null,
      createdAt: "",
      updatedAt: "",
    });

    const { GET } = await import("@/app/api/agent/profiles/route");
    const res = await GET(mockRequest("http://127.0.0.1/api/test"));
    const data = await res.json();

    const swe = data.data.profiles.find((p: { id: string }) => p.id === "swe");
    expect(swe.name).toBe("SWE");
  });
});

describe("POST /api/agent/profiles", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    store.clear();
    mockExistsSync.mockReturnValue(false);
    mockReadFileSync.mockReturnValue("");
  });

  it("rejects missing name", async () => {
    const { POST } = await import("@/app/api/agent/profiles/route");
    const res = await POST(makeRequest("http://localhost/api/agent/profiles", "POST", {}));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Name is required");
  });

  it("rejects name shorter than 2 chars", async () => {
    const { POST } = await import("@/app/api/agent/profiles/route");
    const res = await POST(makeRequest("http://localhost/api/agent/profiles", "POST", { name: "a" }));
    expect(res.status).toBe(400);
  });

  it("rejects duplicate profile names", async () => {
    store.set("existing", {
      slug: "existing",
      displayName: "Existing",
      description: "",
      personality: "technical",
      configYaml: "",
      soulMd: "",
      agentsMd: "",
      seedKey: null,
      syncedAt: null,
      syncError: null,
      createdAt: "",
      updatedAt: "",
    });

    const { POST } = await import("@/app/api/agent/profiles/route");
    const res = await POST(makeRequest("http://localhost/api/agent/profiles", "POST", {
      name: "Existing",
    }));
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toContain("already exists");
  });

  it("creates a new profile with correct directory structure", async () => {
    const { POST } = await import("@/app/api/agent/profiles/route");
    const res = await POST(makeRequest("http://localhost/api/agent/profiles", "POST", {
      name: "Research Assistant",
      description: "Academic research",
    }));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.slug).toBe("research-assistant");
    expect(store.has("research-assistant")).toBe(true);
  });

  it("clones from an existing profile when cloneFrom is specified", async () => {
    store.set("source-agent", {
      slug: "source-agent",
      displayName: "Source",
      description: "",
      personality: "technical",
      configYaml: "",
      soulMd: "# Source Agent\n",
      agentsMd: "",
      seedKey: null,
      syncedAt: null,
      syncError: null,
      createdAt: "",
      updatedAt: "",
    });

    const { POST } = await import("@/app/api/agent/profiles/route");
    const res = await POST(makeRequest("http://localhost/api/agent/profiles", "POST", {
      name: "Cloned Agent",
      cloneFrom: "source-agent",
    }));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.slug).toBe("cloned-agent");
    expect(store.get("cloned-agent")?.soulMd).toContain("Source Agent");
  });
});

// T-0060/T-0061 acceptance oracle — the create path must judge the NAME, not the
// slug it has already laundered out of the name.
//
// THE DEFECT. route.ts slugifies at :146 and validates at :148-149. Because
// PROFILE_SLUG_PATTERN is a strict SUBSET of PROFILE_PATTERN, every value
// slugifyDisplayName can return satisfies the validator by construction,
// including its literal "profile" fallback. Those two lines can never return
// 400. The sanitiser has already destroyed the evidence the validator exists to
// inspect, so "../evil" arrives as a legitimate-looking profile called "evil".
//
// AND ONE NAME IS DESTRUCTIVE. "Default" slugifies to "default", which is absent
// from agent_profiles (the root agent lives in agent_root), so the 409 never
// fires. resolveProfileHermesHome("default") then returns the ROOT Hermes home
// rather than profiles/default, and the push rewrites config.yaml, SOUL.md,
// AGENTS.md, USER.md and MEMORY.md with boilerplate. HTTP 200. Reachable from
// "Default", "DEFAULT", "de fault" and "Default!".
describe("POST /api/agent/profiles refuses a name that was never a name", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    store.clear();
    mockExistsSync.mockReturnValue(false);
    mockReadFileSync.mockReturnValue("");
  });

  const hostile: Array<[string, string]> = [
    ["..", "traversal"],
    ["../evil", "traversal"],
    ["a/../b", "a path separator"],
    [".hidden", "a leading dot"],
    ["CON", "a Windows reserved device name"],
  ];

  it.each(hostile)("refuses %s (%s) with a 400 and creates nothing", async (name) => {
    const { POST } = await import("@/app/api/agent/profiles/route");
    const { pushProfileToHermes } = jest.requireMock("@/modules/hermes/lib/profile-push") as {
      pushProfileToHermes: jest.Mock;
    };

    const res = await POST(makeRequest("http://localhost/api/agent/profiles", "POST", { name }));

    expect(res.status).toBe(400);
    expect(store.size).toBe(0);
    expect(pushProfileToHermes).not.toHaveBeenCalled();
  });

  it("refuses a name with nothing left to slugify, rather than calling it 'profile'", async () => {
    // A rocket emoji has length 2, so it clears the min-length check, then
    // slugifies to "" and hits the literal "profile" fallback. Two operators
    // naming their agents with different emoji would collide on one slug and be
    // told a profile they never named already exists.
    const { POST } = await import("@/app/api/agent/profiles/route");

    const res = await POST(
      makeRequest("http://localhost/api/agent/profiles", "POST", { name: "\u{1F680}" }),
    );

    expect(res.status).toBe(400);
    expect(store.size).toBe(0);
  });

  it("keeps emoji that is decoration rather than the whole name", async () => {
    // GREEN CONTROL. The rule rejects a name that yields no slug, NOT a name
    // that happens to contain an emoji. Without this the fix could over-reach
    // into "reject anything non-ascii" and the test above would still pass.
    const { POST } = await import("@/app/api/agent/profiles/route");

    const res = await POST(
      makeRequest("http://localhost/api/agent/profiles", "POST", { name: "Rocket \u{1F680}" }),
    );

    expect(res.status).toBe(200);
    expect(store.has("rocket")).toBe(true);
  });

  it("refuses a name that resolves to the root agent, and pushes nothing", async () => {
    // The destructive one. Today this answers 200 and overwrites the root
    // agent's identity files.
    const { POST } = await import("@/app/api/agent/profiles/route");
    const { pushProfileToHermes } = jest.requireMock("@/modules/hermes/lib/profile-push") as {
      pushProfileToHermes: jest.Mock;
    };

    const res = await POST(
      makeRequest("http://localhost/api/agent/profiles", "POST", { name: "Default" }),
    );

    expect(res.status).toBe(409);
    expect(pushProfileToHermes).not.toHaveBeenCalled();
    expect(store.size).toBe(0);
  });

  it.each(["default", "DEFAULT", "de fault", "Default!"])(
    "refuses %s too, because the slug is what decides",
    async (name) => {
      const { POST } = await import("@/app/api/agent/profiles/route");
      const res = await POST(makeRequest("http://localhost/api/agent/profiles", "POST", { name }));
      expect(res.status).toBe(409);
    },
  );

  it("still creates an ordinary profile", async () => {
    // GREEN CONTROL. Stops the fix degenerating into "refuse everything".
    const { POST } = await import("@/app/api/agent/profiles/route");

    const res = await POST(
      makeRequest("http://localhost/api/agent/profiles", "POST", { name: "QA Engineer" }),
    );

    expect(res.status).toBe(200);
    expect((await res.json()).data.slug).toBe("qa-engineer");
  });
});

describe("the slug validator on the create path is unreachable, and that is the bug", () => {
  it("no hostile name survives slugifyDisplayName as an invalid slug", async () => {
    // GREEN ON ARRIVAL, and it is the proof that route.ts:148-149 is dead code
    // rather than a working guard. Every value the sanitiser can produce already
    // satisfies the validator, so the validator can never fire. Keeping the
    // check is right (it is a fence at a filesystem boundary); believing it
    // guards the create path is not.
    const { slugifyDisplayName, isValidProfileSlug } = await import("@/lib/profile-slug");

    for (const name of ["..", "../evil", "a/../b", ".hidden", "\u{1F680}", "!!!", "///"]) {
      expect(isValidProfileSlug(slugifyDisplayName(name))).toBe(true);
    }
  });
});
