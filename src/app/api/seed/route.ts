import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/api-auth";
import { serverErrorFromCatch } from "@/lib/api-logger";
import { ok } from "@/lib/api-response";
import { parseAndValidateJsonBody } from "@/lib/parse-json-body";
import { seedPostSchema } from "@/lib/api-schemas";
import { runCatalogSeed, getSeedState } from "@/lib/seed/catalog-seed";
import { importHermesStateFromDisk } from "@/modules/hermes/lib/state-import";
import { getHermesHome } from "@/modules/hermes/lib/home";
import { existsSync } from "fs";

export async function GET() {
  try {
    const state = getSeedState();
    return ok({ state });
  } catch (error) {
    return serverErrorFromCatch(
      "GET /api/seed",
      "state",
      error,
      "Failed to read seed state",
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  // Hoist body parsing out of the main try/catch so malformed JSON returns
  // 400 (via parseAndValidateJsonBody → parseJsonBody) rather than 500.
  // seedPostSchema validates target/mode against the canonical enums and
  // folds the legacy `id` alias back to `templateId` via .transform() —
  // previously the route did `body.target as SeedTarget["target"]` with
  // no validation, so a foreign value would silently reach runCatalogSeed.
  const parsed = await parseAndValidateJsonBody(request, seedPostSchema);
  if (parsed instanceof NextResponse) return parsed;
  const { target = "all", mode = "merge", slug, templateId } = parsed;

  try {
    const hermesHome = getHermesHome();
    const imported = existsSync(hermesHome + "/config.yaml")
      ? importHermesStateFromDisk()
      : null;
    const result = runCatalogSeed({ target, mode, slug, templateId });
    return ok({ ...result, imported });
  } catch (error) {
    return serverErrorFromCatch(
      "POST /api/seed",
      "seed",
      error,
      "Failed to run seed",
    );
  }
}
