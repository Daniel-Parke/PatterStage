// ═══════════════════════════════════════════════════════════════
// profile-sync.ts — Push/pull profiles, root, skills to Hermes disk
// ═══════════════════════════════════════════════════════════════

import {
  copyFileSync,
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from "fs";

import { atomicWriteFile, finalizeRootConfigOnDisk } from "@/modules/hermes/lib/config-sync";
import { backupTimestamp, ensureDir, fileHash, contentHash } from "@/lib/fs-helpers";
import { messageFromError } from "@/lib/api-fetch";
import { getHermesDefaultRoot } from "./profile-paths";
import { resolveProfileHermesHome } from "./profile-paths";
import { buildHermesPathBundle } from "@/modules/hermes/lib/paths";
import {
  getAgentRoot,
  setAgentRootSyncStatus,
  updateAgentRoot,
  type AgentRootRow,
} from "@/lib/agent-root-repository";
import {
  assembleConfigYamlForProfile,
  getProfile,
  hydratePlatformToolsetsForSlug,
  listProfiles,
  setProfileSyncStatus,
  updateProfileContent,
} from "./profiles-repository";
import { unionToolsetsFromPlatforms } from "@/modules/hermes/lib/toolset-unify";
import {
  buildConfigYaml,
  configYamlToColumnValues,
  configYamlSemanticallyMatches,
  parseConfigYaml,
  disabledSkillsMatchJson,
  disabledSkillsFromJson,
  resolvePlatformToolsets,
} from "./profile-config-builder";
import { collectSkillDirectoryNames, skillFilePath, skillsRootForProfile } from "./skills-config";

import { loadSeedPlatformToolsets } from "./seed-profile-toolsets";
import {
  getSkill,
  listSkills,
  parseSkillFrontmatter,
  setSkillSyncStatus,
  upsertSkill,
} from "@/lib/skills-repository";
import { upsertProfile } from "./profiles-repository";
import { isValidProfileSlug } from "@/lib/profile-slug";
import { now } from "@/lib/db";

const PROFILE_SUBDIRS = [
  "memories",
  "sessions",
  "skins",
  "logs",
  "plans",
  "workspace",
  "cron",
] as const;

export interface SyncResult {
  success: boolean;
  slug: string;
  backupPath: string | null;
  error: string | null;
}

export interface ProfileDriftEntry {
  slug: string;
  drifted: boolean;
  fields: string[];
  syncError: string | null;
}

export interface RootDriftEntry {
  drifted: boolean;
  fields: string[];
  syncError: string | null;
}

interface SkillDriftEntry {
  skillKey: string;
  drifted: boolean;
  syncError: string | null;
}

export interface FullDriftReport {
  root: RootDriftEntry;
  profiles: ProfileDriftEntry[];
  skills: SkillDriftEntry[];
}

export interface DiscoveredProfile {
  slug: string;
  path: string;
  inDatabase: boolean;
}

function ensureProfileDirs(root: string): void {
  for (const sub of PROFILE_SUBDIRS) {
    const dir = root + "/" + sub;
    ensureDir(dir);
  }
}

function ensureAuthJson(profileRoot: string, defaultRoot: string): void {
  const authPath = profileRoot + "/auth.json";
  if (existsSync(authPath)) return;
  const rootAuth = defaultRoot + "/auth.json";
  if (existsSync(rootAuth)) {
    copyFileSync(rootAuth, authPath);
  }
}

function profileRootForSlug(slug: string): string {
  return resolveProfileHermesHome(slug);
}

function writeWithBackup(targetPath: string, content: string, backupsDir: string): void {
  if (existsSync(targetPath)) {
    ensureDir(backupsDir);
    const base = targetPath.split(/[/\\]/).pop() ?? "file";
    const backup = backupsDir + "/" + base + "." + backupTimestamp() + ".bak";
    copyFileSync(targetPath, backup);
  }
  atomicWriteFile(targetPath, content);
}

function globalSkillsRoot(): string {
  return buildHermesPathBundle(getHermesDefaultRoot()).skills;
}

function assembleRootConfig(row: AgentRootRow): string {
  const parts = parseConfigYaml(row.configYaml);
  const { toolsets } = resolvePlatformToolsets(
    row.platformToolsetsJson,
    row.configYaml,
    loadSeedPlatformToolsets("default"),
  );
  return buildConfigYaml({
    personality: row.personality || parts.personality,
    disabledSkills: disabledSkillsFromJson(row.disabledSkillsJson),
    platformDisabledSkills: parts.platformDisabledSkills,
    platformToolsets: toolsets,
    preservedSections: parts.preservedSections,
    extraYamlLines: parts.extraYamlLines,
  });
}

export function pushProfileToHermes(slug: string): SyncResult {
  const profile = getProfile(slug);
  if (!profile) {
    return { success: false, slug, backupPath: null, error: "Profile not found in database" };
  }

  try {
    const root = profileRootForSlug(slug);
    const defaultRoot = getHermesDefaultRoot();
    const bundle = buildHermesPathBundle(root);
    ensureProfileDirs(root);
    ensureAuthJson(root, defaultRoot);

    const configYaml = assembleConfigYamlForProfile(profile);
    const backupsDir = bundle.backups;
    writeWithBackup(bundle.config, configYaml, backupsDir);
    writeWithBackup(bundle.soul, profile.soulMd, backupsDir);
    writeWithBackup(bundle.agents, profile.agentsMd, backupsDir);
    writeWithBackup(bundle.userMemory, profile.userMd || "# User\n", backupsDir);
    writeWithBackup(bundle.agentMemory, profile.memoryMd || "# Memory\n", backupsDir);

    updateProfileContent(slug, { configYaml });

    setProfileSyncStatus(slug, now(), null);
    return { success: true, slug, backupPath: backupsDir, error: null };
  }
  catch (err) {
    const message = messageFromError(err, "");
    setProfileSyncStatus(slug, null, message);
    return { success: false, slug, backupPath: null, error: message };
  }
}

export function pushRootToHermes(): SyncResult {
  const row = getAgentRoot();
  try {
    const defaultRoot = getHermesDefaultRoot();
    const bundle = buildHermesPathBundle(defaultRoot);
    const backupsDir = bundle.backups;
    const configYaml = assembleRootConfig(row);

    writeWithBackup(bundle.config, configYaml, backupsDir);
    writeWithBackup(bundle.soul, row.soulMd, backupsDir);
    writeWithBackup(bundle.agents, row.agentsMd, backupsDir);
    if (existsSync(bundle.hermes) || row.frameworkMd) {
      writeWithBackup(bundle.hermes, row.frameworkMd, backupsDir);
    }
    writeWithBackup(bundle.userMemory, row.userMd || "# User\n", backupsDir);
    writeWithBackup(bundle.agentMemory, row.memoryMd || "# Memory\n", backupsDir);

    finalizeRootConfigOnDisk();

    setAgentRootSyncStatus(now(), null);
    return { success: true, slug: "default", backupPath: backupsDir, error: null };
  }
  catch (err) {
    const message = messageFromError(err, "");
    setAgentRootSyncStatus(null, message);
    return { success: false, slug: "default", backupPath: null, error: message };
  }
}

export function pushSkillToHermes(skillKey: string): SyncResult {
  const skill = getSkill(skillKey);
  if (!skill) {
    return { success: false, slug: skillKey, backupPath: null, error: "Skill not found in database" };
  }
  try {
    const skillsRoot = globalSkillsRoot();
    ensureDir(skillsRoot);
    const targetDir = skillsRoot + "/" + skillKey.replace(/\\/g, "/");
    ensureDir(targetDir);
    const targetPath = targetDir + "/SKILL.md";
    atomicWriteFile(targetPath, skill.content);
    setSkillSyncStatus(skillKey, now(), null);
    return { success: true, slug: skillKey, backupPath: null, error: null };
  }
  catch (err) {
    const message = messageFromError(err, "");
    setSkillSyncStatus(skillKey, null, message);
    return { success: false, slug: skillKey, backupPath: null, error: message };
  }
}

export function pushAllSkillsToHermes(): SyncResult[] {
  return listSkills().map((s) => pushSkillToHermes(s.skillKey));
}

export function pushAllProfiles(options?: {
  onlyMissing?: boolean;
  onlyOutOfSync?: boolean;
}): SyncResult[] {
  const results: SyncResult[] = [];
  for (const profile of listProfiles()) {
    if (options?.onlyMissing) {
      const root = profileRootForSlug(profile.slug);
      if (existsSync(root + "/SOUL.md") || existsSync(root + "/AGENTS.md")) {
        continue;
      }
    }
    if (options?.onlyOutOfSync) {
      const drift = detectProfileDrift(profile.slug);
      if (!drift.drifted && profile.syncedAt && !profile.syncError) {
        continue;
      }
    }
    results.push(pushProfileToHermes(profile.slug));
  }
  return results;
}

function catalogKeysForPull(): string[] {
  return collectSkillDirectoryNames(skillsRootForProfile());
}

function reconcileProfileConfigOnDisk(slug: string): void {
  const profile = getProfile(slug);
  if (!profile) return;
  const root = profileRootForSlug(slug);
  const bundle = buildHermesPathBundle(root);
  const assembled = assembleConfigYamlForProfile(profile);
  writeWithBackup(bundle.config, assembled, bundle.backups);
}

function reconcileRootConfigOnDisk(): void {
  const row = getAgentRoot();
  const defaultRoot = getHermesDefaultRoot();
  const bundle = buildHermesPathBundle(defaultRoot);
  const assembled = assembleRootConfig(row);
  writeWithBackup(bundle.config, assembled, bundle.backups);
}

export function pullProfileFromHermes(
  slug: string,
  options?: { reconcileDisk?: boolean },
): SyncResult {
  const root = profileRootForSlug(slug);
  const bundle = buildHermesPathBundle(root);
  try {
    let configYaml = "";
    if (existsSync(bundle.config)) {
      configYaml = readFileSync(bundle.config, "utf-8");
    }
    const catalogKeys = catalogKeysForPull();
    const cols = configYamlToColumnValues(configYaml, catalogKeys);
    const patch: Parameters<typeof updateProfileContent>[1] = {
      configYaml: cols.configYaml,
      personality: cols.personality,
      disabledSkillsJson: cols.disabledSkillsJson,
      platformToolsetsJson: cols.platformToolsetsJson,
    };
    if (existsSync(bundle.soul)) {
      patch.soulMd = readFileSync(bundle.soul, "utf-8");
    }
    if (existsSync(bundle.agents)) {
      patch.agentsMd = readFileSync(bundle.agents, "utf-8");
    }
    if (existsSync(bundle.userMemory)) {
      patch.userMd = readFileSync(bundle.userMemory, "utf-8");
    }
    if (existsSync(bundle.agentMemory)) {
      patch.memoryMd = readFileSync(bundle.agentMemory, "utf-8");
    }
    updateProfileContent(slug, patch);
    hydratePlatformToolsetsForSlug(slug, { persist: true });
    if (options?.reconcileDisk) {
      reconcileProfileConfigOnDisk(slug);
    }
    setProfileSyncStatus(slug, now(), null);
    return { success: true, slug, backupPath: null, error: null };
  }
  catch (err) {
    const message = messageFromError(err, "");
    return { success: false, slug, backupPath: null, error: message };
  }
}

export function pullRootFromHermes(options?: { reconcileDisk?: boolean }): SyncResult {
  const defaultRoot = getHermesDefaultRoot();
  const bundle = buildHermesPathBundle(defaultRoot);
  try {
    let configYaml = "";
    if (existsSync(bundle.config)) {
      configYaml = readFileSync(bundle.config, "utf-8");
    }
    const catalogKeys = catalogKeysForPull();
    const cols = configYamlToColumnValues(configYaml, catalogKeys);
    const patch: Parameters<typeof updateAgentRoot>[0] = {
      configYaml: cols.configYaml,
      personality: cols.personality,
      disabledSkillsJson: cols.disabledSkillsJson,
      platformToolsetsJson: cols.platformToolsetsJson,
    };
    if (existsSync(bundle.soul)) patch.soulMd = readFileSync(bundle.soul, "utf-8");
    if (existsSync(bundle.agents)) patch.agentsMd = readFileSync(bundle.agents, "utf-8");
    if (existsSync(bundle.hermes)) patch.frameworkMd = readFileSync(bundle.hermes, "utf-8");
    if (existsSync(bundle.userMemory)) patch.userMd = readFileSync(bundle.userMemory, "utf-8");
    if (existsSync(bundle.agentMemory)) patch.memoryMd = readFileSync(bundle.agentMemory, "utf-8");
    updateAgentRoot(patch);
    hydratePlatformToolsetsForSlug("default", { persist: true });
    if (options?.reconcileDisk) {
      reconcileRootConfigOnDisk();
    }
    setAgentRootSyncStatus(now(), null);
    return { success: true, slug: "default", backupPath: null, error: null };
  }
  catch (err) {
    const message = messageFromError(err, "");
    return { success: false, slug: "default", backupPath: null, error: message };
  }
}

export function pullSkillFromHermes(skillKey: string): SyncResult {
  const skillsRoot = globalSkillsRoot();
  const direct = skillFilePath(skillsRoot, skillKey);
  let filePath: string | null = existsSync(direct) ? direct : null;
  if (!filePath) {
    const walk = (dir: string): string | null => {
      for (const item of readdirSync(dir)) {
        if (item.startsWith(".")) continue;
        const full = dir + "/" + item;
        try {
          const st = statSync(full);
          if (st.isDirectory()) {
            if (item === skillKey.split("/").pop() && existsSync(full + "/SKILL.md")) {
              return full + "/SKILL.md";
            }
            const found = walk(full);
            if (found) return found;
          }
        }
        catch {
          // skip
        }
      }
      return null;
    };
    if (existsSync(skillsRoot)) filePath = walk(skillsRoot);
  }
  if (!filePath) {
    return { success: false, slug: skillKey, backupPath: null, error: "Skill file not found on disk" };
  }
  try {
    const content = readFileSync(filePath, "utf-8");
    const meta = parseSkillFrontmatter(content);
    upsertSkill({
      skillKey,
      content,
      displayName: meta.name || skillKey,
      description: meta.description,
      category: meta.category,
      source: "custom",
    });
    setSkillSyncStatus(skillKey, now(), null);
    return { success: true, slug: skillKey, backupPath: null, error: null };
  }
  catch (err) {
    const message = messageFromError(err, "");
    return { success: false, slug: skillKey, backupPath: null, error: message };
  }
}

export function detectProfileDrift(slug: string): ProfileDriftEntry {
  const profile = getProfile(slug);
  if (!profile) {
    return { slug, drifted: false, fields: [], syncError: "not in database" };
  }

  const bundle = buildHermesPathBundle(profileRootForSlug(slug));
  const fields: string[] = [];
  const expectedConfig = assembleConfigYamlForProfile(profile);
  const catalogKeys = catalogKeysForPull();

  if (existsSync(bundle.config)) {
    const diskConfig = readFileSync(bundle.config, "utf-8");
    if (!configYamlSemanticallyMatches(diskConfig, expectedConfig, catalogKeys)) {
      fields.push("config.yaml");
    }
  } else if (expectedConfig.trim().length > 0) {
    fields.push("config.yaml");
  }
  if (fileHash(bundle.soul) !== contentHash(profile.soulMd)) fields.push("SOUL.md");
  if (fileHash(bundle.agents) !== contentHash(profile.agentsMd)) fields.push("AGENTS.md");
  if (fileHash(bundle.userMemory) !== contentHash(profile.userMd || "# User\n")) fields.push("USER.md");
  if (fileHash(bundle.agentMemory) !== contentHash(profile.memoryMd || "# Memory\n")) {
    fields.push("MEMORY.md");
  }
  if (existsSync(bundle.config)) {
    const diskConfig = readFileSync(bundle.config, "utf-8");
    if (!disabledSkillsMatchJson(diskConfig, profile.disabledSkillsJson, catalogKeys)) {
      fields.push("skills.disabled");
    }
  }

  return {
    slug,
    drifted: fields.length > 0,
    fields,
    syncError: profile.syncError,
  };
}

export function detectRootDrift(): RootDriftEntry {
  const row = getAgentRoot();
  const bundle = buildHermesPathBundle(getHermesDefaultRoot());
  const fields: string[] = [];
  const expectedConfig = assembleRootConfig(row);
  const catalogKeys = catalogKeysForPull();

  if (existsSync(bundle.config)) {
    const diskConfig = readFileSync(bundle.config, "utf-8");
    if (!configYamlSemanticallyMatches(diskConfig, expectedConfig, catalogKeys)) {
      fields.push("config.yaml");
    }
  } else if (expectedConfig.trim().length > 0) {
    fields.push("config.yaml");
  }
  if (existsSync(bundle.config)) {
    const diskConfig = readFileSync(bundle.config, "utf-8");
    if (!disabledSkillsMatchJson(diskConfig, row.disabledSkillsJson, catalogKeys)) {
      fields.push("skills.disabled");
    }
  }
  if (fileHash(bundle.soul) !== contentHash(row.soulMd)) fields.push("SOUL.md");
  if (fileHash(bundle.agents) !== contentHash(row.agentsMd)) fields.push("AGENTS.md");
  if (existsSync(bundle.hermes) && fileHash(bundle.hermes) !== contentHash(row.frameworkMd)) {
    fields.push("HERMES.md");
  }
  if (fileHash(bundle.userMemory) !== contentHash(row.userMd || "# User\n")) fields.push("USER.md");
  if (fileHash(bundle.agentMemory) !== contentHash(row.memoryMd || "# Memory\n")) {
    fields.push("MEMORY.md");
  }

  return {
    drifted: fields.length > 0,
    fields,
    syncError: row.syncError,
  };
}

function detectSkillDrift(skillKey: string): SkillDriftEntry {
  const skill = getSkill(skillKey);
  if (!skill) {
    return { skillKey, drifted: false, syncError: "not in database" };
  }
  const skillsRoot = globalSkillsRoot();
  const path = skillFilePath(skillsRoot, skillKey);
  const disk = fileHash(path);
  const db = contentHash(skill.content);
  return {
    skillKey,
    drifted: disk !== db,
    syncError: skill.syncError,
  };
}

function detectAllProfileDrift(): ProfileDriftEntry[] {
  return listProfiles().map((p) => detectProfileDrift(p.slug));
}

export function detectFullDrift(): FullDriftReport {
  return {
    root: detectRootDrift(),
    profiles: detectAllProfileDrift(),
    skills: listSkills().map((s) => detectSkillDrift(s.skillKey)),
  };
}

export function discoverLocalProfiles(): DiscoveredProfile[] {
  const defaultRoot = getHermesDefaultRoot();
  const profilesDir = defaultRoot + "/profiles";
  const inDb = new Set(listProfiles().map((p) => p.slug));
  const found: DiscoveredProfile[] = [];
  if (!existsSync(profilesDir)) return found;
  for (const name of readdirSync(profilesDir)) {
    if (name.startsWith(".")) continue;
    const path = profilesDir + "/" + name;
    try {
      if (!statSync(path).isDirectory()) continue;
    }
    catch {
      continue;
    }
    const slug = name.toLowerCase();
    if (!isValidProfileSlug(slug)) continue;
    found.push({
      slug,
      path,
      inDatabase: inDb.has(slug),
    });
  }
  return found;
}

export function importDiscoveredProfile(slug: string): SyncResult {
  if (getProfile(slug)) {
    return pullProfileFromHermes(slug);
  }
  const discovered = discoverLocalProfiles().find((d) => d.slug === slug);
  if (!discovered) {
    return { success: false, slug, backupPath: null, error: "Profile directory not found" };
  }
  const displayName = slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, " ");
  upsertProfile({
    slug,
    displayName,
    description: "Imported from local Hermes profile",
  });
  return pullProfileFromHermes(slug);
}

