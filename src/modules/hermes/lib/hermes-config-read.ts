// ═══════════════════════════════════════════════════════════════
// hermes-config-read.ts: reading ~/.hermes/config.yaml
//
// One responsibility: turn the on-disk config.yaml into typed values,
// and never write. The shape of that file (`model`, `auxiliary`,
// `fallback_providers`, `agent`) is declared here as `HermesConfig`
// because this is where it is parsed; the writers import the type from
// here rather than each keeping a private idea of the layout.
//
// Three readers, at three grains:
//   - readHermesYamlConfig:    the whole file, or null.
//   - loadHermesConfigFromString: a YAML string already in hand.
//   - readHermesConfigModels:  every (provider, modelId) pair the
//     file mentions, flattened across its three model-bearing
//     sections.
// ═══════════════════════════════════════════════════════════════

import { existsSync, readFileSync } from "fs";
import type { ModelIdentity } from "@/lib/models/model-types";
import * as yaml from "js-yaml";

import { modelKey } from "@/lib/models/model-key";
import { getActiveHermesPaths } from "./agent-runtime";

export interface AuxiliarySection {
  provider?: string;
  model?: string;
  base_url?: string;
  api_key?: string;
  timeout?: number;
}

export interface HermesConfig {
  model?: { default?: string; provider?: string; base_url?: string; api_key?: string; context_length?: number };
  auxiliary?: Record<string, AuxiliarySection>;
  fallback_providers?: Array<{ provider: string; model: string; base_url?: string; api_key?: string }>;
  [key: string]: unknown;
}

/**
 * Read `~/.hermes/config.yaml` and return the parsed YAML object, or
 * `null` if the file is missing or unparseable. `null` rather than `{}`
 * so a missing file cannot pass as an empty config; callers handle it
 * explicitly.
 */
export function readHermesYamlConfig<T = Record<string, unknown>>(): T | null {
  const paths = getActiveHermesPaths();
  if (!existsSync(paths.config)) return null;
  try {
    const raw = readFileSync(paths.config, "utf-8");
    return (yaml.load(raw) as T) ?? null;
  } catch {
    return null;
  }
}

/**
 * Parse a YAML string into a HermesConfig, treating empty content as an
 * empty object.
 *
 * **Does NOT catch parse errors**: a `yaml.load` throw propagates. The one
 * caller that must not overwrite a partially-written file
 * (`syncDefaultsToHermesConfig`) keeps its own try/catch inline.
 */
export function loadHermesConfigFromString(content: string): HermesConfig {
  if (!content) return {};
  return (yaml.load(content) as HermesConfig) ?? {};
}

/**
 * Collect every unique (provider, modelId) pair currently written in
 * config.yaml's model.* + auxiliary.* + fallback_providers.* sections.
 *
 * Shared by sync-manager.ts (drift detection) and the sync/pull route
 * (per-model pull from Hermes config → DB).
 */
export type HermesConfigModelEntry = ModelIdentity;

export function readHermesConfigModels(): Map<string, HermesConfigModelEntry> {
  const config = readHermesYamlConfig<Record<string, unknown>>();
  if (!config) return new Map();

  try {
    const map = new Map<string, HermesConfigModelEntry>();

    type ConfigModelSlice = {
      default?: string;
      model?: string;
      provider?: string;
      base_url?: string;
      context_length?: number;
    };

    const entryFromSlice = (slice: ConfigModelSlice): HermesConfigModelEntry | null => {
      const modelId = slice.default ?? slice.model;
      if (!modelId || !slice.provider) return null;
      return {
        modelId,
        provider: slice.provider,
        baseUrl: slice.base_url?.trim() || null,
        contextLength:
          typeof slice.context_length === "number" ? slice.context_length : null,
      };
    };

    // Primary model section
    const model = config.model as ConfigModelSlice | undefined;
    const primary = model ? entryFromSlice(model) : null;
    if (primary) {
      map.set(modelKey(primary.provider, primary.modelId), primary);
    }

    // Auxiliary sections
    const aux = config.auxiliary as Record<string, ConfigModelSlice> | undefined;
    for (const entry of Object.values(aux ?? {})) {
      const parsed = entryFromSlice(entry);
      if (parsed) {
        map.set(modelKey(parsed.provider, parsed.modelId), parsed);
      }
    }

    // Fallback providers chain — models used as fallbacks
    const fallback = config.fallback_providers as ConfigModelSlice[] | undefined;
    for (const entry of fallback ?? []) {
      const parsed = entryFromSlice(entry);
      if (parsed) {
        const key = modelKey(parsed.provider, parsed.modelId);
        if (!map.has(key)) {
          map.set(key, parsed);
        }
      }
    }

    return map;
  } catch {
    return new Map();
  }
}
