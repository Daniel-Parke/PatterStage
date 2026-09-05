import type { NextRequest } from "next/server";
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

import { parseHermesConfig } from "@/modules/hermes/lib/config-import";
import { modelKey } from "@/lib/model-key";
import { upsertModel, updateModel, listModels } from "@/lib/models-repository";
import { upsertCredential } from "@/lib/credentials-repository";
import { envVarForProvider } from "@/modules/hermes/lib/providers";
import { logApiError, serverErrorFromCatch } from "@/lib/api-logger";
import { ok } from "@/lib/api-response";
import { toError } from "@/lib/api-fetch";

import { appendAuditLine } from "@/lib/audit-log";
import { maskKeyHint } from "@/lib/secret-mask";

// GET /api/models/import — dry-run preview
export async function GET(_request: NextRequest) {
  try {
    const parsed = parseHermesConfig();
    return ok({
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
        keyHint: maskKeyHint(c.apiKey.trim()),
      })),
      details: parsed.details,
    });
  } catch (error) {
    return serverErrorFromCatch(
      "GET /api/models/import",
      "previewing Hermes import",
      error,
      "Failed to preview import",
    );
  }
}

// POST /api/models/import — execute import
export async function POST(_request: NextRequest) {
  try {
    const parsed = parseHermesConfig();

    const details: Array<{ name: string; action: string; reason?: string }> = [];
    // Track each upserted model's id by (provider::modelId) so the
    // credential-link pass below doesn't have to re-query the DB.
    const modelKeyToId = new Map<string, string>();

    for (const model of parsed.models) {
      const key = modelKey(model.provider, model.modelId);
      try {
        const result = upsertModel({
          name: model.name,
          provider: model.provider,
          modelId: model.modelId,
          baseUrl: model.baseUrl,
          contextLength: model.contextLength,
          defaultSlots: model.defaultSlots,
        });
        modelKeyToId.set(key, result.id);
        // Say when the import deferred to an edit rather than writing over it,
        // so "updated" does not read as "overwrote everything" (T-0100, D10).
        // `?? []` because a caller's double may predate the field.
        const kept = result.preserved ?? [];
        details.push({
          name: model.name,
          action: result.action,
          reason:
            `provider=${model.provider} model=${model.modelId}` +
            (kept.length > 0 ? ` (kept operator edits: ${kept.join(", ")})` : ""),
        });
      } catch (err) {
        logApiError("POST /api/models/import", `upsert model ${model.name}`, err);
        details.push({
          name: model.name,
          action: "skipped",
          reason: toError(err).message,
        });
      }
    }

    let credentialsUpdated = 0;
    // Build provider → credentialId map from upsert results
    const providerToCredId: Record<string, string> = {};
    for (const cred of parsed.credentials) {
      // OAuth-only providers have no API key to store. Hermes signals that with an
      // empty env-var name, so the question is Hermes' to answer and it is asked
      // HERE, at the composition point, rather than inside the core credentials
      // repository -- which was inferring "OAuth-only" from a vendor lookup table.
      if (!envVarForProvider(cred.provider)) continue;
      try {
        const result = upsertCredential({ provider: cred.provider, apiKey: cred.apiKey });
        if (result) {
          credentialsUpdated++;
          providerToCredId[cred.provider] = result.id;
        }
      } catch (err) {
        logApiError("POST /api/models/import", `upsert credential ${cred.provider}`, err);
      }
    }

    // Link credentials to models where provider matches
    let credentialsLinked = 0;
    if (Object.keys(providerToCredId).length > 0) {
      // Build a model-id → existing-row map once (O(N)) instead of calling
      // `listModels().find(m => m.id === modelId)` inside the loop, which
      // was O(N) per model = O(N×M) total. The N models in `parsed.models`
      // map 1:1 to the M rows from listModels (both originate from the
      // same registry writes), so a Map lookup is sufficient.
      const existingById = new Map(listModels().map((m) => [m.id, m]));
      for (const entry of parsed.models) {
        const credId = providerToCredId[entry.provider];
        if (!credId) continue;
        const modelId = modelKeyToId.get(modelKey(entry.provider, entry.modelId));
        if (!modelId) continue;
        // Re-read the existing model once to check whether the link is
        // already in place — avoids a redundant write + audit line.
        try {
          const model = existingById.get(modelId);
          if (model && model.credentialsId !== credId) {
            updateModel(modelId, { credentialsId: credId });
            credentialsLinked++;
          }
        } catch {
          // best-effort
        }
      }
    }

    const { modelsImported, modelsSkipped } = details.reduce(
      (acc, d) => {
        if (d.action === "skipped") acc.modelsSkipped += 1;
        else acc.modelsImported += 1;
        return acc;
      },
      { modelsImported: 0, modelsSkipped: 0 },
    );

    appendAuditLine({
      action: "models.import",
      resource: "hermes",
      ok: true,
      detail: `models_imported=${modelsImported} models_skipped=${modelsSkipped} credentials_updated=${credentialsUpdated} credentials_linked=${credentialsLinked}`,
    });

    return ok({
      modelsImported,
      modelsSkipped,
      credentialsUpdated,
      credentialsLinked,
      details,
    });
  } catch (error) {
    return serverErrorFromCatch(
      "POST /api/models/import",
      "importing Hermes models",
      error,
      "Failed to import models",
    );
  }
}
