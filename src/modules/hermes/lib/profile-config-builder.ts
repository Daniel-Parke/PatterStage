// ═══════════════════════════════════════════════════════════════
// profile-config-builder.ts — Merge DB fields ↔ Hermes config.yaml
// ═══════════════════════════════════════════════════════════════

import * as yaml from "js-yaml";

import {
  computeEffectiveDisabledFromYaml,
  normalizeDisabledSkillKeys,
  parseSkillsDisabledFromYaml,
} from "./skills-config";
import { normalizePlatformToolsets } from "./toolset-normalize";
import { dumpYamlConfig } from "@/lib/yaml-config";
import { parseStringArrayOrEmpty } from "@/lib/db/parse-json";

export type PlatformToolsets = Record<string, string[]>;

/** Top-level config.yaml keys managed outside skills/platform_toolsets. */
const PRESERVED_TOP_LEVEL_KEYS = [
  "model",
  "auxiliary",
  "fallback_providers",
  "memory",
  "plugins",
  "terminal",
  "agent",
] as const;

export type PreservedTopLevelKey = (typeof PRESERVED_TOP_LEVEL_KEYS)[number];

export interface ProfileConfigParts {
  personality: string;
  disabledSkills: string[];
  platformDisabledSkills: Record<string, string[]>;
  platformToolsets: PlatformToolsets;
  /**
   * EVERY top-level key except the managed ones (skills, platform_toolsets,
   * legacy toolsets) — model, auxiliary, memory, and anything Hermes adds
   * later, preserved as parsed objects in original insertion order.
   *
   * This used to be split between a fixed seven-key record and raw
   * `extraYamlLines` text. The split was the corruption: the line walker
   * skipped only each preserved section's HEADER, so the children leaked into
   * the raw lines while the section was ALSO captured structurally, and the
   * rebuild emitted both — duplicate mapping keys, orphaned indents, months of
   * .broken backups (T-0086, round-6 finding 9).
   */
  preservedSections: Record<string, unknown>;
  /**
   * The children of `skills` PatterStage does not manage — today
   * `creation_nudge_interval` (the Skills section's only field) and
   * `external_dirs`. Optional so the hand-built parts literals elsewhere still
   * typecheck; every one of them forwards it.
   *
   * Deliberately NOT part of `preservedSections`: carried there, the file's raw
   * `disabled` list would ride along and overwrite the database's managed one,
   * which is the opposite of what the round-trip contract says wins (T-0100,
   * D76).
   */
  skillsExtras?: Record<string, unknown>;
  /**
   * Set when the content did not parse as a YAML mapping. Deliberately a FACT
   * rather than a throw: drift detection renders a banner off these parts and
   * must not 500 on a poisoned row. The functions that would REBUILD from the
   * parts are the ones that throw — rebuilding from a failed parse is exactly
   * the silent preserved-section drop that compounded into data loss.
   */
  parseError?: string;
}

/** Extract model/auxiliary/agent/etc. from full config text. */
export function extractPreservedSections(content: string): Partial<Record<PreservedTopLevelKey, unknown>> {
  if (!content.trim()) return {};
  try {
    const doc = yaml.load(content) as Record<string, unknown> | null;
    if (!doc || typeof doc !== "object" || Array.isArray(doc)) return {};
    const out: Partial<Record<PreservedTopLevelKey, unknown>> = {};
    for (const key of PRESERVED_TOP_LEVEL_KEYS) {
      if (doc[key] !== undefined) {
        out[key] = doc[key];
      }
    }
    return out;
  } catch {
    return {};
  }
}




