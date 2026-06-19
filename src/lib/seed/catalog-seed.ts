// ═══════════════════════════════════════════════════════════════
// catalog-seed.ts — Seed professional catalog into SQLite
// ═══════════════════════════════════════════════════════════════

import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

import { ensureDb } from "../db";
import { upsertProfile, getProfileBySeedKey } from "../profiles-repository";
import {
  configYamlToColumnValues,
  extractPreservedSections,
  isEmptyPlatformToolsets,
  platformToolsetsFromJson,
} from "../profile-config-builder";
import { upsertCatalogTemplate, getCatalogTemplate } from "../catalog-template-repository";
import { upsertSkill, getSkill } from "../skills-repository";
import { upsertToolBundle, getToolBundle } from "../tool-catalog-repository";
import { upsertMemoryFact } from "../memory-catalog-repository";
import { pushSkillToHermes } from "../hermes-profile-sync";
import { db } from "../db";
import { CH_DATA_DIR } from "../paths";
import { pushProfileToHermes, pushAllProfiles, pushRootToHermes } from "../hermes-profile-sync";
import { getAgentRoot, updateAgentRoot } from "../agent-root-repository";
import { ensureDir } from "../fs-helpers";

function resolveRepoRoot(): string {
  const candidates = [
    join(__dirname, "..", "..", ".."),
    process.cwd(),
  ];
  for (const root of candidates) {
    if (existsSync(join(root, "data/seed/profiles/manifest.json"))) {
      return root;
    }
  }
  return candidates[0];
}

const REPO_ROOT = resolveRepoRoot();
const PROFILES_MANIFEST = join(REPO_ROOT, "data/seed/profiles/manifest.json");
const SKILLS_MANIFEST = join(REPO_ROOT, "data/seed/skills/manifest.json");
const TOOLS_MANIFEST = join(REPO_ROOT, "data/seed/tools/manifest.json");
const MEMORIES_MANIFEST = join(REPO_ROOT, "data/seed/memories/manifest.json");
const TEMPLATE_PACK = join(
  REPO_ROOT,
  "data/seed/template-packs/control-hub-professional-v1.json",
);

export type SeedMode = "merge" | "replace";

export interface SeedTarget {
  target: "all" | "root" | "profiles" | "templates" | "categories" | "skills" | "tools" | "memories";
  slug?: string;
  templateId?: string;
  mode: SeedMode;
  /** When true, merge mode may overwrite existing config sections.
   *  Defaults to false — existing user config is preserved. */
  confirmOverride?: boolean;
}

export interface SeedResult {
  profiles: number;
  root: number;
  templates: number;
  categories: number;
  skills: number;
  tools: number;
  memories: number;
  pushed: number;
}

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

interface TemplatePackEntry {
  id: string;
  seedKey?: string;
  name: string;
  icon: string;
  color: string;
  categoryId: string;
  profile: string;
  description: string;
  instruction: string;
  context: string;
  goals: string[];
  outputFormat: string;
  constraints: string;
  suggestedSkills?: string[];
  suggestedToolsets?: string[];
  localDirs?: string[];
  references?: string[];
  missionTimeMinutes?: number;
  timeoutMinutes: number;
}

interface TemplatePack {
  schemaVersion: string;
  id: string;
  name: string;
  version: string;
  templates: TemplatePackEntry[];
}

function readProfileFiles(slug: string): { soulMd: string; agentsMd: string; configYaml: string } {
  const base = join(REPO_ROOT, "data/seed/profiles", slug);
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
  hermesMd: string;
  userMd: string;
  memoryMd: string;
  configYaml: string;
} {
  const base = join(REPO_ROOT, "data/seed/agent-root");
  const read = (path: string): string => existsSync(path) ? readFileSync(path, "utf-8") : "";
  return {
    soulMd: read(base + "/SOUL.md"),
    agentsMd: read(base + "/AGENTS.md"),
    hermesMd: read(base + "/HERMES.md"),
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
      root.hermesMd.trim() ||
      root.configYaml.trim() ||
      root.userMd.trim() ||
      root.memoryMd.trim(),
  );
  if (mode === "merge" && hasExistingContent) {
    const currentToolsets = platformToolsetsFromJson(root.platformToolsetsJson);
    const seedToolsets = platformToolsetsFromJson(cols.platformToolsetsJson);
    if (
      isEmptyPlatformToolsets(currentToolsets) &&
      !isEmptyPlatformToolsets(seedToolsets)
    ) {
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
    hermesMd: files.hermesMd,
    userMd: files.userMd,
    memoryMd: files.memoryMd,
    disabledSkillsJson: cols.disabledSkillsJson,
    platformToolsetsJson: cols.platformToolsetsJson,
  });
  return 1;
}

