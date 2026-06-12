import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/api-auth";
import { serverErrorFromCatch } from "@/lib/api-logger";
import { methodNotAllowed, notFound, ok } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/parse-json-body";
import { ensureDb } from "@/lib/db";
import { applyProfileOrRootPatchOrFail } from "@/lib/apply-profile-or-root-patch";
import { hydratePlatformToolsetsForSlug } from "@/lib/profiles-repository";
import {
  normalizePlatformToolsetsFromInput,
  serializeJsonToolsets,
} from "@/lib/profile-config-builder";
import {
  platformsDiffer,
  unionToolsetsFromPlatforms,
} from "@/lib/hermes-toolset-unify";
import { requireSafeProfileName } from "@/lib/path-security";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireAuth(request);
  if (auth) return auth;

  const { id } = await params;
  const prof = requireSafeProfileName(id);
  if (prof instanceof NextResponse) return prof;

  try {
    ensureDb();
    const hydrated = hydratePlatformToolsetsForSlug(prof.profile, { persist: true });
    if (!hydrated) {
      return notFound("Profile not found");
    }
    const divergence = platformsDiffer(hydrated.toolsets);
    return ok({
      profile: prof.profile,
      platformToolsets: hydrated.toolsets,
      source: hydrated.source,
      unifiedEnabled: unionToolsetsFromPlatforms(hydrated.toolsets),
      platformsDiverged: divergence.diverged,
      divergedPlatforms: divergence.platforms,
    });
  }
  catch (error) {
    return serverErrorFromCatch(
      "GET /api/agent/profiles/[id]/toolsets",
      "reading toolsets",
      error,
      "Failed to read toolsets",
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireAuth(request);
  if (auth) return auth;

  const { id } = await params;
  const prof = requireSafeProfileName(id);
  if (prof instanceof NextResponse) return prof;

  try {
    ensureDb();
    const bodyResult = await parseJsonBody(request);
    if (bodyResult instanceof NextResponse) return bodyResult;
    const platformToolsets = normalizePlatformToolsetsFromInput(bodyResult.platformToolsets);
    const platformToolsetsJson = serializeJsonToolsets(platformToolsets);

    // applyProfileOrRootPatchOrFail collapses the 4-line
    // apply+toPatchResponse+assert+return-err dance into 1 call +
    // 1 instanceof check. Byte-equivalent to the pre-migration shape
    // (same 404 on not-found, same 500 on push-failed, same
    // { success: true, profile, platformToolsets } success body).
    const result = applyProfileOrRootPatchOrFail(
      prof.profile,
      { platformToolsetsJson },
      { platformToolsetsJson },
      "Failed to sync profile to Hermes",
    );
    if (result instanceof NextResponse) return result;

    return ok({ success: true, profile: result.profile, platformToolsets });
  }
  catch (error) {
    return serverErrorFromCatch(
      "PUT /api/agent/profiles/[id]/toolsets",
      "saving toolsets",
      error,
      "Failed to save toolsets",
    );
  }
}

export async function DELETE() {
  return methodNotAllowed("Method not allowed");
}
