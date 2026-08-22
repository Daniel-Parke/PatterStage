// ═══════════════════════════════════════════════════════════════
// modules/hermes/lib/seed-agent-catalog.ts — the agent-shaped half of the seed
//
// Split out of src/lib/seed/catalog-seed.ts, which had two owners and always
// did: one idempotent "set up my install" operation seeded PatterStage's OWN
// catalogs (mission categories, skills, tool bundles, memory facts, template
// packs) AND the agent's profiles and root files, AND pushed the result to the
// agent's filesystem. Core keeps the first half; this file is the second.
//
// Everything here writes agent_profiles / agent_root -- tables whose content
// columns are a mirror of Hermes files (config.yaml, SOUL.md, AGENTS.md,
// HERMES.md, USER.md, MEMORY.md) -- or pushes those rows to disk. Core reaches it
// through ServerModule.seedAgentCatalog, never by import (ADR-0005).
//
// The seed DATA itself is PatterStage's, not Hermes': data/seed/ ships in this
// repo and its location is resolved by the core helper both halves share.
// ═══════════════════════════════════════════════════════════════

import { existsSync, readFileSync } from "fs";

import { seedPath } from "@/lib/seed/seed-paths";
import { getAgentRoot, updateAgentRoot } from "@/lib/agent-root-repository";

import {
  configYamlToColumnValues,
  extractPreservedSections,
  isEmptyPlatformToolsets,
  platformToolsetsFromJson,
} from "./profile-config-builder";
import { upsertProfile, getProfileBySeedKey } from "./profiles-repository";
import { pushProfileToHermes, pushAllProfiles, pushRootToHermes, pushSkillToHermes } from "./profile-push";

type SeedMode = "merge" | "replace";

/** What core asks this module to seed. Mirrors the core-side SeedTarget subset. */
export interface AgentSeedOptions {
  /** "all" seeds root + profiles; the narrower targets seed one of them. */
  target: "all" | "root" | "profiles" | "other";
  /** Seed only this profile slug. */
  slug?: string;
  mode: SeedMode;
  /** Merge mode may overwrite existing config sections only when true. */
  confirmOverride?: boolean;
}

export interface AgentSeedResult {
  root: number;
  profiles: number;
  /** Rows successfully written through to the agent's filesystem. */
  pushed: number;
}

const PROFILES_MANIFEST = seedPath("profiles", "manifest.json");

interface ProfileManifestEntry {
  slug: string;
  displayName: string;
  description: string;
  personality: string;
  seedKey: string;
}

interface ProfileManifest {
  version: string;
  profiles: ProfileManifestEntry[];
}

function readProfileFiles(slug: string): { soulMd: string; agentsMd: string; configYaml: string } {
  const base = seedPath("profiles", slug);
  const soulPath = base + "/SOUL.md";
  const agentsPath = base + "/AGENTS.md";
  const configPath = base + "/config.yaml";
  return {
    soulMd: existsSync(soulPath) ? readFileSync(soulPath, "utf-8") : "",
    agentsMd: existsSync(agentsPath) ? readFileSync(agentsPath, "utf-8") : "",
    configYaml: existsSync(configPath)
      ? readFileSync(configPath, "utf-8")
      : "skills:\n  disabled: []\nagent:\n  max_turns: 60\n",
  };
}

function readRootSeedFiles(): {
  soulMd: string;
  agentsMd: string;
  frameworkMd: string;
  userMd: string;
  memoryMd: string;
  configYaml: string;
} {
  const base = seedPath("agent-root");
  const read = (path: string): string => (existsSync(path) ? readFileSync(path, "utf-8") : "");
  return {
    soulMd: read(base + "/SOUL.md"),
    agentsMd: read(base + "/AGENTS.md"),
    frameworkMd: read(base + "/HERMES.md"),
    userMd: read(base + "/memories/USER.md"),
    memoryMd: read(base + "/memories/MEMORY.md"),
    configYaml: read(base + "/config.yaml"),
  };
}

function seedRoot(mode: SeedMode, confirmOverride = false): number {
  const root = getAgentRoot();
  const files = readRootSeedFiles();
  const cols = configYamlToColumnValues(files.configYaml);
  const hasExistingContent = Boolean(
    root.soulMd.trim() ||
      root.agentsMd.trim() ||
      root.frameworkMd.trim() ||
      root.configYaml.trim() ||
      root.userMd.trim() ||
      root.memoryMd.trim(),
  );
  if (mode === "merge" && hasExistingContent) {
    const currentToolsets = platformToolsetsFromJson(root.platformToolsetsJson);
    const seedToolsets = platformToolsetsFromJson(cols.platformToolsetsJson);
    if (isEmptyPlatformToolsets(currentToolsets) && !isEmptyPlatformToolsets(seedToolsets)) {
      updateAgentRoot({
        platformToolsetsJson: cols.platformToolsetsJson,
        configYaml: cols.configYaml,
      });
      return 1;
    }
    // Warn about differing preserved sections
    const currentPreserved = extractPreservedSections(root.configYaml);
    const seedPreserved = extractPreservedSections(cols.configYaml);
    const differingKeys = (Object.keys(seedPreserved) as Array<keyof typeof seedPreserved>).filter(
      (k) => JSON.stringify(seedPreserved[k]) !== JSON.stringify(currentPreserved[k]),
    );
    if (differingKeys.length > 0) {
      console.warn(
        `[seed] root: existing config preserved. Differing sections: ${differingKeys.join(", ")}. ` +
          "Pass --confirm-override to apply seed defaults for these sections.",
      );
      if (confirmOverride) {
        updateAgentRoot({
          platformToolsetsJson: cols.platformToolsetsJson,
          configYaml: cols.configYaml,
        });
        return 1;
      }
    }
    return 0;
  }

  updateAgentRoot({
    displayName: "Bob",
    description: "Local Hermes default agent at HERMES_HOME",
    personality: "technical",
    configYaml: cols.configYaml,
    soulMd: files.soulMd,
    agentsMd: files.agentsMd,
    frameworkMd: files.frameworkMd,
    userMd: files.userMd,
    memoryMd: files.memoryMd,
    disabledSkillsJson: cols.disabledSkillsJson,
    platformToolsetsJson: cols.platformToolsetsJson,
  });
  return 1;
}

