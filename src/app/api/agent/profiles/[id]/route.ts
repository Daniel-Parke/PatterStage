import { NextRequest, NextResponse } from "next/server";
import { renameSync, existsSync } from "fs";

import { logApiError } from "@/lib/api-logger";
import { parseJsonBody } from "@/lib/parse-json-body";
import { resolveSafeProfileName } from "@/lib/path-security";
import { requireAuth } from "@/lib/api-auth";
import { appendAuditLine } from "@/lib/audit-log";
import { ensureDb } from "@/lib/db";
import {
  getProfile,
  renameProfileSlug,
  deleteProfile,
  updateProfileContent,
} from "@/lib/profiles-repository";
import { pushProfileToHermes, removeProfileFromDisk } from "@/lib/hermes-profile-sync";
import { resolveProfileHermesHome } from "@/lib/hermes-profile-paths";
import { slugifyDisplayName } from "@/lib/profile-slug";
import type { ApiResponse } from "@/types/hermes";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireAuth(request);
  if (auth) return auth;

  const { id } = await params;
  const prof = resolveSafeProfileName(id);
  if (!prof.ok) {
    return NextResponse.json({ error: prof.error }, { status: 400 });
  }

  if (prof.profile === "default") {
    return NextResponse.json(
      { error: "Cannot modify the default profile slug" },
      { status: 400 },
    );
  }

  const existing = getProfile(prof.profile);
  if (!existing) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  try {
    ensureDb();
    const bodyResult = await parseJsonBody(request);
    if (bodyResult instanceof NextResponse) return bodyResult;
    const { name, description } = bodyResult as { name?: string; description?: string };

    let slug = prof.profile;
    if (name && typeof name === "string" && name.trim().length >= 2) {
      const newSlug = slugifyDisplayName(name);

      if (newSlug && newSlug !== prof.profile) {
        const newProf = resolveSafeProfileName(newSlug);
        if (!newProf.ok) {
          return NextResponse.json({ error: newProf.error }, { status: 400 });
        }
        if (getProfile(newSlug)) {
          return NextResponse.json(
            { error: `Profile "${newSlug}" already exists` },
            { status: 409 },
          );
        }

        const oldDir = resolveProfileHermesHome(prof.profile);
        const newDir = resolveProfileHermesHome(newSlug);
        if (existsSync(oldDir) && !existsSync(newDir)) {
          renameSync(oldDir, newDir);
        }

        const renamed = renameProfileSlug(prof.profile, newSlug);
        if (!renamed) {
          return NextResponse.json({ error: "Failed to rename profile" }, { status: 500 });
        }
        slug = newSlug;
      } else if (newSlug === prof.profile) {
        updateProfileContent(slug, {
          displayName: name.trim(),
          description: typeof description === "string" ? description : undefined,
        });
      }
    } else if (typeof description === "string") {
      updateProfileContent(slug, { description });
    }

    const push = pushProfileToHermes(slug);
    if (!push.success) {
      return NextResponse.json(
        { error: push.error ?? "Failed to sync profile to Hermes" },
        { status: 500 },
      );
    }

    appendAuditLine({
      action: "agent.profile.update",
      resource: slug,
      ok: true,
    });

    return NextResponse.json<ApiResponse<{ success: true; slug: string }>>({
      data: { success: true, slug },
    });
  } catch (error) {
    logApiError("PUT /api/agent/profiles/[id]", "updating profile", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireAuth(request);
  if (auth) return auth;

  const { id } = await params;
  const prof = resolveSafeProfileName(id);
  if (!prof.ok) {
    return NextResponse.json({ error: prof.error }, { status: 400 });
  }

  if (prof.profile === "default") {
    return NextResponse.json(
      { error: "Cannot delete the default profile" },
      { status: 400 },
    );
  }

  try {
    ensureDb();
    if (!deleteProfile(prof.profile)) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }
    removeProfileFromDisk(prof.profile);

    appendAuditLine({
      action: "agent.profile.delete",
      resource: prof.profile,
      ok: true,
    });

    return NextResponse.json<ApiResponse<{ success: true }>>({
      data: { success: true },
    });
  } catch (error) {
    logApiError("DELETE /api/agent/profiles/[id]", "deleting profile", error);
    return NextResponse.json({ error: "Failed to delete profile" }, { status: 500 });
  }
}
