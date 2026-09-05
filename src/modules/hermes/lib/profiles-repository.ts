// ═══════════════════════════════════════════════════════════════
// profiles-repository.ts — Agent profiles in PatterStage SQLite
// ═══════════════════════════════════════════════════════════════

import { getDb, inTransaction, now } from "@/lib/db";
import {
  buildConfigYaml,
  disabledSkillsFromJson,
  parseConfigYaml,
  resolvePlatformToolsets,
  serializeJsonToolsets,
  type PlatformToolsets,
  type PlatformToolsetsSource,
} from "./profile-config-builder";
import { loadSeedPlatformToolsets } from "./seed-profile-toolsets";
import { normalizePlatformToolsets } from "./toolset-normalize";
import { getAgentRoot, updateAgentRoot } from "@/lib/agent-root-repository";

export interface AgentProfileRow {
  slug: string;
  displayName: string;
  description: string;
  personality: string;
  configYaml: string;
  soulMd: string;
  agentsMd: string;
  userMd: string;
  memoryMd: string;
  disabledSkillsJson: string;
  platformToolsetsJson: string;
  seedKey: string | null;
  syncedAt: string | null;
  syncError: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DbRow {
  slug: string;
  display_name: string;
  description: string;
  personality: string;
  config_yaml: string;
  soul_md: string;
  agents_md: string;
  user_md: string;
  memory_md: string;
  disabled_skills: string;
  platform_toolsets: string;
  seed_key: string | null;
  synced_at: string | null;
  sync_error: string | null;
  created_at: string;
  updated_at: string;
}

function rowToProfile(row: DbRow): AgentProfileRow {
  return {
    slug: row.slug,
    displayName: row.display_name,
    description: row.description,
    personality: row.personality,
    configYaml: row.config_yaml,
    soulMd: row.soul_md,
    agentsMd: row.agents_md,
    userMd: row.user_md,
    memoryMd: row.memory_md,
    disabledSkillsJson: row.disabled_skills,
    platformToolsetsJson: row.platform_toolsets,
    seedKey: row.seed_key,
    syncedAt: row.synced_at,
    syncError: row.sync_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT_COLS = `
  slug, display_name, description, personality, config_yaml,
  soul_md, agents_md, user_md, memory_md, disabled_skills, platform_toolsets,
  seed_key, synced_at, sync_error, created_at, updated_at
`;

export function listProfiles(): AgentProfileRow[] {
  const rows = getDb()
    .prepare(`SELECT ${SELECT_COLS} FROM agent_profiles ORDER BY display_name COLLATE NOCASE`)
    .all() as DbRow[];
  return rows.map(rowToProfile);
}

export function getProfile(slug: string): AgentProfileRow | null {
  const row = getDb()
    .prepare(`SELECT ${SELECT_COLS} FROM agent_profiles WHERE slug = ?`)
    .get(slug) as DbRow | undefined;
  return row ? rowToProfile(row) : null;
}

export function getProfileBySeedKey(seedKey: string): AgentProfileRow | null {
  const row = getDb()
    .prepare(`SELECT ${SELECT_COLS} FROM agent_profiles WHERE seed_key = ?`)
    .get(seedKey) as DbRow | undefined;
  return row ? rowToProfile(row) : null;
}

export function getDisabledSkills(slug: string): string[] {
  const row = getProfile(slug);
  if (!row) return [];
  return disabledSkillsFromJson(row.disabledSkillsJson);
}

export interface HydratedPlatformToolsets {
  toolsets: PlatformToolsets;
  source: PlatformToolsetsSource;
  platformToolsetsJson: string;
}

export function hydratePlatformToolsetsForSlug(
  slug: string,
  options?: { persist?: boolean },
): HydratedPlatformToolsets | null {
  const seedFallback = loadSeedPlatformToolsets(slug === "default" ? "default" : slug);

  if (slug === "default") {
    const row = getAgentRoot();
    const resolved = resolvePlatformToolsets(
      row.platformToolsetsJson,
      row.configYaml,
      seedFallback,
    );
    // Normalise what came from outside. A value already in the database was
    // put there by the write path, which normalises; re-normalising it on every
    // read made a GET rewrite the row, and a granular toolset the operator had
    // enabled was gone for good (T-0103, D80).
    const toolsets =
      resolved.source === "database" ? resolved.toolsets : normalizePlatformToolsets(resolved.toolsets);
    const platformToolsetsJson = serializeJsonToolsets(toolsets);
    if (
      options?.persist &&
      (resolved.source !== "database" || platformToolsetsJson !== row.platformToolsetsJson)
    ) {
      updateAgentRoot({ platformToolsetsJson });
    }
    return { toolsets, source: resolved.source, platformToolsetsJson };
  }

  const row = getProfile(slug);
  if (!row) return null;
  const resolved = resolvePlatformToolsets(
    row.platformToolsetsJson,
    row.configYaml,
    seedFallback,
  );
  const toolsets =
    resolved.source === "database" ? resolved.toolsets : normalizePlatformToolsets(resolved.toolsets);
  const platformToolsetsJson = serializeJsonToolsets(toolsets);
  if (
    options?.persist &&
    (resolved.source !== "database" || platformToolsetsJson !== row.platformToolsetsJson)
  ) {
    updateProfileContent(slug, { platformToolsetsJson });
  }
  return { toolsets, source: resolved.source, platformToolsetsJson };
}

export interface UpsertProfileInput {
  slug: string;
  displayName: string;
  description?: string;
  personality?: string;
  configYaml?: string;
  soulMd?: string;
  agentsMd?: string;
  userMd?: string;
  memoryMd?: string;
  disabledSkillsJson?: string;
  platformToolsetsJson?: string;
  seedKey?: string | null;
}

function resolvedPlatformToolsetsForProfile(row: AgentProfileRow): PlatformToolsets {
  return resolvePlatformToolsets(
    row.platformToolsetsJson,
    row.configYaml,
    loadSeedPlatformToolsets(row.slug),
  ).toolsets;
}

export function assembleConfigYamlForProfile(row: AgentProfileRow): string {
  const parts = parseConfigYaml(row.configYaml);
  if (parts.parseError) {
    // Same refusal as assembleRootConfig: assembling from a failed parse
    // silently drops every preserved section (T-0086).
    throw new Error(
      `profile "${row.slug}" config.yaml did not parse (${parts.parseError}) — ` +
        `refusing to assemble from it. Pull the profile from Hermes to repair.`,
    );
  }
  return buildConfigYaml({
    personality: row.personality || parts.personality,
    disabledSkills: disabledSkillsFromJson(row.disabledSkillsJson),
    platformDisabledSkills: parts.platformDisabledSkills,
    platformToolsets: resolvedPlatformToolsetsForProfile(row),
    preservedSections: parts.preservedSections,
    // Forwarded, or a profile push eats skills.creation_nudge_interval.
    skillsExtras: parts.skillsExtras,
  });
}

export function upsertProfile(input: UpsertProfileInput): AgentProfileRow {
  const ts = now();
  const existing = getProfile(input.slug);
  const personality = input.personality ?? existing?.personality ?? "technical";
  let configYaml = input.configYaml ?? existing?.configYaml ?? defaultConfigYaml(personality);
  if (input.disabledSkillsJson !== undefined || input.platformToolsetsJson !== undefined || input.personality !== undefined) {
    const disabled = input.disabledSkillsJson !== undefined
      ? disabledSkillsFromJson(input.disabledSkillsJson)
      : disabledSkillsFromJson(existing?.disabledSkillsJson ?? "[]");
    const toolsetsJson = input.platformToolsetsJson ?? existing?.platformToolsetsJson ?? "{}";
    const toolsets = resolvePlatformToolsets(
      toolsetsJson,
      configYaml,
      loadSeedPlatformToolsets(input.slug),
    ).toolsets;
    const parsed = parseConfigYaml(configYaml);
    if (parsed.parseError) {
      throw new Error(
        `profile "${input.slug}" config.yaml did not parse (${parsed.parseError}) — refusing to rebuild it`,
      );
    }
    configYaml = buildConfigYaml({
      personality,
      disabledSkills: disabled,
      platformDisabledSkills: parsed.platformDisabledSkills,
      platformToolsets: toolsets,
      preservedSections: parsed.preservedSections,
      skillsExtras: parsed.skillsExtras,
    });
  }
  getDb()
    .prepare(
      `INSERT INTO agent_profiles (
        slug, display_name, description, personality, config_yaml,
        soul_md, agents_md, user_md, memory_md, disabled_skills, platform_toolsets,
        seed_key, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(slug) DO UPDATE SET
        display_name = excluded.display_name,
        description = excluded.description,
        personality = excluded.personality,
        config_yaml = excluded.config_yaml,
        soul_md = excluded.soul_md,
        agents_md = excluded.agents_md,
        user_md = excluded.user_md,
        memory_md = excluded.memory_md,
        disabled_skills = excluded.disabled_skills,
        platform_toolsets = excluded.platform_toolsets,
        seed_key = COALESCE(excluded.seed_key, agent_profiles.seed_key),
        updated_at = excluded.updated_at`,
    )
    .run(
      input.slug,
      input.displayName,
      input.description ?? existing?.description ?? "",
      personality,
      configYaml,
      input.soulMd ?? existing?.soulMd ?? "",
      input.agentsMd ?? existing?.agentsMd ?? "",
      input.userMd ?? existing?.userMd ?? "",
      input.memoryMd ?? existing?.memoryMd ?? "",
      input.disabledSkillsJson ?? existing?.disabledSkillsJson ?? "[]",
      input.platformToolsetsJson ?? existing?.platformToolsetsJson ?? "{}",
      input.seedKey ?? existing?.seedKey ?? null,
      existing?.createdAt ?? ts,
      ts,
    );
  return getProfile(input.slug)!;
}

export function updateProfileContent(
  slug: string,
  patch: Partial<
    Pick<
      UpsertProfileInput,
      | "displayName"
      | "description"
      | "personality"
      | "configYaml"
      | "soulMd"
      | "agentsMd"
      | "userMd"
      | "memoryMd"
      | "disabledSkillsJson"
      | "platformToolsetsJson"
    >
  >,
): AgentProfileRow | null {
  const existing = getProfile(slug);
  if (!existing) return null;
  return upsertProfile({
    slug,
    displayName: patch.displayName ?? existing.displayName,
    description: patch.description ?? existing.description,
    personality: patch.personality ?? existing.personality,
    configYaml: patch.configYaml ?? existing.configYaml,
    soulMd: patch.soulMd ?? existing.soulMd,
    agentsMd: patch.agentsMd ?? existing.agentsMd,
    userMd: patch.userMd ?? existing.userMd,
    memoryMd: patch.memoryMd ?? existing.memoryMd,
    disabledSkillsJson: patch.disabledSkillsJson ?? existing.disabledSkillsJson,
    platformToolsetsJson: patch.platformToolsetsJson ?? existing.platformToolsetsJson,
    seedKey: existing.seedKey,
  });
}

export function renameProfileSlug(oldSlug: string, newSlug: string): AgentProfileRow | null {
  const existing = getProfile(oldSlug);
  if (!existing || oldSlug === "default") return null;
  if (getProfile(newSlug)) return null;

  return inTransaction(() => {
    getDb()
      .prepare(
        `INSERT INTO agent_profiles (
          slug, display_name, description, personality, config_yaml,
          soul_md, agents_md, user_md, memory_md, disabled_skills, platform_toolsets,
          seed_key, synced_at, sync_error, created_at, updated_at
        ) SELECT ?, display_name, description, personality, config_yaml,
          soul_md, agents_md, user_md, memory_md, disabled_skills, platform_toolsets,
          seed_key, NULL, NULL, created_at, ?
        FROM agent_profiles WHERE slug = ?`,
      )
      .run(newSlug, now(), oldSlug);
    getDb().prepare("DELETE FROM agent_profiles WHERE slug = ?").run(oldSlug);
    return getProfile(newSlug);
  });
}

export function deleteProfile(slug: string): boolean {
  if (slug === "default") return false;
  const result = getDb().prepare("DELETE FROM agent_profiles WHERE slug = ?").run(slug);
  return result.changes > 0;
}

export function setProfileSyncStatus(
  slug: string,
  syncedAt: string | null,
  syncError: string | null,
): void {
  getDb()
    .prepare(
      "UPDATE agent_profiles SET synced_at = ?, sync_error = ?, updated_at = ? WHERE slug = ?",
    )
    .run(syncedAt, syncError, now(), slug);
}

export function defaultConfigYaml(personality: string): string {
  return buildConfigYaml({
    personality,
    disabledSkills: [],
    platformDisabledSkills: {},
    platformToolsets: {},
    preservedSections: {},
  });
}

/**
 * Number of catalogued skills.
 *
 * Used by the state import to decide whether a first-run import has
 * already happened. It lives here rather than in state-import.ts
 * because a module's own repository IS the repository layer (the
 * WO-0003 ruling): forcing module SQL into src/lib would break the
 * ADR-0005 boundary to satisfy the SQL rule.
 */
export function countSkills(): number | undefined {
  return (getDb().prepare("SELECT COUNT(*) AS c FROM skills").get() as { c: number } | undefined)?.c;
}
