import { NextRequest, NextResponse } from "next/server";

import { serverErrorFromCatch } from "@/lib/api-logger";
import { badRequest } from "@/lib/api-response";
import { requireAuth } from "@/lib/api-auth";
import { parseJsonBody } from "@/lib/parse-json-body";
import { ensureDb } from "@/lib/db";
import { applyProfileOrRootPatch, assertPatchSucceeded, toPatchResponse } from "@/lib/apply-profile-or-root-patch";
import { resolveSafeProfileName } from "@/lib/path-security";

export async function PUT(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  try {
    ensureDb();
    const bodyResult = await parseJsonBody(request);
    if (bodyResult instanceof NextResponse) return bodyResult;
    const personality = typeof bodyResult.personality === "string" ? bodyResult.personality : "";
    const profile = typeof bodyResult.profile === "string" ? bodyResult.profile : "default";

    if (!personality) {
      return badRequest("Personality is required");
    }

    const prof = resolveSafeProfileName(profile);
    if (!prof.ok) {
      return badRequest(prof.error);
    }

    // applyProfileOrRootPatch handles default-vs-non-default dispatch,
    // 404 on missing profile, and 500 on push failure — was previously
    // a 16-line if/else in this handler.
    const result = applyProfileOrRootPatch(
      prof.profile,
      { personality },
      { personality },
    );
    const err = toPatchResponse(result, "Failed to sync personality to Hermes");
    if (err) return err;
    assertPatchSucceeded(result);

    return NextResponse.json({
      data: { success: true, profile: result.profile, personality },
    });
  }
  catch (error) {
    return serverErrorFromCatch(
      "PUT /api/agent/personality",
      "updating personality",
      error,
      "Failed to update personality",
    );
  }
}
