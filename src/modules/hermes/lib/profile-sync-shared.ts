// ═══════════════════════════════════════════════════════════════
// profile-sync-shared.ts: the floor the profile sync halves stand on
//
// Split out of profile-sync.ts, which was one file doing five jobs.
// This module holds what every half needs and nothing that belongs to
// a particular direction of travel: the result shape they all return,
// where a profile lives on disk, how a file is written with a backup
// first, and how a config.yaml is assembled for the root row.
//
// It imports from none of its four siblings (profile-push,
// profile-pull, profile-drift, profile-discovery), which is what
// keeps the graph acyclic.
// ═══════════════════════════════════════════════════════════════

import { copyFileSync, existsSync } from "fs";

import { atomicWriteFile } from "./hermes-config-write";
import { backupTimestamp, ensureDir } from "@/lib/fs/fs-helpers";
import { getHermesDefaultRoot, resolveProfileHermesHome } from "./profile-paths";
import { buildHermesPathBundle } from "./paths";
import { type AgentRootRow } from "@/lib/agent-root-repository";
import {
  buildConfigYaml,
  parseConfigYaml,
  disabledSkillsFromJson,
  resolvePlatformToolsets,
} from "./profile-config-builder";
import { loadSeedPlatformToolsets } from "./seed-profile-toolsets";
import { collectSkillDirectoryNames, skillsRootForProfile } from "./skills-config";

const PROFILE_SUBDIRS = [
  "memories",
  "sessions",
  "skins",
  "logs",
  "plans",
  "workspace",
  "cron",
] as const;

/**
 * What every push, pull and import returns. `slug` doubles as the skill
 * key on the skill-shaped calls, and `backupPath` is null whenever the
 * operation wrote nothing that needed backing up.
 */
export interface SyncResult {
  success: boolean;
  slug: string;
  backupPath: string | null;
  error: string | null;
}

export function ensureProfileDirs(root: string): void {
  for (const sub of PROFILE_SUBDIRS) {
    const dir = root + "/" + sub;
    ensureDir(dir);
  }
}

export function ensureAuthJson(profileRoot: string, defaultRoot: string): void {
  const authPath = profileRoot + "/auth.json";
  if (existsSync(authPath)) return;
  const rootAuth = defaultRoot + "/auth.json";
  if (existsSync(rootAuth)) {
    copyFileSync(rootAuth, authPath);
  }
}

export function profileRootForSlug(slug: string): string {
  return resolveProfileHermesHome(slug);
}

/**
 * Write a file, keeping a timestamped copy of what was there first.
 *
 * This is deliberately `atomicWriteFile` and NOT `writeHermesConfigFile`,
 * even though some callers pass a config.yaml path: the profile roots are
 * not the active Hermes home, and the root push follows its writes with
 * `finalizeRootConfigOnDisk`, which does invalidate. Changing this to the
 * cache-aware writer would change behaviour.
 */
export function writeWithBackup(targetPath: string, content: string, backupsDir: string): void {
  if (existsSync(targetPath)) {
    ensureDir(backupsDir);
    const base = targetPath.split(/[/\\]/).pop() ?? "file";
    const backup = backupsDir + "/" + base + "." + backupTimestamp() + ".bak";
    copyFileSync(targetPath, backup);
  }
  atomicWriteFile(targetPath, content);
}

export function globalSkillsRoot(): string {
  return buildHermesPathBundle(getHermesDefaultRoot()).skills;
}

/** The skill directory names a pull compares an on-disk config against. */
export function catalogKeysForPull(): string[] {
  return collectSkillDirectoryNames(skillsRootForProfile());
}

/** Assemble the root row's config.yaml the way both push and drift expect it. */
export function assembleRootConfig(row: AgentRootRow): string {
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
