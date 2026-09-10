// ═══════════════════════════════════════════════════════════════
// sync-manager.ts — Push/Pull orchestration between PatterStage
//                      and Hermes config files
// ═══════════════════════════════════════════════════════════════

import { getModel, listModels, getModelDefaults } from "@/lib/models/models-repository";
import { getCredentialWithKey } from "@/lib/models/credentials-repository";
import { syncSingleModelToHermesConfig } from "./config-sync";
import { syncCredentialToHermesEnv } from "./hermes-env-sync";
import { readHermesConfigModels, readHermesYamlConfig } from "./hermes-config-read";
import { isHermesProvider, type HermesProvider } from "./providers";
import { modelKey } from "@/lib/models/model-key";
import { messageFromError } from "@/lib/api/api-fetch";

// ── Types ────────────────────────────────────────────────────

import type { SyncActionResult } from "@/lib/models/sync-result";
// The line shape is a UI contract, declared in core; the module reads it.
import type { DriftLine } from "@/components/models/types";
export type { SyncActionResult };

export interface DriftReport {
  modelsInHermesNotInDb: Array<{ name: string; provider: string; modelId: string }>;
  /** `registryId` is the row the line is about; optional so older fixtures still typecheck. */
  modelsInDbNotInHermes: Array<{ name: string; provider: string; modelId: string; registryId?: string | null }>;
  /** `registryId` is the row matching the Hermes primary, null when none does. */
  primaryDiffers: { dbModel: string; hermesModel: string; registryId?: string | null } | null;
}

/**
 * Read the primary model from ~/.hermes/config.yaml.
 * Returns null if no primary model is set or file can't be parsed.
 * Accepts the already-parsed hermesModelMap so callers can reuse it
 * and avoid parsing the YAML file twice.
 */
function readHermesPrimaryModel(
  hermesModelMap: Map<string, { modelId: string; provider: string; baseUrl: string | null }>
): { modelId: string; provider: string; baseUrl: string | null } | null {
  const config = readHermesYamlConfig<Record<string, unknown>>();
  if (!config) return null;
  const modelSection = config.model as Record<string, unknown> | undefined;
  if (!modelSection) return null;

  const primaryId = (modelSection.default ?? modelSection.model) as string | undefined;
  const primaryProvider = modelSection.provider as string | undefined;
  if (!primaryId || !primaryProvider) return null;

  const entry = hermesModelMap.get(modelKey(primaryProvider, primaryId));
  if (!entry) return null;
  return { modelId: entry.modelId, provider: entry.provider, baseUrl: entry.baseUrl };
}

// ── Drift detection ───────────────────────────────────────────

/**
 * Compare active agent model in config.yaml against the DB default
 * for the Hermes agent. Also reports models present only in one
 * side or the other.
 */
export function detectConfigDrift(): DriftReport {
  const dbModels = listModels();
  const dbModelByKey = new Map(
    dbModels.map((m) => [modelKey(m.provider, m.modelId), m])
  );

  // Read what's currently in config.yaml
  const hermesModelMap = readHermesConfigModels();
  const hermesPrimary = readHermesPrimaryModel(hermesModelMap);
  const hermesKeySet = new Set(hermesModelMap.keys());
  const hermesModels = [...hermesModelMap.values()].map((m) => ({
    name: m.modelId,
    provider: m.provider,
    modelId: m.modelId,
  }));

  // 1. Models in config.yaml but not in DB
  const modelsInHermesNotInDb = hermesModels.filter(
    (m) => !dbModelByKey.has(modelKey(m.provider, m.modelId))
  );

  // 2. Models in DB but not in config.yaml (Hermes)
  const modelsInDbNotInHermes = dbModels
    .filter((m) => !hermesKeySet.has(modelKey(m.provider, m.modelId)))
    // The row id travels with the line so the banner can push exactly this
    // model rather than re-running a whole sync (T-0100).
    .map((m) => ({ name: m.name, provider: m.provider, modelId: m.modelId, registryId: m.id }));

  // 3. Primary model drift
  let primaryDiffers: DriftReport["primaryDiffers"] = null;
  if (hermesPrimary) {
    // Find the DB model that matches the hermes primary by provider+modelId
    const matched = dbModelByKey.get(modelKey(hermesPrimary.provider, hermesPrimary.modelId));
    if (matched) {
      // Compare with the DB default agent model for Hermes
      const dbDefaults = getModelDefaults();
      const defaultAgentId = dbDefaults.agent;
      if (defaultAgentId) {
        const dbDefault = getModel(defaultAgentId);
        if (dbDefault && dbDefault.id !== matched.id) {
          primaryDiffers = {
            dbModel: `${dbDefault.provider}/${dbDefault.modelId}`,
            hermesModel: `${matched.provider}/${matched.modelId}`,
            registryId: matched.id,
          };
        }
      }
    } else {
      // Primary in config but not matched in DB — treat as drift
      primaryDiffers = {
        dbModel: "none",
        hermesModel: `${hermesPrimary.provider}/${hermesPrimary.modelId}`,
        // Nothing in the registry matches it: pulling has to import first.
        registryId: null,
      };
    }
  }

  return { modelsInHermesNotInDb, modelsInDbNotInHermes, primaryDiffers };
}

