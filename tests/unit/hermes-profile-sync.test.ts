/* eslint-disable @typescript-eslint/no-require-imports */
/** @jest-environment node */

import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
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
  const actual = jest.requireActual("@/modules/hermes/lib/profile-paths") as typeof import("@/modules/hermes/lib/profile-paths");
  return {
    ...actual,
    getHermesDefaultRoot: () => hermesRoot,
    resolveProfileHermesHome: (slug: string) => join(hermesRoot, "profiles", slug),
  };
});

beforeEach(() => {
  const Database = loadRealBetterSqlite3();
  testDb = new (Database as unknown as new (path: string) => import("better-sqlite3").Database)(
    ":memory:"
  );
  testDb.pragma("foreign_keys = ON");
  execBaselineSchema(testDb);
  hermesRoot = mkdtempSync(join(tmpdir(), "ch-hermes-sync-"));
  writeFileSync(join(hermesRoot, "config.yaml"), "version: 1\n");
});

afterEach(() => {
  testDb?.close();
  testDb = null;
});

describe("hermes-profile-sync", () => {
  it("push writes SOUL.md and pull reads it back", () => {
    const { upsertProfile } = require("@/modules/hermes/lib/profiles-repository") as typeof import("@/modules/hermes/lib/profiles-repository");
    const {
      pushProfileToHermes,
      pullProfileFromHermes,
      detectProfileDrift,
    } = require("@/modules/hermes/lib/profile-sync") as typeof import("@/modules/hermes/lib/profile-sync");

    upsertProfile({
      slug: "qa",
      displayName: "QA",
      soulMd: "# From DB",
      agentsMd: "# Agents",
      configYaml: "agent:\n  personality: technical\n",
    });

    const push = pushProfileToHermes("qa");
    expect(push.success).toBe(true);
    const soulPath = join(hermesRoot, "profiles", "qa", "SOUL.md");
    expect(existsSync(soulPath)).toBe(true);
    expect(readFileSync(soulPath, "utf-8")).toBe("# From DB");

    writeFileSync(soulPath, "# On disk");
    expect(detectProfileDrift("qa").drifted).toBe(true);

    const pull = pullProfileFromHermes("qa");
    expect(pull.success).toBe(true);
    const { getProfile } = require("@/modules/hermes/lib/profiles-repository") as typeof import("@/modules/hermes/lib/profiles-repository");
    expect(getProfile("qa")?.soulMd).toBe("# On disk");
  });

  it("pushAllProfiles onlyMissing skips profiles with existing SOUL on disk", () => {
    const { upsertProfile } = require("@/modules/hermes/lib/profiles-repository") as typeof import("@/modules/hermes/lib/profiles-repository");
    const { pushAllProfiles } = require("@/modules/hermes/lib/profile-sync") as typeof import("@/modules/hermes/lib/profile-sync");

    const soulPath = join(hermesRoot, "profiles", "qa", "SOUL.md");
    const agentsPath = join(hermesRoot, "profiles", "qa", "AGENTS.md");
    mkdirSync(join(hermesRoot, "profiles", "qa"), { recursive: true });
    writeFileSync(soulPath, "# User edit on disk");
    writeFileSync(agentsPath, "# User agents on disk");

    upsertProfile({
      slug: "qa",
      displayName: "QA",
      soulMd: "# From DB seed",
      agentsMd: "# Agents from DB",
      configYaml: "agent:\n  personality: technical\n",
    });

    const results = pushAllProfiles({ onlyMissing: true });
    expect(results).toHaveLength(0);
    expect(readFileSync(soulPath, "utf-8")).toBe("# User edit on disk");
  });

  it("pull normalizes granular cli toolsets into compact hermes-cli", () => {
    const { upsertProfile, getProfile } = require("@/modules/hermes/lib/profiles-repository") as typeof import("@/modules/hermes/lib/profiles-repository");
    const {
      pullProfileFromHermes,
      detectProfileDrift,
    } = require("@/modules/hermes/lib/profile-sync") as typeof import("@/modules/hermes/lib/profile-sync");

    const profileDir = join(hermesRoot, "profiles", "bob");
    mkdirSync(profileDir, { recursive: true });
    writeFileSync(join(profileDir, "SOUL.md"), "# Bob");
    writeFileSync(join(profileDir, "AGENTS.md"), "# Agents");
    writeFileSync(
      join(profileDir, "config.yaml"),
      [
        "skills:",
        "  disabled: []",
        "platform_toolsets:",
        "  cli:",
        "    - hermes-cli",
        "    - browser",
        "    - web",
        "    - terminal",
      ].join("\n") + "\n",
    );

    upsertProfile({
      slug: "bob",
      displayName: "Bob",
      soulMd: "# Bob",
      agentsMd: "# Agents",
      configYaml: "agent:\n  personality: technical\n",
    });

    const pull = pullProfileFromHermes("bob");
    expect(pull.success).toBe(true);
    const row = getProfile("bob");
    const json = JSON.parse(row?.platformToolsetsJson ?? "{}") as Record<string, string[]>;
    expect(json.cli).toEqual(["hermes-cli"]);
    const drift = detectProfileDrift("bob");
    expect(drift.fields).not.toContain("config.yaml");
  });
});
