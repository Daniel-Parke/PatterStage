import { NextRequest, NextResponse } from "next/server";

import { logApiError } from "@/lib/api-logger";
import { requireAuth } from "@/lib/api-auth";
import { ensureDb } from "@/lib/db";
import { getAgentRoot, updateAgentRoot } from "@/lib/agent-root-repository";
import { listProfiles, updateProfileContent } from "@/lib/profiles-repository";
import { pushProfileToHermes, pushRootToHermes } from "@/lib/hermes-profile-sync";
import { resolveSafeProfileName } from "@/lib/path-security";

/** Shared upsert logic used by both POST (create) and PUT (update). */
async function upsertPersonality(request: NextRequest) {
  ensureDb();
  const body = (await request.json()) as Record<string, unknown>;
  const profile = typeof body.profile === "string" ? body.profile : "default";
  const prompt = typeof body.prompt === "string" ? body.prompt : "";
  if (!prompt.trim()) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  const resolved = resolveSafeProfileName(profile);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: 400 });
  }

  try {
    if (resolved.profile === "default") {
      updateAgentRoot({ soulMd: prompt });
      const push = pushRootToHermes();
      if (!push.success) {
        return NextResponse.json({ error: push.error ?? "Push failed" }, { status: 500 });
      }
    }
    else {
      const updated = updateProfileContent(resolved.profile, { soulMd: prompt });
      if (!updated) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
      const push = pushProfileToHermes(resolved.profile);
      if (!push.success) {
        return NextResponse.json({ error: push.error ?? "Push failed" }, { status: 500 });
      }
    }
  } catch (pushErr) {
    logApiError(
      resolved.profile === "default" ? "pushRootToHermes" : "pushProfileToHermes",
      `personality push for ${resolved.profile}`,
      pushErr,
    );
    return NextResponse.json({ error: "Failed to sync personality to Hermes" }, { status: 500 });
  }

  return NextResponse.json({
    data: { success: true, name: resolved.profile, prompt, source: "SOUL.md" },
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
