import { NextRequest, NextResponse } from "next/server";
import { renameSync, existsSync } from "fs";

import { serverErrorFromCatch } from "@/lib/api-logger";
import { parseJsonBody } from "@/lib/parse-json-body";
import { resolveSafeProfileName, requireSafeProfileName } from "@/lib/fs/path-security";

import { appendAuditLine } from "@/lib/audit-log";
import { ensureDb } from "@/lib/db";
import {
  getProfile,
  renameProfileSlug,
  deleteProfile,
  updateProfileContent,
} from "@/modules/hermes/lib/profiles-repository";
import { pushProfileToHermes } from "@/modules/hermes/lib/profile-push";
import { removeProfileFromDisk } from "@/modules/hermes/lib/profile-discovery";
import { resolveProfileHermesHome } from "@/modules/hermes/lib/profile-paths";
import { slugifyDisplayName, validateProfileDisplayName, DEFAULT_PROFILE_SLUG } from "@/lib/profile-slug";
import { badRequest, conflict, notFound, ok, serverError, methodNotAllowed } from "@/lib/api-response";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const prof = requireSafeProfileName(id);
  if (prof instanceof NextResponse) return prof;

  if (prof.profile === "default") {
    return badRequest("Cannot modify the default profile slug");
  }

  const existing = getProfile(prof.profile);
  if (!existing) {
    return notFound("Profile not found");
  }

  try {
    ensureDb();
    const bodyResult = await parseJsonBody(request);
    if (bodyResult instanceof NextResponse) return bodyResult;
    const { name, description } = bodyResult as { name?: string; description?: string };

    let slug = prof.profile;
    if (name && typeof name === "string") {
      // Same laundering as the create path, and the same fix: judge the name.
      const nameCheck = validateProfileDisplayName(name);
      if (!nameCheck.ok) return badRequest(nameCheck.error);

      const newSlug = slugifyDisplayName(name);

      // The guard above rejects renaming the default profile; this rejects
      // renaming any profile INTO it. Without both, a rename reaches the root
      // agent's directory by the same route a create did.
      if (newSlug === DEFAULT_PROFILE_SLUG) {
        return conflict(
          `"${name.trim()}" resolves to the slug "default", which is the root agent rather than ` +
            `a profile. Choose a different name.`,
        );
      }

      if (newSlug && newSlug !== prof.profile) {
        const newProf = resolveSafeProfileName(newSlug);
        if (!newProf.ok) {
          return badRequest(newProf.error);
        }
        if (getProfile(newSlug)) {
          return conflict(`Profile "${newSlug}" already exists`);
        }

        const oldDir = resolveProfileHermesHome(prof.profile);
        const newDir = resolveProfileHermesHome(newSlug);
        if (existsSync(oldDir) && !existsSync(newDir)) {
          renameSync(oldDir, newDir);
        }

        const renamed = renameProfileSlug(prof.profile, newSlug);
        if (!renamed) {
          return serverError("Failed to rename profile");
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
      return serverError(push.error ?? "Failed to sync profile to Hermes");
    }

    appendAuditLine({
      action: "agent.profile.update",
      resource: slug,
      ok: true,
    });

    return ok({ success: true, slug });
  } catch (error) {
    return serverErrorFromCatch(
      "PUT /api/agent/profiles/[id]",
      "updating profile",
      error,
      "Failed to update profile",
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const prof = requireSafeProfileName(id);
  if (prof instanceof NextResponse) return prof;

  if (prof.profile === "default") {
    return badRequest("Cannot delete the default profile");
  }

  try {
    ensureDb();
    if (!deleteProfile(prof.profile)) {
      return notFound("Profile not found");
    }
    removeProfileFromDisk(prof.profile);

    appendAuditLine({
      action: "agent.profile.delete",
      resource: prof.profile,
      ok: true,
    });

    return ok({ success: true });
  } catch (error) {
    return serverErrorFromCatch(
      "DELETE /api/agent/profiles/[id]",
      "deleting profile",
      error,
      "Failed to delete profile",
    );
  }
}

// GET is not supported on a single profile: the list route returns every
// profile in full, so there is nothing this could add.
export async function GET() {
  return methodNotAllowed(
    "GET is not supported here — /api/agent/profiles returns every profile in full", ["PUT", "DELETE"]);
}
