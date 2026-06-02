import { NextRequest, NextResponse } from "next/server";

import { logApiError } from "@/lib/api-logger";
import { requireAuth } from "@/lib/api-auth";
import { parseJsonBody } from "@/lib/parse-json-body";
import { ensureDb } from "@/lib/db";
import { getAgentRoot } from "@/lib/agent-root-repository";
import { listProfiles } from "@/lib/profiles-repository";
import { applyProfileOrRootPatch, toPatchResponse } from "@/lib/apply-profile-or-root-patch";
import { resolveSafeProfileName } from "@/lib/path-security";

/** Shared upsert logic used by both POST (create) and PUT (update). */
async function upsertPersonality(request: NextRequest) {
  ensureDb();
  const bodyResult = await parseJsonBody(request);
  if (bodyResult instanceof NextResponse) return bodyResult;
  const body = bodyResult;
  const profile = typeof body.profile === "string" ? body.profile : "default";
  const prompt = typeof body.prompt === "string" ? body.prompt : "";
  if (!prompt.trim()) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  const resolved = resolveSafeProfileName(profile);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: 400 });
  }

  // applyProfileOrRootPatch handles default-vs-non-default dispatch,
  // 404 on missing profile, and 500 on push failure — was previously
  // a 16-line if/else here.
  const result = applyProfileOrRootPatch(
    resolved.profile,
    { soulMd: prompt },
    { soulMd: prompt },
  );
  const err = toPatchResponse(result, "Failed to sync personality to Hermes");
  if (err) {
    if (!result.ok && result.reason === "push-failed") {
      logApiError(
        resolved.profile === "default" ? "pushRootToHermes" : "pushProfileToHermes",
        `personality push for ${resolved.profile}`,
        new Error(result.error),
      );
    }
    return err;
  }
  if (!result.ok) throw new Error("unreachable: toPatchResponse returned null on failure");

  return NextResponse.json({
    data: { success: true, name: result.profile, prompt, source: "SOUL.md" },
  });
}

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  try {
    ensureDb();
    const root = getAgentRoot();
    const profiles = [
      {
        name: "default",
        prompt: root.soulMd,
        source: "SOUL.md",
        displayName: root.displayName,
      },
      ...listProfiles().map((profile) => ({
        name: profile.slug,
        prompt: profile.soulMd,
        source: "SOUL.md",
        displayName: profile.displayName,
      })),
    ];

    return NextResponse.json({
      data: { personalities: profiles, total: profiles.length },
    });
  }
  catch (error) {
    logApiError("GET /api/personalities", "reading SOUL identities", error);
    return NextResponse.json({ error: "Failed to read personalities" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  try {
    return await upsertPersonality(request);
  }
  catch (error) {
    logApiError("POST /api/personalities", "creating SOUL identity", error);
    return NextResponse.json({ error: "Failed to save personality" }, { status: 500 });
  }
}

// DELETE is not supported — personalities are profile SOUL.md identities
// and cannot be individually deleted from Control Hub. Delete the profile instead.
export async function DELETE() {
  return NextResponse.json(
    { error: "Individual personalities cannot be deleted — delete the profile instead" },
    { status: 405 }
  );
}

export async function PUT(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  try {
    return await upsertPersonality(request);
  }
  catch (error) {
    logApiError("PUT /api/personalities", "updating SOUL identity", error);
    return NextResponse.json({ error: "Failed to save personality" }, { status: 500 });
  }
}
