// ═══════════════════════════════════════════════════════════════
// /api/laboratory/research/presets — saved Deep Research configurations
// GET (list) · POST (create) · DELETE ?id=
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { ok, created, badRequest } from "@/lib/api-response";
import { ensureDb } from "@/lib/db";
import { parseAndValidateJsonBody } from "@/lib/parse-json-body";
import {
  listResearchPresets,
  createResearchPreset,
  deleteResearchPreset,
} from "@/lib/laboratory/deep-research/research-repository";
import { route } from "@/lib/api-route";

const createSchema = z.object({
  name: z.string().min(1).max(60),
  config: z
    .object({
      modelId: z.string().min(1).optional(),
      searchProvider: z.enum(["duckduckgo", "searxng", "none"]).optional(),
      rounds: z.number().int().min(1).max(8).optional(),
      resultsPerQuery: z.number().int().min(1).max(12).optional(),
      visitsPerRound: z.number().int().min(0).max(6).optional(),
    })
    .strict(),
});

export const GET = route("GET /api/laboratory/research/presets", "list", "Failed to list presets", async () => {
  ensureDb();
  return ok({ presets: listResearchPresets() });
});

export const POST = route("POST /api/laboratory/research/presets", "create", "Failed to save preset", async (request: NextRequest) => {
  const parsed = await parseAndValidateJsonBody(request, createSchema);
  if (parsed instanceof NextResponse) return parsed;
  ensureDb();
  return created({ preset: createResearchPreset(parsed.name, parsed.config) });
});

export const DELETE = route("DELETE /api/laboratory/research/presets", "delete", "Failed to delete preset", async (request: NextRequest) => {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return badRequest("id is required");
  ensureDb();
  deleteResearchPreset(id);
  return ok({ deleted: true });
});
