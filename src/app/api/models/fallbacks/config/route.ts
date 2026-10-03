// ═══════════════════════════════════════════════════════════════
// /api/models/fallbacks/config — GET/PUT fallback behaviour config
// ═══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";

import { parseAndValidateJsonBody } from "@/lib/api/parse-json-body";
import { appendAuditLine } from "@/lib/api/audit-log";
import { getFallbackConfig, updateFallbackConfigBatch } from "@/lib/models/fallbacks-repository";
import { fallbackConfigPutSchema } from "@/lib/models/fallback-config-schema";
import { syncEnabledFallbackChainToHermes } from "@/modules/hermes/lib/fallback-sync";
import { ok } from "@/lib/api/api-response";
import { route } from "@/lib/api/api-route";

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