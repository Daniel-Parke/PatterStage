// ═══════════════════════════════════════════════════════════════
// catalog-seed.ts — Seed professional catalog into SQLite
// ═══════════════════════════════════════════════════════════════

import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

import { ensureDb } from "../db";
import { SERVER_MODULES } from "../modules/server";
import { REPO_ROOT } from "./seed-paths";

import { upsertCatalogTemplate, getCatalogTemplate } from "../catalog-template-repository";
import { upsertSkill, getSkill } from "../skills-repository";
import { upsertToolBundle, getToolBundle } from "../tool-catalog-repository";
import { upsertMemoryFact } from "../memory/memory-catalog-repository";
import {
  countSeededMissionCategories,
  deleteSeededMissionCategories,
  execSeedScript,
  markCatalogSeeded,
  readCatalogSeededFlag,
} from "./seed-repository";
import { PS_DATA_DIR } from "../paths";
import { ensureDir } from "../fs/fs-helpers";

const SKILLS_MANIFEST = join(REPO_ROOT, "data/seed/skills/manifest.json");
const TOOLS_MANIFEST = join(REPO_ROOT, "data/seed/tools/manifest.json");
const MEMORIES_MANIFEST = join(REPO_ROOT, "data/seed/memories/manifest.json");
const TEMPLATE_PACK = join(
  REPO_ROOT,
  "data/seed/template-packs/patterstage-professional-v1.json",
);

type SeedMode = "merge" | "replace";

/** Seed targets a module handles; anything else is core-only catalog work. */
const AGENT_SEED_TARGETS = new Set(["all", "root", "profiles"]);

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

function seedCategories(mode: SeedMode): number {
  const sqlPath = join(REPO_ROOT, "src/lib/db/seeds/001_mission_categories.sql");
  if (!existsSync(sqlPath)) return 0;
  const sql = readFileSync(sqlPath, "utf-8");
  if (mode === "replace") {
    deleteSeededMissionCategories();
  }
  execSeedScript(sql);
  return countSeededMissionCategories() ?? 0;
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
    // The row is core; publishing it so the AGENTIC path can execute it is the
    // module's. Guarded HERE as well as inside the module: this runs on the boot
    // path, and core must not depend on every module remembering to be
    // best-effort. The pre-split code had the same try/catch at this call site.
    for (const m of SERVER_MODULES) {
      try {
        m.publishSkill?.(entry.skillKey);
      } catch {
        /* an absent or broken agent must not fail the seed */
      }
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
  const dir = PS_DATA_DIR;
  ensureDir(dir);
  const state = {
    lastRun: new Date().toISOString(),
    catalogVersion: "patterstage-professional-v1",
    ...result,
  };
  writeFileSync(dir + "/seed-state.json", JSON.stringify(state, null, 2));
}

export function runCatalogSeed(options: SeedTarget): SeedResult {
  ensureDb();
  const mode = options.mode;
  let templates = 0;
  let categories = 0;
  let skills = 0;
  let tools = 0;
  let memories = 0;

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
  if (options.target === "all" || options.target === "templates") {
    templates = seedTemplates(mode, options.templateId);
  }

  // The agent-shaped half: agent_profiles, agent_root, and the write-through to
  // the agent's filesystem. Reached through the composition root so this file
  // never names a module (ADR-0005). A build with no agent module installed seeds
  // the core catalogs and reports zero for the rest, which is correct rather than
  // a failure.
  let root = 0;
  let profiles = 0;
  let pushed = 0;
  for (const m of SERVER_MODULES) {
    let seeded;
    try {
      seeded = m.seedAgentCatalog?.({
        target: AGENT_SEED_TARGETS.has(options.target)
          ? (options.target as "all" | "root" | "profiles")
          : "other",
        slug: options.slug,
        mode,
        confirmOverride: options.confirmOverride,
      });
    } catch (err) {
      // One module failing must not lose the catalogs core already seeded, nor
      // take down boot: ensureCatalogSeededOnce runs this on every start. Logged
      // rather than swallowed, because unlike a missing agent this IS a fault.
      console.warn(`[seed] module ${m.id} failed to seed its catalog:`, err);
      continue;
    }
    if (!seeded) continue;
    root += seeded.root;
    profiles += seeded.profiles;
    pushed += seeded.pushed;
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
    const row = readCatalogSeededFlag();
    if (row) return null;
    const result = runCatalogSeed({ target: "all", mode: "merge" });
    markCatalogSeeded(new Date().toISOString());
    return result;
  } catch {
    return null;
  }
}

export function getSeedState(): Record<string, unknown> | null {
  const path = PS_DATA_DIR + "/seed-state.json";
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// ── What the pack on disk contains ──────────────────────────────

/** The shipped starter set, counted from the files rather than the database. */
export interface ShippedPackCounts {
  catalogVersion: string;
  root: number;
  profiles: number;
  templates: number;
  categories: number;
  skills: number;
  tools: number;
  memories: number;
}

/** Length of an array under `key` in a JSON file, or 0 for anything unreadable. */
function countInManifest(path: string, key: string): number {
  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>;
    const list = parsed[key];
    return Array.isArray(list) ? list.length : 0;
  } catch {
    return 0;
  }
}

/**
 * What the app SHIPS, read from disk only.
 *
 * The Restore page used to count the database, so a fresh install with nothing
 * seeded offered to restore "0 professional agents" and an operator could not
 * tell an empty install from an empty pack (T-0100, D16). This answers the
 * other question: what is in the box.
 *
 * Never throws and never opens the database. A missing file counts 0, because
 * a packaging mistake should read as "nothing to restore here", not as a 500
 * on the page that would tell you about it.
 */
export function readShippedPackCounts(): ShippedPackCounts {
  let catalogVersion = "";
  let templates = 0;
  try {
    const pack = JSON.parse(readFileSync(TEMPLATE_PACK, "utf-8")) as {
      id?: string;
      templates?: unknown[];
    };
    catalogVersion = typeof pack.id === "string" ? pack.id : "";
    templates = Array.isArray(pack.templates) ? pack.templates.length : 0;
  } catch {
    // absent or malformed: nothing to restore from it
  }

  let categories = 0;
  try {
    const sql = readFileSync(join(REPO_ROOT, "src/lib/db/seeds/001_mission_categories.sql"), "utf-8");
    categories = sql.split("ch.cat.").length - 1;
  } catch {
    categories = 0;
  }

  return {
    catalogVersion,
    // One agent root, and it is only there if its config.yaml is.
    root: existsSync(join(REPO_ROOT, "data/seed/agent-root/config.yaml")) ? 1 : 0,
    profiles: countInManifest(join(REPO_ROOT, "data/seed/profiles/manifest.json"), "profiles"),
    templates,
    categories,
    skills: countInManifest(SKILLS_MANIFEST, "skills"),
    tools: countInManifest(TOOLS_MANIFEST, "tools"),
    memories: countInManifest(MEMORIES_MANIFEST, "facts"),
  };
}
