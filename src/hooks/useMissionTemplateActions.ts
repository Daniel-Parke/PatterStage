// ═══════════════════════════════════════════════════════════════
// useMissionTemplateActions — the template write path
// ═══════════════════════════════════════════════════════════════
//
// Split out of useMissionsPage (Phase 4 god-file decomposition). Owns
// the six template handlers: save-as-template from the composer, the
// editor's create/save, edit, delete, and the interactive "click a
// template to load it" selection. All six read the composer form and
// the editor drafts; none of them own that state.
//
// The two state containers are passed in whole and destructured here so
// every handler's dependency array stays per-field, exactly as it was
// before the split. `useMissionTemplatesState` keeps the drafts and the
// modal flags; `useMissionComposer` keeps the form.

"use client";

import { useCallback } from "react";

import type { ToastType } from "@/components/ui/Toast";
import { safeApiCall, toastError } from "@/lib/api-fetch";
import { toastFromResult } from "@/lib/dashboard/toast-from-result";
import type { useMissionComposer } from "@/hooks/useMissionComposer";
import type { useMissionTemplatesState } from "@/hooks/useMissionTemplatesState";
import { useTwoStepConfirm } from "@/hooks/useTwoStepConfirm";
import type { MissionTemplate } from "@/components/missions/TemplateModals";
import { buildTemplatePayload } from "@/lib/missions/mission-form-utils";

type ToastFn = (message: string, type?: ToastType) => void;

export interface UseMissionTemplateActionsArgs {
  composer: ReturnType<typeof useMissionComposer>;
  templateState: ReturnType<typeof useMissionTemplatesState>;
  templates: MissionTemplate[];
  fetchData: () => Promise<void>;
  /** Apply a template to the form + open the composer (shared with the deep link). */
  loadAndApplyTemplate: (
    t: MissionTemplate,
    opts?: { rememberCategory?: boolean; clearQueryParam?: boolean },
  ) => void;
  showToast: ToastFn;
}

