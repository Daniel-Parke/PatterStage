import { NextRequest, NextResponse } from "next/server";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "fs";

import { resolveProfileHermesHome, buildProfileHermesPathBundle } from "@/lib/hermes-profile-paths";
import { getBehaviorFiles } from "@/lib/behavior-files";
import { logApiError } from "@/lib/api-logger";
import { parseJsonBody } from "@/lib/parse-json-body";
import { resolveSafeProfileName } from "@/lib/path-security";
import { requireAuth } from "@/lib/api-auth";
import { appendAuditLine } from "@/lib/audit-log";
import { ensureDb } from "@/lib/db";
import { getProfile } from "@/lib/profiles-repository";
import {
  readManagedFileContent,
  writeManagedFileContent,
  type ManagedFileKey,
} from "@/lib/agent-file-store";
import { applyProfileOrRootPatch, pushProfileOrRoot, toPatchResponse } from "@/lib/apply-profile-or-root-patch";
import {
  configYamlToColumnValues,
  platformToolsetsFromJson,
  serializeJsonToolsets,
} from "@/lib/profile-config-builder";
import { normalizePlatformToolsets } from "@/lib/hermes-toolset-normalize";

const MANAGED_KEYS = new Set<string>(["soul", "agent", "user", "memory", "config", "hermes"]);

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
    return NextResponse.json({ error: `Unknown file key: ${key}` }, { status: 400 });
  }
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: 400 });
  }

  try {
    ensureDb();
    const prof = resolveSafeProfileName(profile);
    const profileSlug = prof.ok ? prof.profile : "default";

    if (MANAGED_KEYS.has(key)) {
      const stored = readManagedFileContent(profileSlug, key as ManagedFileKey);
      if (stored) {
        return NextResponse.json({
          data: {
            key,
            content: stored.content,
            name: resolved.name,
            description: resolved.description,
            exists: stored.content.length > 0,
            size: stored.content.length,
            lastModified: stored.updatedAt,
          },
        });
      }
    }

    if (!existsSync(resolved.path)) {
      return NextResponse.json({
        data: {
          key,
          content: "",
          name: resolved.name,
          description: resolved.description,
          exists: false,
          size: 0,
        },
      });
    }

    const content = readFileSync(resolved.path, "utf-8");
    const stats = statSync(resolved.path);
    return NextResponse.json({
      data: {
        key,
        content,
        name: resolved.name,
        description: resolved.description,
        exists: true,
        size: stats.size,
        lastModified: stats.mtime.toISOString(),
      },
    });
  }
  catch (error) {
    logApiError("GET /api/agent/files/[key]", `reading ${resolved.path}`, error);
    return NextResponse.json({ error: "Failed to read file" }, { status: 500 });
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
    return NextResponse.json({ error: `Unknown file key: ${key}` }, { status: 400 });
  }
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: 400 });
  }

  try {
    ensureDb();
    const bodyResult = await parseJsonBody(request);
    if (bodyResult instanceof NextResponse) return bodyResult;
    const { content, backup } = bodyResult;

    if (typeof content !== "string") {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }

    const prof = resolveSafeProfileName(profile);
    const profileSlug = prof.ok ? prof.profile : "default";

    if (profileSlug !== "default" && !getProfile(profileSlug) && MANAGED_KEYS.has(key)) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const dir = resolved.path.substring(0, resolved.path.lastIndexOf("/"));
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    if (backup && existsSync(resolved.path)) {
      const profileHome = resolveProfileHermesHome(profileSlug);
      const backupDir = profileHome + "/backups";
      if (!existsSync(backupDir)) mkdirSync(backupDir, { recursive: true });
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      const backupName = `${key}-${ts}.md`;
      try {
        writeFileSync(backupDir + "/" + backupName, readFileSync(resolved.path, "utf-8"));
      }
      catch (err) {
        logApiError("PUT /api/agent/files/[key]", `backup ${resolved.path}`, err);
      }
    }

    if (MANAGED_KEYS.has(key)) {
      if (key === "config") {
        const cols = configYamlToColumnValues(content);
        const platformToolsetsJson = serializeJsonToolsets(
          normalizePlatformToolsets(platformToolsetsFromJson(cols.platformToolsetsJson)),
        );
        writeManagedFileContent(profileSlug, "config", cols.configYaml);
        // applyProfileOrRootPatch handles default-vs-non-default
        // dispatch + 404 on missing profile + 500 on push failure —
        // replaces the if/else update block AND the separate push
        // block below (2 places, 16 lines total).
        const configPatch = {
          personality: cols.personality,
          disabledSkillsJson: cols.disabledSkillsJson,
          platformToolsetsJson,
          configYaml: cols.configYaml,
        };
        const result = applyProfileOrRootPatch(
          profileSlug,
          configPatch,
          configPatch,
        );
        const err = toPatchResponse(result, "Failed to sync profile to Hermes");
        if (err) return err;
        if (!result.ok) throw new Error("unreachable: toPatchResponse returned null on failure");
      }
      else {
        // Non-config managed file (SOUL.md, AGENTS.md, etc.) — write
        // the column-free file body to the managed-files table, then
        // push. pushProfileOrRoot handles default-vs-non-default
        // dispatch + 404 + push-fail without doing a no-op DB write
        // that would bump updated_at.
        writeManagedFileContent(profileSlug, key as ManagedFileKey, content);
        const result = pushProfileOrRoot(profileSlug);
        const err = toPatchResponse(result, "Failed to sync profile to Hermes");
        if (err) return err;
        if (!result.ok) throw new Error("unreachable: toPatchResponse returned null on failure");
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

    return NextResponse.json({ data: { success: true, key, path: resolved.path } });
  }
  catch (error) {
    logApiError("PUT /api/agent/files/[key]", `writing ${resolved.path}`, error);
    return NextResponse.json({ error: "Failed to write file" }, { status: 500 });
  }
}
