import { NextRequest, NextResponse } from "next/server";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";

import { resolveProfileHermesHome, buildProfileHermesPathBundle } from "@/lib/hermes-profile-paths";
import { getBehaviorFiles } from "@/lib/behavior-files";
import { logApiError, serverErrorFromCatch } from "@/lib/api-logger";
import { parseJsonBody } from "@/lib/parse-json-body";
import { safeStat } from "@/lib/fs-stats";
import { ensureDir, backupTimestamp } from "@/lib/fs-helpers";
import { resolveSafeProfileName } from "@/lib/path-security";
import { requireAuth } from "@/lib/api-auth";
import { appendAuditLine } from "@/lib/audit-log";
import { ensureDb } from "@/lib/db";
import { getProfile } from "@/lib/profiles-repository";
import {
  isManagedKey,
  readManagedFileContent,
  writeManagedFileContent,
  type ManagedFileKey,
} from "@/lib/agent-file-store";
import {
  applyProfileOrRootPatchOrFail,
  pushProfileOrRootOrFail,
} from "@/lib/apply-profile-or-root-patch";
import { badRequest, notFound, ok } from "@/lib/api-response";
import {
  configYamlToColumnValues,
  platformToolsetsFromJson,
  serializeJsonToolsets,
} from "@/lib/profile-config-builder";
import { normalizePlatformToolsets } from "@/lib/hermes-toolset-normalize";

type FileResponseVariant = {
  content: string;
  size: number;
  exists: boolean;
  lastModified: string | undefined;
};

/**
 * Build the GET response payload for a file-read branch. The 3 branches
 * (managed-file hit, missing file, real-file read) all share the same
 * `key`/`name`/`description` envelope and only differ in `content`,
 * `size`, `lastModified`, and `exists`. This helper centralizes the
 * common envelope so the per-branch code can focus on the variant.
 * `lastModified: undefined` is omitted from the payload (matching the
 * original shape where the "missing file" branch had no `lastModified`
 * field at all).
 */
function buildFileResponse(
  resolved: { path: string; name: string; description: string },
  key: string,
  variant: FileResponseVariant,
) {
  const data: {
    key: string;
    content: string;
    name: string;
    description: string;
    exists: boolean;
    size: number;
    lastModified?: string;
  } = {
    key,
    content: variant.content,
    name: resolved.name,
    description: resolved.description,
    exists: variant.exists,
    size: variant.size,
  };
  if (variant.lastModified !== undefined) {
    data.lastModified = variant.lastModified;
  }
  return { data };
}

/** Build a path lookup map from a Hermes path bundle. */
function getBundlePathMap(bundle: ReturnType<typeof buildProfileHermesPathBundle>): Record<string, string> {
  return {
    soul: bundle.soul,
    agent: bundle.agents,
    user: bundle.userMemory,
    memory: bundle.agentMemory,
    config: bundle.config,
    hermes: bundle.hermes,
    env: bundle.env,
    auth: bundle.auth,
  };
}

