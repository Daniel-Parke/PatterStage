import { NextResponse, NextRequest } from "next/server";
import { existsSync } from "fs";

import { serverErrorFromCatch } from "@/lib/api-logger";
import { parseJsonBody } from "@/lib/parse-json-body";
import { safeStat } from "@/lib/fs-stats";
import { requireSafeProfileName } from "@/lib/path-security";
import { requireAuth } from "@/lib/api-auth";
import { appendAuditLine } from "@/lib/audit-log";
import { ensureDb } from "@/lib/db";
import {
  listProfiles,
  upsertProfile,
  getProfile,
  defaultConfigYaml,
} from "@/lib/profiles-repository";
import { getAgentRoot } from "@/lib/agent-root-repository";
import {
  pushProfileToHermes,
  detectProfileDrift,
  detectRootDrift,
  countProfileSkills,
  countProfileToolsets,
} from "@/lib/hermes-profile-sync";
import { slugifyDisplayName } from "@/lib/profile-slug";
import { buildProfileHermesPathBundle } from "@/lib/hermes-profile-paths";
import type { AgentProfile, ProfileFile } from "@/types/hermes";
import { badRequest, conflict, ok, serverError } from "@/lib/api-response";

const PROFILE_FILE_DEFS = [
  { key: "soul", name: "SOUL.md", getPath: (b: ReturnType<typeof buildProfileHermesPathBundle>) => b.soul },
  { key: "agent", name: "AGENTS.md", getPath: (b: ReturnType<typeof buildProfileHermesPathBundle>) => b.agents },
  { key: "user", name: "USER.md", getPath: (b: ReturnType<typeof buildProfileHermesPathBundle>) => b.userMemory },
  { key: "memory", name: "MEMORY.md", getPath: (b: ReturnType<typeof buildProfileHermesPathBundle>) => b.agentMemory },
  { key: "config", name: "config.yaml", getPath: (b: ReturnType<typeof buildProfileHermesPathBundle>) => b.config },
] as const;

function getProfileFilesForSlug(slug: string): ProfileFile[] {
  const bundle = buildProfileHermesPathBundle(slug);
  const defs = slug === "default"
    ? [
        ...PROFILE_FILE_DEFS,
        { key: "hermes", name: "HERMES.md", getPath: (b: ReturnType<typeof buildProfileHermesPathBundle>) => b.hermes },
      ]
    : PROFILE_FILE_DEFS;
  return defs.map((def) => {
    const path = def.getPath(bundle);
    const exists = existsSync(path);
    const st = exists ? safeStat(path) : null;
    return {
      key: def.key,
      name: def.name,
      path,
      exists,
      size: st?.size ?? 0,
      lastModified: st?.mtime ?? null,
    };
  });
}

/** Derive sync status from drift/error state — shared by all profile types. */
function deriveSyncStatus(drift: { drifted: boolean }, syncError: string | null): AgentProfile["syncStatus"] {
  if (syncError) return "error";
  if (drift.drifted) return "drift";
  return "synced";
}

function rowToApiProfile(slug: string): AgentProfile | null {
  if (slug === "default") {
    const root = getAgentRoot();
    const drift = detectRootDrift();

    return {
      id: "default",
      name: root.displayName === "Bob" ? "Bob (local default)" : root.displayName,
      description:
        root.description ||
        "Local Hermes root agent at ~/.hermes — import from disk wins over seed on merge",
      personality: root.personality,
      isDefault: true,
      isBundled: false,
      skillsCount: countProfileSkills("default"),
      toolsCount: countProfileToolsets("default"),
      files: getProfileFilesForSlug("default"),
      syncStatus: deriveSyncStatus(drift, root.syncError),
      syncedAt: root.syncedAt,
      syncError: root.syncError,
    };
  }

  const row = getProfile(slug);
  if (!row) return null;

  const drift = detectProfileDrift(slug);

  return {
    id: row.slug,
    name: row.displayName,
    description: row.description,
    personality: row.personality,
    isDefault: false,
    isBundled: Boolean(row.seedKey),
    skillsCount: countProfileSkills(slug),
    toolsCount: countProfileToolsets(slug),
    files: getProfileFilesForSlug(slug),
    syncStatus: deriveSyncStatus(drift, row.syncError),
    syncedAt: row.syncedAt,
    syncError: row.syncError,
  };
}

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  try {
    ensureDb();
    const profiles: AgentProfile[] = [];
    const defaultProfile = rowToApiProfile("default");
    if (defaultProfile) profiles.push(defaultProfile);

    for (const row of listProfiles()) {
      const api = rowToApiProfile(row.slug);
      if (api) profiles.push(api);
    }

    return ok({ profiles });
  } catch (error) {
    return serverErrorFromCatch(
      "GET /api/agent/profiles",
      "listing profiles",
      error,
      "Failed to list profiles",
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  try {
    ensureDb();
    const bodyResult = await parseJsonBody(request);
    if (bodyResult instanceof NextResponse) return bodyResult;
    const { name, description, cloneFrom } = bodyResult as {
      name?: string;
      description?: string;
      cloneFrom?: string;
    };

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return badRequest("Name is required (min 2 characters)");
    }

    const slug = slugifyDisplayName(name);

    const prof = requireSafeProfileName(slug);
    if (prof instanceof NextResponse) return prof;

    if (getProfile(slug)) {
      return conflict(`Profile "${slug}" already exists`);
    }

    let soulMd =
      "# " +
      name.trim() +
      "\n\nYou are a subject matter expert. Deliver complete, high-quality work for your assigned task.\n";
    let agentsMd = "# " + name.trim() + " — Development Guide\n\n";
    let configYaml = defaultConfigYaml("technical");
    let personality = "technical";

    if (cloneFrom && cloneFrom !== "default") {
      const source = getProfile(cloneFrom);
      if (source) {
        soulMd = source.soulMd;
        agentsMd = source.agentsMd;
        configYaml = source.configYaml;
        personality = source.personality;
      }
    }

    upsertProfile({
      slug,
      displayName: name.trim(),
      description: typeof description === "string" ? description : "",
      personality,
      configYaml,
      soulMd,
      agentsMd,
    });

    const push = pushProfileToHermes(slug);
    if (!push.success) {
      return serverError(push.error ?? "Failed to sync profile to Hermes");
    }

    appendAuditLine({
      action: "agent.profile.create",
      resource: slug,
      ok: true,
    });

    return ok({ slug });
  } catch (error) {
    return serverErrorFromCatch(
      "POST /api/agent/profiles",
      "creating profile",
      error,
      "Failed to create profile",
    );
  }
}
