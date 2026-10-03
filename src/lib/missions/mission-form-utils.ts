// ═══════════════════════════════════════════════════════════════
// Mission Form Utilities — Shared helpers for mission form state
// ═══════════════════════════════════════════════════════════════

import type { LocalDirEntry } from "@/types/console";
import type { ManagedCategory } from "@/components/missions/CategoryManagerModal";

/** Split newline-delimited goals string into non-empty array. */
export function splitGoals(goals: string): string[] {
  return goals.split("\n").filter((g) => g.trim());
}

/**
 * Map categories to the common { id, name, color } shape used across modals.
 * Consolidates the repeated `categories.map(c => ({ id, name, color }))` pattern.
 */
export function mapCategories(categories: ManagedCategory[]) {
  return categories.map((c) => ({
    id: c.id,
    name: c.name,
    color: c.color,
  }));
}

/**
 * Build a template creation/update payload from mission form state.
 * Used by both handleSaveAsTemplate and handleTemplateSave.
 */
export function buildTemplatePayload({
  action,
  templateId,
  name,
  icon,
  color,
  description,
  instruction,
  context,
  outputFormat,
  constraints,
  goals,
  localDirs,
  references,
  suggestedSkills,
  suggestedToolsets,
  profile,
  defaultModel,
  defaultProvider,
  timeoutMinutes,
  categoryId,
  dispatchMode,
  schedule,
}: {
  action: "create" | "update";
  templateId?: string;
  name: string;
  icon?: string;
  color?: string;
  description?: string;
  instruction: string;
  context?: string;
  outputFormat?: string;
  constraints?: string;
  goals: string;
  localDirs: LocalDirEntry[];
  references: string[];
  suggestedSkills: string[];
  suggestedToolsets: string[];
  profile: string;
  defaultModel: string;
  defaultProvider: string;
  timeoutMinutes: number;
  categoryId: string | null;
  dispatchMode?: string;
  schedule?: string;
}): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    action,
    ...(templateId ? { templateId } : {}),
    name,
    icon,
    color,
    description: description || "",
    instruction,
    context,
    outputFormat,
    constraints,
    goals: splitGoals(goals),
    localDirs,
    references,
    suggestedSkills,
    suggestedToolsets,
    profile,
    defaultModel: defaultModel?.trim() || undefined,
    defaultProvider: defaultProvider?.trim() || undefined,
    timeoutMinutes,
    ...(categoryId ? { categoryId } : {}),
  };

  if (action === "create") {
    payload.dispatchMode = dispatchMode;
    payload.schedule = schedule;
  }

  return payload;
}
