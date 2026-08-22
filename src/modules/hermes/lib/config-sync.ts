// ═══════════════════════════════════════════════════════════════
// config-sync.ts: the model + auxiliary sections of config.yaml
// ═══════════════════════════════════════════════════════════════
//
// Without this module, `hermes chat --model X` would fail because
// Hermes can't resolve which model to run. Every default-set in
// /api/models/defaults and every per-model push runs through here.
//
// What used to be one file is now five, split by responsibility:
//
//   config-sync.ts (this file)   model.* + auxiliary.* from the
//                                Models registry, and the post-push
//                                root reconcile.
//   hermes-config-write.ts       atomicWriteFile / writeHermesConfigFile
//                                and the deliberate line between them.
//   hermes-config-read.ts        every read of config.yaml, and the
//                                HermesConfig shape itself.
//   hermes-env-sync.ts           the .env half (credentials).
//   hermes-fallback-config.ts    fallback_providers + agent.*.
//
// Guarantees, unchanged by the split:
//   - atomic writes via tmpfile + fs.renameSync
//   - timestamped backups under <root>/backups/ before any write
//   - idempotent: re-applying the same input produces the same file
//   - every config.yaml write goes through `writeHermesConfigFile`,
//     so the read cache is dropped in the same call (WG-ARCH-003).

import { existsSync, readFileSync } from "fs";
import * as yaml from "js-yaml";

import { dumpYamlConfig } from "@/lib/yaml-config";
import { getActiveHermesPaths } from "./agent-runtime";
import { AUXILIARY_TASK_TYPES } from "@/lib/models/task-types";
import { updateAgentRoot } from "@/lib/agent-root-repository";
import { getModelDefaults, getModel } from "@/lib/models-repository";
import { toError } from "@/lib/api-fetch";
import { ensureDir } from "@/lib/fs/fs-helpers";
import {
  loadHermesConfigFromString,
  type AuxiliarySection,
  type HermesConfig,
} from "./hermes-config-read";
import { backupFile, writeHermesConfigFile } from "./hermes-config-write";

/** Auxiliary slots written through to `auxiliary.<task>.*`.
 *  See `AUXILIARY_TASK_TYPES` in `@/lib/models/task-types` (canonical). */

/**
 * Read ~/.hermes/config.yaml, set `model.*` from PatterStage DB's default
 * `agent` model and `auxiliary.<task>.{model, provider, base_url, api_key}`
 * for each of the 11 auxiliary slots, then write back atomically with a
 * pre-write backup.
 *
 * `model.api_key` and `auxiliary.<task>.api_key` are reset to the empty
 * string so Hermes resolves the key from .env (canonical posture).
 */
export function syncDefaultsToHermesConfig(): { backupPath: string | null } {
  const paths = getActiveHermesPaths();
  ensureDir(paths.root);
  const configPath = paths.config;
  const backupPath = backupFile(configPath, paths.backups);

  const original = existsSync(configPath) ? readFileSync(configPath, "utf-8") : "";
  // Inline (not `loadHermesConfigFromString`) because this site needs
  // custom parse-error handling — we must not overwrite a partially-
  // corrupted file. The helper has the same happy path; the catch
  // block is the only reason this isn't a one-liner.
  let config: HermesConfig;
  try {
    config = original ? ((yaml.load(original) as HermesConfig) ?? {}) : {};
  } catch (err) {
    // If the YAML is malformed (e.g. duplicated keys from a prior failed write),
    // yaml.load throws and we cannot safely write a merged config. Report the
    // backing error so it surfaces in server logs but do NOT write a corrupted
    // file — return the backup path so the caller can surface a meaningful error.
    const msg = toError(err).message || String(err);
    console.error(`[syncDefaultsToHermesConfig] yaml.load failed: ${msg} — not overwriting ${configPath}`);
    console.error(`[syncDefaultsToHermesConfig] Backup at: ${backupPath}. Please repair the YAML and retry.`);
    return { backupPath };
  }

  const defaults = getModelDefaults();

  // ── Primary agent model
  const agentDefault = defaults.agent ? getModel(defaults.agent) : null;
  if (agentDefault) {
    config.model = {
      ...(config.model ?? {}),
      default: agentDefault.modelId,
      provider: agentDefault.provider,
      base_url: agentDefault.baseUrl ?? "",
      api_key: "",
      context_length: agentDefault.contextLength ?? config.model?.context_length,
    };
  }

  // ── 11 auxiliary slots
  const aux: Record<string, AuxiliarySection> = { ...(config.auxiliary ?? {}) };
  for (const slot of AUXILIARY_TASK_TYPES) {
    const modelId = defaults[slot];
    if (!modelId) continue;
    const m = getModel(modelId);
    if (!m) continue;
    aux[slot] = {
      ...(aux[slot] ?? {}),
      provider: m.provider,
      model: m.modelId,
      base_url: m.baseUrl ?? "",
      api_key: "",
    };
  }
  if (Object.keys(aux).length > 0) {
    config.auxiliary = aux;
  }

  const serialized = dumpYamlConfig(config);
  writeHermesConfigFile(configPath, serialized);

  return { backupPath };
}

export interface FinalizeRootConfigResult {
  /** Whether `model_defaults.agent` was applied to disk. */
  appliedModelDefaults: boolean;
  backupPath: string | null;
}

/**
 * After profile push writes skills/toolsets, re-apply Models registry defaults
 * to `model` / `auxiliary` on disk and refresh `agent_root.config_yaml` so the
 * next push does not strip the model section.
 */
export function finalizeRootConfigOnDisk(): FinalizeRootConfigResult {
  const defaults = getModelDefaults();
  const appliedModelDefaults = Boolean(defaults.agent);
  const { backupPath } = syncDefaultsToHermesConfig();

  const paths = getActiveHermesPaths();
  if (existsSync(paths.config)) {
    const fullYaml = readFileSync(paths.config, "utf-8");
    updateAgentRoot({ configYaml: fullYaml });
  }

  return { appliedModelDefaults, backupPath };
}

// ── Single model sync to Hermes config ─────────────────────

/**
 * Update only the `model.*` section of ~/.hermes/config.yaml
 * for a single model, leaving auxiliary slots untouched.
 * Used by the per-model Push button.
 */
export function syncSingleModelToHermesConfig(modelId: string): { backupPath: string | null } {
  const paths = getActiveHermesPaths();
  const configPath = paths.config;
  const backupPath = backupFile(configPath, paths.backups);

  const original = existsSync(configPath) ? readFileSync(configPath, "utf-8") : "";
  const config: HermesConfig = loadHermesConfigFromString(original);

  const model = getModel(modelId);
  if (model) {
    config.model = {
      ...(config.model ?? {}),
      default: model.modelId,
      provider: model.provider,
      base_url: model.baseUrl ?? "",
      api_key: "",
      context_length: model.contextLength ?? config.model?.context_length,
    };
  }

  const serialized = dumpYamlConfig(config);
  writeHermesConfigFile(configPath, serialized);

  return { backupPath };
}