function parseJsonToolsets(raw: string): PlatformToolsets {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: PlatformToolsets = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (Array.isArray(v)) {
        out[k] = v.filter((x): x is string => typeof x === "string");
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function serializeJsonArray(items: string[]): string {
  return JSON.stringify([...new Set(items)].sort());
}

export function serializeJsonToolsets(toolsets: PlatformToolsets): string {
  const sorted: PlatformToolsets = {};
  for (const key of Object.keys(toolsets).sort()) {
    sorted[key] = [...new Set(toolsets[key])].sort();
  }
  return JSON.stringify(sorted);
}

/** Extract managed sections from existing config.yaml text. */
/** Top-level keys PatterStage manages; everything else is preserved verbatim. */
const MANAGED_TOP_LEVEL_KEYS = new Set(["skills", "platform_toolsets", "toolsets"]);

/** First line of a YAML error, path attached — never the file body (secrets). */
function firstLineOf(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.split(/\r?\n/)[0].trim();
}

function coerceToolsets(raw: unknown): PlatformToolsets {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: PlatformToolsets = {};
  for (const [plat, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(value)) continue;
    out[plat] = value.filter((t): t is string => typeof t === "string" && t.trim().length > 0);
  }
  return out;
}

/**
 * Parse a config.yaml into managed parts + everything else.
 *
 * A REAL parse, not a line walker. The predecessor tracked block state by hand
 * and got all three of its state machines wrong: preserved-section children
 * leaked into raw text (emitted twice on rebuild), the platform_toolsets
 * scanner swallowed every following `key:` section as a phantom platform
 * (order-dependent — why the corruption looked intermittent), and `inAgent`
 * turned itself off on the same header line that turned it on, so
 * `agent.personality` was NEVER read from a top-level agent block. yaml.load
 * answers all three questions correctly and for free (T-0086).
 *
 * Never throws. A failed parse sets `parseError` and returns defaults, because
 * the drift banner renders off these parts and must not crash on a poisoned
 * row. Skills stay delegated to the scoped text parsers in skills-config.ts:
 * they carry the `enabled:` allowlist semantics, are used independently against
 * raw strings, and were never part of the defect.
 */
export function parseConfigYaml(content: string): ProfileConfigParts {
  const defaults: ProfileConfigParts = {
    personality: "technical",
    disabledSkills: [],
    platformDisabledSkills: {},
    platformToolsets: {},
    preservedSections: {},
  };
  if (!content.trim()) return defaults;

  let doc: unknown;
  try {
    doc = yaml.load(content);
  } catch (err) {
    return { ...defaults, parseError: firstLineOf(err) };
  }
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
    return { ...defaults, parseError: "config.yaml root is not a mapping" };
  }
  const record = doc as Record<string, unknown>;

  const skillsParsed = parseSkillsDisabledFromYaml(content);
  const platformDisabledSkills: Record<string, string[]> = {};
  for (const [platform, values] of Object.entries(skillsParsed.platformDisabled)) {
    platformDisabledSkills[platform] = [...values].sort();
  }

  const agent = record.agent;
  const personality =
    agent && typeof agent === "object" && !Array.isArray(agent) &&
    typeof (agent as Record<string, unknown>).personality === "string" &&
    ((agent as Record<string, unknown>).personality as string).trim()
      ? ((agent as Record<string, unknown>).personality as string).trim()
      : "technical";

  const preservedSections: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (MANAGED_TOP_LEVEL_KEYS.has(key)) continue;
    preservedSections[key] = value;
  }

  return {
    personality,
    disabledSkills: [...skillsParsed.disabledNames].sort(),
    platformDisabledSkills,
    platformToolsets: coerceToolsets(record.platform_toolsets),
    preservedSections,
    skillsExtras: extractSkillsExtras(record.skills),
  };
}

/** The managed children of `skills`; every other child is the operator's. */
const MANAGED_SKILLS_KEYS = new Set(["disabled", "platform_disabled", "enabled"]);

/**
 * The `skills` children a rebuild must not eat.
 *
 * `skills` is a managed top-level key, so the whole block was dropped and
 * rewritten from the database — taking `creation_nudge_interval` with it, even
 * though that is a field the Settings page offers to edit (T-0100, D76).
 */
function extractSkillsExtras(raw: unknown): Record<string, unknown> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (MANAGED_SKILLS_KEYS.has(key)) continue;
    out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Assemble full config.yaml from DB-backed parts. */
