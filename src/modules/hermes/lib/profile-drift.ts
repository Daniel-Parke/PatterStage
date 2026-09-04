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
//
// The mirror of that rule, and for the same reason: a file that is not
// on DISK is not drift either (`fileDiffers`, T-0041). Drift here means
// two versions of one file disagree. A file with no version on disk has
// nothing to disagree with, and the sole consumer of `drifted` is the
// banner, whose whole promise is that Push or Pull will clear it.
//
// It could not. `pullProfileFromHermes` writes `soulMd`, `agentsMd`,
// `userMd` and `memoryMd` only when the file exists, so an absent file
// left the column untouched, while `fileHash` returned null and
// `contentHash(profile.userMd || "# User\n")` returned a real digest.
// Null is never a digest, so a profile with no memories/USER.md was
// drifted for ever and no pull could clear it. Only Push could, which
// is why the banner's only CTA reads "Push all to Hermes". The operator
// saw it directly: a "Pull all" that visibly worked, a profile's skills
// going 183 to 218, and a banner that did not move.
//
// So is an absent file silent, or is it a different kind of drift worth
// naming? Silent, and the argument is that it was never a signal to
// begin with. Nobody designed "missing shows as drift"; it fell out of
// `null !== hash`, it was indistinguishable from a real difference in
// the one field the banner renders, and being indistinguishable is
// precisely what made the real signal unreadable during that QA pass.
// Deleting it raises the information content of the banner rather than
// lowering it. "Absent on disk" IS a real and actionable fact, and it
// is worth naming one day, but naming it honestly means a banner with
// a second state and a second CTA (only Push can materialise a file),
// which is a UI decision with a UI owner, and it is the same larger
// design call as teaching Pull to create missing files. Both are out of
// scope here and are recorded on T-0041 as follow-up rather than
// smuggled in behind a bug fix.
//
// config.yaml is not an exception to this rule, it is the boundary of
// it: it keeps an explicit `else if` that DOES report drift when the
// file is missing and the assembled config is non-empty. Note that the
// two comparisons are not symmetrical, and that is deliberate.
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

/**
 * True when `path` is on disk AND its bytes differ from `dbContent`.
 *
 * Both halves are load-bearing and they fail in opposite directions, so
 * the pair lives here once rather than being spelled out at each of the
 * eight call sites. Drop the `existsSync` and every absent file drifts
 * for ever, because `fileHash` returns null and null never equals a
 * digest. Drop the hash comparison and drift is disabled outright while
 * every "a missing file is not drift" test still passes.
 */
function fileDiffers(path: string, dbContent: string): boolean {
  return existsSync(path) && fileHash(path) !== contentHash(dbContent);
}

export function detectProfileDrift(slug: string): ProfileDriftEntry {
  const profile = getProfile(slug);
  if (!profile) {
    return { slug, drifted: false, fields: [], syncError: "not in database" };
  }

  const bundle = buildHermesPathBundle(profileRootForSlug(slug));
  const fields: string[] = [];
  // A row whose stored config no longer parses cannot be assembled — and the
  // drift banner is precisely where an operator learns that. Report it AS
  // drift with the reason, never 500 the page that explains it (T-0086).
  let expectedConfig: string;
  try {
    expectedConfig = assembleConfigYamlForProfile(profile);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return { slug, drifted: true, fields: ["config.yaml"], syncError: reason };
  }
  const catalogKeys = catalogKeysForPull();

  if (existsSync(bundle.config)) {
    const diskConfig = readFileSync(bundle.config, "utf-8");
    if (!configYamlSemanticallyMatches(diskConfig, expectedConfig, catalogKeys)) {
      fields.push("config.yaml");
    }
  } else if (expectedConfig.trim().length > 0) {
    fields.push("config.yaml");
  }
  if (fileDiffers(bundle.soul, profile.soulMd)) fields.push("SOUL.md");
  if (fileDiffers(bundle.agents, profile.agentsMd)) fields.push("AGENTS.md");
  if (fileDiffers(bundle.userMemory, profile.userMd || "# User\n")) fields.push("USER.md");
  if (fileDiffers(bundle.agentMemory, profile.memoryMd || "# Memory\n")) {
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
  let expectedConfig: string;
  try {
    expectedConfig = assembleRootConfig(row);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return { drifted: true, fields: ["config.yaml"], syncError: reason };
  }
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
  if (fileDiffers(bundle.soul, row.soulMd)) fields.push("SOUL.md");
  if (fileDiffers(bundle.agents, row.agentsMd)) fields.push("AGENTS.md");
  if (fileDiffers(bundle.hermes, row.frameworkMd)) fields.push("HERMES.md");
  if (fileDiffers(bundle.userMemory, row.userMd || "# User\n")) fields.push("USER.md");
  if (fileDiffers(bundle.agentMemory, row.memoryMd || "# Memory\n")) {
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
