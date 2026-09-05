// ═══════════════════════════════════════════════════════════════
// templates-handlers/update.ts - POST /api/templates { action: "update" }
// ═══════════════════════════════════════════════════════════════
//
// Field-by-field whitelist, not a spread: an unknown key in the body must
// never reach disk (docs/contributing/repo-guide.md, "no mass assignment").

import { NextResponse } from "next/server";

import { normalizeLocalDirsInput } from "@/lib/fs/local-dir-entry";

import {
  TemplateActionBody,
  enrichCustomTemplateFromDisk,
  invalidateTemplatesCache,
  loadTemplate,
  sanitizeTemplateId,
  saveTemplate,
} from "./shared";
import { isDispatchMode, DISPATCH_MODES } from "@/lib/dispatch-mode";
import { badRequest } from "@/lib/api-response";
import { recordEvent } from "@/lib/analytics/record-event";

export function handleUpdateTemplate(body: TemplateActionBody): NextResponse {
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
  if (body.categoryId !== undefined) {
    template.categoryId =
      typeof body.categoryId === "string" ? body.categoryId : undefined;
  }
  if (body.profile !== undefined) template.profile = body.profile;
  if (body.description !== undefined) template.description = body.description;
  if (body.instruction !== undefined) template.instruction = body.instruction;
  if (body.context !== undefined) template.context = body.context;
  if (body.goals !== undefined) template.goals = body.goals;
  if (body.suggestedSkills !== undefined) template.suggestedSkills = body.suggestedSkills;
  else if (body.skills !== undefined && Array.isArray(body.skills)) {
    template.suggestedSkills = body.skills;
  }
  if (body.suggestedToolsets !== undefined && Array.isArray(body.suggestedToolsets)) {
    template.suggestedToolsets = (body.suggestedToolsets as unknown[]).map((x) => String(x));
  }
  // Validated here, not just on dispatch. A template persists whatever it is
  // given and useMissionComposer casts it straight back into form state, so an
  // unvalidated field here is what turned T-0067 from an API-only defect into
  // one an operator reaches by clicking Apply.
  if (body.dispatchMode !== undefined) {
    if (!isDispatchMode(body.dispatchMode)) {
      return badRequest(
        `Unknown dispatchMode: ${JSON.stringify(body.dispatchMode)}. Expected one of: ${DISPATCH_MODES.join(", ")}.`,
      );
    }
    template.dispatchMode = body.dispatchMode;
  }
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
  if (body.outputFormat !== undefined) {
    template.outputFormat =
      typeof body.outputFormat === "string" ? body.outputFormat : undefined;
  }
  if (body.constraints !== undefined) {
    template.constraints =
      typeof body.constraints === "string" ? body.constraints : undefined;
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
  recordEvent("template.saved", { entityType: "template", entityId: template.id, metadata: { action: "updated" } });
  return NextResponse.json({
    data: enrichCustomTemplateFromDisk(template as unknown as Record<string, unknown>),
  });
}
