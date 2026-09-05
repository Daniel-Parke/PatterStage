/** @jest-environment node */

/**
 * Byte-equivalence + contract tests for the List-4 session 98 refactor:
 * `parseFallbackAgentSettingsFromYaml` (fallback-config-yaml.ts) and
 * `readFallbackAgentSettingsFromConfig` (hermes-config-sync.ts) are now
 * a single source of truth for the field-mapping + clamp. Before the
 * refactor, the read-back path skipped the clamp and the two functions
 * could disagree on `apiMaxRetries` for out-of-range on-disk values.
 *
 * These tests lock:
 *   1. read-back delegates to the import-path helper (no field drift)
 *   2. read-back clamps apiMaxRetries to 0..10 (matches the Zod schema)
 *   3. read-back still returns null for missing files (preserves the
 *      assertFallbackAgentSettingsWritten contract)
 *   4. read-back returns {} (not null) for YAML without an agent section
 *      (preserves the "file present but no agent" branch)
 */

import { mkdtempSync, rmSync, writeFileSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import * as yaml from "js-yaml";

import { parseFallbackAgentSettingsFromYaml } from "@/lib/fallback-config-yaml";
import { readFallbackAgentSettingsFromConfig } from "@/modules/hermes/lib/hermes-fallback-config";

let fakeRoot: string;

jest.mock("@/modules/hermes/lib/agent-runtime", () => ({
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
  getActiveHermesHome: () => (global as { __FAKE_HERMES_ROOT__?: string }).__FAKE_HERMES_ROOT__,
}));

beforeEach(() => {
  fakeRoot = mkdtempSync(join(tmpdir(), "fb-settings-"));
  (global as { __FAKE_HERMES_ROOT__?: string }).__FAKE_HERMES_ROOT__ = fakeRoot;
});

afterEach(() => {
  if (fakeRoot && existsSync(fakeRoot)) rmSync(fakeRoot, { recursive: true, force: true });
  delete (global as { __FAKE_HERMES_ROOT__?: string }).__FAKE_HERMES_ROOT__;
});

describe("fallback agent settings consolidation", () => {
  it("read-back delegates to the import-path helper for valid input", () => {
    writeFileSync(
      join(fakeRoot, "config.yaml"),
      yaml.dump({
        agent: {
          api_max_retries: 5,
          restore_primary_on_fallback: false,
          fallback_notification: true,
        },
      }),
      "utf-8",
    );

    const fromDisk = readFallbackAgentSettingsFromConfig();

    expect(fromDisk).toEqual({
      apiMaxRetries: 5,
      restorePrimaryOnFallback: false,
      fallbackNotification: true,
    });

    // Identical input to the import-path helper produces the identical result.
    const fromInline = parseFallbackAgentSettingsFromYaml({
      api_max_retries: 5,
      restore_primary_on_fallback: false,
      fallback_notification: true,
    });
    expect(fromDisk).toEqual(fromInline);
  });

  it("read-back clamps apiMaxRetries to 0..10 (matches Zod schema + import path)", () => {
    // This is the latent-bug fix: the previous read-back skipped the
    // clamp, letting a corrupted on-disk value (e.g. 15) silently pass
    // assertFallbackAgentSettingsWritten. Both code paths now agree.
    const highFile = join(fakeRoot, "config-high.yaml");
    const lowFile = join(fakeRoot, "config-low.yaml");
    writeFileSync(highFile, yaml.dump({ agent: { api_max_retries: 42 } }), "utf-8");
    writeFileSync(lowFile, yaml.dump({ agent: { api_max_retries: -3 } }), "utf-8");

    expect(readFallbackAgentSettingsFromConfig(highFile)?.apiMaxRetries).toBe(10);
    expect(readFallbackAgentSettingsFromConfig(lowFile)?.apiMaxRetries).toBe(0);

    // Inline import path returns the same clamped values.
    expect(parseFallbackAgentSettingsFromYaml({ api_max_retries: 42 }).apiMaxRetries).toBe(10);
    expect(parseFallbackAgentSettingsFromYaml({ api_max_retries: -3 }).apiMaxRetries).toBe(0);
  });

  it("read-back returns null for a missing file (preserves assertFallbackAgentSettingsWritten contract)", () => {
    expect(readFallbackAgentSettingsFromConfig(join(fakeRoot, "does-not-exist.yaml"))).toBeNull();
  });

  it("read-back returns {} (not null) for YAML without an agent section", () => {
    // File present, no `agent:` key — assertFallbackAgentSettingsWritten
    // treats `{}` as truthy (proceeds to field checks) but `null` as
    // "failed to read back" (throws). The empty object is the canonical
    // "file OK, no fields set" shape.
    const file = join(fakeRoot, "no-agent.yaml");
    writeFileSync(file, yaml.dump({ model: { default: "x" } }), "utf-8");

    expect(readFallbackAgentSettingsFromConfig(file)).toEqual({});
  });

  it("read-back returns null for malformed YAML (preserves error-fallback contract)", () => {
    // Malformed YAML → yaml.load throws → catch returns null.
    // This is the same contract the old function had: the caller
    // (assertFallbackAgentSettingsWritten) interprets null as
    // "couldn't verify the write" and surfaces a meaningful error.
    const file = join(fakeRoot, "broken.yaml");
    writeFileSync(file, "agent: { api_max_retries: 5\n  this is not valid yaml", "utf-8");

    expect(readFallbackAgentSettingsFromConfig(file)).toBeNull();
  });
});
