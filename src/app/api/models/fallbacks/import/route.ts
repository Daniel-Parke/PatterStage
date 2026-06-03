// ═══════════════════════════════════════════════════════════════
// /api/models/fallbacks/import — GET preview / POST import fallbacks from Hermes config.yaml
// ═══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { parseJsonBody } from "@/lib/parse-json-body";
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
import { syncEnabledFallbackChainToHermes } from "@/lib/fallback-sync-helpers";
import { readHermesYamlConfig } from "@/lib/hermes-config-sync";
import { notFound, ok } from "@/lib/api-response";
import { fallbackKey } from "@/lib/model-key";

interface ImportPreview {
  provider: string;
  model: string;
  baseUrl: string | null;
  alreadyImported: boolean;
}

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  try {
    const config = readHermesYamlConfig<{
      fallback_providers?: Array<{ provider?: string; model?: string; base_url?: string }>;
    }>();
    if (!config) {
      return ok({ fallbacks: [], imported: false });
    }

    const preview: ImportPreview[] = [];
    const existingChain = listFallbackChain();
    const existingKeys = new Set(
      existingChain.map((e) => fallbackKey(e.provider, e.modelIdString))
    );

    for (const entry of config?.fallback_providers ?? []) {
      if (!entry.provider || !entry.model) continue;
      preview.push({
        provider: entry.provider,
        model: entry.model,
        baseUrl: entry.base_url?.trim() || null,
        alreadyImported: existingKeys.has(fallbackKey(entry.provider, entry.model)),
      });
    }

    return ok({ fallbacks: preview });
  } catch (error) {
    return serverErrorFromCatch(
      "GET /api/models/fallbacks/import",
      "previewing import",
      error,
      "Failed to preview import",
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  const bodyResult = await parseJsonBody(request);
  if (bodyResult instanceof NextResponse) return bodyResult;

  const body = bodyResult as { overwrite?: boolean };

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

    const existingChain = listFallbackChain();
    const existingKeys = new Set(
      existingChain.map((e) => fallbackKey(e.provider, e.modelIdString))
    );

    for (let i = 0; i < chain.length; i++) {
      const entry = chain[i];
      if (!entry.provider || !entry.model) continue;

      const key = fallbackKey(entry.provider, entry.model);
      if (existingKeys.has(key) && !body?.overwrite) {
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

    return NextResponse.json({
      data: {
        imported: imported.length,
        skipped: skipped.length,
        entries: imported,
      },
    });
  } catch (error) {
    return serverErrorFromCatch(
      "POST /api/models/fallbacks/import",
      "importing fallbacks",
      error,
      "Failed to import fallbacks",
    );
  }
}