export function removeProfileFromDisk(slug: string): void {
  if (slug === "default") return;
  const root = profileRootForSlug(slug);
  if (existsSync(root) && root.includes("/profiles/")) {
    rmSync(root, { recursive: true, force: true });
  }
}

/** Count enabled skills from DB denylist (not disk tree). */
export function countProfileToolsets(slug: string): number {
  const hydrated = hydratePlatformToolsetsForSlug(slug === "default" ? "default" : slug);
  if (!hydrated) return 0;
  return unionToolsetsFromPlatforms(hydrated.toolsets).length;
}

export function countProfileSkills(slug: string): number {
  const total = listSkills().length;
  if (slug === "default") {
    const row = getAgentRoot();
    return Math.max(0, total - disabledSkillsFromJson(row.disabledSkillsJson).length);
  }
  const profile = getProfile(slug);
  if (!profile) return 0;
  return Math.max(0, total - disabledSkillsFromJson(profile.disabledSkillsJson).length);
}

/** Walk global skills catalog on disk for discovery/import. */
export function scanDiskSkillsCatalog(): { skillKey: string; path: string }[] {
  const skillsRoot = globalSkillsRoot();
  const results: { skillKey: string; path: string }[] = [];
  if (!existsSync(skillsRoot)) return results;

  const walk = (dir: string, prefix: string): void => {
    for (const item of readdirSync(dir)) {
      if (item.startsWith(".")) continue;
      const full = dir + "/" + item;
      try {
        const st = statSync(full);
        if (!st.isDirectory()) continue;
        const key = prefix ? prefix + "/" + item : item;
        if (existsSync(full + "/SKILL.md")) {
          results.push({ skillKey: key, path: full + "/SKILL.md" });
        }
        else {
          walk(full, key);
        }
      }
      catch {
        // skip
      }
    }
  };
  walk(skillsRoot, "");
  return results;
}

export function importAllSkillsFromDisk(): SyncResult[] {
  const results: SyncResult[] = [];
  for (const { skillKey, path } of scanDiskSkillsCatalog()) {
    try {
      const content = readFileSync(path, "utf-8");
      const meta = parseSkillFrontmatter(content);
      upsertSkill({
        skillKey,
        content,
        displayName: meta.name || skillKey,
        description: meta.description,
        category: meta.category,
        source: "custom",
      });
      results.push({ success: true, slug: skillKey, backupPath: null, error: null });
    }
    catch (err) {
      const message = messageFromError(err, "");
      results.push({ success: false, slug: skillKey, backupPath: null, error: message });
    }
  }
  return results;
}
