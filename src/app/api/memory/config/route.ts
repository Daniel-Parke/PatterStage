// ═══════════════════════════════════════════════════════════════
// /api/memory/config — manage the PatterStage-owned memory provider config
//
// GET  → providers + the active connection config.
// PUT  → update a provider's host/port/bank (+ enable/activate). An activation
//        also writes `memory.provider` into the agent's config.yaml, so the
//        file agrees with the database rather than competing with it.
// POST { action: "test", type, config } → probe an endpoint before saving.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { ok, badRequest } from "@/lib/api-response";
import { ensureDb } from "@/lib/db";
import { parseAndValidateJsonBody } from "@/lib/parse-json-body";
import {
  getActiveMemoryConfig,
  listMemoryProviders,
  updateMemoryProvider,
} from "@/lib/memory/memory-providers";
import { HindsightMemoryProvider } from "@/lib/memory/memory-providers/hindsight-provider";
import { writeMemoryProviderToHermesConfig } from "@/modules/hermes/lib/memory-provider-sync";
import { recordEvent } from "@/lib/analytics/record-event";
import { route } from "@/lib/api-route";

const configSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().positive(),
  bank: z.string().min(1),
});

const putSchema = z.object({
  type: z.enum(["hindsight", "holographic"]),
  label: z.string().optional(),
  enabled: z.boolean().optional(),
  makeActive: z.boolean().optional(),
  config: configSchema.optional(),
});

const testSchema = z.object({
  action: z.literal("test"),
  config: configSchema,
});

export const GET = route("GET /api/memory/config", "list", "Failed to load memory config", async () => {
  ensureDb();
  return ok({ providers: listMemoryProviders(), active: getActiveMemoryConfig() });
});

export const PUT = route("PUT /api/memory/config", "update", "Failed to update memory config", async (request: NextRequest) => {
  const parsed = await parseAndValidateJsonBody(request, putSchema);
  if (parsed instanceof NextResponse) return parsed;
  ensureDb();
  const row = updateMemoryProvider(parsed.type, {
    label: parsed.label,
    enabled: parsed.enabled,
    config: parsed.config,
    makeActive: parsed.makeActive,
  });
  if (!row) return badRequest("Unknown provider");
  // The database has moved; now the agent's own file is told, so the two
  // cannot disagree about which memory is in use (T-0101, D64). Only on an
  // activation: an endpoint edit changes how the provider is reached, not
  // which one it is. A file that will not parse is reported in the answer,
  // never raised as a 500 over a row write that succeeded.
  const configYaml = parsed.makeActive === true
    ? writeMemoryProviderToHermesConfig(parsed.type)
    : null;
  recordEvent("memory.configured", { entityType: "memory", entityId: parsed.type });
  return ok({ provider: row, configYaml });
});

export const POST = route("POST /api/memory/config", "test", "Connection test failed", async (request: NextRequest) => {
  const parsed = await parseAndValidateJsonBody(request, testSchema);
  if (parsed instanceof NextResponse) return parsed;
  // Probe the candidate endpoint WITHOUT persisting it.
  const health = await new HindsightMemoryProvider(parsed.config).health();
  return ok({ health });
});
