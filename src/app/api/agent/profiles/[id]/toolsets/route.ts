import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/api-auth";
import { logApiError } from "@/lib/api-logger";
import { ensureDb } from "@/lib/db";
import { updateAgentRoot } from "@/lib/agent-root-repository";
import { getProfile, updateProfileContent, hydratePlatformToolsetsForSlug } from "@/lib/profiles-repository";
import { pushProfileToHermes, pushRootToHermes } from "@/lib/hermes-profile-sync";
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
  if (!prof.ok) return NextResponse.json({ error: prof.error }, { status: 400 });

  try {
    ensureDb();
    const hydrated = hydratePlatformToolsetsForSlug(prof.profile, { persist: true });
    if (!hydrated) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }
    const divergence = platformsDiffer(hydrated.toolsets);
    return NextResponse.json({
      data: {
        profile: prof.profile,
        platformToolsets: hydrated.toolsets,
        source: hydrated.source,
        unifiedEnabled: unionToolsetsFromPlatforms(hydrated.toolsets),
        platformsDiverged: divergence.diverged,
        divergedPlatforms: divergence.platforms,
      },
    });
  }
  catch (error) {
    logApiError("GET /api/agent/profiles/[id]/toolsets", "reading toolsets", error);
    return NextResponse.json({ error: "Failed to read toolsets" }, { status: 500 });
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
  if (!prof.ok) return NextResponse.json({ error: prof.error }, { status: 400 });

  try {
    ensureDb();
    const body = (await request.json()) as Record<string, unknown>;
    const platformToolsets = normalizePlatformToolsetsFromInput(body.platformToolsets);
    const platformToolsetsJson = serializeJsonToolsets(platformToolsets);

    if (prof.profile === "default") {
      updateAgentRoot({ platformToolsetsJson });
      const push = pushRootToHermes();
      if (!push.success) {
        return NextResponse.json({ error: push.error ?? "Push failed" }, { status: 500 });
      }
    }
    else {
      const row = getProfile(prof.profile);
      if (!row) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
      updateProfileContent(prof.profile, { platformToolsetsJson });
      const push = pushProfileToHermes(prof.profile);
      if (!push.success) {
        return NextResponse.json({ error: push.error ?? "Push failed" }, { status: 500 });
      }
    }

    return NextResponse.json({ data: { success: true, profile: prof.profile, platformToolsets } });
  }
  catch (error) {
    logApiError("PUT /api/agent/profiles/[id]/toolsets", "saving toolsets", error);
    return NextResponse.json({ error: "Failed to save toolsets" }, { status: 500 });
  }
}