export function useMissionTemplateActions({
  composer,
  templateState,
  templates,
  fetchData,
  loadAndApplyTemplate,
  showToast,
}: UseMissionTemplateActionsArgs) {
  const {
    newName,
    newInstruction,
    newContext,
    newGoals,
    newOutputFormat,
    newConstraints,
    newDispatch,
    newSchedule,
    newTimeout,
    newProfile,
    newModel,
    newProvider,
    newLocalDirs,
    newReferences,
    newSkills,
    newToolsets,
    newCategoryId,
  } = composer;

  const {
    setShowTemplateEditor,
    editingTemplateId,
    setEditingTemplateId,
    templateName,
    templateDescription,
    templateIcon,
    templateColor,
    setTemplateSaving,
    closeTemplateManager,
    templateInstruction,
    templateContext,
    templateGoals,
    templateProfile,
    templateModel,
    templateProvider,
    templateTimeout,
    templateLocalDirs,
    templateReferences,
    templateSkills,
    templateCategoryId,
    resetTemplateDraft,
    seedTemplateDraft,
  } = templateState;

  const persistTemplate = useCallback(
    async (payload: Record<string, unknown>, postSuccess: () => void) => {
      setTemplateSaving(true);
      try {
        const res = await safeApiCall("/api/templates", {
          method: "POST",
          body: payload,
        });
        const wasUpdate = payload.action === "update";
        toastFromResult(
          showToast,
          res,
          wasUpdate ? "Template updated!" : "Template saved!",
          "Failed to save template",
        );
        if (res.ok) {
          postSuccess();
          void fetchData();
        }
      } catch (err) {
        toastError(showToast, err, "Failed to save template");
      } finally {
        setTemplateSaving(false);
      }
    },
    // setTemplateSaving is a stable container-hook setter (listed to
    // satisfy exhaustive-deps now that it's destructured, not a local
    // useState setter the linter auto-exempts).
    [showToast, fetchData, setTemplateSaving],
  );

  // Overwriting a template that already exists is two clicks (T-0096, D51):
  // the first arms the Save-as-template button with the template's name, the
  // second writes. It used to be a native window.confirm over the sheet.
  const overwrite = useTwoStepConfirm({ autoDismissMs: 6000 });
  const overwriteTemplateName =
    overwrite.armedKey === null
      ? null
      : (templates.find((t) => t.id === overwrite.armedKey)?.name ?? null);

  const handleSaveAsTemplate = useCallback(async () => {
    if (!newInstruction.trim()) return;

    const name = newName.trim() || "Untitled Template";

    // The target is resolved BY NAME, never by editingTemplateId: a stale id
    // left behind by a soft close is how a mission saved as a template
    // overwrote whatever the operator last had open (T-0104, D70).
    const existingTemplate = templates.find(
          (t) =>
            t.name === name &&
            // `isCustom` is already declared (optional) on the
            // `MissionTemplate` interface in TemplateModals.tsx:67, so
            // no structural cast is needed to read it. The prior
            // `(t as MissionTemplate & { isCustom?: boolean })` was
            // redundant — `isCustom` is in the type, not in the
            // legacy backend shape. The `!== false` check is
            // preserved byte-equivalent.
            t.isCustom !== false,
        );

    if (existingTemplate && !overwrite.isArmedFor(existingTemplate.id)) {
      overwrite.arm(existingTemplate.id);
      return;
    }
    overwrite.cancel();

    const payload = buildTemplatePayload({
      action: existingTemplate ? "update" : "create",
      templateId: existingTemplate?.id,
      name,
      // A template saved from the composer takes the defaults. The icon, the
      // colour and the description belong to the editor draft, and reading
      // them here is another way for one surface to write another surface.
      icon: "Zap",
      color: "cyan",
      description: "",
      instruction: newInstruction,
      context: newContext,
      outputFormat: newOutputFormat,
      constraints: newConstraints,
      goals: newGoals,
      localDirs: newLocalDirs,
      references: newReferences,
      suggestedSkills: newSkills,
      suggestedToolsets: newToolsets,
      profile: newProfile,
      defaultModel: newModel,
      defaultProvider: newProvider,
      timeoutMinutes: newTimeout,
      categoryId: newCategoryId,
    });

    await persistTemplate(payload, () => setEditingTemplateId(null));
  }, [newInstruction, newName, templates, overwrite, newContext, newOutputFormat, newConstraints, newGoals, newLocalDirs, newReferences, newSkills, newToolsets, newProfile, newModel, newProvider, newTimeout, newCategoryId, persistTemplate, setEditingTemplateId]);

  const handleCreateNewTemplate = useCallback(() => {
    setEditingTemplateId(null);
    // The editor own draft, not the composer form. Blanking the composer here
    // destroyed whatever mission the operator was half way through writing
    // (T-0104, D72).
    resetTemplateDraft();
    // `closeTemplateManager` is the hook's stable close-callback for
    // the template-manager modal (sibling of `openTemplateManager`).
    // Pre-session-211: this site inlined `setShowTemplateManager
    // (false)` directly. The 2-1/2 line of code is byte-equivalent
    // (same `setShowTemplateManager(false)` payload via the callback
    // body), but the migration keeps the 3 internal call sites
    // consistent with the page's `<TemplateManagerModal
    // onClose={closeTemplateManager}>` JSX binding — any future
    // "also clear the template filter" or "also reset template
    // category" extension added to `closeTemplateManager` lands
    // here too, automatically. The deps array adds `closeTemplateManager`
    // (it's a stable `useCallback` with `[]` deps, so the reference
    // is the same on every render of the hook — adding it is a
    // correctness no-op but keeps the linter happy).
    closeTemplateManager();
    setShowTemplateEditor(true);
  }, [closeTemplateManager, resetTemplateDraft, setEditingTemplateId, setShowTemplateEditor]);

  const handleTemplateSave = useCallback(async () => {
    if (!templateName.trim()) return;

    const payload = buildTemplatePayload({
      action: editingTemplateId ? "update" : "create",
      templateId: editingTemplateId ?? undefined,
      name: templateName,
      icon: templateIcon,
      color: templateColor,
      description: templateDescription,
      // Every body field comes from the editor own draft. Reading the composer
      // here is what let a half-written mission leak into a template save
      // (T-0104, D72).
      instruction: templateInstruction,
      context: templateContext,
      outputFormat: newOutputFormat,
      constraints: newConstraints,
      goals: templateGoals,
      localDirs: templateLocalDirs,
      references: templateReferences,
      suggestedSkills: templateSkills,
      suggestedToolsets: [],
      profile: templateProfile,
      defaultModel: templateModel,
      defaultProvider: templateProvider,
      timeoutMinutes: templateTimeout,
      categoryId: templateCategoryId ?? null,
      dispatchMode: editingTemplateId ? undefined : newDispatch,
      schedule: editingTemplateId ? undefined : newSchedule,
    });

    await persistTemplate(payload, () => {
      setShowTemplateEditor(false);
      setEditingTemplateId(null);
    });
  }, [templateName, editingTemplateId, templateIcon, templateColor, templateDescription, templateInstruction, templateContext, newOutputFormat, newConstraints, templateGoals, templateLocalDirs, templateReferences, templateSkills, templateProfile, templateModel, templateProvider, templateTimeout, templateCategoryId, newDispatch, newSchedule, persistTemplate, setShowTemplateEditor, setEditingTemplateId]);

  const handleEditTemplate = useCallback(
    (t: MissionTemplate) => {
      setEditingTemplateId(t.id);
      // Into the editor draft. applyTemplateToForm wrote the composer fields,
      // which is the other half of D72.
      seedTemplateDraft(t);
      // `closeTemplateManager` is the hook's stable close-callback for
      // the template-manager modal (sister migration to the same
      // pattern in `handleCreateNewTemplate` above and
      // `handleDeleteTemplate` below). Pre-session-211: this site
      // inlined `setShowTemplateManager(false)` directly. The migration
      // is byte-equivalent (same payload via the callback body) and
      // keeps the 3 internal call sites consistent with the page's
      // `<TemplateManagerModal onClose={closeTemplateManager}>` JSX
      // binding. The deps array adds `closeTemplateManager` (stable
      // `useCallback` with `[]` deps, so the reference is the same on
      // every render).
      closeTemplateManager();
      setShowTemplateEditor(true);
    },
    [seedTemplateDraft, closeTemplateManager, setEditingTemplateId, setShowTemplateEditor],
  );

  const handleDeleteTemplate = useCallback(async (templateId: string) => {
    // The pre-session 207 form had a `window.confirm("Delete this
    // template?")` pre-confirm guard here — that guard has moved
    // into the `TemplateRow` leaf sub-component inside
    // `TemplateModals.tsx` as a per-row
    // `useTwoStepConfirm({ autoDismissMs: 4000 })` instance, where
    // the template id is in scope at render time. By the time this
    // callback is called, the user has already confirmed in the
    // leaf; this hook is a thin transport wrapper (wire delete +
    // toast + post-success reload + closeTemplateManager()).
    const result = await safeApiCall("/api/templates", {
      method: "POST",
      body: { action: "delete", templateId },
    });
    toastFromResult(
      showToast,
      result,
      "Template deleted",
      "Failed to delete template",
    );
    if (result.ok) {
      // `closeTemplateManager` is the hook's stable close-callback
      // for the template-manager modal (sister migration to the same
      // pattern in `handleCreateNewTemplate` and `handleEditTemplate`
      // above). Pre-session-211: this site inlined
      // `setShowTemplateManager(false)` directly. The migration is
      // byte-equivalent (same payload via the callback body) and
      // keeps the 3 internal call sites consistent with the page's
      // `<TemplateManagerModal onClose={closeTemplateManager}>` JSX
      // binding. The deps array adds `closeTemplateManager` (stable
      // `useCallback` with `[]` deps, so the reference is the same on
      // every render).
      closeTemplateManager();
      fetchData();
    }
  }, [showToast, fetchData, closeTemplateManager]);

  const handleTemplateSelect = useCallback((t: MissionTemplate) => {
    // The interactive "click a template" path: just apply + open +
    // toast. No `rememberCategory` (the user picked a template
    // interactively; persisting the category is reserved for the
    // deep-link path in `fetchData`) and no `clearQueryParam`
    // (there is no `?template=` query to strip — the user is
    // already on the bare missions page). The shared apply+open
    // +toast trio is consolidated in `loadAndApplyTemplate`; see
    // the helper's JSDoc for the 2-site consolidation rationale.
    loadAndApplyTemplate(t);
  }, [loadAndApplyTemplate]);

  return {
    handleSaveAsTemplate,
    overwriteTemplateName,
    handleCreateNewTemplate,
    handleTemplateSave,
    handleEditTemplate,
    handleDeleteTemplate,
    handleTemplateSelect,
  };
}
