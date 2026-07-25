import {
  discoverLocalProfiles,
  importAllSkillsFromDisk,
  importDiscoveredProfile,
  pullRootFromHermes,
  type SyncResult,
} from "@/lib/hermes-profile-sync";
import { ensureDb, db } from "@/lib/db";
import { isProfilesToolsParityComplete } from "@/lib/db/profiles-tools-parity-ensure";
import { getHermesDefaultRoot } from "@/lib/hermes-profile-paths";
import { getAgentRoot } from "@/lib/agent-root-repository";
import { existsSync } from "fs";

function assertProfilesToolsSchemaReady(): void {
  if (!isProfilesToolsParityComplete(db())) {
    throw new Error(
      "Database schema is not at v3 (missing agent_root or skills). Run: npm run db:migrate",
    );
  }
}

export interface HermesStateImportResult {
  root: SyncResult;
  skills: SyncResult[];
  profiles: SyncResult[];
}

function isHermesStateAlreadyImported(): boolean {
  const root = getAgentRoot();
  const skillCount = (
    db().prepare("SELECT COUNT(*) AS c FROM skills").get() as { c: number } | undefined
  )?.c ?? 0;
  return skillCount > 0 && root.soulMd.trim().length > 0;
}

export function importHermesStateFromDisk(options?: { force?: boolean }): HermesStateImportResult {
  ensureDb();
  assertProfilesToolsSchemaReady();

  const defaultRoot = getHermesDefaultRoot();
  if (!existsSync(defaultRoot + "/config.yaml")) {
    return {
      root: { success: true, slug: "default", backupPath: null, error: null },
      skills: [],
      profiles: [],
    };
  }

  if (!options?.force && isHermesStateAlreadyImported()) {
    return {
      root: { success: true, slug: "default", backupPath: null, error: null },
      skills: [],
      profiles: [],
    };
  }

  const skills = importAllSkillsFromDisk();
  const root = pullRootFromHermes();
  const profiles = discoverLocalProfiles().map((profile) => importDiscoveredProfile(profile.slug));

  return {
    root,
    skills,
    profiles,
  };
}
