import { existsSync, readFileSync } from "fs";

import { getAgentRoot } from "@/lib/agent-root-repository";
import { buildProfileHermesPathBundle } from "./profile-paths";
import {
  collectSkillDirectoryNames,
  computeEffectiveDisabledFromYaml,
  normalizeDisabledSkillKeys,
  skillsRootForProfile,
} from "./skills-config";
import { disabledSkillsFromJson } from "./profile-config-builder";
import { getDisabledSkills } from "./profiles-repository";
import { listSkillKeys } from "@/lib/skills-repository";

/** Union of SQLite catalog keys and on-disk skill directory paths. */
function listCatalogSkillKeys(): string[] {
  // Keys only. This used to call `listSkills()`, which drags every SKILL.md
  // body out of SQLite so that the loop below can throw all of them away.
  const keys = new Set<string>();
  for (const key of listSkillKeys()) {
    keys.add(key);
  }
  for (const name of collectSkillDirectoryNames(skillsRootForProfile())) {
    keys.add(name);
  }
  return [...keys].sort();
}

/**
 * Resolve denylist for Skills UI: SQLite, normalized to catalog keys;
 * when empty or refreshFromDisk, merge from on-disk config.yaml.
 */
export function resolveEffectiveDisabledSkills(
  profile: string,
  options?: { refreshFromDisk?: boolean },
): Set<string> {
  const catalogKeys = listCatalogSkillKeys();

  const fromDb: string[] =
    profile === "default"
      ? disabledSkillsFromJson(getAgentRoot().disabledSkillsJson)
      : getDisabledSkills(profile);

  const configPath = buildProfileHermesPathBundle(profile).config;
  const useDisk =
    options?.refreshFromDisk === true ||
    (fromDb.length === 0 && existsSync(configPath));

  if (useDisk && existsSync(configPath)) {
    const yaml = readFileSync(configPath, "utf-8");
    return new Set(normalizeDisabledSkillKeys(
      computeEffectiveDisabledFromYaml(yaml, catalogKeys),
      catalogKeys,
    ));
  }

  return new Set(normalizeDisabledSkillKeys(fromDb, catalogKeys));
}
