import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/api-auth";
import { logApiError } from "@/lib/api-logger";
import { parseJsonBody } from "@/lib/parse-json-body";
import { ensureDb } from "@/lib/db";
import { applyProfileOrRootPatch, toPatchResponse } from "@/lib/apply-profile-or-root-patch";
import { hydratePlatformToolsetsForSlug } from "@/lib/profiles-repository";
import {
  normalizePlatformToolsetsFromInput,
  serializeJsonToolsets,
} from "@/lib/profile-config-builder";
import {
  platformsDiffer,
  unionToolsetsFromPlatforms,
} from "@/lib/hermes-toolset-unify";
import { resolveSafeProfileName } from "@/lib/path-security";
import { badRequest, notFound, serverError } from "@/lib/api-response";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireAuth(request);
  if (auth) return auth;

  const { id } = await params;
  const prof = resolveSafeProfileName(id);
  if (!prof.ok) return badRequest(prof.error);

  try {
    ensureDb();
    const hydrated = hydratePlatformToolsetsForSlug(prof.profile, { persist: true });
    if (!hydrated) {
      return notFound("Profile not found");
    }
    const divergence = platformsDiffer(hydrated.toolsets);
    return NextResponse.json({
      data: {
        profile: prof.profile,
        platformToolsets: hydrated.toolsets,
        source: hydrated.source,
        unifiedEnabled: unionToolsetsFromPlatforms(hydrated.toolsets),
        platformsDiverged: divergence.diverged,
        divergedPlatforms: divergence.platforms,
      },
    });
  }
  catch (error) {
    logApiError("GET /api/agent/profiles/[id]/toolsets", "reading toolsets", error);
    return serverError("Failed to read toolsets");
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireAuth(request);
  if (auth) return auth;

  const { id } = await params;
  const prof = resolveSafeProfileName(id);
  if (!prof.ok) return badRequest(prof.error);

  try {
    ensureDb();
    const bodyResult = await parseJsonBody(request);
    if (bodyResult instanceof NextResponse) return bodyResult;
    const platformToolsets = normalizePlatformToolsetsFromInput(bodyResult.platformToolsets);
    const platformToolsetsJson = serializeJsonToolsets(platformToolsets);

    // applyProfileOrRootPatch handles default-vs-non-default dispatch,
    // 404 on missing profile, and 500 on push failure — was previously
    // a 16-line if/else here.
    const result = applyProfileOrRootPatch(
      prof.profile,
      { platformToolsetsJson },
      { platformToolsetsJson },
    );
    const err = toPatchResponse(result, "Failed to sync profile to Hermes");
    if (err) return err;
    if (!result.ok) throw new Error("unreachable: toPatchResponse returned null on failure");

    return NextResponse.json({ data: { success: true, profile: result.profile, platformToolsets } });
  }
  catch (error) {
    logApiError("PUT /api/agent/profiles/[id]/toolsets", "saving toolsets", error);
    return serverError("Failed to save toolsets");
  }
}

export async function DELETE() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
