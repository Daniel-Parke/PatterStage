// ═══════════════════════════════════════════════════════════════
// hermes-fallback-config.ts: the fallback_providers + agent sections
//
// Split out of config-sync.ts, which keeps the `model` / `auxiliary`
// sections. This file owns the other two sections of config.yaml:
// `fallback_providers` (the chain) and `agent.*` (the behavioural
// settings that govern how the chain is used).
//
// Read and write sit together here because the write ends in a
// read-back assertion: `syncFallbacksToHermesConfig` verifies what it
// just wrote before returning, and the reader it verifies with is the
// same one the import path uses. Splitting them would let the two
// drift into disagreeing about the field mapping, which is exactly
// the bug the clamp comment below records.
//
// The write goes through `writeHermesConfigFile`, never through
// `atomicWriteFile`. See hermes-config-write.ts for why that
// distinction is load-bearing.
//
// Related but distinct neighbours: `fallback-sync.ts` orchestrates
// (chain from the DB, audit line); `fallback-import.ts` goes the
// other way, config.yaml into the DB.
// ═══════════════════════════════════════════════════════════════

import { existsSync, readFileSync } from "fs";
import * as yaml from "js-yaml";

import { dumpYamlConfig } from "@/lib/yaml-config";
import { ensureDir } from "@/lib/fs/fs-helpers";
import { parseFallbackAgentSettingsFromYaml } from "@/lib/fallback-config-yaml";
import type { FallbackConfigPutInput } from "@/lib/fallback-config-schema";
import { getActiveHermesPaths } from "./agent-runtime";
import { loadHermesConfigFromString, type HermesConfig } from "./hermes-config-read";
import { backupFile, writeHermesConfigFile } from "./hermes-config-write";

/**
 * Read `agent.*` fallback fields from on-disk config.yaml (post-write verify).
 * Thin wrapper over `parseFallbackAgentSettingsFromYaml` — keeps the file I/O
 * + YAML parse + null-on-missing-file contract at this layer and delegates
 * the field-mapping + clamp (apiMaxRetries → 0..10) to the single source of
 * truth. Previously this function duplicated the field extraction AND
 * skipped the clamp, which let a corrupt on-disk value (e.g. apiMaxRetries
 * 15) slip past `assertFallbackAgentSettingsWritten`'s "matches expected"
 * check silently. Now both the import path (read Hermes → DB) and the
 * read-back path enforce the same 0..10 contract defined by the Zod
 * schema (`fallbackConfigPutSchema`).
 */
export function readFallbackAgentSettingsFromConfig(
  configPath?: string,
): FallbackConfigPutInput | null {
  const paths = getActiveHermesPaths();
  const target = configPath ?? paths.config;
  if (!existsSync(target)) return null;

  try {
    const raw = readFileSync(target, "utf-8");
    const yamlConfig = (yaml.load(raw) as HermesConfig) ?? {};
    return parseFallbackAgentSettingsFromYaml(yamlConfig.agent);
  } catch {
    return null;
  }
}

function assertFallbackAgentSettingsWritten(
  configPath: string,
  expected: {
    apiMaxRetries?: number | null;
    restorePrimaryOnFallback?: boolean;
    fallbackNotification?: boolean;
  },
): void {
  const readBack = readFallbackAgentSettingsFromConfig(configPath);
  if (!readBack) {
    throw new Error("Failed to read back config.yaml after fallback sync");
  }
  if (expected.apiMaxRetries !== undefined && readBack.apiMaxRetries !== expected.apiMaxRetries) {
    throw new Error(
      `config.yaml api_max_retries mismatch: expected ${expected.apiMaxRetries}, got ${readBack.apiMaxRetries ?? "missing"}`,
    );
  }
  if (
    expected.restorePrimaryOnFallback !== undefined &&
    readBack.restorePrimaryOnFallback !== expected.restorePrimaryOnFallback
  ) {
    throw new Error("config.yaml restore_primary_on_fallback did not persist");
  }
  if (
    expected.fallbackNotification !== undefined &&
    readBack.fallbackNotification !== expected.fallbackNotification
  ) {
    throw new Error("config.yaml fallback_notification did not persist");
  }
}

/**
 * Write the fallback chain and behavioural config entries to
 * ~/.hermes/config.yaml as `fallback_providers` (chain) +
 * `agent.api_max_retries`, `agent.restore_primary_on_fallback`,
 * `agent.fallback_notification`.
 */
export function syncFallbacksToHermesConfig(
  chain: Array<{ modelId: string; provider: string; baseUrl: string | null; apiKey: string | null; overrideBaseUrl?: string | null }>,
  config: {
    restorePrimaryOnFallback?: boolean;
    fallbackNotification?: boolean;
    apiMaxRetries?: number;
  }
): { backupPath: string | null; configPath: string; hermesHome: string } {
  const paths = getActiveHermesPaths();
  const configPath = paths.config;
  ensureDir(paths.root);
  const backupPath = backupFile(configPath, paths.backups);

  const original = existsSync(configPath) ? readFileSync(configPath, "utf-8") : "";
  const yamlConfig: HermesConfig = loadHermesConfigFromString(original);

  // Write fallback_providers chain
  yamlConfig.fallback_providers = chain.map(
    (entry): { provider: string; model: string; base_url?: string; api_key?: string } => {
      const result: { provider: string; model: string; base_url?: string; api_key?: string } = {
        provider: entry.provider,
        model: entry.modelId,
      };
      const url = entry.overrideBaseUrl || entry.baseUrl;
      if (url) result.base_url = url;
      if (entry.apiKey) result.api_key = entry.apiKey;
      return result;
    },
  );

  // Write agent behavioural settings
  const agentSection: Record<string, unknown> = { ...(yamlConfig.agent ?? {}) };
  if (config.apiMaxRetries !== undefined) agentSection.api_max_retries = config.apiMaxRetries;
  if (config.restorePrimaryOnFallback !== undefined) agentSection.restore_primary_on_fallback = config.restorePrimaryOnFallback;
  if (config.fallbackNotification !== undefined) agentSection.fallback_notification = config.fallbackNotification;
  yamlConfig.agent = agentSection;

  const serialized = dumpYamlConfig(yamlConfig);
  writeHermesConfigFile(configPath, serialized);

  assertFallbackAgentSettingsWritten(configPath, {
    apiMaxRetries: config.apiMaxRetries,
    restorePrimaryOnFallback: config.restorePrimaryOnFallback,
    fallbackNotification: config.fallbackNotification,
  });

  return { backupPath, configPath, hermesHome: paths.root };
}
