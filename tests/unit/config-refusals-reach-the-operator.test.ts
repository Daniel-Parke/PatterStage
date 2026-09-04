/** @jest-environment node */

// T-0086, the seams above the assembler. The writers now refuse; these pin
// that a refusal is not swallowed on its way up to the person who can act on
// it. Push used to discard finalize's result entirely, and the per-model push
// destructured only backupPath, so a refusal read as success with a toast.

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const scratch = mkdtempSync(join(tmpdir(), "ps-config-refusals-"));
const hermes = join(scratch, "hermes");

// FUSE (T-0082): every path resolver answers under the scratch dir.
jest.mock("@/modules/hermes/lib/profile-paths", () => ({
  getHermesDefaultRoot: () => hermes,
  resolveProfileHermesHome: (slug: string) => join(hermes, "profiles", slug),
}));
jest.mock("@/modules/hermes/lib/agent-runtime", () => ({
  getActiveHermesPaths: () => ({ root: hermes, config: join(hermes, "config.yaml"), backups: join(hermes, "backups") }),
  getActiveHermesHome: () => hermes,
  getHermesDefaultRoot: () => hermes,
}));

const mockFinalize = jest.fn();
const mockSyncSingle = jest.fn();
jest.mock("@/modules/hermes/lib/config-sync", () => ({
  finalizeRootConfigOnDisk: () => mockFinalize(),
  syncSingleModelToHermesConfig: (id: string) => mockSyncSingle(id),
  syncDefaultsToHermesConfig: jest.fn(),
}));

const mockSetRootStatus = jest.fn();
const CLEAN_ROW = {
  id: 1, displayName: "", description: "", personality: "technical",
  configYaml: "skills:\n  disabled: []\n", soulMd: "# s", agentsMd: "# a", frameworkMd: "",
  userMd: "", memoryMd: "", disabledSkillsJson: "[]", platformToolsetsJson: "{}",
  syncedAt: null, syncError: null, updatedAt: "",
};
jest.mock("@/lib/agent-root-repository", () => ({
  getAgentRoot: () => CLEAN_ROW,
  updateAgentRoot: jest.fn(),
  setAgentRootSyncStatus: (...a: unknown[]) => mockSetRootStatus(...a),
}));

jest.mock("@/lib/models-repository", () => ({
  getModel: (id: string) => (id === "m1" ? { id: "m1", name: "Model One", provider: "openai", modelId: "gpt" } : null),
  listModels: () => [],
  getModelDefaults: () => ({}),
}));

jest.mock("@/lib/db", () => ({
  getDb: jest.fn(),
  ensureDb: jest.fn(),
  now: () => "2026-09-01T00:00:00Z",
  inTransaction: <T,>(fn: () => T) => fn(),
  uuid: () => "test-uuid",
}));

import { pushRootToHermes } from "@/modules/hermes/lib/profile-push";
import { pushModelToHermes } from "@/modules/hermes/lib/sync-manager";

beforeEach(() => {
  jest.clearAllMocks();
  rmSync(hermes, { recursive: true, force: true });
  mkdirSync(join(hermes, "backups"), { recursive: true });
  writeFileSync(join(hermes, "config.yaml"), "skills:\n  disabled: []\n", "utf-8");
});
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

describe("FUSE", () => {
  it("resolvers answer under the scratch dir", async () => {
    const p = await import("@/modules/hermes/lib/profile-paths");
    expect(p.getHermesDefaultRoot()).toContain("ps-config-refusals-");
  });
});

describe("pushRootToHermes carries finalize's refusal up", () => {
  it("returns success:false with the message and records it on the row", () => {
    mockFinalize.mockReturnValue({ appliedModelDefaults: false, backupPath: null, error: "disk config.yaml did not parse (duplicated mapping key)" });

    const result = pushRootToHermes();

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/did not parse/);
    expect(mockSetRootStatus).toHaveBeenCalledWith(null, expect.stringMatching(/did not parse/));
  });

  it("GREEN CONTROL: a clean finalize is a successful push", () => {
    mockFinalize.mockReturnValue({ appliedModelDefaults: true, backupPath: null });

    const result = pushRootToHermes();

    expect(result.success).toBe(true);
    expect(result.error).toBeNull();
    expect(mockSetRootStatus).toHaveBeenCalledWith(expect.any(String), null);
  });
});

describe("pushModelToHermes surfaces the single-model refusal", () => {
  it("is not a success when the config could not be parsed", () => {
    mockSyncSingle.mockReturnValue({ backupPath: "/b", error: "config.yaml did not parse (x) — model not pushed." });

    const result = pushModelToHermes("m1");

    expect(result.success).toBe(false);
    expect(result.details.map((d) => d.detail).join(" ")).toMatch(/not pushed/);
  });

  it("GREEN CONTROL: a clean sync is reported as pushed", () => {
    mockSyncSingle.mockReturnValue({ backupPath: "/b" });

    const result = pushModelToHermes("m1");

    expect(result.success).toBe(true);
    expect(result.details[0].action).toBe("pushed");
  });
});
