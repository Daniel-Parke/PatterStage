import { NextRequest, NextResponse } from "next/server";

import { logApiError } from "@/lib/api-logger";
import { requireAuth } from "@/lib/api-auth";
import { parseJsonBody } from "@/lib/parse-json-body";
import { ensureDb } from "@/lib/db";
import { applyProfileOrRootPatch } from "@/lib/apply-profile-or-root-patch";
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
      return NextResponse.json({ error: "Personality is required" }, { status: 400 });
    }

    const prof = resolveSafeProfileName(profile);
    if (!prof.ok) {
      return NextResponse.json({ error: prof.error }, { status: 400 });
    }

    // applyProfileOrRootPatch handles default-vs-non-default dispatch,
    // 404 on missing profile, and 500 on push failure — was previously
    // a 16-line if/else in this handler.
    const result = applyProfileOrRootPatch(
      prof.profile,
      { personality },
      { personality },
    );

    if (!result.ok) {
      if (result.reason === "not-found") {
        return NextResponse.json({ error: "Profile not found" }, { status: 404 });
      }
      return NextResponse.json(
        { error: result.error },
        { status: 500 },
      );
    }

    return NextResponse.json({
      data: { success: true, profile: result.profile, personality },
    });
  }
  catch (error) {
    logApiError("PUT /api/agent/personality", "updating personality", error);
    return NextResponse.json({ error: "Failed to update personality" }, { status: 500 });
  }
}
