// ═══════════════════════════════════════════════════════════════
// templates-handlers/list.ts - GET /api/templates
// ═══════════════════════════════════════════════════════════════
//
// The list is the union of two sources: the user's custom templates on
// disk (newest first) and the built-in catalogue from SQLite. The result
// is cached for 30 seconds; every mutation invalidates it.

import { readFileSync, readdirSync } from "fs";
import { NextResponse } from "next/server";

import { serverErrorFromCatch } from "@/lib/api-logger";
import { listCatalogTemplates } from "@/lib/catalog-template-repository";
import { ensureDb } from "@/lib/db";
import { resolveTemplateCategoryId } from "@/lib/missions/mission-category-repository";

import {
  CustomTemplate,
  DATA_DIR,
  ensureDataDir,
  enrichCustomTemplateFromDisk,
  getTemplatesCached,
  setTemplatesCache,
} from "./shared";

export async function handleListTemplates(): Promise<NextResponse> {
  try {
    ensureDb();
    // Return cached result if fresh
    const cached = getTemplatesCached();
    if (cached) {
      return NextResponse.json(cached);
    }

    ensureDataDir();
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

    const builtInTemplates = listCatalogTemplates().map((t) => ({
      id: t.id,
      name: t.name,
      icon: t.icon,
      color: t.color,
      category: t.categoryId ?? "general",
      categoryId: t.categoryId ?? resolveTemplateCategoryId(undefined) ?? "general",
      profile: t.profileSlug,
      description: t.description,
      instruction: t.instruction,
      context: t.context,
      goals: t.goals,
      suggestedSkills: t.suggestedSkills,
      suggestedToolsets: t.suggestedToolsets ?? [],
      outputFormat: t.outputFormat,
      constraints: t.constraints,
      localDirs: t.localDirs,
      references: t.references,
      missionTimeMinutes: t.missionTimeMinutes,
      timeoutMinutes: t.timeoutMinutes,
      dispatchMode: "now" as const,
      schedule: "every 5m",
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
      isCustom: false as const,
      seedKey: t.seedKey,
    }));

    const templates = [...customTemplates, ...builtInTemplates];
    const response = { data: { templates, total: templates.length } };

    // Cache the response
    setTemplatesCache(response);

    return NextResponse.json(response);
  } catch (err) {
    return serverErrorFromCatch("GET /api/templates", "listing templates", err, "Failed to list templates");
  }
}
