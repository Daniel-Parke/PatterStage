/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports -- better-sqlite3's package root is not newable under the jest transform */

/**
 * B9 oracle, the skills routes as they behave (T-0103, D81, D82).
 *
 * The sweep asked for these: the structural cases in
 * b9-tools-and-skills-routes pin the shape of the change, and a mutant that
 * keeps the shape and removes the behaviour walked through all of them. The
 * database here is real and in memory, and the agent's skills directory is a
 * real temp tree, so "on disk but not in the catalogue" is a fact rather than
 * a mock's opinion.
 */

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

const hermesHome = mkdtempSync(join(tmpdir(), "ps-b9-skills-"));
const skillsRoot = join(hermesHome, "skills");

jest.mock("@/modules/hermes/lib/agent-runtime", () => {
  const { buildHermesPathBundle } = jest.requireActual(
    "@/modules/hermes/lib/paths",
  ) as typeof import("@/modules/hermes/lib/paths");
  return {
    getActiveHermesPaths: () => buildHermesPathBundle(hermesHome),
    getActiveHermesHome: () => hermesHome,
  };
});
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
jest.mock("@/modules/hermes/lib/profile-push", () => ({
  ...(jest.requireActual("@/modules/hermes/lib/profile-push") as Record<string, unknown>),
  pushProfileToHermes: () => ({ success: true, error: null, filesWritten: [] }),
}));
jest.mock("@/lib/audit-log", () => ({ appendAuditLine: jest.fn() }));
jest.mock("@/lib/analytics/record-event", () => ({ recordEvent: jest.fn() }));

import { NextRequest } from "next/server";

import { upsertSkill } from "@/lib/skills-repository";
import { getAgentRoot } from "@/lib/agent-root-repository";

/** Write a SKILL.md into the agent's own skills tree. */
function writeDiskSkill(key: string, body: string): void {
  const dir = join(skillsRoot, ...key.split("/"));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "SKILL.md"), body, "utf-8");
}

async function toggle(name: string, enabled: boolean) {
  const { PUT } = await import("@/app/api/skills/[name]/toggle/route");
  const res = await PUT(
    new NextRequest(`http://localhost/api/skills/${name}/toggle`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profile: "default", enabled }),
    }),
    { params: Promise.resolve({ name }) },
  );
  return { status: res.status, json: (await res.json()) as { error?: string } };
}

async function readSkill(segments: string[]) {
  const { GET } = await import("@/app/api/skills/[...path]/route");
  const res = await GET(
    new NextRequest(`http://localhost/api/skills/${segments.join("/")}`),
    { params: Promise.resolve({ path: segments }) },
  );
  return {
    status: res.status,
    body: (await res.json()) as { data?: Record<string, unknown>; error?: string },
  };
}

beforeEach(() => {
  const Database = require("better-sqlite3/lib/index.js") as typeof import("better-sqlite3");
  testDb = new (Database as unknown as new (p: string) => import("better-sqlite3").Database)(":memory:");
  testDb.pragma("foreign_keys = ON");
  execBaselineSchema(testDb);
  rmSync(hermesHome, { recursive: true, force: true });
  mkdirSync(skillsRoot, { recursive: true });
  jest.clearAllMocks();
});

afterEach(() => {
  testDb?.close();
  testDb = null;
});

afterAll(() => rmSync(hermesHome, { recursive: true, force: true }));

// ═══════════════════════════════════════════════════════════════
// D82: a skill the list shows is a skill that toggles
// ═══════════════════════════════════════════════════════════════

describe("PUT /api/skills/[name]/toggle", () => {
  it("turns off a skill that is on disk and not in the catalogue", async () => {
    writeDiskSkill("field-notes", "---\nname: field-notes\n---\n\nTake notes.\n");

    const { status } = await toggle("field-notes", false);

    expect(status).toBe(200);
    expect(JSON.parse(getAgentRoot().disabledSkillsJson || "[]")).toContain("field-notes");
  });

  it("GREEN CONTROL: a catalogue skill still toggles", async () => {
    upsertSkill({
      skillKey: "writing",
      displayName: "Writing",
      description: "Prose",
      category: "creative",
      content: "# Writing\n",
      source: "bundled",
    });

    const { status } = await toggle("writing", false);

    expect(status).toBe(200);
    expect(JSON.parse(getAgentRoot().disabledSkillsJson || "[]")).toContain("writing");
  });

  it("still refuses a name that is in neither place", async () => {
    const { status, json } = await toggle("not-a-skill-at-all", false);

    expect(status).toBe(404);
    expect(String(json.error)).toMatch(/not-a-skill-at-all/);
    expect(JSON.parse(getAgentRoot().disabledSkillsJson || "[]")).toEqual([]);
  });
});

describe("skillIsKnown", () => {
  it("answers for a skill that exists only on disk", async () => {
    writeDiskSkill("field-notes", "# Field notes\n");
    const { skillIsKnown } = await import("@/modules/hermes/lib/skills-known");

    expect(skillIsKnown("field-notes")).toBe(true);
  });

  it("answers for a skill that exists only in the catalogue", async () => {
    upsertSkill({
      skillKey: "writing",
      displayName: "Writing",
      description: "Prose",
      category: "creative",
      content: "# Writing\n",
      source: "bundled",
    });
    const { skillIsKnown } = await import("@/modules/hermes/lib/skills-known");

    expect(skillIsKnown("writing")).toBe(true);
  });

  it("and for nothing else", async () => {
    const { skillIsKnown } = await import("@/modules/hermes/lib/skills-known");

    expect(skillIsKnown("neither-place")).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// D81: the viewer is the catalogue's destination
// ═══════════════════════════════════════════════════════════════

describe("GET /api/skills/[...path]", () => {
  it("answers from the catalogue when SKILL.md is not on disk", async () => {
    upsertSkill({
      skillKey: "writing",
      displayName: "Writing",
      description: "Prose that lands",
      category: "creative",
      content: "---\nname: writing\ndescription: Prose that lands\n---\n\n# Writing\n\nBe brief.\n",
      source: "bundled",
    });

    const { status, body } = await readSkill(["writing"]);

    expect(status).toBe(200);
    expect(body.data?.source).toBe("catalog");
    expect(String(body.data?.content)).toMatch(/Be brief\./);
    // Linked files live beside a SKILL.md that is not there.
    expect(body.data?.linkedFiles).toEqual([]);
  });

  it("prefers the disk when the file is there, and says so", async () => {
    writeDiskSkill("writing", "---\nname: writing\n---\n\n# On disk\n");
    upsertSkill({
      skillKey: "writing",
      displayName: "Writing",
      description: "Prose",
      category: "creative",
      content: "# In the database\n",
      source: "bundled",
    });

    const { status, body } = await readSkill(["writing"]);

    expect(status).toBe(200);
    expect(body.data?.source).toBe("disk");
    expect(String(body.data?.content)).toMatch(/On disk/);
  });

  it("still 404s for a name neither place knows", async () => {
    const { status } = await readSkill(["neither-place"]);

    expect(status).toBe(404);
  });
});
