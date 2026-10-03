// ═══════════════════════════════════════════════════════════════
// useMissionTemplatesState — the template editor's own state
// ═══════════════════════════════════════════════════════════════
//
// Extracted from useMissionsPage (god-hook split). Owns the modal flags, the
// "which template is being edited" id, the saving flag, and — since T-0104 —
// the editor's own copy of every body field it writes.
//
// That last part is D72. The editor and the mission composer used to share one
// set of form state: opening "New template" called the composer's
// clearMissionFormFields() and opening "Edit" called its applyTemplateToForm().
// So a half-written mission plus one click on Edit Templates was a half-written
// mission destroyed, with no undo and no warning. The editor writes here now,
// and the composer is never touched.

"use client";

import { useCallback, useState } from "react";

import type { LocalDirEntry } from "@/types/console";
import { normalizeLocalDirsInput } from "@/lib/fs/local-dir-entry";
import type { MissionTemplate } from "@/components/missions/TemplateModals";

/** Everything "Save as Template" hands the editor when it seeds from a mission. */
export interface TemplateDraftSeed {
  name?: string;
  description?: string;
  instruction?: string;
  context?: string;
  goals?: string;
  profile?: string;
  model?: string;
  provider?: string;
  timeoutMinutes?: number;
  localDirs?: LocalDirEntry[];
  references?: string[];
  skills?: string[];
  categoryId?: string | null;
}

const DEFAULT_TIMEOUT_MINUTES = 30;

