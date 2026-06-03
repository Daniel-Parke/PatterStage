import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/api-auth";
import { logApiError } from "@/lib/api-logger";
import { parseJsonBody } from "@/lib/parse-json-body";
import { serverError } from "@/lib/api-response";
import { runCatalogSeed, getSeedState, type SeedTarget } from "@/lib/seed/catalog-seed";
import { importHermesStateFromDisk } from "@/lib/hermes-state-import";
import { getHermesHome } from "@/lib/hermes-home";
import { existsSync } from "fs";

export async function GET() {
  try {
    const state = getSeedState();
    return NextResponse.json({ data: { state } });
  } catch (error) {
    logApiError("GET /api/seed", "state", error);
    return serverError("Failed to read seed state");
  }
}

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  // Hoist body parsing out of the main try/catch so malformed JSON returns
  // 400 (via parseJsonBody) rather than 500. Body is treated as a record
  // of optional fields (target/mode/slug/templateId) — all have defaults.
  const bodyResult = await parseJsonBody(request);
  if (bodyResult instanceof NextResponse) return bodyResult;
  const body = bodyResult;

  try {
    const target = (body.target as SeedTarget["target"]) ?? "all";
    const mode = (body.mode as SeedTarget["mode"]) ?? "merge";
    const slug = typeof body.slug === "string" ? body.slug : undefined;
    const templateId =
      typeof body.templateId === "string"
        ? body.templateId
        : typeof body.id === "string"
          ? body.id
          : undefined;

    const hermesHome = getHermesHome();
    const imported = existsSync(hermesHome + "/config.yaml")
      ? importHermesStateFromDisk()
      : null;
    const result = runCatalogSeed({ target, mode, slug, templateId });
    return NextResponse.json({ data: { ...result, imported } });
  } catch (error) {
    logApiError("POST /api/seed", "seed", error);
    return serverError("Failed to run seed");
  }
}
