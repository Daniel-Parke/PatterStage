// ═══════════════════════════════════════════════════════════════
// /api/models/fallbacks/import — GET preview / POST import fallbacks from Hermes config.yaml
// ═══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { existsSync, readFileSync } from "fs";
import * as yaml from "js-yaml";
import { requireMcApiKey, requireNotReadOnly } from "@/lib/api-auth";
import { logApiError } from "@/lib/api-logger";
import { appendAuditLine } from "@/lib/audit-log";
import { addFallbackEntry, listFallbackChain } from "@/lib/fallbacks-repository";
import { upsertModel } from "@/lib/models-repository";
import { syncFallbacksToHermesConfig } from "@/lib/hermes-config-sync";
import { getActiveHermesPaths } from "@/lib/hermes-agent-runtime";

interface ImportPreview {
  provider: string;
  model: string;
  baseUrl: string | null;
  alreadyImported: boolean;
}

export async function GET() {
  try {
    const paths = getActiveHermesPaths();
    if (!existsSync(paths.config)) {
      return NextResponse.json({ data: { fallbacks: [], imported: false } });
    }

    const raw = readFileSync(paths.config, "utf-8");
    const config = yaml.load(raw) as {
      fallback_providers?: Array<{ provider?: string; model?: string; base_url?: string }>;
    } | null;

    const preview: ImportPreview[] = [];
    const existingChain = listFallbackChain();
    const existingKeys = new Set(
      existingChain.map((e) => `${e.provider}::${e.modelIdString}`)
    );

    for (const entry of config?.fallback_providers ?? []) {
      if (!entry.provider || !entry.model) continue;
      preview.push({
        provider: entry.provider,
        model: entry.model,
        baseUrl: entry.base_url?.trim() || null,
        alreadyImported: existingKeys.has(`${entry.provider}::${entry.model}`),
      });
    }

    return NextResponse.json({ data: { fallbacks: preview } });
  } catch (error) {
    logApiError("GET /api/models/fallbacks/import", "previewing import", error);
    return NextResponse.json({ error: "Failed to preview import" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const ro = requireNotReadOnly();
  if (ro) return ro;
  const auth = requireMcApiKey(request);
  if (auth) return auth;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const body = raw as { overwrite?: boolean };

  try {
    const paths = getActiveHermesPaths();
    if (!existsSync(paths.config)) {
      return NextResponse.json({ error: "config.yaml not found" }, { status: 404 });
    }

    const rawContent = readFileSync(paths.config, "utf-8");
    const config = yaml.load(rawContent) as {
      fallback_providers?: Array<{ provider?: string; model?: string; base_url?: string }>;
    } | null;

    const chain = config?.fallback_providers ?? [];
    const imported: string[] = [];
    const skipped: string[] = [];

    const existingChain = listFallbackChain();
    const existingKeys = new Set(
      existingChain.map((e) => `${e.provider}::${e.modelIdString}`)
    );

    for (let i = 0; i < chain.length; i++) {
      const entry = chain[i];
      if (!entry.provider || !entry.model) continue;

      const key = `${entry.provider}::${entry.model}`;
      if (existingKeys.has(key) && !body?.overwrite) {
        skipped.push(key);
        continue;
      }

      // Upsert the model (creates if missing, updates if exists)
      const modelResult = upsertModel({
        importKey: key,
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

    // Re-sync to Hermes config
    const updatedChain = listFallbackChain().filter((e) => e.enabled);
    syncFallbacksToHermesConfig(
      updatedChain.map((e) => ({
        modelId: e.modelIdString,
        provider: e.provider,
        baseUrl: null,
        overrideBaseUrl: e.overrideBaseUrl,
        apiKey: null,
      })),
      {}
    );

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
    logApiError("POST /api/models/fallbacks/import", "importing fallbacks", error);
    return NextResponse.json({ error: "Failed to import fallbacks" }, { status: 500 });
  }
}