// ── Drift → human-readable details (UI surface) ──────────────

/**
 * Project a `DriftReport` to the flat `string[]` shape consumed by the
 * `ModelsDriftBanner` component (`{ hasDrift, driftDetails: string[] }`).
 * Does NOT include the `hasDrift` flag: the route composes it from the
 * array length, so the helper stays "details only".
 */
export function buildDriftDetails(drift: DriftReport): string[] {
  // Delegated so the sentence exists once. buildDriftLines emits the same
  // three sections in the same order; taking the text off each line is what
  // keeps the two from ever drifting apart (T-0100).
  return buildDriftLines(drift).map((line) => line.text);
}

/**
 * `hermesModel` is built as `${provider}/${modelId}`, and a provider name
 * never contains a slash, so the first slash is the exact boundary. A model
 * id may contain further slashes and keeps them.
 */
function splitModelRef(ref: string): { provider: string; modelId: string } {
  const cut = ref.indexOf("/");
  if (cut === -1) return { provider: "", modelId: ref };
  return { provider: ref.slice(0, cut), modelId: ref.slice(cut + 1) };
}

/**
 * The same three sentences, each with the handles the banner acts on.
 *
 * `buildDriftDetails` is this function's text column, so the two can never
 * disagree about wording or order. What a line adds is the direction that
 * resolves it: a Hermes-only model is pulled, a registry-only model is
 * pushed, and a primary disagreement can go either way.
 */
export function buildDriftLines(drift: DriftReport): DriftLine[] {
  const lines: DriftLine[] = [];
  if (drift.primaryDiffers) {
    const { provider, modelId } = splitModelRef(drift.primaryDiffers.hermesModel);
    lines.push({
      kind: "primary",
      text: `Primary model drift: DB has "${drift.primaryDiffers.dbModel}", Hermes has "${drift.primaryDiffers.hermesModel}"`,
      provider,
      modelId,
      registryId: drift.primaryDiffers.registryId ?? null,
    });
  }
  for (const m of drift.modelsInHermesNotInDb) {
    lines.push({
      kind: "hermes-only",
      text: `Model "${m.modelId}" (${m.provider}) is in Hermes but not in PatterStage`,
      provider: m.provider,
      modelId: m.modelId,
      // By definition there is no registry row yet; a pull creates one.
      registryId: null,
    });
  }
  for (const m of drift.modelsInDbNotInHermes) {
    lines.push({
      kind: "db-only",
      text: `Model "${m.modelId}" (${m.provider}) is in PatterStage but not pushed to Hermes`,
      provider: m.provider,
      modelId: m.modelId,
      registryId: m.registryId ?? null,
    });
  }
  return lines;
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
    const { backupPath, error } = syncSingleModelToHermesConfig(modelId);
    if (error) {
      // Refusal, not success: the file could not be parsed so the model was
      // not written. The message already carries the repair guidance.
      return { success: false, backupPath, details: [{ action: "error", detail: error }] };
    }
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
          detail: String(messageFromError(err, "")),
        },
      ],
    };
  }
}

// ── Credential push (PatterStage → Hermes .env) ──────────────

/**
 * Push a credential (provider + apiKey) to the Hermes .env file.
 *
 * `provider` is typed as `HermesProvider` because `syncCredentialToHermesEnv`
 * requires the literal union. Callers that source the value from a `string`
 * field (e.g. the credentials DB column) must validate with `isHermesProvider`
 * before calling.
 */
function pushCredentialToHermesEnv(provider: HermesProvider, apiKey: string): SyncActionResult {
  try {
    const { backupPath } = syncCredentialToHermesEnv({
      provider,
      apiKey,
    });
    return {
      success: true,
      backupPath,
      details: [
        {
          action: "pushed",
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
          detail: String(messageFromError(err, "")),
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
  // The DB column is `provider TEXT` (no CHECK constraint), so validate
  // against the canonical list before passing to the typed push helper.
  if (!isHermesProvider(cred.provider)) {
    return {
      success: false,
      backupPath: null,
      details: [{ action: "error", detail: `Unknown provider: ${cred.provider}` }],
    };
  }
  return pushCredentialToHermesEnv(cred.provider, cred.apiKey);
}
