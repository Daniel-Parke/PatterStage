import { NextResponse, NextRequest } from "next/server";
import { existsSync } from "fs";

import { parseJsonBody } from "@/lib/api/parse-json-body";
import { safeStat } from "@/lib/fs/fs-stats";
import { requireSafeProfileName } from "@/lib/fs/path-security";

import { appendAuditLine } from "@/lib/api/audit-log";
import { ensureDb } from "@/lib/db";
import {
  listProfiles,
  upsertProfile,
  getProfile,
  defaultConfigYaml,
} from "@/modules/hermes/lib/profiles-repository";
import { getAgentRoot } from "@/lib/agents/agent-root-repository";
import { pushProfileToHermes } from "@/modules/hermes/lib/profile-push";
import { recordEvent } from "@/lib/analytics/record-event";
import { detectProfileDrift, detectRootDrift } from "@/modules/hermes/lib/profile-drift";
import { createProfileSkillsCounter, countProfileToolsets } from "@/modules/hermes/lib/profile-counts";
import { slugifyDisplayName, validateProfileDisplayName, DEFAULT_PROFILE_SLUG } from "@/lib/agents/profile-slug";
import { buildProfileHermesPathBundle } from "@/modules/hermes/lib/profile-paths";
import { isManagedKey, readManagedFileContent } from "@/modules/hermes/lib/agent-file-store";
import type { AgentProfile, ProfileFile } from "@/types/console";
import { badRequest, conflict, ok, serverError } from "@/lib/api/api-response";
import { route } from "@/lib/api/api-route";

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
    const onDisk = existsSync(path);
    // A managed file lives in the database until the first push, and the
    // editor reads it from there. Reporting "missing" for a file the editor
    // opens full of content is the file list disagreeing with the door beside
    // it (T-0102, D26).
    const exists =
      onDisk ||
      (isManagedKey(def.key) && (readManagedFileContent(slug, def.key)?.content ?? "").trim().length > 0);
    const st = onDisk ? safeStat(path) : null;
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

/**
 * `countSkillsFor` is passed in rather than called per profile: the skills
 * catalogue it counts against is the same for every profile in the list, and
 * reading it here walked the whole skills tree once per row (see
 * createProfileSkillsCounter).
 */
function rowToApiProfile(slug: string, countSkillsFor: (slug: string) => number): AgentProfile | null {
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
      skillsCount: countSkillsFor("default"),
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
    skillsCount: countSkillsFor(slug),
    toolsCount: countProfileToolsets(slug),
    files: getProfileFilesForSlug(slug),
    syncStatus: deriveSyncStatus(drift, row.syncError),
    syncedAt: row.syncedAt,
    syncError: row.syncError,
  };
}

export const GET = route("GET /api/agent/profiles", "listing profiles", "Failed to list profiles", async (_request: NextRequest) => {
  ensureDb();
  const profiles: AgentProfile[] = [];
  // One catalogue read for the whole list, not one per profile.
  const countSkillsFor = createProfileSkillsCounter();
  const defaultProfile = rowToApiProfile("default", countSkillsFor);
  if (defaultProfile) profiles.push(defaultProfile);

  for (const row of listProfiles()) {
    const api = rowToApiProfile(row.slug, countSkillsFor);
    if (api) profiles.push(api);
  }

  return ok({ profiles });
});

export const POST = route("POST /api/agent/profiles", "creating profile", "Failed to create profile", async (request: NextRequest) => {
  ensureDb();
  const bodyResult = await parseJsonBody(request);
  if (bodyResult instanceof NextResponse) return bodyResult;
  const { name, description, cloneFrom } = bodyResult as {
    name?: string;
    description?: string;
    cloneFrom?: string;
  };

  if (!name || typeof name !== "string") {
    return badRequest("Name is required (min 2 characters)");
  }

  // Judge the NAME, before it is slugified. The check below used to run on the
  // already-slugified value, and every value slugifyDisplayName can produce
  // satisfies the slug pattern by construction, so it could never fire:
  // "../evil" was laundered into a legitimate-looking profile called "evil"
  // and ".." into the literal fallback "profile" (T-0061).
  const nameCheck = validateProfileDisplayName(name);
  if (!nameCheck.ok) return badRequest(nameCheck.error);

  const slug = slugifyDisplayName(name);

  // Kept, and now honestly labelled: an invariant assertion at a filesystem
  // boundary, not a working guard on this path. It cannot fire for any output
  // of slugifyDisplayName, and there is a test asserting exactly that. It
  // stays because the day someone widens the slugifier is the day it earns
  // its place, and deleting a fence at a path boundary to save two lines is
  // the wrong trade.
  const prof = requireSafeProfileName(slug);
  if (prof instanceof NextResponse) return prof;

  // The root agent is NOT in agent_profiles (it lives in agent_root), so the
  // ordinary collision check below cannot see it, and
  // resolveProfileHermesHome("default") resolves to the ROOT Hermes home
  // rather than profiles/default. Creating a profile named "Default"
  // therefore rewrote the operator's own config.yaml, SOUL.md, AGENTS.md,
  // USER.md and MEMORY.md with boilerplate and answered 200 (T-0061).
  if (slug === DEFAULT_PROFILE_SLUG) {
    return conflict(
      `"${name.trim()}" resolves to the slug "default", which is reserved for the root agent. ` +
        `Rename the root agent with Edit profile on its own card, or choose a different name here.`,
    );
  }

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

  // "Default (Bob)" is what the modal offers first, and it used to be the one
  // value this branch skipped: `cloneFrom !== "default"` meant the most-used
  // path silently wrote the boilerplate above over the clone the operator
  // asked for, and answered 200 (T-0102, D18). The root agent is not in
  // agent_profiles, so it is read from its own row.
  if (cloneFrom === DEFAULT_PROFILE_SLUG) {
    const root = getAgentRoot();
    soulMd = root.soulMd;
    agentsMd = root.agentsMd;
    configYaml = root.configYaml;
    personality = root.personality;
  } else if (cloneFrom) {
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
  recordEvent("profile.created", { entityType: "profile", entityId: slug, profile: slug });

  return ok({ slug });
});
