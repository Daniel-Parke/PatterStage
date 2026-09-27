import {
  discoverLocalProfiles,
  importAllSkillsFromDisk,
  importDiscoveredProfile,
} from "./profile-discovery";
import { pullRootFromHermes } from "./profile-pull";
import { type SyncResult } from "./profile-sync-shared";
import { ensureDb, getDb } from "@/lib/db";
import { isProfilesToolsParityComplete } from "@/lib/db/profiles-tools-parity-ensure";
import { countSkills, listProfiles } from "./profiles-repository";
import { getHermesDefaultRoot } from "./profile-paths";
import { getAgentRoot } from "@/lib/agents/agent-root-repository";
import { existsSync } from "fs";

function assertProfilesToolsSchemaReady(): void {
  if (!isProfilesToolsParityComplete(getDb())) {
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

function isHermesStateAlreadyImported(strict: boolean): boolean {
  const root = getAgentRoot();
  const skillCount = countSkills() ?? 0;
  if (skillCount === 0 || root.soulMd.trim().length === 0) return false;
  if (strict && discoverLocalProfiles(true).some((profile) => !profile.inDatabase)) {
    throw new Error("Hermes state import incomplete; run with --pull to import new profiles");
  }
  return true;
}

function rootHasStoredContent(): boolean {
  const root = getAgentRoot();
  return root.configYaml.length > 0 || root.soulMd.length > 0 ||
    root.agentsMd.length > 0 || root.frameworkMd.length > 0 ||
    root.userMd.length > 0 || root.memoryMd.length > 0 ||
    root.personality !== "technical" || root.disabledSkillsJson !== "[]" ||
    root.platformToolsetsJson !== "{}" || root.syncedAt !== null ||
    root.syncError !== null;
}

export function importHermesStateFromDisk(options?: { force?: boolean; strict?: boolean; importMissingProfiles?: boolean }): HermesStateImportResult {
  ensureDb();
  assertProfilesToolsSchemaReady();

  const defaultRoot = getHermesDefaultRoot();
  if (!existsSync(defaultRoot + "/config.yaml")) {
    if (options?.importMissingProfiles) {
      throw new Error("Hermes config is missing; targeted import cannot complete");
    }
    return {
      root: { success: true, slug: "default", backupPath: null, error: null },
      skills: [],
      profiles: [],
    };
  }

  if (!options?.force) {
    const alreadyImported = isHermesStateAlreadyImported(Boolean(options?.strict && !options?.importMissingProfiles));
    if (options?.importMissingProfiles && !alreadyImported) {
      const hasExistingRows = rootHasStoredContent() || (countSkills() ?? 0) > 0 || listProfiles().length > 0;
      if (hasExistingRows) {
        throw new Error("Hermes state is partial; targeted import refuses to refresh existing rows");
      }
    }
    if (alreadyImported) {
      const profiles = options?.importMissingProfiles
        ? getDb().transaction(() => discoverLocalProfiles(Boolean(options.strict))
          .filter((profile) => !profile.inDatabase)
          .map((profile) => {
            const result = importDiscoveredProfile(profile.slug);
            if (!result.success) throw new Error("Hermes missing profile import failed");
            return result;
          }))()
        : [];
      return {
        root: { success: true, slug: "default", backupPath: null, error: null },
        skills: [],
        profiles,
      };
    }
  }

  const skills = importAllSkillsFromDisk(options?.strict);
  const root = pullRootFromHermes();
  const profiles = discoverLocalProfiles(options?.strict).map((profile) => importDiscoveredProfile(profile.slug));

  return {
    root,
    skills,
    profiles,
  };
}
