/* eslint-disable @typescript-eslint/no-require-imports */
/** @jest-environment node */

// ═══════════════════════════════════════════════════════════════
// Acceptance oracle for T-0041: Pull must be able to converge what
// Drift measures.
//
// `fileHash` returns null for a file that is not on disk, while
// `contentHash(profile.userMd || "# User\n")` is always a real digest.
// So `null !== "<digest>"` and a profile with no memories/USER.md is
// drifted for ever. `pullProfileFromHermes` writes those columns only
// when the file exists, so no amount of pulling clears it; only Push
// can, which is why the banner's only CTA is "Push all to Hermes".
//
// Both directions are asserted deliberately, and the second half of
// this file is the more important half. A test that only proves
// "absent means no drift" also passes when drift detection is deleted
// outright, so every absent-file case below is paired with a
// differing-file case over the same field.
// ═══════════════════════════════════════════════════════════════

import { mkdtempSync, mkdirSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import { execBaselineSchema } from "../helpers/baseline-db";

let testDb: import("better-sqlite3").Database | null = null;
let hermesRoot = "";

function loadRealBetterSqlite3(): typeof import("better-sqlite3") {
  return require("better-sqlite3/lib/index.js") as typeof import("better-sqlite3");
}

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

jest.mock("@/modules/hermes/lib/profile-paths", () => {
  const actual = jest.requireActual(
    "@/modules/hermes/lib/profile-paths",
  ) as typeof import("@/modules/hermes/lib/profile-paths");
  return {
    ...actual,
    getHermesDefaultRoot: () => hermesRoot,
    resolveProfileHermesHome: (slug: string) => join(hermesRoot, "profiles", slug),
  };
});

function drift() {
  return require("@/modules/hermes/lib/profile-drift") as typeof import("@/modules/hermes/lib/profile-drift");
}

function profiles() {
  return require("@/modules/hermes/lib/profiles-repository") as typeof import("@/modules/hermes/lib/profiles-repository");
}

function rootRepo() {
  return require("@/lib/agent-root-repository") as typeof import("@/lib/agent-root-repository");
}

/** A profile whose disk root holds SOUL, AGENTS and config.yaml and nothing else. */
function seedProfileWithNoMemories(slug: string): string {
  const profileDir = join(hermesRoot, "profiles", slug);
  mkdirSync(profileDir, { recursive: true });
  writeFileSync(join(profileDir, "SOUL.md"), "# Soul on disk\n");
  writeFileSync(join(profileDir, "AGENTS.md"), "# Agents on disk\n");
  writeFileSync(join(profileDir, "config.yaml"), "skills:\n  disabled: []\n");

  profiles().upsertProfile({
    slug,
    displayName: slug,
    soulMd: "# Soul on disk\n",
    agentsMd: "# Agents on disk\n",
    userMd: "# User in database\n",
    memoryMd: "# Memory in database\n",
    configYaml: "skills:\n  disabled: []\n",
  });
  return profileDir;
}

beforeEach(() => {
  const Database = loadRealBetterSqlite3();
  testDb = new (Database as unknown as new (path: string) => import("better-sqlite3").Database)(
    ":memory:",
  );
  testDb.pragma("foreign_keys = ON");
  execBaselineSchema(testDb);
  hermesRoot = mkdtempSync(join(tmpdir(), "ps-drift-missing-"));
  writeFileSync(join(hermesRoot, "config.yaml"), "skills:\n  disabled: []\n");
});

afterEach(() => {
  testDb?.close();
  testDb = null;
});

describe("profile drift ignores files that are absent from disk", () => {
  it("reports no USER.md or MEMORY.md drift when memories/ does not exist", () => {
    seedProfileWithNoMemories("qa");

    const report = drift().detectProfileDrift("qa");
    expect(report.fields).not.toContain("USER.md");
    expect(report.fields).not.toContain("MEMORY.md");
  });

  it("reports no SOUL.md or AGENTS.md drift when neither file is on disk", () => {
    mkdirSync(join(hermesRoot, "profiles", "bare"), { recursive: true });
    writeFileSync(
      join(hermesRoot, "profiles", "bare", "config.yaml"),
      "skills:\n  disabled: []\n",
    );
    profiles().upsertProfile({
      slug: "bare",
      displayName: "Bare",
      soulMd: "# Soul in database\n",
      agentsMd: "# Agents in database\n",
      configYaml: "skills:\n  disabled: []\n",
    });

    const report = drift().detectProfileDrift("bare");
    expect(report.fields).not.toContain("SOUL.md");
    expect(report.fields).not.toContain("AGENTS.md");
  });

  it("still reports drift for every one of those files when it exists and differs", () => {
    const profileDir = seedProfileWithNoMemories("noisy");
    mkdirSync(join(profileDir, "memories"), { recursive: true });
    writeFileSync(join(profileDir, "SOUL.md"), "# Soul edited on disk\n");
    writeFileSync(join(profileDir, "AGENTS.md"), "# Agents edited on disk\n");
    writeFileSync(join(profileDir, "memories", "USER.md"), "# User edited on disk\n");
    writeFileSync(join(profileDir, "memories", "MEMORY.md"), "# Memory edited on disk\n");

    const report = drift().detectProfileDrift("noisy");
    expect(report.drifted).toBe(true);
    expect(report.fields).toEqual(
      expect.arrayContaining(["SOUL.md", "AGENTS.md", "USER.md", "MEMORY.md"]),
    );
  });

  it("reports no drift for a memory file that exists and matches", () => {
    const profileDir = seedProfileWithNoMemories("quiet");
    mkdirSync(join(profileDir, "memories"), { recursive: true });
    writeFileSync(join(profileDir, "memories", "USER.md"), "# User in database\n");
    writeFileSync(join(profileDir, "memories", "MEMORY.md"), "# Memory in database\n");

    const report = drift().detectProfileDrift("quiet");
    expect(report.fields).not.toContain("USER.md");
    expect(report.fields).not.toContain("MEMORY.md");
  });

  it("lets Pull clear the banner for a profile that has no memory files on disk", () => {
    // The QA report in the task record: "Pull all" visibly worked and the
    // drift banner stayed lit. This is that report as an assertion.
    const profileDir = seedProfileWithNoMemories("converge");
    writeFileSync(join(profileDir, "SOUL.md"), "# Soul edited on disk\n");

    const { pullProfileFromHermes } = require("@/modules/hermes/lib/profile-pull") as typeof import("@/modules/hermes/lib/profile-pull");
    const pull = pullProfileFromHermes("converge", { reconcileDisk: true });
    expect(pull.success).toBe(true);

    const report = drift().detectProfileDrift("converge");
    expect(report.fields).toEqual([]);
    expect(report.drifted).toBe(false);
  });
});

describe("root drift on a poisoned row is a banner, not a 500", () => {
  it("reports config.yaml drifted with the parse fault as syncError", () => {
    // T-0086: assembleRootConfig throws on an unparseable stored config; the
    // drift page is where the operator learns that, so it must render.
    rootRepo().updateAgentRoot({ configYaml: "model:\n  a: 1\nmodel:\n  b: 2\n" });

    const entry = drift().detectRootDrift();

    expect(entry.drifted).toBe(true);
    expect(entry.fields).toEqual(["config.yaml"]);
    expect(entry.syncError).toMatch(/did not parse/);
  });
});

describe("root drift ignores files that are absent from disk", () => {
  it("reports no SOUL/AGENTS/USER/MEMORY drift when none of them are on disk", () => {
    rootRepo().updateAgentRoot({
      soulMd: "# Root soul in database\n",
      agentsMd: "# Root agents in database\n",
      userMd: "# Root user in database\n",
      memoryMd: "# Root memory in database\n",
      configYaml: "skills:\n  disabled: []\n",
    });

    const report = drift().detectRootDrift();
    expect(report.fields).not.toContain("SOUL.md");
    expect(report.fields).not.toContain("AGENTS.md");
    expect(report.fields).not.toContain("USER.md");
    expect(report.fields).not.toContain("MEMORY.md");
  });

  it("still reports root drift for every one of those files when it exists and differs", () => {
    rootRepo().updateAgentRoot({
      soulMd: "# Root soul in database\n",
      agentsMd: "# Root agents in database\n",
      userMd: "# Root user in database\n",
      memoryMd: "# Root memory in database\n",
      configYaml: "skills:\n  disabled: []\n",
    });
    mkdirSync(join(hermesRoot, "memories"), { recursive: true });
    writeFileSync(join(hermesRoot, "SOUL.md"), "# Root soul on disk\n");
    writeFileSync(join(hermesRoot, "AGENTS.md"), "# Root agents on disk\n");
    writeFileSync(join(hermesRoot, "memories", "USER.md"), "# Root user on disk\n");
    writeFileSync(join(hermesRoot, "memories", "MEMORY.md"), "# Root memory on disk\n");

    const report = drift().detectRootDrift();
    expect(report.drifted).toBe(true);
    expect(report.fields).toEqual(
      expect.arrayContaining(["SOUL.md", "AGENTS.md", "USER.md", "MEMORY.md"]),
    );
  });

  it("keeps reporting HERMES.md drift, which was already guarded, when it differs", () => {
    rootRepo().updateAgentRoot({
      frameworkMd: "# Framework in database\n",
      configYaml: "skills:\n  disabled: []\n",
    });
    writeFileSync(join(hermesRoot, "HERMES.md"), "# Framework on disk\n");

    expect(drift().detectRootDrift().fields).toContain("HERMES.md");
  });
});
