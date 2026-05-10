// ═══════════════════════════════════════════════════════════════
// /api/models/import — Import Hermes models from config.yaml + .env
// ═══════════════════════════════════════════════════════════════
//
// POST: reads ~/.hermes/config.yaml and ~/.hermes/.env, upserts models
//   and credentials into the registry. Same logic that runs during
//   prebuild — exposed as a manual UI action ("Refresh Models").
//
// GET: returns a dry-run preview of what would be imported without
//   writing anything to the database.

import { NextRequest, NextResponse } from "next/server";

import { parseHermesConfig } from "@/lib/hermes-import";
import { upsertModel } from "@/lib/models-repository";
import { upsertCredential } from "@/lib/credentials-repository";
import { logApiError } from "@/lib/api-logger";
import { requireMcApiKey, requireNotReadOnly } from "@/lib/api-auth";
import { appendAuditLine } from "@/lib/audit-log";

// GET /api/models/import — dry-run preview
export async function GET(request: NextRequest) {
  const auth = requireMcApiKey(request);
  if (auth) return auth;

  try {
    const parsed = parseHermesConfig();
    return NextResponse.json({
      data: {
        modelsCount: parsed.models.length,
        credentialsCount: parsed.credentials.length,
        models: parsed.models.map((m) => ({
          name: m.name,
          provider: m.provider,
          modelId: m.modelId,
          baseUrl: m.baseUrl,
          defaultSlots: m.defaultSlots,
        })),
        credentials: parsed.credentials.map((c) => ({
          provider: c.provider,
          keyHint: c.apiKey.trim().slice(0, 4) + "..." + c.apiKey.trim().slice(-4),
        })),
        details: parsed.details,
      },
    });
  } catch (error) {
    logApiError("GET /api/models/import", "previewing Hermes import", error);
    return NextResponse.json({ error: "Failed to preview import" }, { status: 500 });
  }
}

// POST /api/models/import — execute import
export async function POST(request: NextRequest) {
  const ro = requireNotReadOnly();
  if (ro) return ro;
  const auth = requireMcApiKey(request);
  if (auth) return auth;

  try {
    const parsed = parseHermesConfig();

    const details: Array<{ name: string; action: string; reason?: string }> = [];

    for (const model of parsed.models) {
      try {
        const result = upsertModel({
          importKey: model.importKey,
          name: model.name,
          provider: model.provider,
          modelId: model.modelId,
          baseUrl: model.baseUrl,
          contextLength: model.contextLength,
          defaultSlots: model.defaultSlots,
        });
        details.push({
          name: model.name,
          action: result.action,
          reason: `provider=${model.provider} model=${model.modelId}`,
        });
      } catch (err) {
        logApiError("POST /api/models/import", `upsert model ${model.name}`, err);
        details.push({
          name: model.name,
          action: "skipped",
          reason: String(err instanceof Error ? err.message : err),
        });
      }
    }

    for (const cred of parsed.credentials) {
      try {
        upsertCredential({ provider: cred.provider, apiKey: cred.apiKey });
        details.push({
          name: `${cred.provider} API key`,
          action: "inserted",
          reason: "from .env",
        });
      } catch (err) {
        logApiError("POST /api/models/import", `upsert credential ${cred.provider}`, err);
      }
    }

    const imported = details.filter((d) => d.action !== "skipped").length;
    const skipped = details.filter((d) => d.action === "skipped").length;

    appendAuditLine({
      action: "models.import",
      resource: "hermes",
      ok: true,
      detail: `imported=${imported} skipped=${skipped}`,
    });

    return NextResponse.json({
      data: {
        imported,
        skipped,
        credentials: parsed.credentials.length,
        details,
      },
    });
  } catch (error) {
    logApiError("POST /api/models/import", "importing Hermes models", error);
    return NextResponse.json({ error: "Failed to import models" }, { status: 500 });
  }
}
