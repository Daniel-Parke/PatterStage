/* eslint-disable @typescript-eslint/no-require-imports */
/** @jest-environment node */

/**
 * Tests for the .env half of hermes-config-sync.ts:
 *   syncCredentialToHermesEnv  → writes <PROVIDER>_API_KEY=<plain> atomically
 *   removeCredentialFromHermesEnv → deletes the line for a provider
 *
 * Uses a real tmp dir as the fake ~/.hermes/.
 */

import { mkdtempSync, readFileSync, writeFileSync, existsSync, readdirSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { HERMES_PROVIDERS, PROVIDER_ENV_VAR } from "@/lib/hermes-providers";

let fakeRoot: string;

jest.mock("@/lib/hermes-agent-runtime", () => ({
  getActiveHermesPaths: () => {
    const root = (global as { __FAKE_HERMES_ROOT__?: string }).__FAKE_HERMES_ROOT__!;
    return {
      root,
      env: join(root, ".env"),
      soul: join(root, "SOUL.md"),
      hermes: join(root, "HERMES.md"),
      agents: join(root, "AGENTS.md"),
      skills: join(root, "skills"),
      profiles: join(root, "profiles"),
      sessions: join(root, "sessions"),
      logs: join(root, "logs"),
      config: join(root, "config.yaml"),
      backups: join(root, "backups"),
      cronJobs: join(root, "cron", "jobs.json"),
      memoryDb: join(root, "memory_store.db"),
    };
  },
}));

beforeEach(() => {
  fakeRoot = mkdtempSync(join(tmpdir(), "ch-hermes-sync-"));
  (global as { __FAKE_HERMES_ROOT__?: string }).__FAKE_HERMES_ROOT__ = fakeRoot;
});

afterEach(() => {
  if (fakeRoot && existsSync(fakeRoot)) rmSync(fakeRoot, { recursive: true, force: true });
});

describe("syncCredentialToHermesEnv", () => {
  it("writes <PROVIDER>_API_KEY when no .env exists", () => {
    const { syncCredentialToHermesEnv } = require("@/lib/hermes-config-sync") as typeof import("@/lib/hermes-config-sync");
    syncCredentialToHermesEnv({ provider: "anthropic", apiKey: "sk-ant-secret" });

    const envContent = readFileSync(join(fakeRoot, ".env"), "utf-8");
    expect(envContent).toContain("ANTHROPIC_API_KEY=sk-ant-secret");
  });

  it("preserves existing keys, comments, and ordering", () => {
    const original = [
      "# Hermes env file",
      "OPENROUTER_API_KEY=sk-or-12345",
      "",
      "# auxiliary keys",
      "ANTHROPIC_API_KEY=sk-old-anthropic",
      "FOO=bar",
      "",
    ].join("\n");
    writeFileSync(join(fakeRoot, ".env"), original);

    const { syncCredentialToHermesEnv } = require("@/lib/hermes-config-sync") as typeof import("@/lib/hermes-config-sync");
    syncCredentialToHermesEnv({ provider: "anthropic", apiKey: "sk-new-anthropic" });

    const env = readFileSync(join(fakeRoot, ".env"), "utf-8");
    expect(env).toContain("# Hermes env file");
    expect(env).toContain("OPENROUTER_API_KEY=sk-or-12345");
    expect(env).toContain("ANTHROPIC_API_KEY=sk-new-anthropic");
    expect(env).toContain("FOO=bar");
    expect(env).not.toContain("sk-old-anthropic");
  });

  it("creates a backup of the original file before writing", () => {
    writeFileSync(join(fakeRoot, ".env"), "OPENROUTER_API_KEY=sk-or-original\n");
    const { syncCredentialToHermesEnv } = require("@/lib/hermes-config-sync") as typeof import("@/lib/hermes-config-sync");
    const result = syncCredentialToHermesEnv({ provider: "openrouter", apiKey: "sk-new" });
    expect(result.backupPath).not.toBeNull();
    const backups = readdirSync(join(fakeRoot, "backups"));
    expect(backups.length).toBeGreaterThan(0);
    const backupContent = readFileSync(join(fakeRoot, "backups", backups[0]), "utf-8");
    expect(backupContent).toContain("OPENROUTER_API_KEY=sk-or-original");
  });

  it("rejects unknown provider names", () => {
    const { syncCredentialToHermesEnv } = require("@/lib/hermes-config-sync") as typeof import("@/lib/hermes-config-sync");
    expect(() =>
      syncCredentialToHermesEnv({ provider: "not-a-provider" as never, apiKey: "x" })
    ).toThrow(/Unknown provider/);
  });

  it("every Hermes provider with an env var routes to its mapped env var", () => {
    const { syncCredentialToHermesEnv } = require("@/lib/hermes-config-sync") as typeof import("@/lib/hermes-config-sync");
    const oauthOnly = new Set(["nous"]);
    for (const provider of HERMES_PROVIDERS) {
      if (oauthOnly.has(provider)) continue;
      // Reset .env between iterations.
      writeFileSync(join(fakeRoot, ".env"), "");
      syncCredentialToHermesEnv({ provider, apiKey: `key-for-${provider}` });
      const env = readFileSync(join(fakeRoot, ".env"), "utf-8");
      expect(env).toContain(`${PROVIDER_ENV_VAR[provider]}=key-for-${provider}`);
    }
  });

  it("rejects OAuth-only providers (e.g. nous) with a clear error", () => {
    const { syncCredentialToHermesEnv } = require("@/lib/hermes-config-sync") as typeof import("@/lib/hermes-config-sync");
    expect(() =>
      syncCredentialToHermesEnv({ provider: "nous", apiKey: "x" })
    ).toThrow(/uses OAuth/);
  });

  it("atomic write does not leave a tmp file behind on success", () => {
    const { syncCredentialToHermesEnv } = require("@/lib/hermes-config-sync") as typeof import("@/lib/hermes-config-sync");
    syncCredentialToHermesEnv({ provider: "anthropic", apiKey: "sk-x" });
    const dirEntries = readdirSync(fakeRoot);
    const tmpFiles = dirEntries.filter((e) => e.includes(".tmp-"));
    expect(tmpFiles).toEqual([]);
  });
});

describe("removeCredentialFromHermesEnv", () => {
  it("removes the line for the given provider", () => {
    writeFileSync(
      join(fakeRoot, ".env"),
      [
        "ANTHROPIC_API_KEY=keep-me",
        "OPENROUTER_API_KEY=remove-me",
        "FOO=bar",
        "",
      ].join("\n")
    );
    const { removeCredentialFromHermesEnv } = require("@/lib/hermes-config-sync") as typeof import("@/lib/hermes-config-sync");
    removeCredentialFromHermesEnv("openrouter");

    const env = readFileSync(join(fakeRoot, ".env"), "utf-8");
    expect(env).toContain("ANTHROPIC_API_KEY=keep-me");
    expect(env).not.toContain("OPENROUTER_API_KEY");
    expect(env).toContain("FOO=bar");
  });

  it("is a no-op when .env does not exist", () => {
    const { removeCredentialFromHermesEnv } = require("@/lib/hermes-config-sync") as typeof import("@/lib/hermes-config-sync");
    const result = removeCredentialFromHermesEnv("anthropic");
    expect(result.backupPath).toBeNull();
  });
});
