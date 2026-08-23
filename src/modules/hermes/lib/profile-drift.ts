// ═══════════════════════════════════════════════════════════════
// profile-drift.ts: compare disk against database, write nothing
//
// Split out of profile-sync.ts. Every function here reads both sides
// and reports the difference; none of them writes. That is the whole
// contract, and it is why the drift banner can be rendered on any
// page load without side effects.
//
// Two kinds of comparison, deliberately not the same:
//   - config.yaml is compared SEMANTICALLY
//     (`configYamlSemanticallyMatches`, `disabledSkillsMatchJson`),
//     because key order and formatting are not drift.
//   - every other file is compared by content hash, because for those
//     a byte is a byte.
//
// A profile that is not in the database reports `drifted: false` with
// a syncError of "not in database". That is not a fudge: an absent row
// has nothing to drift FROM, and reporting it as drift would make the
// banner permanently red for anything the operator has on disk but has
// not adopted. Skills need no such branch: the only caller walks the
// rows the catalog just returned, so the row always exists.
// ═══════════════════════════════════════════════════════════════

import { existsSync, readFileSync } from "fs";

import { fileHash, contentHash } from "@/lib/fs/fs-helpers";
import { buildHermesPathBundle } from "./paths";
import { getHermesDefaultRoot } from "./profile-paths";
import { getAgentRoot } from "@/lib/agent-root-repository";
import { assembleConfigYamlForProfile, getProfile, listProfiles } from "./profiles-repository";
import {
  configYamlSemanticallyMatches,
  disabledSkillsMatchJson,
} from "./profile-config-builder";
import { listSkills, type SkillRow } from "@/lib/skills-repository";
import { skillFilePath } from "./skills-config";
import {
  assembleRootConfig,
  catalogKeysForPull,
  globalSkillsRoot,
  profileRootForSlug,
} from "./profile-sync-shared";

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

function detectSkillDrift(skill: SkillRow, skillsRoot: string): SkillDriftEntry {
  const path = skillFilePath(skillsRoot, skill.skillKey);
  const disk = fileHash(path);
  const db = contentHash(skill.content);
  return {
    skillKey: skill.skillKey,
    drifted: disk !== db,
    syncError: skill.syncError,
  };
}

function detectAllProfileDrift(): ProfileDriftEntry[] {
  return listProfiles().map((p) => detectProfileDrift(p.slug));
}

export function detectFullDrift(): FullDriftReport {
  // `listSkills()` already returns every row, body included. The previous
  // `detectSkillDrift(s.skillKey)` then re-fetched each of those rows one at a
  // time (1 + N queries for N skills) to read the body it had just discarded.
  // Hand the row straight in, and resolve the skills root once rather than per
  // skill.
  const skillsRoot = globalSkillsRoot();
  return {
    root: detectRootDrift(),
    profiles: detectAllProfileDrift(),
    skills: listSkills().map((s) => detectSkillDrift(s, skillsRoot)),
  };
}
