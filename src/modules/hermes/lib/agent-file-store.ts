// Maps behaviour file keys ↔ SQLite (agent_profiles / agent_root)

import { getAgentRoot, updateAgentRoot } from "@/lib/agent-root-repository";
import { getProfile, updateProfileContent } from "./profiles-repository";

export type ManagedFileKey =
  | "soul"
  | "agent"
  | "user"
  | "memory"
  | "config"
  | "hermes";

/**
 * Runtime predicate for the managed-file key set.
 *
 * The set is intentionally not derived from `getBehaviorFiles()`
 * (which has 7 keys including `env`) because `env` is a
 * security-sensitive excluded case — the .env file is masked
 * server-side in `GET /api/agent/files/[key]` (see
 * `maskEnvFileContent`), rejected by that route's PUT, and never
 * written through the managed-files SQLite table. (Until the
 * security hotfix this comment claimed the read-only-ness came
 * from a React renderer; it did not — the API returned the raw
 * file to any caller.) The 6 keys here are the
 * behavior-file keys that the agent-file-store can read+write
 * via the `readManagedFileContent` / `writeManagedFileContent`
 * helpers; `env` (and any future security-sensitive addition)
 * stays out of the set.
 *
 * Exported for use at the API-route boundary (e.g.
 * `if (isManagedKey(key))` in `/api/agent/files/[key]/route.ts`)
 * so the route file no longer needs to redeclare the
 * `new Set<string>([...])` literal — the type-narrowing to
 * `ManagedFileKey` is preserved by the explicit `as ManagedFileKey`
 * casts at the read/write call sites.
 */
export function isManagedKey(key: string): key is ManagedFileKey {
  return (
    key === "soul" ||
    key === "agent" ||
    key === "user" ||
    key === "memory" ||
    key === "config" ||
    key === "hermes"
  );
}

export function readManagedFileContent(
  profileSlug: string,
  key: ManagedFileKey,
): { content: string; updatedAt: string } | null {
  if (profileSlug === "default") {
    const row = getAgentRoot();
    const map: Record<ManagedFileKey, { content: string }> = {
      soul: { content: row.soulMd },
      agent: { content: row.agentsMd },
      user: { content: row.userMd },
      memory: { content: row.memoryMd },
      config: { content: row.configYaml },
      hermes: { content: row.frameworkMd },
    };
    const entry = map[key];
    if (!entry) return null;
    return { content: entry.content, updatedAt: row.updatedAt };
  }

  const row = getProfile(profileSlug);
  if (!row) return null;
  const map: Record<string, { content: string }> = {
    soul: { content: row.soulMd },
    agent: { content: row.agentsMd },
    user: { content: row.userMd },
    memory: { content: row.memoryMd },
    config: { content: row.configYaml },
  };
  const entry = map[key];
  if (!entry) return null;
  return { content: entry.content, updatedAt: row.updatedAt };
}

export function writeManagedFileContent(
  profileSlug: string,
  key: ManagedFileKey,
  content: string,
): boolean {
  if (profileSlug === "default") {
    const patch: Parameters<typeof updateAgentRoot>[0] = {};
    if (key === "soul") patch.soulMd = content;
    else if (key === "agent") patch.agentsMd = content;
    else if (key === "user") patch.userMd = content;
    else if (key === "memory") patch.memoryMd = content;
    else if (key === "config") patch.configYaml = content;
    else if (key === "hermes") patch.frameworkMd = content;
    else return false;
    updateAgentRoot(patch);
    return true;
  }

  const patch: Parameters<typeof updateProfileContent>[1] = {};
  if (key === "soul") patch.soulMd = content;
  else if (key === "agent") patch.agentsMd = content;
  else if (key === "user") patch.userMd = content;
  else if (key === "memory") patch.memoryMd = content;
  else if (key === "config") patch.configYaml = content;
  else return false;
  return updateProfileContent(profileSlug, patch) !== null;
}
