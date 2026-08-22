// ═══════════════════════════════════════════════════════════════
// fallback-import.ts — import the fallback chain from Hermes config.yaml
// ═══════════════════════════════════════════════════════════════
//
// The heavy body of the former POST /api/models/fallbacks/import route,
// extracted so the consolidated /api/models/fallbacks route's action
// switch stays readable. Reads config.yaml's fallback_providers, upserts
// each as a model, adds it to the chain, and pushes the enabled chain
// to Hermes.

import { NextResponse } from "next/server";

import { serverErrorFromCatch } from "@/lib/api-logger";
import { appendAuditLine } from "@/lib/audit-log";
import {
  addFallbackEntry,
  getFallbackConfig,
  listFallbackChain,
  updateFallbackConfigBatch,
} from "@/lib/fallbacks-repository";
import { parseFallbackAgentSettingsFromYaml } from "@/lib/fallback-config-yaml";
import { upsertModel } from "@/lib/models-repository";
import { syncEnabledFallbackChainToHermes } from "./fallback-sync";
import { readHermesYamlConfig } from "./hermes-config-read";
import { notFound, ok } from "@/lib/api-response";
import { fallbackKey } from "@/lib/model-key";

/** The (provider, modelId) keys already in the fallback chain. */
function existingFallbackKeys(): Set<string> {
  return new Set(
    listFallbackChain().map((e) => fallbackKey(e.provider, e.modelIdString)),
  );
}

export function importFallbacksFromHermesYaml(overwrite: boolean): NextResponse {
  try {
    const config = readHermesYamlConfig<{
      fallback_providers?: Array<{ provider?: string; model?: string; base_url?: string }>;
      agent?: unknown;
    }>();
    if (!config) {
      return notFound("config.yaml not found");
    }

    const agentSettings = parseFallbackAgentSettingsFromYaml(config.agent);
    if (Object.keys(agentSettings).length > 0) {
      updateFallbackConfigBatch(agentSettings);
    }

    const chain = config?.fallback_providers ?? [];
    const imported: string[] = [];
    const skipped: string[] = [];

    const existingKeys = existingFallbackKeys();

    for (let i = 0; i < chain.length; i++) {
      const entry = chain[i];
      if (!entry.provider || !entry.model) continue;

      const key = fallbackKey(entry.provider, entry.model);
      if (existingKeys.has(key) && !overwrite) {
        skipped.push(key);
        continue;
      }

      // Upsert the model (creates if missing, updates if exists)
      const modelResult = upsertModel({
        name: entry.model,
        provider: entry.provider,
        modelId: entry.model,
        baseUrl: entry.base_url?.trim() || null,
        contextLength: null,
        defaultSlots: [],
      });

      // Add to fallback chain at position i
      addFallbackEntry({
        modelId: modelResult.id,
        position: i,
        enabled: true,
        overrideBaseUrl: entry.base_url?.trim() || null,
      });

      imported.push(key);
      existingKeys.add(key);
    }

    const fullConfig = getFallbackConfig();
    syncEnabledFallbackChainToHermes(fullConfig);

    appendAuditLine({
      action: "fallback.import",
      resource: `imported:${imported.length}`,
      ok: true,
    });

    return ok({
      imported: imported.length,
      skipped: skipped.length,
      entries: imported,
    });
  } catch (error) {
    return serverErrorFromCatch(
      "POST /api/models/fallbacks { action: import }",
      "importing fallbacks",
      error,
      "Failed to import fallbacks",
    );
  }
}
