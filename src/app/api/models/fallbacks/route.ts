// ═══════════════════════════════════════════════════════════════
// /api/models/fallbacks — list + action-based fallback chain mutations
// ═══════════════════════════════════════════════════════════════
//
// GET  → the fallback chain + behaviour config.
// POST → an `action`-discriminated mutation (add | toggle | reorder |
//        custom | import | sync). These were five separate sub-routes
//        (toggle/reorder/custom/import/sync) consolidated here; the
//        per-entry GET/PUT/DELETE stays at /[id] and the behaviour
//        config at /config.
import { NextRequest, NextResponse } from "next/server";

import { parseAndValidateJsonBody } from "@/lib/parse-json-body";
import { logApiError, serverErrorFromCatch } from "@/lib/api-logger";
import { toError } from "@/lib/api-fetch";
import { appendAuditLine } from "@/lib/audit-log";
import {
  addFallbackEntry,
  getFallbackConfig,
  getFallbackEntry,
  listFallbackChain,
  toggleFallbackEntry,
  updateFallbackEntry,
  updateFallbackConfigBatch,
} from "@/lib/fallbacks-repository";
import { fallbackActionSchema } from "@/lib/fallback-config-schema";
import { commitFallbackChange, syncEnabledFallbackChainToHermes } from "@/modules/hermes/lib/fallback-sync";
import { importFallbacksFromHermesYaml } from "@/modules/hermes/lib/fallback-import";
import { inTransaction } from "@/lib/db";
import { created, notFound, ok, serverError } from "@/lib/api-response";

export async function GET(_request: NextRequest) {
  try {
    return ok({ entries: listFallbackChain(), config: getFallbackConfig() });
  } catch (error) {
    return serverErrorFromCatch(
      "GET /api/models/fallbacks",
      "reading fallback chain",
      error,
      "Failed to read fallback chain",
    );
  }
}

export async function POST(request: NextRequest) {
  const parsed = await parseAndValidateJsonBody(request, fallbackActionSchema);
  if (parsed instanceof NextResponse) return parsed;

  try {
    switch (parsed.action) {
      // ── Add from registry ──────────────────────────────────────
      case "add": {
        const entry = addFallbackEntry({
          modelId: parsed.modelId,
          position: parsed.position,
          enabled: parsed.enabled,
          overrideBaseUrl: parsed.overrideBaseUrl,
        });
        commitFallbackChange("fallback.add", entry.id);
        return created({ entry });
      }

      // ── Toggle enabled ─────────────────────────────────────────
      case "toggle": {
        const entry = toggleFallbackEntry(parsed.entryId, parsed.enabled);
        if (!entry) return notFound("Fallback entry not found");
        commitFallbackChange("fallback.toggle", entry.id);
        return ok({ entry });
      }

      // ── Reorder (swap with adjacent) ───────────────────────────
      case "reorder": {
        const { entryId, direction } = parsed;
        const entry = getFallbackEntry(entryId);
        if (!entry) return notFound("Entry not found");

        const chain = listFallbackChain();
        const idx = chain.findIndex((e) => e.id === entryId);
        if (idx === -1) return notFound("Entry not in chain");

        const targetIdx = direction === "up" ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= chain.length) {
          // Already at top/bottom — no-op
          return ok({ fallbacks: chain });
        }

        // Swap positions atomically
        inTransaction(() => {
          const posA = chain[idx].position;
          const posB = chain[targetIdx].position;
          updateFallbackEntry(chain[idx].id, { position: posB });
          updateFallbackEntry(chain[targetIdx].id, { position: posA });
        });

        commitFallbackChange("fallback.reorder", entryId);
        return ok({ fallbacks: listFallbackChain() });
      }

      // ── Add custom (non-registry) ──────────────────────────────
      case "custom": {
        const entry = addFallbackEntry({
          modelId: null,
          modelName: parsed.name,
          provider: parsed.provider,
          modelIdString: parsed.modelIdString,
          position: parsed.position,
          enabled: parsed.enabled,
          overrideBaseUrl: parsed.baseUrl,
        });
        commitFallbackChange("fallback.custom.add", entry.id);
        return created({ entry });
      }

      // ── Import from Hermes config.yaml ─────────────────────────
      case "import":
        return importFallbacksFromHermesYaml(parsed.overwrite ?? false);

      // ── Sync chain + config to Hermes ──────────────────────────
      case "sync": {
        try {
          if (parsed.config && Object.keys(parsed.config).length > 0) {
            updateFallbackConfigBatch(parsed.config);
          }

          const config = getFallbackConfig();
          const result = syncEnabledFallbackChainToHermes(config);

          appendAuditLine({ action: "fallback.sync", resource: "hermes", ok: true });

          return ok({
            success: true,
            config,
            hermesHome: result?.hermesHome ?? null,
            configPath: result?.configPath ?? null,
            backupPath: result?.backupPath ?? null,
          });
        } catch (error) {
          logApiError("POST /api/models/fallbacks { action: sync }", "syncing fallback to Hermes", error);
          return serverError(toError(error).message);
        }
      }
    }
  } catch (error) {
    return serverErrorFromCatch(
      "POST /api/models/fallbacks",
      `fallback action ${parsed.action}`,
      error,
      "Failed to process fallback action",
    );
  }
}
