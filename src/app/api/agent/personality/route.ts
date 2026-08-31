import { NextRequest, NextResponse } from "next/server";

import { serverErrorFromCatch } from "@/lib/api-logger";

import { badRequest, ok, methodNotAllowed } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/parse-json-body";
import { ensureDb } from "@/lib/db";
import { applyProfileOrRootPatchOrFail } from "@/modules/hermes/handlers/profile-patch";
import { requireSafeProfileName } from "@/lib/fs/path-security";
import { recordEvent } from "@/lib/analytics/record-event";

export async function PUT(request: NextRequest) {
  try {
    ensureDb();
    const bodyResult = await parseJsonBody(request);
    if (bodyResult instanceof NextResponse) return bodyResult;
    const personality = typeof bodyResult.personality === "string" ? bodyResult.personality : "";
    const profile = typeof bodyResult.profile === "string" ? bodyResult.profile : "default";

    if (!personality) {
      return badRequest("Personality is required");
    }

    const prof = requireSafeProfileName(profile);
    if (prof instanceof NextResponse) return prof;

    // applyProfileOrRootPatchOrFail collapses the 4-line
    // apply+toPatchResponse+assert+return-err dance into 1 call +
    // 1 instanceof check. Byte-equivalent to the pre-migration shape
    // (same 404 on not-found, same 500 on push-failed, same
    // { success: true, profile, personality } success body).
    const result = applyProfileOrRootPatchOrFail(
      prof.profile,
      { personality },
      { personality },
      "Failed to sync personality to Hermes",
    );
    if (result instanceof NextResponse) return result;

    recordEvent("personality.changed", {
      entityType: "personality",
      entityId: result.profile,
      profile: result.profile,
    });
    return ok({ success: true, profile: result.profile, personality });
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

// GET is not supported. The personality is part of the profile, so it is read
// through /api/agent/profiles — this route only WRITES it. A bare 404 here
// read as "there is no personality" (T-0083).
export async function GET() {
  return methodNotAllowed(
    "GET is not supported here — read the personality from /api/agent/profiles",
  );
}