export function buildConfigYaml(parts: ProfileConfigParts): string {
  // ONE object, ONE dump. A yaml.dump of a single plain object is structurally
  // incapable of emitting a duplicate mapping key or an orphaned indent — the
  // two corruption shapes the old two-source concatenation produced (T-0086).
  //
  // Section order is deliberate and fixed: the managed blocks first (matching
  // every file this builder has ever written, so no gratuitous churn on
  // healthy installs), then the seven historically-preserved keys in their
  // long-standing order, then anything else in the order the source file had.
  const doc: Record<string, unknown> = {};

  const skills: Record<string, unknown> = {
    // Extras first, managed keys after: the database's disabled list wins over
    // whatever the file happened to carry, and the operator's own siblings ride
    // along instead of being eaten by the rebuild.
    ...(parts.skillsExtras ?? {}),
    disabled: [...parts.disabledSkills].sort(),
  };
  const platforms = Object.keys(parts.platformDisabledSkills).sort();
  if (platforms.length > 0) {
    const platformDisabled: Record<string, string[]> = {};
    for (const platform of platforms) {
      platformDisabled[platform] = [...new Set(parts.platformDisabledSkills[platform])].sort();
    }
    skills.platform_disabled = platformDisabled;
  }
  doc.skills = skills;

  const toolsetKeys = Object.keys(parts.platformToolsets).sort();
  if (toolsetKeys.length > 0) {
    const toolsets: PlatformToolsets = {};
    for (const plat of toolsetKeys) toolsets[plat] = parts.platformToolsets[plat];
    doc.platform_toolsets = toolsets;
  }

  const preserved = parts.preservedSections ?? {};
  const emitPreserved = (key: string, value: unknown) => {
    if (key === "agent" && value !== null && typeof value === "object" && !Array.isArray(value)) {
      // Personality lives inside the agent block — but only when an agent
      // block EXISTS. Inventing one on a personality-less config would change
      // the file's key set and wake drift on every such install.
      doc[key] = { ...(value as Record<string, unknown>), personality: parts.personality };
      return;
    }
    doc[key] = value;
  };
  for (const key of PRESERVED_TOP_LEVEL_KEYS) {
    if (preserved[key] !== undefined) emitPreserved(key, preserved[key]);
  }
  for (const [key, value] of Object.entries(preserved)) {
    if ((PRESERVED_TOP_LEVEL_KEYS as readonly string[]).includes(key)) continue;
    emitPreserved(key, value);
  }

  return dumpYamlConfig(doc);
}

/** Pull: parse yaml into column-friendly values. */
export function configYamlToColumnValues(
  content: string,
  catalogKeys?: readonly string[],
): {
  personality: string;
  disabledSkillsJson: string;
  platformToolsetsJson: string;
  configYaml: string;
} {
  const parts = parseConfigYaml(content);
  if (parts.parseError) {
    // Rebuilding from a failed parse is how one corrupt write became a
    // permanently poisoned row: the old path silently dropped every preserved
    // section and stored the remainder as if it were the whole config. The
    // pull/push/seed callers catch this and surface it as a sync error.
    throw new Error(
      `config.yaml did not parse (${parts.parseError}) — refusing to rebuild from a corrupt source`,
    );
  }
  if (catalogKeys && catalogKeys.length > 0) {
    parts.disabledSkills = computeEffectiveDisabledFromYaml(content, catalogKeys);
  }
  const rebuilt = buildConfigYaml(parts);
  return {
    personality: parts.personality,
    disabledSkillsJson: serializeJsonArray(parts.disabledSkills),
    platformToolsetsJson: serializeJsonToolsets(
      normalizePlatformToolsets(parts.platformToolsets),
    ),
    configYaml: rebuilt,
  };
}

export function disabledSkillsFromJson(raw: string): string[] {
  return parseStringArrayOrEmpty(raw);
}

export function platformToolsetsFromJson(raw: string): PlatformToolsets {
  return parseJsonToolsets(raw);
}

/** Validate API/body input and return normalized platform toolsets. */
export function normalizePlatformToolsetsFromInput(raw: unknown): PlatformToolsets {
  if (raw === null || raw === undefined) {
    return {};
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("platformToolsets must be an object");
  }
  const out: PlatformToolsets = {};
  for (const [platform, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof platform !== "string" || !platform.trim()) continue;
    if (!Array.isArray(value)) continue;
    const list = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
    if (list.length > 0) {
      out[platform] = list;
    }
  }
  return normalizePlatformToolsets(out);
}

export function isEmptyPlatformToolsets(toolsets: PlatformToolsets): boolean {
  return Object.keys(toolsets).length === 0;
}

export type PlatformToolsetsSource = "database" | "config_yaml" | "seed_pack";