function seedProfiles(mode: SeedMode, slugFilter?: string): number {
  if (!existsSync(PROFILES_MANIFEST)) {
    console.warn(
      `catalog-seed: missing ${PROFILES_MANIFEST} — run: node scripts/tooling/generate-seed-pack.mjs`,
    );
    return 0;
  }
  const manifest = JSON.parse(readFileSync(PROFILES_MANIFEST, "utf-8")) as ProfileManifest;
  let count = 0;
  for (const entry of manifest.profiles) {
    if (slugFilter && entry.slug !== slugFilter) continue;
    const files = readProfileFiles(entry.slug);
    const cols = configYamlToColumnValues(files.configYaml);
    const existing = getProfileBySeedKey(entry.seedKey);
    if (mode === "merge" && existing) {
      const currentToolsets = platformToolsetsFromJson(existing.platformToolsetsJson);
      const seedToolsets = platformToolsetsFromJson(cols.platformToolsetsJson);
      if (isEmptyPlatformToolsets(currentToolsets) && !isEmptyPlatformToolsets(seedToolsets)) {
        upsertProfile({
          slug: entry.slug,
          displayName: entry.displayName,
          description: entry.description,
          personality: cols.personality || entry.personality,
          configYaml: cols.configYaml,
          soulMd: existing.soulMd || files.soulMd,
          agentsMd: existing.agentsMd || files.agentsMd,
          disabledSkillsJson: cols.disabledSkillsJson,
          platformToolsetsJson: cols.platformToolsetsJson,
          seedKey: entry.seedKey,
        });
        count += 1;
      }
      continue;
    }

    upsertProfile({
      slug: entry.slug,
      displayName: entry.displayName,
      description: entry.description,
      personality: cols.personality || entry.personality,
      configYaml: cols.configYaml,
      soulMd: files.soulMd,
      agentsMd: files.agentsMd,
      disabledSkillsJson: cols.disabledSkillsJson,
      platformToolsetsJson: cols.platformToolsetsJson,
      seedKey: entry.seedKey,
    });
    count += 1;
  }
  return count;
}

/**
 * Seed the agent's own rows and write them through to its filesystem.
 *
 * The push semantics are carried over verbatim from the unsplit version, because
 * they are load-bearing and non-obvious:
 *  - the root pushes only on a `replace` that actually wrote something;
 *  - a profiles seed pushes ONE slug when filtered, else all of them, and in
 *    merge mode only the ones missing on disk;
 *  - a slug supplied against a non-profiles target still pushes that one slug,
 *    which is how `--target root --slug x` repairs a single profile.
 */
export function seedAgentCatalog(options: AgentSeedOptions): AgentSeedResult {
  const { mode, slug } = options;
  const wantsRoot = options.target === "all" || options.target === "root";
  const wantsProfiles = options.target === "all" || options.target === "profiles";

  const root = wantsRoot ? seedRoot(mode, options.confirmOverride) : 0;
  const profiles = wantsProfiles ? seedProfiles(mode, slug) : 0;

  let pushed = 0;
  if (root > 0 && mode === "replace") {
    if (pushRootToHermes().success) pushed += 1;
  }
  if (wantsProfiles) {
    const results =
      slug != null
        ? [pushProfileToHermes(slug)]
        : pushAllProfiles({ onlyMissing: mode === "merge", onlyOutOfSync: false });
    pushed += results.filter((r) => r.success).length;
  } else if (slug) {
    if (pushProfileToHermes(slug).success) pushed += 1;
  }

  return { root, profiles, pushed };
}

/**
 * Publish an already-seeded core skill to the agent so the AGENTIC path can
 * execute it.
 *
 * The `skills` table is core; only the write-through to the agent's global
 * skills directory is this module's. Best-effort by design: Hermes may be absent
 * on a PatterStage-only install, and a missing agent must not fail the seed.
 */
export function publishSkill(skillKey: string): void {
  try {
    pushSkillToHermes(skillKey);
  } catch {
    /* best-effort — the agent may not be installed */
  }
}
