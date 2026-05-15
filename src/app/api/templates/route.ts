// ═══════════════════════════════════════════════════════════════
// Custom Templates API — CRUD for user-created mission templates
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from "fs";
import { parseTemplatePackManifestV1 } from "@/lib/schema";
import { zodErrorResponse } from "@/lib/api-schemas";
import { logApiError } from "@/lib/api-logger";
import { PATHS } from "@/lib/paths";
import { requireMcApiKey, requireNotReadOnly } from "@/lib/api-auth";
import { TEMPLATES } from "@/lib/mission-helpers";
import type { LocalDirEntry } from "@/types/hermes";
import { normalizeLocalDirsInput } from "@/lib/local-dir-entry";

const DATA_DIR = PATHS.templates;

// ── Simple in-memory cache (30s TTL) ───────────────────────
let templatesCache: { data: unknown; timestamp: number } | null = null;
const CACHE_TTL_MS = 30_000;

function getTemplatesCached() {
  const now = Date.now();
  if (templatesCache && now - templatesCache.timestamp < CACHE_TTL_MS) {
    return templatesCache.data;
  }
  return null;
}

function setTemplatesCache(data: unknown) {
  templatesCache = { data, timestamp: Date.now() };
}

function invalidateTemplatesCache() {
  templatesCache = null;
}

function sanitizeTemplateId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "");
}

function ensureDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

interface CustomTemplate {
  id: string;
  name: string;
  icon: string;
  color: string;
  category: string;
  profile: string;
  description: string;
  instruction: string;
  context: string;
  goals: string[];
  suggestedSkills: string[];
  dispatchMode: "save" | "now" | "cron";
  schedule: string;
  /** Hermes CLI model id, e.g. anthropic/claude-sonnet-4 */
  defaultModel?: string;
  /** Hermes CLI --provider */
  defaultProvider?: string;
  localDirs?: LocalDirEntry[];
  references?: string[];
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
function enrichCustomTemplateFromDisk(
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

  const out = {
    ...raw,
    suggestedSkills,
    localDirs,
    references,
    timeoutMinutes,
    isCustom: true as const,
  } as CustomTemplate & { isCustom: true };
  delete (out as unknown as Record<string, unknown>).skills;
  return out;
}

function loadTemplate(id: string): CustomTemplate | null {
  const path = DATA_DIR + "/" + id + ".json";
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as CustomTemplate;
  } catch {
    return null;
  }
}

function saveTemplate(template: CustomTemplate) {
  ensureDir();
  const path = DATA_DIR + "/" + template.id + ".json";
  const forDisk = { ...template } as Record<string, unknown>;
  delete forDisk.skills;
  writeFileSync(path, JSON.stringify(forDisk, null, 2));
}

