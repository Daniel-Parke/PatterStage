import { NextRequest, NextResponse } from "next/server";

import { methodNotAllowed, notFound, ok } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/parse-json-body";
import { ensureDb } from "@/lib/db";
import { applyProfileOrRootPatchOrFail } from "@/modules/hermes/handlers/profile-patch";
import { hydratePlatformToolsetsForSlug } from "@/modules/hermes/lib/profiles-repository";
import {
  normalizePlatformToolsetsFromInput,
  serializeJsonToolsets,
} from "@/modules/hermes/lib/profile-config-builder";
import {
  platformsDiffer,
  unionToolsetsFromPlatforms,
} from "@/modules/hermes/lib/toolset-unify";
import { requireSafeProfileName } from "@/lib/fs/path-security";
import { isReadOnly } from "@/lib/read-only";
import { recordEvent } from "@/lib/analytics/record-event";
import { route } from "@/lib/api-route";

export const GET = route("GET /api/agent/profiles/[id]/toolsets", "reading toolsets", "Failed to read toolsets", async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const prof = requireSafeProfileName(id);
  if (prof instanceof NextResponse) return prof;
  ensureDb();
  // check-read-only-guards-disable-next-line -- hydrating may persist the normalised JSON, a write this GET skips under PS_READ_ONLY while still answering (T-0095, D124)
  const hydrated = hydratePlatformToolsetsForSlug(prof.profile, { persist: !isReadOnly() });
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
});

export const PUT = route("PUT /api/agent/profiles/[id]/toolsets", "saving toolsets", "Failed to save toolsets", async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const prof = requireSafeProfileName(id);
  if (prof instanceof NextResponse) return prof;
  ensureDb();
  const bodyResult = await parseJsonBody(request);
  if (bodyResult instanceof NextResponse) return bodyResult;
  const platformToolsets = normalizePlatformToolsetsFromInput(bodyResult.platformToolsets);
  const platformToolsetsJson = serializeJsonToolsets(platformToolsets);

  const result = applyProfileOrRootPatchOrFail(
    prof.profile,
    { platformToolsetsJson },
    { platformToolsetsJson },
    "Failed to sync profile to Hermes",
  );
  if (result instanceof NextResponse) return result;

  recordEvent("toolset.saved", { entityType: "toolset", entityId: prof.profile, profile: prof.profile });
  return ok({ success: true, profile: result.profile, platformToolsets });
});

export async function DELETE() {
  return methodNotAllowed("Method not allowed", ["GET", "PUT"]);
}