/** Prefer SQLite JSON; fall back to parsed config.yaml, then seed pack on disk. */
export function resolvePlatformToolsets(
  platformToolsetsJson: string,
  configYaml: string,
  seedFallback?: PlatformToolsets,
): { toolsets: PlatformToolsets; source: PlatformToolsetsSource } {
  const fromDb = platformToolsetsFromJson(platformToolsetsJson);
  if (!isEmptyPlatformToolsets(fromDb)) {
    return { toolsets: fromDb, source: "database" };
  }

  const fromYaml = parseConfigYaml(configYaml).platformToolsets;
  if (!isEmptyPlatformToolsets(fromYaml)) {
    return { toolsets: fromYaml, source: "config_yaml" };
  }

  if (seedFallback && !isEmptyPlatformToolsets(seedFallback)) {
    return { toolsets: seedFallback, source: "seed_pack" };
  }

  return { toolsets: {}, source: "database" };
}

/**
 * Key order and YAML formatting are not policy, so they must not read as
 * drift. Sorting every mapping recursively makes two files that say the same
 * thing serialise to the same string.
 */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) out[key] = canonical(source[key]);
    return out;
  }
  return value;
}

/**
 * `agent.personality` is compared as `personality` and injected by the
 * builder, so counting it again here would report drift on every install with
 * an agent block and no personality line.
 */
function stripPersonality(preserved: Record<string, unknown>): Record<string, unknown> {
  const agent = preserved.agent;
  if (!agent || typeof agent !== "object" || Array.isArray(agent)) return preserved;
  const rest = { ...(agent as Record<string, unknown>) };
  delete rest.personality;
  return { ...preserved, agent: rest };
}

function partsForSemanticCompare(parts: ProfileConfigParts): string {
  const platformDisabled: Record<string, string[]> = {};
  for (const [platform, values] of Object.entries(parts.platformDisabledSkills)) {
    platformDisabled[platform] = [...values].sort();
  }
  const payload = {
    personality: parts.personality,
    disabledSkills: [...parts.disabledSkills].sort(),
    platformDisabledSkills: platformDisabled,
    platformToolsets: normalizePlatformToolsets(parts.platformToolsets),
    // Every non-managed section. Left out, a Settings save was invisible to
    // the drift detector right up to the push that erased it (T-0100, D76).
    preserved: canonical(stripPersonality(parts.preservedSections)),
  };
  return JSON.stringify(payload);
}

/** Compare config policy (not raw yaml bytes). */
export function configYamlSemanticallyMatches(
  diskContent: string,
  assembledContent: string,
  catalogKeys?: readonly string[],
): boolean {
  const diskParts = parseConfigYaml(diskContent);
  const assembledParts = parseConfigYaml(assembledContent);
  // An unparseable side IS drift, honestly — the alternative is comparing a
  // defaults object against real policy and calling them equal.
  if (diskParts.parseError || assembledParts.parseError) return false;
  if (catalogKeys && catalogKeys.length > 0) {
    diskParts.disabledSkills = computeEffectiveDisabledFromYaml(diskContent, catalogKeys);
    assembledParts.disabledSkills = computeEffectiveDisabledFromYaml(
      assembledContent,
      catalogKeys,
    );
  }
  return partsForSemanticCompare(diskParts) === partsForSemanticCompare(assembledParts);
}

/** Compare disabled lists for drift (ignores yaml formatting). */
export function disabledSkillsMatchJson(
  yamlContent: string,
  disabledJson: string,
  catalogKeys?: readonly string[],
): boolean {
  const fromDb = disabledSkillsFromJson(disabledJson);
  let fromYaml = parseConfigYaml(yamlContent).disabledSkills;
  if (catalogKeys && catalogKeys.length > 0) {
    fromYaml = computeEffectiveDisabledFromYaml(yamlContent, catalogKeys);
    const normalizedDb = normalizeDisabledSkillKeys(fromDb, catalogKeys);
    if (fromYaml.length !== normalizedDb.length) return false;
    const a = [...fromYaml].sort();
    const b = [...normalizedDb].sort();
    return a.every((v, i) => v === b[i]);
  }
  if (fromYaml.length !== fromDb.length) return false;
  const a = [...fromYaml].sort();
  const b = [...fromDb].sort();
  return a.every((v, i) => v === b[i]);
}
