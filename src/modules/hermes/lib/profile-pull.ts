// ═══════════════════════════════════════════════════════════════
// profile-pull.ts: Hermes disk to database
//
// Split out of profile-sync.ts. The mirror of profile-push: read what
// is on the agent's filesystem for a profile, the root, or a skill,
// and write it into the database.
//
// Two details worth keeping in view:
//
//   - Every file is optional. A profile root missing SOUL.md is not
//     an error, it is a profile that has never had one, so the patch
//     object is built up key by key rather than assembled whole.
//   - `reconcileDisk` writes back out again after pulling in. That
//     looks circular and is not: the pull normalises the config into
//     the column shape, and reconciling re-serialises it so the file
//     on disk matches what the database now believes. Only the two
//     callers that asked for it pay that cost.
// ═══════════════════════════════════════════════════════════════

import { existsSync, readFileSync, readdirSync, statSync } from "fs";

import { messageFromError } from "@/lib/api-fetch";
import { buildHermesPathBundle } from "./paths";
import { getHermesDefaultRoot } from "./profile-paths";
import {
  getAgentRoot,
  setAgentRootSyncStatus,
  updateAgentRoot,
} from "@/lib/agent-root-repository";
import {
  assembleConfigYamlForProfile,
  getProfile,
  hydratePlatformToolsetsForSlug,
  setProfileSyncStatus,
  updateProfileContent,
} from "./profiles-repository";
import { configYamlToColumnValues } from "./profile-config-builder";
import { repairGuidance } from "./profile-sync-shared";
import { skillFilePath } from "./skills-config";
import {
  parseSkillFrontmatter,
  setSkillSyncStatus,
  upsertSkill,
} from "@/lib/skills-repository";
import { now } from "@/lib/db";
import {
  assembleRootConfig,
  catalogKeysForPull,
  globalSkillsRoot,
  profileRootForSlug,
  writeWithBackup,
  type SyncResult,
} from "./profile-sync-shared";

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
    const raw = messageFromError(err, "");
    // A parse refusal names its repair (T-0086); everything else passes through.
    const message = /did not parse/.test(raw)
      ? `${raw} ${repairGuidance(bundle.backups, "then Pull again")}`
      : raw;
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
    const raw = messageFromError(err, "");
    // A parse refusal names its repair (T-0086); everything else passes through.
    const message = /did not parse/.test(raw)
      ? `${raw} ${repairGuidance(bundle.backups, "then Pull again")}`
      : raw;
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
