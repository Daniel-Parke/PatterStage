import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/api-auth";
import { serverErrorFromCatch } from "@/lib/api-logger";
import { badRequest, methodNotAllowed, notFound, ok } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/parse-json-body";
import { ensureDb } from "@/lib/db";
import { applyProfileOrRootPatch, assertPatchSucceeded, toPatchResponse } from "@/lib/apply-profile-or-root-patch";
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
    assertPatchSucceeded(result);

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
