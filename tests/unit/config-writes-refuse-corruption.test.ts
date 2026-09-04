/** @jest-environment node */

// T-0086 acceptance oracle, half two — no write path may launder corruption.
//
// The propagation loop the round-6 investigation traced: a corrupt parse
// poisons `agent_root.config_yaml`, push writes the corrupt text to disk with
// zero validation, `finalizeRootConfigOnDisk` copies the corrupt DISK text back
// into the DB, and on the next cycle `extractPreservedSections`' catch → {}
// silently DROPS every preserved section — compounding into data loss. Nine
// .broken/.corrupt backups over five months on the operator's machine.
//
// The posture pinned here: REFUSE AND REPORT, never launder, never auto-restore
// (a backup carries older model/provider settings; silently reviving one could
// flip the active model without consent). Every refusal names the newest
// backup that still parses, so the repair is one copy command away.

import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import * as yaml from "js-yaml";

const CORRUPT = "model:\n  default: a\nmodel:\n  default: b\n";
const CLEAN = "skills:\n  disabled: []\nmodel:\n  default: ok\n";

// ── FUSE: everything this file writes stays inside the OS temp dir ──────────
// The T-0082 incident rule: a missed mock once sent fixture writes into the
// operator's real Hermes home. Both path-resolving modules are mocked and the
// fuse test reads the values the code under test will actually use.
const scratch = mkdtempSync(join(tmpdir(), "ps-config-refuse-"));

jest.mock("@/modules/hermes/lib/agent-runtime", () => ({
  getActiveHermesPaths: () => ({
    root: join(scratch, "hermes"),
    config: join(scratch, "hermes", "config.yaml"),
    backups: join(scratch, "hermes", "backups"),
  }),
  getActiveHermesHome: () => join(scratch, "hermes"),
  getHermesDefaultRoot: () => join(scratch, "hermes"),
}));
jest.mock("@/modules/hermes/lib/profile-paths", () => ({
  getHermesDefaultRoot: () => join(scratch, "hermes"),
  resolveProfileHermesHome: (slug: string) => join(scratch, "hermes", "profiles", slug),
}));

const mockUpdateAgentRoot = jest.fn();
jest.mock("@/lib/agent-root-repository", () => ({
  getAgentRoot: jest.fn(),
  updateAgentRoot: (...a: unknown[]) => mockUpdateAgentRoot(...a),
  setAgentRootSyncStatus: jest.fn(),
}));

const mockGetModelDefaults = jest.fn();
jest.mock("@/lib/models-repository", () => ({
  getModelDefaults: () => mockGetModelDefaults(),
  getModel: jest.fn(() => null),
}));

jest.mock("@/lib/db", () => ({
  getDb: jest.fn(),
  ensureDb: jest.fn(),
  now: () => "2026-09-01T00:00:00Z",
  inTransaction: <T,>(fn: () => T) => fn(),
  uuid: () => "test-uuid",
}));

import {
  assertParseableConfigYaml,
  findLatestParseableBackup,
  writeHermesConfigFile,
} from "@/modules/hermes/lib/hermes-config-write";
import { writeWithBackup } from "@/modules/hermes/lib/profile-sync-shared";
import {
  configYamlToColumnValues,
  parseConfigYaml,
} from "@/modules/hermes/lib/profile-config-builder";
import {
  finalizeRootConfigOnDisk,
  syncSingleModelToHermesConfig,
} from "@/modules/hermes/lib/config-sync";

function freshHermes(): { home: string; config: string; backups: string } {
  const home = join(scratch, "hermes");
  rmSync(home, { recursive: true, force: true });
  mkdirSync(join(home, "backups"), { recursive: true });
  return { home, config: join(home, "config.yaml"), backups: join(home, "backups") };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetModelDefaults.mockReturnValue({});
  freshHermes();
});

afterAll(() => rmSync(scratch, { recursive: true, force: true }));

describe("FUSE: this file writes only inside the OS temp directory", () => {
  it("both path resolvers answer under the scratch dir", async () => {
    const runtime = await import("@/modules/hermes/lib/agent-runtime");
    const paths = await import("@/modules/hermes/lib/profile-paths");

    expect(runtime.getActiveHermesPaths().config).toContain("ps-config-refuse-");
    expect(paths.getHermesDefaultRoot()).toContain("ps-config-refuse-");
  });
});

