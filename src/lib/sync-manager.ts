// ═══════════════════════════════════════════════════════════════
// sync-manager.ts — Push/Pull orchestration between Control Hub
//                      and Hermes config files
// ═══════════════════════════════════════════════════════════════

import { existsSync, readFileSync } from "fs";
import * as yaml from "js-yaml";

import { getActiveHermesPaths } from "./hermes-agent-runtime";
import { getModel, listModels, getModelDefaults, setDefaultModel } from "./models-repository";
import { getCredentialWithKey, listCredentials } from "./credentials-repository";
import { listFallbackChain, getFallbackConfig } from "./fallbacks-repository";
import {
  syncSingleModelToHermesConfig,
  syncSingleCredentialToHermesEnv,
  syncFallbacksToHermesConfig,
} from "./hermes-config-sync";
import { envVarForProvider, isHermesProvider, type HermesProvider } from "./hermes-providers";
import { getActiveFrameworkId } from "./framework-registry";

// ── Types ────────────────────────────────────────────────────

export interface SyncActionResult {
  success: boolean;
  backupPath: string | null;
  details: Array<{ action: string; detail: string }>;
}

export interface DriftReport {
  modelsInHermesNotInDb: Array<{ name: string; provider: string; modelId: string }>;
  modelsInDbNotInHermes: Array<{ name: string; provider: string; modelId: string; frameworkId: string }>;
  primaryDiffers: { dbModel: string; hermesModel: string } | null;
}

// ── Internal helpers ─────────────────────────────────────────

interface ConfigModelSection {
  default?: string;
  provider?: string;
  base_url?: string;
  context_length?: number;
}

interface ConfigAuxiliaryEntry {
  provider?: string;
  model?: string;
  base_url?: string;
  api_key?: string;
}

interface HermesYamlConfig {
  model?: ConfigModelSection;
  auxiliary?: Record<string, ConfigAuxiliaryEntry>;
  [key: string]: unknown;
}

/**
 * Read the current `model.*` section from ~/.hermes/config.yaml.
 * Returns null if file doesn't exist or can't be parsed.
 */
function readHermesPrimaryModel(): { modelId: string; provider: string; baseUrl: string | null } | null {
  const paths = getActiveHermesPaths();
  if (!existsSync(paths.config)) return null;

  try {
    const raw = readFileSync(paths.config, "utf-8");
    const config = (yaml.load(raw) as HermesYamlConfig) ?? {};
    if (!config.model?.default) return null;
    return {
      modelId: config.model.default,
      provider: config.model.provider ?? "",
      baseUrl: config.model.base_url?.trim() || null,
    };
  } catch {
    return null;
  }
}

/**
 * Collect every unique (provider, modelId) pair currently written in
 * config.yaml's model.* + auxiliary.* sections.
 */
function readHermesConfigModels(): Array<{ name: string; provider: string; modelId: string }> {
  const paths = getActiveHermesPaths();
  if (!existsSync(paths.config)) return [];

  try {
    const raw = readFileSync(paths.config, "utf-8");
    const config = (yaml.load(raw) as HermesYamlConfig) ?? {};
    const found: Array<{ name: string; provider: string; modelId: string }> = [];

    // Primary agent model
    if (config.model?.default) {
      const provider = config.model.provider ?? "";
      found.push({
        name: config.model.default,
        provider,
        modelId: config.model.default,
      });
    }

    // Auxiliary slots
    const aux = config.auxiliary ?? {};
    for (const entry of Object.values(aux)) {
      if (entry?.model) {
        found.push({
          name: entry.model,
          provider: entry.provider ?? "",
          modelId: entry.model,
        });
      }
    }

    return found;
  } catch {
    return [];
  }
}

// ── Drift detection ───────────────────────────────────────────

/**
 * Compare active agent model in config.yaml against the DB default
 * for the active framework. Also reports models present only in one
 * side or the other.
 */
export function detectConfigDrift(): DriftReport {
  const frameworkId = getActiveFrameworkId();
  const dbModels = listModels(frameworkId);
  const dbModelByKey = new Map(
    dbModels.map((m) => [`${m.provider}::${m.modelId}`, m])
  );

  // Read what's currently in config.yaml
  const hermesPrimary = readHermesPrimaryModel();
  const hermesModels = readHermesConfigModels();

  const hermesKeySet = new Set(hermesModels.map((m) => `${m.provider}::${m.modelId}`));

  // 1. Models in config.yaml but not in DB
  const modelsInHermesNotInDb = hermesModels.filter(
    (m) => !dbModelByKey.has(`${m.provider}::${m.modelId}`)
  );

  // 2. Models in DB but not in config.yaml (for the active framework)
  const modelsInDbNotInHermes = dbModels.filter(
    (m) => !hermesKeySet.has(`${m.provider}::${m.modelId}`)
  );

  // 3. Primary model drift
  let primaryDiffers: DriftReport["primaryDiffers"] = null;
  if (hermesPrimary) {
    // Find the DB model that matches the hermes primary by provider+modelId
    const matched = dbModelByKey.get(`${hermesPrimary.provider}::${hermesPrimary.modelId}`);
    if (matched) {
      // Compare with the DB default agent model for the active framework
      const dbDefaults = getModelDefaults(frameworkId);
      const dbDefault = dbDefaults.agent ? getModel(dbDefaults.agent) : null;
      if (dbDefault && dbDefault.id !== matched.id) {
        primaryDiffers = {
          dbModel: `${dbDefault.provider}/${dbDefault.modelId}`,
          hermesModel: `${matched.provider}/${matched.modelId}`,
        };
      }
    } else {
      // Primary in config but not matched in DB — treat as drift
      primaryDiffers = {
        dbModel: "none",
        hermesModel: `${hermesPrimary.provider}/${hermesPrimary.modelId}`,
      };
    }
  }

  return { modelsInHermesNotInDb, modelsInDbNotInHermes, primaryDiffers };
}

