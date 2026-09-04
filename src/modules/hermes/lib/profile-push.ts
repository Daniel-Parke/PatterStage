// ═══════════════════════════════════════════════════════════════
// profile-push.ts: database to Hermes disk
//
// Split out of profile-sync.ts. One direction of travel: take what
// the database holds for a profile, the root, or a skill, and write
// it to the agent's filesystem, backing up whatever was there first.
//
// Every push records its outcome on the row it pushed
// (`setProfileSyncStatus` / `setAgentRootSyncStatus` /
// `setSkillSyncStatus`) so the drift banner can distinguish "never
// pushed" from "pushed and failed". That is why each function has its
// own try/catch rather than letting the caller handle one: the error
// has to land on the right row.
// ═══════════════════════════════════════════════════════════════

import { existsSync } from "fs";

import { finalizeRootConfigOnDisk } from "./config-sync";
import { messageFromError } from "@/lib/api-fetch";
import { buildHermesPathBundle } from "./paths";
import { getHermesDefaultRoot } from "./profile-paths";
import {
  getAgentRoot,
  setAgentRootSyncStatus,
} from "@/lib/agent-root-repository";
import {
  assembleConfigYamlForProfile,
  getProfile,
  listProfiles,
  setProfileSyncStatus,
  updateProfileContent,
} from "./profiles-repository";
import {
  getSkill,
  listSkills,
  setSkillSyncStatus,
} from "@/lib/skills-repository";
import { ensureDir } from "@/lib/fs/fs-helpers";
import { now } from "@/lib/db";
import { detectProfileDrift } from "./profile-drift";
import {
  assembleRootConfig,
  ensureAuthJson,
  ensureProfileDirs,
  globalSkillsRoot,
  profileRootForSlug,
  writeWithBackup,
  type SyncResult,
} from "./profile-sync-shared";
import { atomicWriteFile, describeWriteFailure } from "./hermes-config-write";

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
    const message = describeWriteFailure(err);
    setProfileSyncStatus(slug, null, message);
    return { success: false, slug, backupPath: null, error: message };
  }
}

export function pushRootToHermes(): SyncResult {
  const row = getAgentRoot();
  try {
    const defaultRoot = getHermesDefaultRoot();
    const bundle = buildHermesPathBundle(defaultRoot);
    // The line pushProfileToHermes has always had and this one did not. Without
    // it a Hermes home with no memories/ directory takes four of the seven
    // writes and then ENOENTs on the fifth -- which is every fresh install, so
    // the operator's FIRST save reported a crash over a change that had already
    // been committed to the database (QA finding 7, T-0082).
    ensureProfileDirs(defaultRoot);
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

    // A finalize failure is a push that did not finish: the model defaults
    // were not applied, or the row could not be refreshed from disk. It used
    // to be discarded here, which made a refusal indistinguishable from
    // success — the exact silence that let corruption round-trip (T-0086).
    const finalize = finalizeRootConfigOnDisk();
    if (finalize.error) {
      setAgentRootSyncStatus(null, finalize.error);
      return { success: false, slug: "default", backupPath: backupsDir, error: finalize.error };
    }

    setAgentRootSyncStatus(now(), null);
    return { success: true, slug: "default", backupPath: backupsDir, error: null };
  }
  catch (err) {
    const message = describeWriteFailure(err);
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
