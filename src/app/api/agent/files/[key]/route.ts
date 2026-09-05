import { NextRequest, NextResponse } from "next/server";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";

import { resolveProfileHermesHome, buildProfileHermesPathBundle } from "@/modules/hermes/lib/profile-paths";
import { getBehaviorFiles } from "@/modules/hermes/lib/behavior-files";
import { logApiError, serverErrorFromCatch } from "@/lib/api-logger";
import { parseJsonBody } from "@/lib/parse-json-body";
import { safeStat } from "@/lib/fs/fs-stats";
import { ensureDir, backupTimestamp } from "@/lib/fs/fs-helpers";
import { resolveSafeProfileName } from "@/lib/fs/path-security";

import { appendAuditLine } from "@/lib/audit-log";
import { ensureDb } from "@/lib/db";
import { getProfile } from "@/modules/hermes/lib/profiles-repository";
import {
  isManagedKey,
  readManagedFileContent,
  writeManagedFileContent,
  type ManagedFileKey,
} from "@/modules/hermes/lib/agent-file-store";
import {
  applyProfileOrRootPatchOrFail,
  pushProfileOrRootOrFail,
} from "@/modules/hermes/handlers/profile-patch";
import { badRequest, notFound, ok } from "@/lib/api-response";
import { maskEnvFileContent } from "@/lib/secret-mask";
import { recordEvent } from "@/lib/analytics/record-event";
import {
  configYamlToColumnValues,
  platformToolsetsFromJson,
  serializeJsonToolsets,
} from "@/modules/hermes/lib/profile-config-builder";
import { normalizePlatformToolsets } from "@/modules/hermes/lib/toolset-normalize";

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
 *
 * Returns the INNER payload (not `{ data: payload }`): the callers wrap it
 * with `ok()`, which adds the single `{ data }` envelope. (A prior version
 * returned `{ data }` here AND was passed to `ok()`, double-wrapping into
 * `{ data: { data: {...} } }` — the config-section editor read `json.data.content`
 * and got undefined → blank HERMES.md/.env editors + a false drift warning.)
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
  return data;
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

/**
 * Resolve `profileParam` to a safe profile slug, falling back to `"default"`
 * when the input is invalid. Used by the GET + PUT try-blocks after
 * `resolveFilePath` has already validated the input (so the invalid branch
 * is unreachable in practice, but the defensive fallback preserves the
 * pre-refactor behaviour). Centralises the 2-line
 * `const prof = resolveSafeProfileName(profile); const profileSlug = prof.ok ? prof.profile : "default"`
 * pattern that was duplicated at GET line 136-137 and PUT line 214-215.
 */
function safeProfileSlug(profileParam: string | null): string {
  const prof = resolveSafeProfileName(profileParam);
  return prof.ok ? prof.profile : "default";
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
    const profileSlug = safeProfileSlug(profile);

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

    const raw = readFileSync(resolved.path, "utf-8");
    // Secrets are masked HERE, not in the React component that used to be the
    // only thing masking them. `size` stays the real on-disk size so the UI can
    // still tell an empty file from a populated one.
    const content = key === "env" ? maskEnvFileContent(raw) : raw;
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
  const { key } = await params;
  const profile = request.nextUrl.searchParams.get("profile");
  const resolved = resolveFilePath(key, profile);

  if (!resolved) {
    return badRequest(`Unknown file key: ${key}`);
  }
  if ("error" in resolved) {
    return badRequest(resolved.error);
  }
  if (key === "env") {
    // GET now returns MASKED values, so writing the response back would replace
    // real keys with "abcd…wxyz". The UI has always declared this editor
    // read-only ("Edit .env directly on the server for security"); this makes
    // the API agree with it. Credentials are managed via /api/credentials.
    return badRequest(
      ".env is read-only through this API — its values are masked. Manage keys via the Models/credentials surface or edit the file on the server.",
    );
  }

  try {
    ensureDb();
    const bodyResult = await parseJsonBody(request);
    if (bodyResult instanceof NextResponse) return bodyResult;
    const { content, backup } = bodyResult;

    if (typeof content !== "string") {
      return badRequest("Content is required");
    }

    const profileSlug = safeProfileSlug(profile);

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
        // configYamlToColumnValues now THROWS on unparseable YAML rather than
        // silently dropping every preserved section (T-0086). Answer the same
        // 409 shape the PUT /api/config refusal established in T-0060: the
        // fault's first line, never the body (it holds api_key lines), and the
        // operator keeps their file.
        let cols: ReturnType<typeof configYamlToColumnValues>;
        try {
          cols = configYamlToColumnValues(content);
        } catch (err) {
          const firstLine = (err instanceof Error ? err.message : String(err))
            .split(String.fromCharCode(10))[0]
            .trim();
          return NextResponse.json(
            { error: `config.yaml was not saved: ${firstLine}` },
            { status: 409 },
          );
        }
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
        // The write answers whether it happened. HERMES.md exists only on the
        // root agent, so on a named profile this returns false and used to be
        // discarded: the route pushed, audited and answered 200 over a save
        // that wrote nothing, and the editor showed the operator's text back
        // to them from its own state (T-0102, D28).
        if (!writeManagedFileContent(profileSlug, key as ManagedFileKey, content)) {
          return badRequest(
            key === "hermes"
              ? `HERMES.md belongs to the root agent — the profile "${profileSlug}" has no framework file to save.`
              : `${key} could not be saved for the profile "${profileSlug}".`,
          );
        }
        const result = pushProfileOrRootOrFail(
          profileSlug,
          "Failed to sync profile to Hermes",
        );
        if (result instanceof NextResponse) return result;
        // SOUL.md is the personality. The Identity tab (decision 11, B9)
        // writes it through this door, so the Shapeshifter ledger lives here
        // and not only on the personality route it replaces (T-0098).
        if (key === "soul") {
          recordEvent("personality.changed", { entityType: "personality", entityId: profileSlug, profile: profileSlug });
        }
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
