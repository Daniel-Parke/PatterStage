// ═══════════════════════════════════════════════════════════════
// hermes-import.ts — Read Hermes config + .env, produce upsert objects
// ═══════════════════════════════════════════════════════════════
//
// This is the companion to hermes-config-sync.ts (which writes registry
// state → Hermes files). This module reads Hermes files → registry.
//
// Sources read:
//   ~/.hermes/config.yaml  — model.* + auxiliary.<task>.* sections
//   ~/.hermes/.env        — *_API_KEY lines for credential discovery
//
// The caller is responsible for writing to the SQLite registry
// (upsertModel / upsertCredential in models-repository /
// credentials-repository).
//
// Design:
//   - Idempotent: same input = same output (stable import keys)
//   - Unknown providers are silently skipped
//   - Context length is never in config.yaml — left null
//   - Credentials are only created if a model for that provider exists

import { createHash } from "crypto";
import { existsSync, readFileSync } from "fs";
import * as yaml from "js-yaml";

import { getActiveHermesPaths } from "./hermes-agent-runtime";
import {
  PROVIDER_ENV_VAR,
  isHermesProvider,
  TASK_TYPES,
  type HermesProvider,
  type TaskType,
} from "./hermes-providers";

// ── Types ────────────────────────────────────────────────────

export interface ParsedCredential {
  provider: HermesProvider;
  apiKey: string;
  /** Stable key used for upsert — SHA-256 of provider + first 8 hex chars */
  importKey: string;
}

export interface ParsedModel {
  /**
   * Stable key used for upsert — SHA-256(provider + model_id), first 16 hex.
   * Used to detect "same model, already imported" across runs.
   */
  importKey: string;
  name: string;
  provider: HermesProvider;
  modelId: string;
  baseUrl: string | null;
  contextLength: number | null;
  /** Task types this model should be the default for. Empty = no defaults. */
  defaultSlots: TaskType[];
}

export interface ImportResult {
  models: ParsedModel[];
  credentials: ParsedCredential[];
  /** Human-readable summary for audit / UI toast */
  details: Array<{ name: string; action: "inserted" | "updated" | "skipped"; reason?: string }>;
}

// ── Helpers ──────────────────────────────────────────────────

/** Stable import key — deterministic, collision-resistant enough for DB use. */
function importKeyFor(provider: string, modelId: string): string {
  return createHash("sha256")
    .update(`${provider}::${modelId}`)
    .digest("hex")
    .slice(0, 16);
}

// ── Config YAML parser ───────────────────────────────────────

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
  timeout?: number;
}

interface HermesYamlConfig {
  model?: ConfigModelSection;
  auxiliary?: Record<string, ConfigAuxiliaryEntry>;
  [key: string]: unknown;
}

/**
 * Extract all model configurations from config.yaml.
 * Returns a map of importKey → ParsedModel (one entry per unique provider+model).
 */
function parseConfigYaml(configPath: string): Map<string, ParsedModel> {
  const byKey = new Map<string, ParsedModel>();

  if (!existsSync(configPath)) return byKey;

  let config: HermesYamlConfig;
  try {
    config = (yaml.load(readFileSync(configPath, "utf-8")) as HermesYamlConfig) ?? {};
  } catch {
    return byKey;
  }

  const addModel = (
    name: string,
    provider: HermesProvider,
    modelId: string,
    baseUrl: string | null,
    defaultSlot: TaskType
  ) => {
    if (!isHermesProvider(provider)) return;
    const key = importKeyFor(provider, modelId);
    if (byKey.has(key)) {
      // Same provider+model in multiple slots — just claim the extra default
      const existing = byKey.get(key)!;
      if (!existing.defaultSlots.includes(defaultSlot)) {
        existing.defaultSlots.push(defaultSlot);
      }
    } else {
      byKey.set(key, {
        importKey: key,
        name,
        provider,
        modelId,
        baseUrl: baseUrl ?? null,
        contextLength: null,
        defaultSlots: [defaultSlot],
      });
    }
  };

  // Primary agent model: model.default / model.provider / model.base_url
  const primary = config.model;
  if (primary?.default && primary?.provider) {
    const baseUrl = primary.base_url?.trim() || null;
    addModel(primary.default, primary.provider as HermesProvider, primary.default, baseUrl, "agent");
  } else if (primary?.default) {
    // No explicit provider — try to derive from model ID prefix (heuristic)
    const derived = deriveProviderFromModelId(primary.default);
    if (derived) {
      addModel(primary.default, derived, primary.default, primary.base_url?.trim() || null, "agent");
    }
  }

  // Auxiliary slots
  const aux = config.auxiliary ?? {};
  for (const slot of TASK_TYPES) {
    const entry = aux[slot];
    if (!entry?.model) continue;
    const provider = (entry.provider as HermesProvider | undefined) ?? deriveProviderFromModelId(entry.model);
    if (!provider) continue;
    const baseUrl = entry.base_url?.trim() || null;
    addModel(entry.model, provider, entry.model, baseUrl, slot);
  }

  return byKey;
}