export async function GET() {
  try {
    // Return cached result if fresh
    const cached = getTemplatesCached();
    if (cached) {
      return NextResponse.json(cached);
    }

    ensureDir();
    const files = readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"));
    const customTemplates: (CustomTemplate & { isCustom: true })[] = [];

    for (const file of files) {
      try {
        const content = readFileSync(DATA_DIR + "/" + file, "utf-8");
        const raw = JSON.parse(content) as Record<string, unknown>;
        customTemplates.push(enrichCustomTemplateFromDisk(raw));
      } catch {
        // skip bad file
      }
    }

    customTemplates.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const builtInTemplates = TEMPLATES.map((t) => ({
      id: t.id,
      name: t.name,
      icon: t.icon,
      color: t.color,
      category: t.category,
      profile: t.profile,
      description: t.description,
      instruction: t.instruction,
      context: t.context,
      goals: t.goals,
      suggestedSkills: t.suggestedSkills,
      dispatchMode: "now" as const,
      schedule: "every 5m",
      defaultModel: t.defaultModel,
      defaultProvider: t.defaultProvider,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
      isCustom: false as const,
    }));

    const templates = [...customTemplates, ...builtInTemplates];
    const response = { data: { templates, total: templates.length } };

    // Cache the response
    setTemplatesCache(response);

    return NextResponse.json(response);
  } catch (err) {
    logApiError("GET /api/templates", "listing templates", err);
    return NextResponse.json({ error: "Failed to list templates" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const ro = requireNotReadOnly();
  if (ro) return ro;
  const auth = requireMcApiKey(request);
  if (auth) return auth;

  try {
    const body = await request.json();
    const { action } = body;

    if (action === "create") {
      const id = "ct_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 4);
      const now = new Date().toISOString();

      const suggestedSkills =
        Array.isArray(body.suggestedSkills) && body.suggestedSkills.length > 0
          ? body.suggestedSkills
          : Array.isArray(body.skills)
            ? body.skills
            : [];

      const template: CustomTemplate = {
        id,
        name: body.name || "Untitled Template",
        icon: body.icon || "Zap",
        color: body.color || "cyan",
        category: body.category || "Custom",
        profile: typeof body.profile === "string" ? body.profile : "",
        description: body.description || "",
        instruction: body.instruction || "",
        context: body.context || "",
        goals: body.goals || [],
        suggestedSkills,
        dispatchMode: body.dispatchMode || "now",
        schedule: body.schedule || "every 5m",
        defaultModel:
          typeof body.defaultModel === "string" && body.defaultModel.trim() !== ""
            ? body.defaultModel.trim()
            : undefined,
        defaultProvider:
          typeof body.defaultProvider === "string" && body.defaultProvider.trim() !== ""
            ? body.defaultProvider.trim()
            : undefined,
        localDirs: normalizeLocalDirsInput(body.localDirs ?? []),
        references: Array.isArray(body.references)
          ? (body.references as unknown[]).map((x) => String(x))
          : [],
        timeoutMinutes:
          typeof body.timeoutMinutes === "number" && Number.isFinite(body.timeoutMinutes)
            ? body.timeoutMinutes
            : undefined,
        createdAt: now,
        updatedAt: now,
      };

      saveTemplate(template);
      invalidateTemplatesCache();
      return NextResponse.json({ data: enrichCustomTemplateFromDisk(template as unknown as Record<string, unknown>) });
    }

    if (action === "update") {
      const { templateId } = body;
      const sanitizedId = sanitizeTemplateId(templateId);
      const template = loadTemplate(sanitizedId);
      if (!template) {
        return NextResponse.json({ error: "Template not found" }, { status: 404 });
      }

      if (body.name !== undefined) template.name = body.name;
      if (body.icon !== undefined) template.icon = body.icon;
      if (body.color !== undefined) template.color = body.color;
      if (body.category !== undefined) template.category = body.category;
      if (body.profile !== undefined) template.profile = body.profile;
      if (body.description !== undefined) template.description = body.description;
      if (body.instruction !== undefined) template.instruction = body.instruction;
      if (body.context !== undefined) template.context = body.context;
      if (body.goals !== undefined) template.goals = body.goals;
      if (body.suggestedSkills !== undefined) template.suggestedSkills = body.suggestedSkills;
      else if (body.skills !== undefined && Array.isArray(body.skills)) {
        template.suggestedSkills = body.skills;
      }
      if (body.dispatchMode !== undefined) template.dispatchMode = body.dispatchMode;
      if (body.schedule !== undefined) template.schedule = body.schedule;
      if (body.defaultModel !== undefined) {
        template.defaultModel =
          typeof body.defaultModel === "string" && body.defaultModel.trim() !== ""
            ? body.defaultModel.trim()
            : undefined;
      }
      if (body.defaultProvider !== undefined) {
        template.defaultProvider =
          typeof body.defaultProvider === "string" && body.defaultProvider.trim() !== ""
            ? body.defaultProvider.trim()
            : undefined;
      }
      if (body.localDirs !== undefined) {
        template.localDirs = normalizeLocalDirsInput(body.localDirs);
      }
      if (body.references !== undefined) {
        template.references = Array.isArray(body.references)
          ? (body.references as unknown[]).map((x) => String(x))
          : [];
      }
      if (body.timeoutMinutes !== undefined) {
        template.timeoutMinutes =
          typeof body.timeoutMinutes === "number" && Number.isFinite(body.timeoutMinutes)
            ? body.timeoutMinutes
            : undefined;
      }
      template.updatedAt = new Date().toISOString();

      saveTemplate(template);
      invalidateTemplatesCache();
      return NextResponse.json({
        data: enrichCustomTemplateFromDisk(template as unknown as Record<string, unknown>),
      });
    }

    if (action === "importPack") {
      const parsed = parseTemplatePackManifestV1(body.manifest);
      if (!parsed.ok) {
        return zodErrorResponse(parsed.error);
      }
      const manifest = parsed.data;
      const created: CustomTemplate[] = [];
      const now = new Date().toISOString();
      for (const t of manifest.templates) {
        const id = `ct_${t.id.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
        const template: CustomTemplate = {
          id,
          name: t.name,
          icon: t.icon,
          color: t.color,
          category: "Imported",
          profile: t.profile,
          description: t.description,
          instruction: t.prompt,
          context: "",
          goals: t.goals,
          suggestedSkills: t.suggestedSkills,
          dispatchMode: "now",
          schedule: "every 5m",
          defaultModel: t.defaultModel,
          defaultProvider: t.defaultProvider,
          localDirs: [],
          references: [],
          timeoutMinutes: t.timeoutMinutes,
          createdAt: now,
          updatedAt: now,
        };
        saveTemplate(template);
        invalidateTemplatesCache();
        created.push(template);
      }
      return NextResponse.json({
        data: { imported: created.length, templates: created, packId: manifest.id },
      });
    }

    if (action === "delete") {
      const { templateId } = body;
      const sanitizedId = sanitizeTemplateId(templateId);
      if (!sanitizedId) {
        return NextResponse.json({ error: "Invalid template id" }, { status: 400 });
      }
      const path = DATA_DIR + "/" + sanitizedId + ".json";
      if (existsSync(path)) {
        unlinkSync(path);
        invalidateTemplatesCache();
        return NextResponse.json({ data: { deleted: true } });
      }
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    logApiError("POST /api/templates", "processing request", err);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}
