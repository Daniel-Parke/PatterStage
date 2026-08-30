// ═══════════════════════════════════════════════════════════════
// templates-handlers/shared.ts - the custom-template store and its cache
// ═══════════════════════════════════════════════════════════════
//
// Extracted from the /api/templates route god-file. Custom templates are
// one JSON file each under PATHS.templates; this module owns that layout
// (read, write, id sanitisation, the legacy `skills` normalisation) plus
// the 30-second list cache the GET handler serves from and every mutation
// invalidates. The per-action handlers next to this file hold no disk or
// cache knowledge of their own.

import { writeFileSync, readFileSync, existsSync } from "fs";

import { ensureDir } from "@/lib/fs/fs-helpers";
import { normalizeLocalDirsInput } from "@/lib/fs/local-dir-entry";
import { resolveTemplateCategoryId } from "@/lib/missions/mission-category-repository";
import { PATHS } from "@/lib/paths";
import type { LocalDirEntry } from "@/types/console";
import type { DispatchMode } from "@/lib/dispatch-mode";

export const DATA_DIR = PATHS.templates;

/**
 * The POST body is action-discriminated and each branch validates the
 * fields it reads, so the body itself stays untyped exactly as it was
 * when the route read it via `request.json()`. Declaring the escape
 * hatch once here keeps the per-action handlers free of their own
 * eslint-disable lines.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- body is action-discriminated; per-branch validators narrow the shape
export type TemplateActionBody = any;

// ── Simple in-memory cache (30s TTL) ───────────────────────
let templatesCache: { data: unknown; timestamp: number } | null = null;
const CACHE_TTL_MS = 30_000;

export function getTemplatesCached() {
  const now = Date.now();
  if (templatesCache && now - templatesCache.timestamp < CACHE_TTL_MS) {
    return templatesCache.data;
  }
  return null;
}

export function setTemplatesCache(data: unknown) {
  templatesCache = { data, timestamp: Date.now() };
}

export function invalidateTemplatesCache() {
  templatesCache = null;
}

export function sanitizeTemplateId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "");
}

export function ensureDataDir() {
  ensureDir(DATA_DIR);
}

export interface CustomTemplate {
  id: string;
  name: string;
  icon: string;
  color: string;
  category: string;
  categoryId?: string;
  profile: string;
  description: string;
  instruction: string;
  context: string;
  goals: string[];
  suggestedSkills: string[];
  suggestedToolsets?: string[];
  /**
   * Was `"save" | "now" | "cron"`, missing `queue` and so drifted from
   * DispatchMode. Aliased to the real type now so the two cannot part again.
   */
  dispatchMode: DispatchMode;
  schedule: string;
  /** Hermes CLI model id, e.g. anthropic/claude-sonnet-4 */
  defaultModel?: string;
  /** Hermes CLI --provider */
  defaultProvider?: string;
  localDirs?: LocalDirEntry[];
  references?: string[];
  outputFormat?: string;
  constraints?: string;
  timeoutMinutes?: number;
  createdAt: string;
  updatedAt: string;
}

function mergeSuggestedSkillsFromRaw(raw: Record<string, unknown>): string[] {
  const sug = raw.suggestedSkills;
  if (Array.isArray(sug) && sug.length > 0) {
    return (sug as unknown[]).map((x) => String(x));
  }
  const leg = raw.skills;
  if (Array.isArray(leg)) {
    return (leg as unknown[]).map((x) => String(x));
  }
  return [];
}

/** Response shape for clients: normalise legacy `skills` → `suggestedSkills`. */
export function enrichCustomTemplateFromDisk(
  raw: Record<string, unknown>
): CustomTemplate & { isCustom: true } {
  const suggestedSkills = mergeSuggestedSkillsFromRaw(raw);
  const localDirs = normalizeLocalDirsInput(raw.localDirs);
  const references = Array.isArray(raw.references)
    ? (raw.references as unknown[]).map((x) => String(x))
    : [];
  const timeoutMinutes =
    typeof raw.timeoutMinutes === "number" && Number.isFinite(raw.timeoutMinutes)
      ? raw.timeoutMinutes
      : undefined;

  const categoryId =
    typeof raw.categoryId === "string"
      ? raw.categoryId
      : resolveTemplateCategoryId(
          typeof raw.category === "string" ? raw.category : undefined,
        );
  const out = {
    ...raw,
    suggestedSkills,
    localDirs,
    references,
    timeoutMinutes,
    categoryId: categoryId ?? "general",
    category:
      typeof raw.category === "string" ? raw.category : "Custom",
    isCustom: true as const,
  } as CustomTemplate & { isCustom: true };
  delete (out as unknown as Record<string, unknown>).skills;
  return out;
}

export function loadTemplate(id: string): CustomTemplate | null {
  const path = DATA_DIR + "/" + id + ".json";
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as CustomTemplate;
  } catch {
    return null;
  }
}

export function saveTemplate(template: CustomTemplate) {
  ensureDataDir();
  const path = DATA_DIR + "/" + template.id + ".json";
  const forDisk = { ...template } as Record<string, unknown>;
  delete forDisk.skills;
  writeFileSync(path, JSON.stringify(forDisk, null, 2));
}
