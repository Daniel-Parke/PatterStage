/**
 * Asserts that:
 *   - every provider in HERMES_PROVIDERS has a mapped env var name;
 *   - the env var name follows the upper-snake-case + _API_KEY convention;
 *   - all 12 task slots match the migration's is_default_<task> columns.
 *
 * The first 14 providers must stay in lock-step with the `--provider`
 * argparse choices in hermes-agent/hermes_cli/main.py. We don't read the
 * Python file from this repo (it lives in a sibling clone), but we
 * pin the literal list defensively so a drift here trips the test.
 */

import { readFileSync } from "fs";
import { join } from "path";
import {
  HERMES_PROVIDERS,
  PROVIDER_ENV_VAR,
  TASK_TYPES,
  envVarForProvider,
  isHermesProvider,
  isTaskType,
} from "@/lib/hermes-providers";

describe("hermes-providers — provider list", () => {
  it("includes every Hermes CLI --provider choice (excluding 'auto')", () => {
    const cliChoices = [
      "openrouter",
      "openai-codex",
      "copilot-acp",
      "copilot",
      "anthropic",
      "gemini",
      "huggingface",
      "zai",
      "kimi-coding",
      "minimax",
      "minimax-cn",
      "kilocode",
      "xiaomi",
    ];
    for (const choice of cliChoices) {
      expect(HERMES_PROVIDERS).toContain(choice);
    }
  });

  it("isHermesProvider accepts known providers and rejects unknown", () => {
    expect(isHermesProvider("anthropic")).toBe(true);
    expect(isHermesProvider("openai")).toBe(true);
    expect(isHermesProvider("not-a-provider")).toBe(false);
    expect(isHermesProvider(42)).toBe(false);
    expect(isHermesProvider(undefined)).toBe(false);
  });
});

describe("hermes-providers — env var mapping", () => {
  it("every provider has an env var entry", () => {
    for (const provider of HERMES_PROVIDERS) {
      expect(PROVIDER_ENV_VAR[provider]).toBeDefined();
      expect(envVarForProvider(provider)).toBe(PROVIDER_ENV_VAR[provider]);
    }
  });

  it("every env var is upper-snake-case and ends in _API_KEY", () => {
    for (const provider of HERMES_PROVIDERS) {
      const envVar = PROVIDER_ENV_VAR[provider];
      expect(envVar).toMatch(/^[A-Z][A-Z0-9_]*_API_KEY$/);
    }
  });

  it("anthropic / openrouter / minimax / openai map to canonical names", () => {
    expect(PROVIDER_ENV_VAR.anthropic).toBe("ANTHROPIC_API_KEY");
    expect(PROVIDER_ENV_VAR.openrouter).toBe("OPENROUTER_API_KEY");
    expect(PROVIDER_ENV_VAR.minimax).toBe("MINIMAX_API_KEY");
    expect(PROVIDER_ENV_VAR.openai).toBe("OPENAI_API_KEY");
  });
});

describe("hermes-providers — task slots", () => {
  it("matches the 12 is_default_<task> columns in migration 006", () => {
    const sql = readFileSync(
      join(__dirname, "..", "..", "src", "lib", "db", "migrations", "006_models_credentials.sql"),
      "utf-8"
    );
    for (const slot of TASK_TYPES) {
      expect(sql).toContain(`is_default_${slot}`);
    }
    // 12 columns total
    const matches = sql.match(/is_default_\w+/g) ?? [];
    const distinct = new Set(matches);
    expect(distinct.size).toBe(12);
  });

  it("isTaskType validates registry-known slots", () => {
    expect(isTaskType("agent")).toBe(true);
    expect(isTaskType("triage_specifier")).toBe(true);
    expect(isTaskType("not-a-real-slot")).toBe(false);
    expect(isTaskType(0)).toBe(false);
  });
});