describe("a failed parse is a fact, not an exception, not a default", () => {
  it("parseConfigYaml reports parseError instead of throwing", () => {
    // Never throws: the drift banner must render on a poisoned row, not 500.
    const parts = parseConfigYaml(CORRUPT);

    expect(parts.parseError).toBeTruthy();
    expect(parts.parseError).toMatch(/duplicated mapping key|duplicate/i);
  });

  it("configYamlToColumnValues THROWS on a failed parse", () => {
    // Rebuilding from a failed parse is exactly the silent preserved-section
    // drop that caused the data loss. The pull/push catch blocks convert this
    // throw into SyncResult.error + the row's syncError — the refusal surface.
    expect(() => configYamlToColumnValues(CORRUPT)).toThrow(/config\.yaml|parse/i);
  });

  it("GREEN CONTROL: a clean parse carries no parseError and converts fine", () => {
    expect(parseConfigYaml(CLEAN).parseError).toBeUndefined();
    expect(() => configYamlToColumnValues(CLEAN)).not.toThrow();
  });
});

describe("assembly refuses a poisoned row, naming the repair", () => {
  it("assembleRootConfig throws with the backup to restore", async () => {
    // Found by mutation: the throw at the assembly seam had no oracle, and it
    // is the one that turns a poisoned DB row into a refused push instead of
    // a corrupt file.
    const { backups } = freshHermes();
    writeFileSync(join(backups, "config.yaml.2026-08-30T10-00-00-000Z.bak"), CLEAN, "utf-8");
    const { assembleRootConfig } = await import("@/modules/hermes/lib/profile-sync-shared");
    const row = {
      id: 1, displayName: "", description: "", personality: "technical",
      configYaml: CORRUPT, soulMd: "", agentsMd: "", frameworkMd: "", userMd: "", memoryMd: "",
      disabledSkillsJson: "[]", platformToolsetsJson: "{}",
      syncedAt: null, syncError: null, updatedAt: "",
    };

    expect(() => assembleRootConfig(row)).toThrow(/did not parse/);
    expect(() => assembleRootConfig(row)).toThrow(/2026-08-30T10-00-00-000Z/);
  });
});

describe("the belt — no config.yaml write without a parse", () => {
  it("assertParseableConfigYaml refuses duplicate keys, naming the target", () => {
    expect(() => assertParseableConfigYaml(CORRUPT, "/h/config.yaml")).toThrow(/config\.yaml/);
  });

  it("keeps secrets out of the refusal", () => {
    // Same hygiene ruling the PUT /api/config test pinned: first-line fault
    // only, never the file body (which holds api_key lines on real installs).
    const withSecret = "api_key: sk-super-secret\nmodel:\n  a: 1\nmodel:\n  b: 2\n";
    let message = "";
    try {
      assertParseableConfigYaml(withSecret, "/h/config.yaml");
    } catch (e) {
      message = (e as Error).message;
    }

    expect(message).toBeTruthy();
    expect(message).not.toContain("sk-super-secret");
  });

  it("writeWithBackup refuses corrupt config.yaml content", () => {
    const { config, backups } = freshHermes();
    writeFileSync(config, CLEAN, "utf-8");

    expect(() => writeWithBackup(config, CORRUPT, backups)).toThrow();
    // The file on disk is untouched — refusal means refusal.
    expect(readFileSync(config, "utf-8")).toBe(CLEAN);
  });

  it("writeWithBackup still writes NON-config files freely", () => {
    // SOUL.md is prose; a YAML gate on it would refuse every real soul.
    const { home, backups } = freshHermes();
    const soul = join(home, "SOUL.md");

    writeWithBackup(soul, "model: [unbalanced", backups);

    expect(readFileSync(soul, "utf-8")).toBe("model: [unbalanced");
  });

  it("writeHermesConfigFile refuses corrupt serialised output", () => {
    const { config } = freshHermes();

    expect(() => writeHermesConfigFile(config, CORRUPT)).toThrow();
    expect(existsSync(config)).toBe(false);
  });

  it("GREEN CONTROL: clean content writes through both paths", () => {
    const { home, config, backups } = freshHermes();

    writeWithBackup(config, CLEAN, backups);
    expect(readFileSync(config, "utf-8")).toBe(CLEAN);

    const second = join(home, "config2.yaml");
    writeHermesConfigFile(second, CLEAN);
    expect(readFileSync(second, "utf-8")).toBe(CLEAN);
  });
});

