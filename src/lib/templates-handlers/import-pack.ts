// ═══════════════════════════════════════════════════════════════
// templates-handlers/import-pack.ts - POST { action: "importPack" }
// ═══════════════════════════════════════════════════════════════
//
// The only branch whose input is schema-validated up front: a pack
// manifest is a whole document, so it goes through
// parseTemplatePackManifestV1 before a single file is written.

import { NextResponse } from "next/server";

import { zodErrorResponse } from "@/lib/api-schemas";
import { parseTemplatePackManifestV1 } from "@/lib/schema";

import {
  CustomTemplate,
  TemplateActionBody,
  invalidateTemplatesCache,
  saveTemplate,
} from "./shared";

export function handleImportTemplatePack(body: TemplateActionBody): NextResponse {
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