function resolveFilePath(
  key: string,
  profileParam: string | null,
):
  | { path: string; name: string; description: string }
  | { error: string }
  | null {
  const fileConfig = getBehaviorFiles()[key];
  if (!fileConfig) return null;

  const prof = resolveSafeProfileName(profileParam);
  if (!prof.ok) {
    return { error: prof.error };
  }
  const profile = prof.profile;

  const bundle = buildProfileHermesPathBundle(profile === "default" ? "default" : profile);
  const pathMap = getBundlePathMap(bundle);
  const resolvedPath = pathMap[key];
  if (!resolvedPath) return null;

  return { path: resolvedPath, name: fileConfig.name, description: fileConfig.description };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const auth = requireAuth(request);
  if (auth) return auth;

  const { key } = await params;
  const profile = request.nextUrl.searchParams.get("profile");
  const resolved = resolveFilePath(key, profile);

  if (!resolved) {
    return badRequest(`Unknown file key: ${key}`);
  }
  if ("error" in resolved) {
    return badRequest(resolved.error);
  }

  try {
    ensureDb();
    const prof = resolveSafeProfileName(profile);
    const profileSlug = prof.ok ? prof.profile : "default";

    if (isManagedKey(key)) {
      const stored = readManagedFileContent(profileSlug, key as ManagedFileKey);
      if (stored) {
        return ok(
          buildFileResponse(resolved, key, {
            content: stored.content,
            size: stored.content.length,
            exists: stored.content.length > 0,
            lastModified: stored.updatedAt,
          }),
        );
      }
    }

    if (!existsSync(resolved.path)) {
      return ok(
        buildFileResponse(resolved, key, {
          content: "",
          size: 0,
          exists: false,
          lastModified: undefined,
        }),
      );
    }

    const content = readFileSync(resolved.path, "utf-8");
    // File confirmed to exist above; safeStat never null.
    const stats = safeStat(resolved.path)!;
    return ok(
      buildFileResponse(resolved, key, {
        content,
        size: stats.size,
        exists: true,
        lastModified: stats.mtime,
      }),
    );
  }
  catch (error) {
    return serverErrorFromCatch(
      "GET /api/agent/files/[key]",
      `reading ${resolved.path}`,
      error,
      "Failed to read file",
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const auth = requireAuth(request);
  if (auth) return auth;

  const { key } = await params;
  const profile = request.nextUrl.searchParams.get("profile");
  const resolved = resolveFilePath(key, profile);

  if (!resolved) {
    return badRequest(`Unknown file key: ${key}`);
  }
  if ("error" in resolved) {
    return badRequest(resolved.error);
  }

  try {
    ensureDb();
    const bodyResult = await parseJsonBody(request);
    if (bodyResult instanceof NextResponse) return bodyResult;
    const { content, backup } = bodyResult;

    if (typeof content !== "string") {
      return badRequest("Content is required");
    }

    const prof = resolveSafeProfileName(profile);
    const profileSlug = prof.ok ? prof.profile : "default";

    if (profileSlug !== "default" && !getProfile(profileSlug) && isManagedKey(key)) {
      return notFound("Profile not found");
    }

    const dir = dirname(resolved.path);
    ensureDir(dir);

    if (backup && existsSync(resolved.path)) {
      const profileHome = resolveProfileHermesHome(profileSlug);
      const backupDir = profileHome + "/backups";
      ensureDir(backupDir);
      const backupName = `${key}-${backupTimestamp()}.md`;
      try {
        writeFileSync(backupDir + "/" + backupName, readFileSync(resolved.path, "utf-8"));
      }
      catch (err) {
        logApiError("PUT /api/agent/files/[key]", `backup ${resolved.path}`, err);
      }
    }

    if (isManagedKey(key)) {
      if (key === "config") {
        const cols = configYamlToColumnValues(content);
        const platformToolsetsJson = serializeJsonToolsets(
          normalizePlatformToolsets(platformToolsetsFromJson(cols.platformToolsetsJson)),
        );
        writeManagedFileContent(profileSlug, "config", cols.configYaml);
        // applyProfileOrRootPatchOrFail collapses the 4-line
        // apply+toPatchResponse+assert+return-err dance into 1 call
        // + 1 instanceof check. Replaces the if/else update block
        // AND the separate push block below (2 places, 16 lines
        // total).
        const configPatch = {
          personality: cols.personality,
          disabledSkillsJson: cols.disabledSkillsJson,
          platformToolsetsJson,
          configYaml: cols.configYaml,
        };
        const result = applyProfileOrRootPatchOrFail(
          profileSlug,
          configPatch,
          configPatch,
          "Failed to sync profile to Hermes",
        );
        if (result instanceof NextResponse) return result;
      }
      else {
        // Non-config managed file (SOUL.md, AGENTS.md, etc.) — write
        // the column-free file body to the managed-files table, then
        // push. pushProfileOrRootOrFail is the push-only companion
        // of applyProfileOrRootPatchOrFail — collapses the
        // push+toPatchResponse+assert+return-err dance into 1 call
        // + 1 instanceof check. writeManagedFileContent has already
        // updated the managed-files table; we just need the post-
        // write push to mirror to Hermes.
        writeManagedFileContent(profileSlug, key as ManagedFileKey, content);
        const result = pushProfileOrRootOrFail(
          profileSlug,
          "Failed to sync profile to Hermes",
        );
        if (result instanceof NextResponse) return result;
      }
    }
    else {
      writeFileSync(resolved.path, content, "utf-8");
    }

    appendAuditLine({
      action: "agent.file.put",
      resource: key,
      ok: true,
    });

    return ok({ success: true, key, path: resolved.path });
  }
  catch (error) {
    return serverErrorFromCatch(
      "PUT /api/agent/files/[key]",
      `writing ${resolved.path}`,
      error,
      "Failed to write file",
    );
  }
}
