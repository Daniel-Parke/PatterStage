// ═══════════════════════════════════════════════════════════════
// /api/laboratory/research/presets — saved Deep Research configurations
// GET (list) · POST (create) · DELETE ?id=
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { serverErrorFromCatch } from "@/lib/api-logger";
import { ok, created, badRequest } from "@/lib/api-response";
import { ensureDb } from "@/lib/db";
import { parseAndValidateJsonBody } from "@/lib/parse-json-body";
import {
  listResearchPresets,
  createResearchPreset,
  deleteResearchPreset,
} from "@/lib/laboratory/deep-research/research-repository";

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

export async function GET() {
  try {
    ensureDb();
    return ok({ presets: listResearchPresets() });
  } catch (error) {
    return serverErrorFromCatch("GET /api/laboratory/research/presets", "list", error, "Failed to list presets");
  }
}

export async function POST(request: NextRequest) {
  const parsed = await parseAndValidateJsonBody(request, createSchema);
  if (parsed instanceof NextResponse) return parsed;
  try {
    ensureDb();
    return created({ preset: createResearchPreset(parsed.name, parsed.config) });
  } catch (error) {
    return serverErrorFromCatch("POST /api/laboratory/research/presets", "create", error, "Failed to save preset");
  }
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return badRequest("id is required");
  try {
    ensureDb();
    deleteResearchPreset(id);
    return ok({ deleted: true });
  } catch (error) {
    return serverErrorFromCatch("DELETE /api/laboratory/research/presets", "delete", error, "Failed to delete preset");
  }
}
