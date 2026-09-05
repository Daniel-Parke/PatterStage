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

import {
  assertParseableConfigYaml,
  atomicWriteFile,
  findLatestParseableBackup,
} from "./hermes-config-write";
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
  // The belt (T-0086). This is the writer the corrupted config.yamls went
  // through — text-assembled pushes with zero validation. After the assembler
  // rewrite it should never fire; it exists so any future regression becomes a
  // loud refusal instead of a corrupt file on the operator's disk. Non-YAML
  // targets (SOUL.md and friends) pass untouched — they are prose.
  if (targetPath.toLowerCase().endsWith("config.yaml")) {
    assertParseableConfigYaml(content, targetPath);
  }
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

/**
 * Assemble the root row's config.yaml the way both push and drift expect it.
 *
 * THROWS when the stored row does not parse. Assembling from a failed parse is
 * the silent preserved-section drop that turned one corrupt write into
 * compounding data loss (T-0086); the push/pull callers catch this and surface
 * it as the row's syncError, and the message names the newest backup that
 * still parses so the repair is one copy command away.
 */
/**
 * The repair, said once. Names the newest backup that still parses and never
 * performs the restore (T-0086): a backup carries older model settings and
 * reviving one silently could flip the operator's active model.
 */
export function repairGuidance(backupsDir: string, then: string): string {
  const restorable = findLatestParseableBackup(backupsDir);
  return restorable
    ? `Restore ${restorable} over config.yaml, ${then}.`
    : `Repair config.yaml by hand, ${then}.`;
}

export function assembleRootConfig(row: AgentRootRow): string {
  const parts = parseConfigYaml(row.configYaml);
  if (parts.parseError) {
    const backups = buildHermesPathBundle(getHermesDefaultRoot()).backups;
    throw new Error(
      `the stored root config.yaml did not parse (${parts.parseError}) — refusing to assemble from it. ` +
        repairGuidance(backups, "then Pull from Hermes to repair the database copy"),
    );
  }
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
    // Forwarded, or a root push still eats skills.creation_nudge_interval.
    skillsExtras: parts.skillsExtras,
  });
}
