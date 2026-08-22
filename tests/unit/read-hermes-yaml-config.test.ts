/** @jest-environment node */

/**
 * Tests for readHermesYamlConfig — the central "read+parse
 * ~/.hermes/config.yaml, return null on missing/unparseable" helper
 * introduced in session 67 (List 3 refactor) to consolidate the
 * `existsSync + readFileSync + yaml.load + try/catch` pattern that
 * was duplicated across 5 sites.
 */

import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

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
}));

// Import after the mock so the module-level getActiveHermesPaths call sees it
import { readHermesYamlConfig } from "@/modules/hermes/lib/hermes-config-read";

let fakeRoot: string;

beforeEach(() => {
  fakeRoot = mkdtempSync(join(tmpdir(), "ch-read-yaml-"));
  (global as { __FAKE_HERMES_ROOT__?: string }).__FAKE_HERMES_ROOT__ = fakeRoot;
});

afterEach(() => {
  rmSync(fakeRoot, { recursive: true, force: true });
  delete (global as { __FAKE_HERMES_ROOT__?: string }).__FAKE_HERMES_ROOT__;
});

describe("readHermesYamlConfig", () => {
  test("returns null when config.yaml does not exist", () => {
    expect(readHermesYamlConfig()).toBeNull();
  });

  test("returns the parsed YAML object for a valid file", () => {
    writeFileSync(join(fakeRoot, "config.yaml"), "model:\n  default: gpt-4o\n  provider: openai\n");
    const config = readHermesYamlConfig<{ model: { default: string; provider: string } }>();
    expect(config).not.toBeNull();
    expect(config?.model.default).toBe("gpt-4o");
    expect(config?.model.provider).toBe("openai");
  });

  test("returns null for an empty config.yaml (yaml.load yields undefined)", () => {
    writeFileSync(join(fakeRoot, "config.yaml"), "");
    expect(readHermesYamlConfig()).toBeNull();
  });

  test("returns null for malformed YAML (yaml.load throws)", () => {
    // Duplicated key + unbalanced flow sequence → js-yaml throws a YAMLException
    writeFileSync(
      join(fakeRoot, "config.yaml"),
      "model: { default: a, default: b }: { broken: [",
    );
    expect(readHermesYamlConfig()).toBeNull();
  });

  test("returns the parsed object for valid YAML with multiple top-level sections", () => {
    writeFileSync(
      join(fakeRoot, "config.yaml"),
      [
        "model:",
        "  default: gpt-4o",
        "  provider: openai",
        "fallback_providers:",
        "  - provider: openai",
        "    model: gpt-4o-mini",
        "agent:",
        "  api_max_retries: 3",
      ].join("\n"),
    );
    const config = readHermesYamlConfig<{
      model: { default: string; provider: string };
      fallback_providers: Array<{ provider: string; model: string }>;
      agent: { api_max_retries: number };
    }>();
    expect(config).not.toBeNull();
    expect(config?.agent.api_max_retries).toBe(3);
    expect(config?.fallback_providers[0].model).toBe("gpt-4o-mini");
  });

  test("generic T is propagated to the return type (compile-time check)", () => {
    // This is a static-only check — the runtime is a no-op cast.
    // The test ensures the typed generic helper actually narrows in callers.
    writeFileSync(join(fakeRoot, "config.yaml"), "fallback_providers: []\n");
    const config = readHermesYamlConfig<{
      fallback_providers: Array<{ provider: string; model: string }>;
    }>();
    expect(Array.isArray(config?.fallback_providers)).toBe(true);
  });
});