export function useMissionTemplatesState() {
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [templateIcon, setTemplateIcon] = useState("Zap");
  const [templateColor, setTemplateColor] = useState("cyan");
  const [templateSaving, setTemplateSaving] = useState(false);

  // ── the editor's own body fields (D72) ────────────────────────
  const [templateInstruction, setTemplateInstruction] = useState("");
  const [templateContext, setTemplateContext] = useState("");
  const [templateGoals, setTemplateGoals] = useState("");
  const [templateProfile, setTemplateProfile] = useState("");
  const [templateModel, setTemplateModel] = useState("");
  const [templateProvider, setTemplateProvider] = useState("");
  const [templateMissionTime, setTemplateMissionTime] = useState(DEFAULT_TIMEOUT_MINUTES);
  const [templateTimeout, setTemplateTimeout] = useState(DEFAULT_TIMEOUT_MINUTES);
  const [templateLocalDirs, setTemplateLocalDirs] = useState<LocalDirEntry[]>([]);
  const [templateLocalDirDraft, setTemplateLocalDirDraft] = useState<{
    path: string;
    branch: string | null;
  }>({ path: "", branch: null });
  const [templateReferences, setTemplateReferences] = useState<string[]>([]);
  const [templateReferenceInput, setTemplateReferenceInput] = useState("");
  const [templateSkills, setTemplateSkills] = useState<string[]>([]);
  const [templateCategoryId, setTemplateCategoryId] = useState<string | null>(null);

  /** The model and its provider move together, as they do in the composer. */
  const setTemplateModelAndProvider = useCallback((modelId: string, provider: string) => {
    setTemplateModel(modelId);
    setTemplateProvider(provider);
  }, []);

  /** Blank every draft field, for "New template". */
  const resetTemplateDraft = useCallback(() => {
    setTemplateName("");
    setTemplateDescription("");
    setTemplateIcon("Zap");
    setTemplateColor("cyan");
    setTemplateInstruction("");
    setTemplateContext("");
    setTemplateGoals("");
    setTemplateProfile("");
    setTemplateModel("");
    setTemplateProvider("");
    setTemplateMissionTime(DEFAULT_TIMEOUT_MINUTES);
    setTemplateTimeout(DEFAULT_TIMEOUT_MINUTES);
    setTemplateLocalDirs([]);
    setTemplateLocalDirDraft({ path: "", branch: null });
    setTemplateReferences([]);
    setTemplateReferenceInput("");
    setTemplateSkills([]);
    setTemplateCategoryId(null);
  }, []);

  /** Fill every draft field from a template, for "Edit". */
  const seedTemplateDraft = useCallback((t: MissionTemplate) => {
    const rich = t as MissionTemplate & {
      instruction?: string;
      context?: string;
      timeoutMinutes?: number;
      categoryId?: string | null;
    };
    setTemplateName(t.name ?? "");
    setTemplateDescription(t.description || "");
    setTemplateIcon(t.icon);
    setTemplateColor(t.color);
    setTemplateInstruction(rich.instruction || "");
    setTemplateContext(rich.context || "");
    setTemplateGoals((t.goals || []).join("\n"));
    setTemplateProfile(t.profile || "");
    setTemplateModel(t.defaultModel || "");
    setTemplateProvider(t.defaultProvider || "");
    setTemplateLocalDirs(normalizeLocalDirsInput(t.localDirs));
    setTemplateLocalDirDraft({ path: "", branch: null });
    setTemplateReferences(t.references ?? []);
    setTemplateReferenceInput("");
    setTemplateSkills(t.suggestedSkills || []);
    setTemplateCategoryId(rich.categoryId ?? null);
    const tm = rich.timeoutMinutes;
    if (typeof tm === "number" && Number.isFinite(tm)) {
      setTemplateMissionTime(tm);
      setTemplateTimeout(tm);
    } else {
      setTemplateMissionTime(DEFAULT_TIMEOUT_MINUTES);
      setTemplateTimeout(DEFAULT_TIMEOUT_MINUTES);
    }
  }, []);

  /** Fill every draft field from the composer's current mission. */
  const seedTemplateDraftFrom = useCallback((fields: TemplateDraftSeed) => {
    setTemplateName(fields.name ?? "");
    setTemplateDescription(fields.description ?? "");
    setTemplateIcon("Zap");
    setTemplateColor("cyan");
    setTemplateInstruction(fields.instruction ?? "");
    setTemplateContext(fields.context ?? "");
    setTemplateGoals(fields.goals ?? "");
    setTemplateProfile(fields.profile ?? "");
    setTemplateModel(fields.model ?? "");
    setTemplateProvider(fields.provider ?? "");
    setTemplateMissionTime(fields.timeoutMinutes ?? DEFAULT_TIMEOUT_MINUTES);
    setTemplateTimeout(fields.timeoutMinutes ?? DEFAULT_TIMEOUT_MINUTES);
    setTemplateLocalDirs(normalizeLocalDirsInput(fields.localDirs));
    setTemplateLocalDirDraft({ path: "", branch: null });
    setTemplateReferences(fields.references ?? []);
    setTemplateReferenceInput("");
    setTemplateSkills(fields.skills ?? []);
    setTemplateCategoryId(fields.categoryId ?? null);
  }, []);

  // Open/close siblings for the template-manager modal (the "Edit
  // Templates" button in MissionsList) and the template-editor modal's
  // soft close (X / overlay click).
  const openTemplateManager = useCallback(() => {
    setShowTemplateManager(true);
  }, []);
  const closeTemplateManager = useCallback(() => {
    setShowTemplateManager(false);
  }, []);
  const closeTemplateEditor = useCallback(() => {
    setShowTemplateEditor(false);
    // The soft close clears the edit target exactly as the hard close does.
    // Leaving it set is how "Save as Template" on an unrelated mission
    // overwrote the template the operator last had open (T-0104, D70).
    setEditingTemplateId(null);
  }, []);

  return {
    showTemplateEditor,
    setShowTemplateEditor,
    showTemplateManager,
    editingTemplateId,
    setEditingTemplateId,
    templateName,
    setTemplateName,
    templateDescription,
    setTemplateDescription,
    templateIcon,
    setTemplateIcon,
    templateColor,
    setTemplateColor,
    templateSaving,
    setTemplateSaving,
    templateInstruction,
    setTemplateInstruction,
    templateContext,
    setTemplateContext,
    templateGoals,
    setTemplateGoals,
    templateProfile,
    setTemplateProfile,
    templateModel,
    templateProvider,
    setTemplateModelAndProvider,
    templateMissionTime,
    setTemplateMissionTime,
    templateTimeout,
    setTemplateTimeout,
    templateLocalDirs,
    setTemplateLocalDirs,
    templateLocalDirDraft,
    setTemplateLocalDirDraft,
    templateReferences,
    setTemplateReferences,
    templateReferenceInput,
    setTemplateReferenceInput,
    templateSkills,
    setTemplateSkills,
    templateCategoryId,
    setTemplateCategoryId,
    resetTemplateDraft,
    seedTemplateDraft,
    seedTemplateDraftFrom,
    openTemplateManager,
    closeTemplateManager,
    closeTemplateEditor,
  };
}
