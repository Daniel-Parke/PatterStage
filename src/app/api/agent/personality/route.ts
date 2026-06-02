import { NextRequest, NextResponse } from "next/server";

import { logApiError } from "@/lib/api-logger";
import { requireAuth } from "@/lib/api-auth";
import { parseJsonBody } from "@/lib/parse-json-body";
import { ensureDb } from "@/lib/db";
import { updateAgentRoot } from "@/lib/agent-root-repository";
import { getProfile, updateProfileContent } from "@/lib/profiles-repository";
import { pushProfileToHermes, pushRootToHermes } from "@/lib/hermes-profile-sync";
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

    if (prof.profile === "default") {
      updateAgentRoot({ personality });
      const push = pushRootToHermes();
      if (!push.success) {
        return NextResponse.json({ error: push.error ?? "Push failed" }, { status: 500 });
      }
    }
    else {
      const row = getProfile(prof.profile);
      if (!row) {
        return NextResponse.json({ error: "Profile not found" }, { status: 404 });
      }
      updateProfileContent(prof.profile, { personality });
      const push = pushProfileToHermes(prof.profile);
      if (!push.success) {
        return NextResponse.json({ error: push.error ?? "Push failed" }, { status: 500 });
      }
    }

    return NextResponse.json({
      data: { success: true, profile: prof.profile, personality },
    });
  }
  catch (error) {
    logApiError("PUT /api/agent/personality", "updating personality", error);
    return NextResponse.json({ error: "Failed to update personality" }, { status: 500 });
  }
}