// ── Model push ───────────────────────────────────────────────

/**
 * Push a single model to Hermes config.yaml.
 * Updates only model.* section (not auxiliary).
 */
export function pushModelToHermes(modelId: string): SyncActionResult {
  const model = getModel(modelId);
  if (!model) {
    return { success: false, backupPath: null, details: [{ action: "error", detail: "Model not found" }] };
  }
  try {
    const { backupPath } = syncSingleModelToHermesConfig(modelId);
    return {
      success: true,
      backupPath,
      details: [
        {
          action: "pushed",
          detail: `${model.name} (${model.provider}/${model.modelId}) written to config.yaml`,
        },
      ],
    };
  } catch (err) {
    return {
      success: false,
      backupPath: null,
      details: [
        {
          action: "error",
          detail: String(err instanceof Error ? err.message : err),
        },
      ],
    };
  }
}

// ── Credential pull (Hermes .env → registry) ─────────────────

/**
 * Pull credential for a provider from .env into registry.
 */
export function pullCredential(provider: string, apiKey: string): SyncActionResult {
  if (!isHermesProvider(provider as HermesProvider)) {
    return {
      success: false,
      backupPath: null,
      details: [{ action: "error", detail: `Unknown provider: ${provider}` }],
    };
  }
  try {
    const { backupPath } = syncSingleCredentialToHermesEnv(
      provider as HermesProvider,
      apiKey
    );
    return {
      success: true,
      backupPath,
      details: [
        {
          action: "pulled",
          detail: `Credential for ${provider} written to .env`,
        },
      ],
    };
  } catch (err) {
    return {
      success: false,
      backupPath: null,
      details: [
        {
          action: "error",
          detail: String(err instanceof Error ? err.message : err),
        },
      ],
    };
  }
}

// ── Credential push (registry → Hermes .env) ─────────────────

/**
 * Push credential to .env for a given credential ID.
 */
export function pushCredential(credentialId: string): SyncActionResult {
  const cred = getCredentialWithKey(credentialId);
  if (!cred) {
    return {
      success: false,
      backupPath: null,
      details: [{ action: "error", detail: "Credential not found" }],
    };
  }
  return pullCredential(cred.provider, cred.apiKey);
}

// ── Full push (models + credentials + fallbacks → Hermes) ─────

export interface FullPushResult {
  modelResults: SyncActionResult[];
  credentialResults: SyncActionResult[];
  fallbackResult: { backupPath: string | null } | null;
}

/**
 * Push all models, credentials, and fallback chain to Hermes files.
 * Used for a full registry → Hermes sync.
 */
export function pushAllToHermes(): FullPushResult {
  const modelResults: SyncActionResult[] = [];
  const credentialResults: SyncActionResult[] = [];

  // Push every model that has a default slot for the active framework
  const frameworkId = getActiveFrameworkId();
  const dbModels = listModels(frameworkId);

  for (const model of dbModels) {
    // Check if this model has any defaults set (is the default for any slot)
    const result = pushModelToHermes(model.id);
    // Only report if something actually changed (not an error)
    if (result.success) {
      modelResults.push(result);
    }
  }

  // Push every credential
  const credentials = listCredentials();
  for (const cred of credentials) {
    const full = getCredentialWithKey(cred.id);
    if (!full) continue;
    const result = pullCredential(full.provider, full.apiKey);
    if (result.success) {
      credentialResults.push(result);
    }
  }

  // Push fallback chain
  let fallbackResult: FullPushResult["fallbackResult"] = null;
  try {
    const chain = listFallbackChain().filter((e) => e.enabled);
    const config = getFallbackConfig();
    fallbackResult = syncFallbacksToHermesConfig(
      chain.map((e) => ({
        modelId: e.modelIdString,
        provider: e.provider,
        baseUrl: e.overrideBaseUrl,
        apiKey: null,
      })),
      {
        restorePrimaryOnFallback: config.restorePrimaryOnFallback,
        fallbackNotification: config.fallbackNotification,
        apiMaxRetries: config.apiMaxRetries,
      }
    );
  } catch {
    // Best-effort — fallbacks are optional
  }

  return { modelResults, credentialResults, fallbackResult };
}
