import { NextRequest, NextResponse } from "next/server";

import { serverErrorFromCatch } from "@/lib/api-logger";
import { requireAuth } from "@/lib/api-auth";
import { badRequest, methodNotAllowed, notFound, ok } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/parse-json-body";
import { ensureDb } from "@/lib/db";
import { getAgentRoot } from "@/lib/agent-root-repository";
import { listProfiles } from "@/modules/hermes/lib/profiles-repository";
import { applyProfileOrRootPatchOrFail } from "@/modules/hermes/handlers/profile-patch";
import { requireSafeProfileName } from "@/lib/fs/path-security";

/** Shared upsert logic used by both POST (create) and PUT (update). */
async function upsertPersonality(request: NextRequest) {
  ensureDb();
  const bodyResult = await parseJsonBody(request);
  if (bodyResult instanceof NextResponse) return bodyResult;
  const body = bodyResult;
  // Require an EXPLICIT profile. Never silently fall back to "default" — that
  // would overwrite Bob's SOUL.md whenever the field is missing or a typo, a
  // data-loss footgun. A "personality" IS a profile's SOUL identity, so the
  // target profile must already exist (created on the Agents page).
  if (typeof body.profile !== "string" || !body.profile.trim()) {
    return badRequest("profile is required — the agent profile whose SOUL identity to set");
  }
  const profile = body.profile.trim();
  const prompt = typeof body.prompt === "string" ? body.prompt : "";
  if (!prompt.trim()) {
    return badRequest("prompt is required");
  }

  const resolved = requireSafeProfileName(profile);
  if (resolved instanceof NextResponse) return resolved;

  // The profile must already exist (the "default" root, or a created profile).
  // We do NOT create profiles here.
  if (resolved.profile !== "default" && !listProfiles().some((p) => p.slug === resolved.profile)) {
    return notFound(`Unknown profile '${resolved.profile}' — create it on the Agents page first`);
  }

  // applyProfileOrRootPatchOrFail collapses the 4-line
  // apply+toPatchResponse+assert+return-err dance into 1 call +
  // 1 instanceof check. Byte-equivalent to the pre-migration shape
  // (same 404 on not-found, same 500 on push-failed, same
  // { success: true, name, prompt, source } success body).
  const result = applyProfileOrRootPatchOrFail(
    resolved.profile,
    { soulMd: prompt },
    { soulMd: prompt },
    "Failed to sync personality to Hermes",
  );
  if (result instanceof NextResponse) return result;

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
// and cannot be individually deleted from PatterStage. Delete the profile instead.
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