function seedCategories(mode: SeedMode): number {
  const sqlPath = join(REPO_ROOT, "src/lib/db/seeds/001_mission_categories.sql");
  if (!existsSync(sqlPath)) return 0;
  const sql = readFileSync(sqlPath, "utf-8");
  if (mode === "replace") {
    db().exec("DELETE FROM mission_categories WHERE seed_key IS NOT NULL");
  }
  db().exec(sql);
  const row = db()
    .prepare("SELECT COUNT(*) AS c FROM mission_categories WHERE seed_key IS NOT NULL")
    .get() as { c: number } | undefined;
  return row?.c ?? 0;
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
      if (
        isEmptyPlatformToolsets(currentToolsets) &&
        !isEmptyPlatformToolsets(seedToolsets)
      ) {
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

interface SkillManifestEntry {
  skillKey: string;
  displayName: string;
  description: string;
  category: string;
}
interface SkillManifest {
  version: string;
  skills: SkillManifestEntry[];
}

/**
 * Seed the canonical "standard" skill pack (source='bundled') so a fresh install
 * has a fair-test default set the user can toggle on/off in benchmarks. Merge
 * mode preserves any existing skill of the same key (user edits win).
 */
function seedSkills(mode: SeedMode): number {
  if (!existsSync(SKILLS_MANIFEST)) return 0;
  const manifest = JSON.parse(readFileSync(SKILLS_MANIFEST, "utf-8")) as SkillManifest;
  let count = 0;
  for (const entry of manifest.skills) {
    if (mode === "merge" && getSkill(entry.skillKey)) continue;
    const contentPath = join(REPO_ROOT, "data/seed/skills", entry.skillKey, "SKILL.md");
    const content = existsSync(contentPath) ? readFileSync(contentPath, "utf-8") : "";
    upsertSkill({
      skillKey: entry.skillKey,
      displayName: entry.displayName,
      description: entry.description,
      category: entry.category,
      content,
      source: "bundled",
    });
    // Push to the Hermes global skills dir so the AGENTIC path can execute it.
    try {
      pushSkillToHermes(entry.skillKey);
    } catch {
      // best-effort — Hermes may be absent on a CH-only setup
    }
    count += 1;
  }
  return count;
}

interface ToolManifestEntry {
  toolKey: string;
  displayName: string;
  description: string;
  category: string;
  toolsetIds: string[];
}

/** Seed the canonical default TOOL bundles (source='bundled'); merge preserves edits. */
function seedTools(mode: SeedMode): number {
  if (!existsSync(TOOLS_MANIFEST)) return 0;
  try {
    const manifest = JSON.parse(readFileSync(TOOLS_MANIFEST, "utf-8")) as { version: string; tools: ToolManifestEntry[] };
    let count = 0;
    for (const entry of manifest.tools) {
      const seedKey = `ch.tool.${entry.toolKey}`;
      if (mode === "merge" && getToolBundle(entry.toolKey)) continue;
      upsertToolBundle({
        toolKey: entry.toolKey,
        displayName: entry.displayName,
        description: entry.description,
        toolsetIds: entry.toolsetIds,
        category: entry.category,
        source: "bundled",
        seedKey,
      });
      count += 1;
    }
    return count;
  } catch {
    // tool_catalog may not exist yet (pre-v16 / minimal schema) — skip gracefully.
    return 0;
  }
}

interface MemoryManifestEntry {
  seedKey: string;
  category: string;
  content: string;
}

/** Seed the canonical default MEMORY facts (source='bundled'); idempotent by seed_key. */
function seedMemories(mode: SeedMode): number {
  if (!existsSync(MEMORIES_MANIFEST)) return 0;
  void mode; // accepted for signature parity; upsert is idempotent by seed_key
  try {
    const manifest = JSON.parse(readFileSync(MEMORIES_MANIFEST, "utf-8")) as { version: string; facts: MemoryManifestEntry[] };
    let count = 0;
    for (const fact of manifest.facts) {
      upsertMemoryFact({
        content: fact.content,
        category: fact.category,
        source: "bundled",
        seedKey: fact.seedKey,
      });
      count += 1;
    }
    return count;
  } catch {
    // seed_memory_facts may not exist yet (pre-v16 / minimal schema) — skip.
    return 0;
  }
}

function seedTemplates(mode: SeedMode, idFilter?: string): number {
  if (!existsSync(TEMPLATE_PACK)) {
    console.warn(`catalog-seed: missing ${TEMPLATE_PACK}`);
    return 0;
  }
  const pack = JSON.parse(readFileSync(TEMPLATE_PACK, "utf-8")) as TemplatePack;
  let count = 0;
  for (const t of pack.templates) {
    if (idFilter && t.id !== idFilter) continue;
    const seedKey = t.seedKey ?? `ch.tpl.${t.id}`;
    if (mode === "merge") {
      const existing = getCatalogTemplate(t.id);
      if (existing?.seedKey) {
        const seedToolsets = t.suggestedToolsets ?? [];
        const currentToolsets = existing.suggestedToolsets ?? [];
        if (currentToolsets.length === 0 && seedToolsets.length > 0) {
          upsertCatalogTemplate({
            ...existing,
            suggestedToolsets: seedToolsets,
          });
          count += 1;
        }
        continue;
      }
    }

    upsertCatalogTemplate({
      id: t.id,
      seedKey,
      name: t.name,
      icon: t.icon,
      color: t.color,
      categoryId: t.categoryId,
      profileSlug: t.profile,
      description: t.description,
      instruction: t.instruction,
      context: t.context,
      goals: t.goals,
      outputFormat: t.outputFormat,
      constraints: t.constraints,
      suggestedSkills: t.suggestedSkills ?? [],
      suggestedToolsets: t.suggestedToolsets ?? [],
      localDirs: t.localDirs ?? [],
      references: t.references ?? [],
      missionTimeMinutes: t.missionTimeMinutes ?? null,
      timeoutMinutes: t.timeoutMinutes,
    });
    count += 1;
  }
  return count;
}

function writeSeedState(result: SeedResult): void {
  const dir = CH_DATA_DIR;
  ensureDir(dir);
  const state = {
    lastRun: new Date().toISOString(),
    catalogVersion: "control-hub-professional-v1",
    ...result,
  };
  writeFileSync(dir + "/seed-state.json", JSON.stringify(state, null, 2));
}

export function runCatalogSeed(options: SeedTarget): SeedResult {
  ensureDb();
  const mode = options.mode;
  let profiles = 0;
  let root = 0;
  let templates = 0;
  let categories = 0;
  let skills = 0;
  let tools = 0;
  let memories = 0;

  if (options.target === "all" || options.target === "root") {
    root = seedRoot(mode, options.confirmOverride);
  }
  if (options.target === "all" || options.target === "categories") {
    categories = seedCategories(mode);
  }
  if (options.target === "all" || options.target === "skills") {
    skills = seedSkills(mode);
  }
  if (options.target === "all" || options.target === "tools") {
    tools = seedTools(mode);
  }
  if (options.target === "all" || options.target === "memories") {
    memories = seedMemories(mode);
  }
  if (options.target === "all" || options.target === "profiles") {
    profiles = seedProfiles(mode, options.slug);
  }
  if (options.target === "all" || options.target === "templates") {
    templates = seedTemplates(mode, options.templateId);
  }

  let pushed = 0;
  if (root > 0 && mode === "replace") {
    const r = pushRootToHermes();
    if (r.success) pushed += 1;
  }
  if (options.target === "all" || options.target === "profiles") {
    const pushResults =
      options.slug != null
        ? [pushProfileToHermes(options.slug)]
        : pushAllProfiles({ onlyMissing: mode === "merge", onlyOutOfSync: false });
    pushed += pushResults.filter((r) => r.success).length;
  } else if (options.slug) {
    const r = pushProfileToHermes(options.slug);
    if (r.success) pushed = 1;
  }

  const result: SeedResult = { root, profiles, templates, categories, skills, tools, memories, pushed };
  writeSeedState(result);
  return result;
}

/**
 * Idempotent one-time boot seed so a fresh DEPLOY (Docker / any non-installer
 * start) has the full catalog — professional profiles, the Baseline agent, the
 * bundled skill pack (+ Hermes push), tool bundles, and memory facts — without
 * the operator running the installer's seed step. Gated by a `meta` flag so it
 * runs once. Best-effort: never throws into boot.
 */
export function ensureCatalogSeededOnce(): SeedResult | null {
  try {
    ensureDb();
    const row = db().prepare("SELECT value FROM meta WHERE key = 'catalog_seeded'").get() as
      | { value: string }
      | undefined;
    if (row) return null;
    const result = runCatalogSeed({ target: "all", mode: "merge" });
    db()
      .prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('catalog_seeded', ?)")
      .run(new Date().toISOString());
    return result;
  } catch {
    return null;
  }
}

export function getSeedState(): Record<string, unknown> | null {
  const path = CH_DATA_DIR + "/seed-state.json";
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}