describe("finalizeRootConfigOnDisk stops the re-poisoning", () => {
  it("does NOT copy unparseable disk text into the DB", () => {
    // This copy is the loop-closer: refuse-to-write followed by copy-the-
    // corruption-back was how one bad write became a permanently poisoned row.
    const { config } = freshHermes();
    writeFileSync(config, CORRUPT, "utf-8");

    const result = finalizeRootConfigOnDisk();

    const copiedCorrupt = mockUpdateAgentRoot.mock.calls.some(
      ([patch]) => typeof patch?.configYaml === "string" && patch.configYaml.includes("default: b"),
    );
    expect(copiedCorrupt).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("GREEN CONTROL: clean disk still round-trips into the DB", () => {
    const { config } = freshHermes();
    writeFileSync(config, CLEAN, "utf-8");

    const result = finalizeRootConfigOnDisk();

    expect(result.error ?? null).toBeNull();
    const copiedClean = mockUpdateAgentRoot.mock.calls.some(
      ([patch]) => typeof patch?.configYaml === "string" && patch.configYaml.includes("default: ok"),
    );
    expect(copiedClean).toBe(true);
  });
});

describe("refusal parity — the single-model sync stops 500ing", () => {
  it("refuses a corrupt file with an error, like its sibling", () => {
    const { config } = freshHermes();
    writeFileSync(config, CORRUPT, "utf-8");

    // Today: loadHermesConfigFromString throws → the per-model Push button
    // 500s with no repair guidance. The sibling (syncDefaultsToHermesConfig)
    // has had refuse-and-report since the corruption was first seen.
    let outcome: { error?: string } | "threw" = "threw";
    try {
      outcome = syncSingleModelToHermesConfig("any-model") as { error?: string };
    } catch {
      outcome = "threw";
    }

    expect(outcome).not.toBe("threw");
    expect((outcome as { error?: string }).error).toBeTruthy();
    // And it did not overwrite the file it could not parse.
    expect(readFileSync(config, "utf-8")).toBe(CORRUPT);
  });
});

describe("the repair is named, never performed", () => {
  it("finds the newest backup that still parses", () => {
    const { backups } = freshHermes();
    writeFileSync(join(backups, "config.yaml.2026-08-30T10-00-00-000Z.bak"), CLEAN, "utf-8");
    writeFileSync(join(backups, "config.yaml.2026-08-31T10-00-00-000Z.bak"), CORRUPT, "utf-8");
    writeFileSync(join(backups, "config.yaml.2026-08-31T11-00-00-000Z.bak"), CORRUPT, "utf-8");

    const found = findLatestParseableBackup(backups);

    // Newest-first scan, first that parses — the two corrupt newer ones are
    // exactly what a corruption-then-backup cycle leaves behind.
    expect(found).toContain("2026-08-30T10-00-00-000Z");
    expect(() => yaml.load(readFileSync(found!, "utf-8"))).not.toThrow();
  });

  it("prefers the NEWER of two parseable backups", () => {
    // Found by mutation: with one clean backup the scan direction is
    // invisible. Two clean ones pin newest-first, which matters because the
    // older a backup, the more model settings it silently rolls back.
    const { backups } = freshHermes();
    writeFileSync(join(backups, "config.yaml.2026-08-29T10-00-00-000Z.bak"), CLEAN, "utf-8");
    writeFileSync(join(backups, "config.yaml.2026-08-30T10-00-00-000Z.bak"), CLEAN, "utf-8");
    writeFileSync(join(backups, "config.yaml.2026-08-31T10-00-00-000Z.bak"), CORRUPT, "utf-8");

    expect(findLatestParseableBackup(backups)).toContain("2026-08-30T10-00-00-000Z");
  });

  it("returns null when no backup parses, rather than guessing", () => {
    const { backups } = freshHermes();
    writeFileSync(join(backups, "config.yaml.2026-08-31T10-00-00-000Z.bak"), CORRUPT, "utf-8");

    expect(findLatestParseableBackup(backups)).toBeNull();
  });

  it("survives a missing backups directory", () => {
    expect(findLatestParseableBackup(join(scratch, "nope"))).toBeNull();
  });
});
