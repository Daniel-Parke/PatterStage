// ═══════════════════════════════════════════════════════════════
// Custom Templates API — CRUD for user-created mission templates
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from "fs";
import { parseTemplatePackManifestV1 } from "@agent-control-hub/schema";
import { zodErrorResponse } from "@/lib/api-schemas";
import { logApiError } from "@/lib/api-logger";
import { PATHS } from "@/lib/paths";
import { requireMcApiKey, requireNotReadOnly } from "@/lib/api-auth";
import { TEMPLATES } from "@/lib/mission-helpers";

const DATA_DIR = PATHS.templates;

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
  createdAt: string;
  updatedAt: string;
}

function loadTemplate(id: string): CustomTemplate | null {
  const path = DATA_DIR + "/" + id + ".json";
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}

function saveTemplate(template: CustomTemplate) {
  ensureDir();
  const path = DATA_DIR + "/" + template.id + ".json";
  writeFileSync(path, JSON.stringify(template, null, 2));
}

export async function GET() {
  try {
    // 1. Load custom user templates from disk
    ensureDir();
    const files = readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"));
    const customTemplates: CustomTemplate[] = [];

    for (const file of files) {
      try {
        const content = readFileSync(DATA_DIR + "/" + file, "utf-8");
        customTemplates.push({ ...JSON.parse(content), isCustom: true as const });
      } catch {}
    }

    customTemplates.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // 2. Merge built-in templates (marked isCustom: false) from mission-helpers
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
      createdAt: new Date(0).toISOString(), // oldest — sort after recent custom
      updatedAt: new Date(0).toISOString(),
      isCustom: false as const,
    }));

    const templates = [...customTemplates, ...builtInTemplates];

    return NextResponse.json({ data: { templates, total: templates.length } });
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

      const template: CustomTemplate = {
        id,
        name: body.name || "Untitled Template",
        icon: body.icon || "Zap",
        color: body.color || "cyan",
        category: body.category || "Custom",
        profile: body.profile || "",
        description: body.description || "",
        instruction: body.instruction || "",
        context: body.context || "",
        goals: body.goals || [],
        suggestedSkills: body.suggestedSkills || [],
        dispatchMode: body.dispatchMode || "now",
        schedule: body.schedule || "every 5m",
        createdAt: now,
        updatedAt: now,
      };

      saveTemplate(template);
      return NextResponse.json({ data: template });
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
      if (body.dispatchMode !== undefined) template.dispatchMode = body.dispatchMode;
      if (body.schedule !== undefined) template.schedule = body.schedule;
      template.updatedAt = new Date().toISOString();

      saveTemplate(template);
      return NextResponse.json({ data: template });
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
          createdAt: now,
          updatedAt: now,
        };
        saveTemplate(template);
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
