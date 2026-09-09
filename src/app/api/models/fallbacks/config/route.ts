// ═══════════════════════════════════════════════════════════════
// /api/models/fallbacks/config — GET/PUT fallback behaviour config
// ═══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";

import { parseAndValidateJsonBody } from "@/lib/parse-json-body";
import { appendAuditLine } from "@/lib/audit-log";
import { getFallbackConfig, updateFallbackConfigBatch } from "@/lib/fallbacks-repository";
import { fallbackConfigPutSchema } from "@/lib/fallback-config-schema";
import { syncEnabledFallbackChainToHermes } from "@/modules/hermes/lib/fallback-sync";
import { ok } from "@/lib/api-response";
import { route } from "@/lib/api-route";

export const GET = route("GET /api/models/fallbacks/config", "reading fallback config", "Failed to read fallback config", async (_request: NextRequest) => {
  return ok({ config: getFallbackConfig() });
});

export const PUT = route("PUT /api/models/fallbacks/config", "updating fallback config", "Failed to update fallback config", async (request: NextRequest) => {
  const parsed = await parseAndValidateJsonBody(request, fallbackConfigPutSchema);
  if (parsed instanceof NextResponse) return parsed;
  const updated = updateFallbackConfigBatch(parsed);
  syncEnabledFallbackChainToHermes(updated);
  appendAuditLine({ action: "fallback.config.update", resource: "config", ok: true });
  return ok({ config: updated });
});