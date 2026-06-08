import { NextRequest, NextResponse } from "next/server";

import { logApiError, serverErrorFromCatch } from "@/lib/api-logger";
import { requireAuth } from "@/lib/api-auth";
import { badRequest, methodNotAllowed, ok } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/parse-json-body";
import { ensureDb } from "@/lib/db";
import { getAgentRoot } from "@/lib/agent-root-repository";
import { listProfiles } from "@/lib/profiles-repository";
import { applyProfileOrRootPatch, assertPatchSucceeded, toPatchResponse } from "@/lib/apply-profile-or-root-patch";
import { requireSafeProfileName } from "@/lib/path-security";

/** Shared upsert logic used by both POST (create) and PUT (update). */
async function upsertPersonality(request: NextRequest) {
  ensureDb();
  const bodyResult = await parseJsonBody(request);
  if (bodyResult instanceof NextResponse) return bodyResult;
  const body = bodyResult;
  const profile = typeof body.profile === "string" ? body.profile : "default";
  const prompt = typeof body.prompt === "string" ? body.prompt : "";
  if (!prompt.trim()) {
    return badRequest("prompt is required");
  }

  const resolved = requireSafeProfileName(profile);
  if (resolved instanceof NextResponse) return resolved;

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
  assertPatchSucceeded(result);

  return ok({ success: true, name: result.profile, prompt, source: "SOUL.md" });
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

    return ok({ personalities: profiles, total: profiles.length });
  }
  catch (error) {
    return serverErrorFromCatch(
      "GET /api/personalities",
      "reading SOUL identities",
      error,
      "Failed to read personalities",
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  try {
    return await upsertPersonality(request);
  }
  catch (error) {
    return serverErrorFromCatch(
      "POST /api/personalities",
      "creating SOUL identity",
      error,
      "Failed to save personality",
    );
  }
}

// DELETE is not supported — personalities are profile SOUL.md identities
// and cannot be individually deleted from Control Hub. Delete the profile instead.
export async function DELETE() {
  return methodNotAllowed(
    "Individual personalities cannot be deleted — delete the profile instead"
  );
}

export async function PUT(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  try {
    return await upsertPersonality(request);
  }
  catch (error) {
    return serverErrorFromCatch(
      "PUT /api/personalities",
      "updating SOUL identity",
      error,
      "Failed to save personality",
    );
  }
}
