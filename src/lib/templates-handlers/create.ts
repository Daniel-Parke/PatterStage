// ═══════════════════════════════════════════════════════════════
// templates-handlers/create.ts - POST /api/templates { action: "create" }
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";

import { normalizeLocalDirsInput } from "@/lib/fs/local-dir-entry";
import { resolveTemplateCategoryId } from "@/lib/missions/mission-category-repository";

import {
  CustomTemplate,
  TemplateActionBody,
  enrichCustomTemplateFromDisk,
  invalidateTemplatesCache,
  saveTemplate,
} from "./shared";
import { isDispatchMode } from "@/lib/dispatch-mode";
import { recordEvent } from "@/lib/analytics/record-event";

export function handleCreateTemplate(body: TemplateActionBody): NextResponse {
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
    category:
      typeof body.category === "string" ? body.category : "Custom",
    categoryId:
      typeof body.categoryId === "string" && body.categoryId
        ? body.categoryId
        : resolveTemplateCategoryId(body.category) ?? "general",
    profile: typeof body.profile === "string" ? body.profile : "",
    description: body.description || "",
    instruction: body.instruction || "",
    context: body.context || "",
    goals: body.goals || [],
    suggestedSkills,
    suggestedToolsets: Array.isArray(body.suggestedToolsets)
      ? (body.suggestedToolsets as unknown[]).map((x) => String(x))
      : [],
    dispatchMode: isDispatchMode(body.dispatchMode) ? body.dispatchMode : "now",
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
    outputFormat:
      typeof body.outputFormat === "string" ? body.outputFormat : undefined,
    constraints:
      typeof body.constraints === "string" ? body.constraints : undefined,
    timeoutMinutes:
      typeof body.timeoutMinutes === "number" && Number.isFinite(body.timeoutMinutes)
        ? body.timeoutMinutes
        : undefined,
    createdAt: now,
    updatedAt: now,
  };

  saveTemplate(template);
  invalidateTemplatesCache();
  recordEvent("template.saved", { entityType: "template", entityId: id, metadata: { action: "created" } });
  return NextResponse.json({ data: enrichCustomTemplateFromDisk(template as unknown as Record<string, unknown>) });
}