// ── .env credential parser ───────────────────────────────────

/**
 * Extract all *_API_KEY values from ~/.hermes/.env.
 * Returns a map of provider → { apiKey, importKey }.
 */
function parseEnvCredentials(envPath: string): Map<HermesProvider, ParsedCredential> {
  const byProvider = new Map<HermesProvider, ParsedCredential>();

  if (!existsSync(envPath)) return byProvider;

  try {
    const content = readFileSync(envPath, "utf-8");
    for (const raw of content.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const m = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
      if (!m) continue;
      const key = m[1]!;
      const value = m[2]!;

      // Find which provider this env var belongs to
      const provider = (Object.entries(PROVIDER_ENV_VAR) as [HermesProvider, string][]).find(
        ([, envVar]) => envVar === key
      )?.[0];
      if (!provider || !value.trim()) continue;

      byProvider.set(provider, {
        provider,
        apiKey: value.trim(),
        importKey: importKeyFor(provider, ""), // credentials use provider-only key
      });
    }
  } catch {
    // best-effort
  }

  return byProvider;
}

// ── Provider inference ───────────────────────────────────────

/** Heuristic: try to derive a HermesProvider from a model ID string. */
function deriveProviderFromModelId(modelId: string): HermesProvider | null {
  const lower = modelId.toLowerCase();
  if (lower.startsWith("anthropic/")) return "anthropic";
  if (lower.startsWith("openai/")) return "openai";
  if (lower.startsWith("openrouter/")) return "openrouter";
  if (lower.startsWith("google/")) return "gemini";
  if (lower.startsWith("gemini/")) return "gemini";
  if (lower.startsWith("deepseek/")) return "deepseek";
  if (lower.startsWith("mistral/")) return "mistral";
  if (lower.startsWith("groq/")) return "groq";
  if (lower.startsWith("huggingface/")) return "huggingface";
  if (lower.startsWith("ollama/")) return "ollama";
  if (lower.startsWith("lmstudio/")) return "lmstudio";
  if (lower.startsWith("vllm/")) return "vllm";
  // Bare model names that map to specific providers
  if (lower.includes("claude")) return "anthropic";
  if (lower.includes("gpt")) return "openai";
  if (lower.includes("minimax")) return "minimax";
  if (lower.includes("gemini")) return "gemini";
  if (lower.includes("opus") || lower.includes("sonnet") || lower.includes("haiku")) return "anthropic";
  return null;
}

// ── Main entry point ─────────────────────────────────────────

/**
 * Parse ~/.hermes/config.yaml and ~/.hermes/.env.
 * Returns models + credentials ready for upsert into the registry.
 *
 * Idempotent — re-running produces the same result.
 */
export function parseHermesConfig(): ImportResult {
  const paths = getActiveHermesPaths();

  const modelsByKey = parseConfigYaml(paths.config);
  const credentialsByProvider = parseEnvCredentials(paths.env);

  // Pair credentials with models that use the same provider
  const credentials: ParsedCredential[] = [];
  const usedProviders = new Set<HermesProvider>();
  for (const [, model] of Array.from(modelsByKey.entries())) {
    usedProviders.add(model.provider);
  }
  for (const [provider, cred] of Array.from(credentialsByProvider.entries())) {
    if (usedProviders.has(provider)) {
      credentials.push(cred);
    }
  }

  const details: ImportResult["details"] = [];
  for (const [, model] of Array.from(modelsByKey.entries())) {
    details.push({
      name: model.name,
      action: "inserted",
      reason: `provider=${model.provider} model=${model.modelId}`,
    });
  }
  for (const cred of credentials) {
    details.push({
      name: `${cred.provider} API key`,
      action: "inserted",
      reason: "from .env",
    });
  }

  return {
    models: Array.from(modelsByKey.values()),
    credentials,
    details,
  };
}
