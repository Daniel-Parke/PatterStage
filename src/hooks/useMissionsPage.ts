import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useToast } from "@/components/ui/Toast";
import { useMissionsApi } from "@/hooks/useMissionsApi";
import { useMissionCategories } from "@/hooks/useMissionCategories";
import { useMissionTemplatesState } from "@/hooks/useMissionTemplatesState";
import { useMissionComposer } from "@/hooks/useMissionComposer";
import { safeApiCall, toastError } from "@/lib/api-fetch";
import { toastFromResult } from "@/lib/dashboard/toast-from-result";
import { successMessageForDispatch, dispatchMissionAction } from "@/hooks/success-message-for-dispatch";
import type { Mission } from "@/types/console";
import type { MissionTemplate } from "@/components/missions/TemplateModals";
import { buildTemplatePayload } from "@/lib/missions/mission-form-utils";
import {
  isMissionDraft,
  isMissionQueuedForRun,
} from "@/lib/missions/mission-board";
import {
  getCategoryIdFromTemplate,
  rememberLastCategory,
} from "@/lib/missions/mission-composer-utils";
import {
  filterMissions,
  computeMissionCounts,
  computeMissionCategoryPills,
  computeTemplateCategoryPills,
  filterGroupedTemplates,
  submitToastForDispatch,
} from "@/lib/missions/mission-filters";

// getCategoryIdFromTemplate / rememberLastCategory / readLastCategory moved
// to src/lib/mission-composer-utils.ts (shared by useMissionComposer + this
// hook, imported above). The pure board/category selectors (filterMissions,
// computeMissionCounts, *CategoryPills, filterGroupedTemplates) and the
// dispatch-toast copy live in src/lib/mission-filters.ts.

export type MissionRow = Mission & {
  cronJob?: {
    state: string;
    enabled: boolean;
    lastRun: string | null;
    lastStatus: string | null;
  };
  latestSession?: { id: string; modified: string } | null;
  /** API may return results as plural field for backward compatibility */
  results?: string;
  /** Runtime error state (not persisted in schema) */
  error?: string;
};

export interface MissionDetail {
  mission: MissionRow;
  cronJob: {
    id: string;
    name: string;
    state: string;
    enabled: boolean;
    lastRun: string | null;
    nextRun: string | null;
    lastStatus: string | null;
    schedule: string;
  } | null;
  sessions: Array<{ id: string; modified: string; size: number }>;
}

export function useMissionsPage() {
  const {
    fetchMissions,
    fetchTemplates,
    fetchMissionDetail,
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
  } = useMissionsApi();
  const [missions, setMissions] = useState<MissionRow[]>([]);
  const [templates, setTemplates] = useState<MissionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MissionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [promptCollapsed, setPromptCollapsed] = useState(true);
  const [collapsedColumns, setCollapsedColumns] = useState<Record<string, boolean>>({
    successful: true,
    failed: true,
  });
  const { showToast, toastElement } = useToast();
  const templateApplied = useRef(false);
  const expandedIdRef = useRef<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Template editor/manager UI state lives in its own container hook
  // (src/hooks/useMissionTemplatesState.ts); destructured here so the
  // template handlers + the public return shape are unchanged.
  const {
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
    openTemplateManager,
    closeTemplateManager,
    closeTemplateEditor,
  } = useMissionTemplatesState();

  // Composer form state (every `new*` field) + its setters, the typed
  // field-setter map, the dispatch payload builder, the two form-
  // population helpers, and the three composer-local effects live in
  // their own container hook (src/hooks/useMissionComposer.ts). It's
  // destructured here so every handler body that reads `newName`/
  // `dispatchPayload`/etc. and the public return shape are unchanged.
  // showCreate/editingId are passed in so the visibility-gated effects
  // (last-category restore, default-agent autofill) can read them.
  const {
    newName,
    newInstruction, setNewInstruction,
    newContext, setNewContext,
    newGoals, setNewGoals,
    newOutputFormat, setNewOutputFormat,
    newConstraints, setNewConstraints,
    dispatchAcknowledged, setDispatchAcknowledged,
    newDispatch, setNewDispatch,
    newSchedule,
    newMissionTime, setNewMissionTime,
    newTimeout, setNewTimeout,
    newProfile, setNewProfile,
    newModel, setNewModel,
    newProvider, setNewProvider,
    newLocalDirs, setNewLocalDirs,
    localDirDraft, setLocalDirDraft,
    newReferences, setNewReferences,
    newSkills, setNewSkills,
    newToolsets,
    referenceInput, setReferenceInput,
    newCategoryId, setNewCategoryId,
    formState,
    setFormField,
    dispatchPayload,
    setModelAndProvider,
    setCategoryId,
    clearMissionFormFields,
    applyTemplateToForm,
    populateFormFromMission,
  } = useMissionComposer({ showCreate, editingId });

  const [dispatching, setDispatching] = useState(false);
  const [cancellingMissionId, setCancellingMissionId] = useState<string | null>(
    null,
  );
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [missionCategoryFilter, setMissionCategoryFilter] = useState("all");

  const resetForm = useCallback(() => {
    clearMissionFormFields();
    setDispatchAcknowledged(false);
    setNewDispatch("save");
    setShowCreate(false);
    // setDispatchAcknowledged + setNewDispatch are stable composer-hook
    // setters (listed to satisfy exhaustive-deps now that they're
    // destructured, not local useState setters the linter auto-exempts).
  }, [clearMissionFormFields, setDispatchAcknowledged, setNewDispatch]);

  // Close the create/edit mission composer. The same `setEditingId(null)`
  // + `setShowCreate(false)` pair appears at 3 sites — the 2 success
  // branches of `handleCreate` (update + promote) and the page's
  // `handleCloseCreate` (Sheet onClose, MissionComposerActions onClose,
  // MissionCreateForm onClose). Centralising it here keeps the 3 sites
  // in lockstep if a future "clear form fields" or "dismiss category"
  // reset is added — a single edit here updates all 3.
  const closeComposer = useCallback(() => {
    setEditingId(null);
    setShowCreate(false);
  }, []);

  // Open the create mission composer (fresh-create mode, not edit).
  // The page's `<Button onClick={() => setShowCreate(true)}>` "New Mission"
  // header action is the canonical caller — a named callback keeps the
  // action bar's open-mission click in lockstep with `closeComposer`'s
  // close-mission click, and groups the 2 sibling open/close callbacks
  // next to each other. Mirrors the `openAgentCreate` / `closeAgentModal`
  // pattern that session 114 promoted in `cron/page.tsx` (see commit
  // `5f0ec5a` "openCreate/openEdit callbacks"). The 4 `setShowCreate(true)`
  // sites inside this hook (handleEdit, handleDuplicateMission,
  // handleTemplateSelect, fetchData's template-apply path) are NOT this
  // callback — they all do additional state mutations (set editing,
  // populate form, etc.) before opening. openCreate is the single-setter
  // "open fresh" path used by the page's "New Mission" button only.
  const openCreate = useCallback(() => {
    setShowCreate(true);
  }, []);

  // Reload the missions + templates slices in parallel. Used as the category
  // hook's post-delete refresh (a category delete reassigns its missions to the
  // fallback category, so both slices go stale). Promise.allSettled so one
  // failing slice doesn't abort the other's refetch.
  const reloadMissionsAndTemplates = useCallback(async () => {
    await Promise.allSettled([
      fetchMissions().then(setMissions),
      fetchTemplates().then(setTemplates),
    ]);
  }, [fetchMissions, fetchTemplates]);

  // Category-management concern (catalog + CRUD + manager modal). The form's
  // selected `newCategoryId` stays in this hook (compose state); the category
  // hook owns the catalog itself.
  const {
    categories,
    categoriesLoadError,
    showCategoryManager,
    loadCategories,
    handleCreateCategory,
    handleUpdateCategory,
    handleDeleteCategory,
    openCategoryManager,
    closeCategoryManager,
  } = useMissionCategories({
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    showToast,
    onMissionsReassigned: reloadMissionsAndTemplates,
  });

  // Generalised mission-by-id updater. Updates the mission matching
  // `id` by applying the `updater` to its full record. Missions with
  // a different id pass through unchanged. Mirrors the session 180
  // `updateSession(sessionId, updater)` helper in the chat page —
  // same id-discriminator + setState((prev) => prev.map(...)) shape,
  // same "stays out of the way of the existing direct setters"
  // contract.
  //
  // The 2 remaining inline `setMissions((prev) => prev.map((m) =>
  // m.id === X ? { ...m, ...FIELD } : m))` sites (cancel optimistic
  // status flip + cancel restore from snapshot) collapse to a single
  // call shape. The pre-existing nested `restoreMission` closure
  // (line ~1048) becomes a 1-line call to the new helper.
  const updateMission = useCallback(
    (id: string, updater: (mission: MissionRow) => MissionRow) => {
      setMissions((prev) =>
        prev.map((m) => (m.id === id ? updater(m) : m)),
      );
    },
    [],
  );

  /**
   * Apply a template to the form + open the composer in "create" mode.
   * The 5-line sequence `applyTemplateToForm(t, cid) +
   * rememberLastCategory(cid) + setShowCreate(true) + showToast("Template
   * loaded: ${t.name}", "success")` was duplicated at 2 sites:
   *
   *   1. `handleTemplateSelect` (the "click a template" path from
   *      `MissionsList`'s quick-templates UI). This site passes
   *      `undefined` for the categoryIdOverride and skips
   *      `rememberLastCategory` (the user picked a template
   *      interactively; the last-category write is a "fresh start"
   *      affordance reserved for the deep-link path below).
   *   2. `fetchData`'s template-apply path (the `?template=<id>`
   *      deep-link from `/orchestration/missions?template=...`). This
   *      site passes the explicit `cid` and writes it via
   *      `rememberLastCategory`, plus it also fires
   *      `window.history.replaceState(...)` to strip the query param
   *      so a page refresh doesn't re-apply the template.
   *
   * The shared core is the apply+open+toast trio. The site-specific
   * extensions are passed as `opts` so the helper is the single
   * source of truth for the "open the composer with a template
   * loaded" UX, and a future "also reset the dispatch warning" or
   * "also scroll the form into view" extension lands in one place.
   *
   * Byte-equivalent to the pre-refactor inline form: same
   * `applyTemplateToForm(t, cid)` call (with the same `cid` /
   * `undefined` discriminator), same `setShowCreate(true)`, same
   * `showToast(\`Template loaded: ${t.name}\`, "success")` toast.
   * The `opts` extras (rememberLastCategory, history.replaceState)
   * are also byte-equivalent to the pre-refactor fetchData path
   * (same calls, same args). The `templateApplied.current = true`
   * latch is intentionally NOT in this helper — it is fetchData's
   * "don't re-apply on the next fetchData()" guard, not part of the
   * "apply template" UX, so the latch stays in fetchData where the
   * fetch-result consumer can see it.
   */
  const loadAndApplyTemplate = useCallback(
    (
      t: MissionTemplate,
      opts: {
        /** Persist the template's category as the user's last-used. */
        rememberCategory?: boolean;
        /** Strip the `?template=<id>` query param via replaceState. */
        clearQueryParam?: boolean;
      } = {},
    ) => {
      const cid = getCategoryIdFromTemplate(t);
      applyTemplateToForm(t, cid);
      if (opts.rememberCategory) rememberLastCategory(cid);
      setShowCreate(true);
      showToast(`Template loaded: ${t.name}`, "success");
      if (opts.clearQueryParam) {
        window.history.replaceState({}, "", "/orchestration/missions");
      }
    },
    [applyTemplateToForm, showToast],
  );

  const fetchData = useCallback(async () => {
    try {
      const list = await fetchMissions();
      setMissions(list);
    } catch (error) {
      // `toastError` is the user-facing surface; the pre-session-178
      // `console.error` was the only error reporting and the user
      // saw nothing. Surfaces the same string the sibling
      // `fetchTemplates` catch block (line 562) reports, and
      // matches the `loadCategories` site on line 386 — all three
      // slices in `fetchData` now report failures via toast.
      toastError(showToast, error, "Failed to load missions");
    }

    await loadCategories();

    try {
      const loaded = await fetchTemplates();
      setTemplates(loaded);
      if (!templateApplied.current && loaded.length > 0) {
        const url = new URL(window.location.href);
        const templateId = url.searchParams.get("template");
        if (templateId) {
          const t = loaded.find(
            (tmpl: MissionTemplate) => tmpl.id === templateId,
          );
          if (t) {
            // The deep-link `?template=<id>` path is the only
            // `loadAndApplyTemplate` caller that wants
            // `rememberCategory` + `clearQueryParam` — both side
            // effects are unique to "I followed a deep link and the
            // page should remember that category for next time and
            // strip the now-consumed `?template=` query". The
            // interactive `handleTemplateSelect` path (a user
            // clicking a template in the list) does not pass either
            // option — it just applies + opens. The shared
            // apply+open+toast trio is consolidated in
            // `loadAndApplyTemplate`; the `templateApplied.current`
            // latch stays here because it is the "don't re-apply
            // on the next `fetchData()`" guard, not part of the
            // template-apply UX.
            loadAndApplyTemplate(t, {
              rememberCategory: true,
              clearQueryParam: true,
            });
            templateApplied.current = true;
          }
        }
      }
    } catch (error) {
      // The toast surfaces the real error to the user; the pre-refactor
      // `console.error` was redundant dev-only noise duplicating the
      // same string. Per session 131 P-131-4 console.error-redundancy rule.
      toastError(showToast, error, "Failed to load templates");
    }
  }, [fetchMissions, fetchTemplates, showToast, loadCategories, loadAndApplyTemplate]);

  const fetchDetail = useCallback(
    (id: string, showLoading = true) => {
      if (showLoading) setDetailLoading(true);
      fetchMissionDetail(id)
        .then((data) => {
          if (data) setDetail(data);
        })
        .catch((error) => {
          // The detail panel has no `error` useState to dispatch
          // through `setErrorFromCaught`, so `toastError` is the
          // user-facing surface. The pre-session-178 `console.error`
          // was the only error reporting and the user saw nothing
          // when expanding a broken mission. Matches the user-
          // visible contract of `fetchData`'s three slices (lines
          // 526, 539, 562 — all surface failures via toast).
          toastError(showToast, error, "Failed to load mission detail");
        })
        .finally(() => {
          if (showLoading) setDetailLoading(false);
        });
    },
    [fetchMissionDetail, showToast],
  );

  useEffect(() => {
    expandedIdRef.current = expandedId;
  }, [expandedId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetchData().finally(() => {
      if (!cancelled) setLoading(false);
    });
    const interval = setInterval(() => {
      void fetchData();
      const id = expandedIdRef.current;
      if (id) fetchDetail(id, false);
    }, 15_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [fetchData, fetchDetail]);

  useEffect(() => {
    if (expandedId) {
      setPromptCollapsed(true);
      fetchDetail(expandedId, true);
    } else {
      setDetail(null);
    }
  }, [expandedId, fetchDetail]);

  const handleCreate = useCallback(async () => {
    if (!newName.trim() || !newInstruction.trim()) return;
    if (!editingId && !dispatchAcknowledged) {
      showToast("Open Dispatch to choose how this mission runs.", "error");
      return;
    }
    if (dispatching) return;
    setDispatching(true);

    try {
      if (editingId) {
        const existingMission = missions.find((m) => m.id === editingId);
        const isCompleted =
          existingMission &&
          (existingMission.status === "successful" ||
            existingMission.status === "failed");
        const isRunning = existingMission?.status === "dispatched";
        const isPromotable =
          existingMission &&
          (isMissionDraft(existingMission) || isMissionQueuedForRun(existingMission));

        if (isRunning) {
          showToast("Updating mission...", "info");
          // The `dispatchMissionAction` helper composes the
          // `safeApiCall<MissionActionResponse>("/api/missions", { method:
          // "POST", body: { action, ...body } })` shape that all 4 action
          // branches in this function share — see JSDoc on the helper
          // for the 4-site rationale and the byte-equivalence claim.
          const result = await dispatchMissionAction("update", {
            missionId: editingId,
            name: newName,
            ...dispatchPayload(),
          });
          toastFromResult(
            showToast,
            result,
            "Mission updated",
            "Failed to update mission",
          );
          if (result.ok) {
            closeComposer();
            void fetchData();
            if (expandedId === editingId) void fetchDetail(editingId);
          }
          return;
        }

        if (isPromotable) {
          showToast(submitToastForDispatch(newDispatch), "info");
          // The route returns `{ data: { mission: {...} } }` (envelope).
          // The `dispatchMissionAction` helper unwraps the inner `data` via
          // the `MissionActionResponse` envelope type — see JSDoc on the
          // helper. We only read `ok`/`error` here, so we destructure the
          // safe-result tuple and pass the relevant fields to
          // `toastFromResult`.
          const { ok, error } = await dispatchMissionAction("promote", {
            missionId: editingId,
            name: newName,
            ...dispatchPayload({
              dispatchMode: newDispatch,
            }),
          });
          toastFromResult(
            showToast,
            { ok, error },
            () => successMessageForDispatch(newDispatch, newSchedule),
            "Failed to update mission",
          );
          if (ok) {
            closeComposer();
            resetForm();
            await fetchData();
            if (expandedId === editingId) void fetchDetail(editingId);
          }
          return;
        }

        if (!isCompleted) return;

        setEditingId(null);

        // The route returns `{ data: { mission: { id } } }` (envelope).
        // The `dispatchMissionAction` helper unwraps the inner envelope via
        // the `MissionActionPayload` type, so `result.data?.data?.mission?.id`
        // (the pre-helper two-level indirection) collapses to
        // `result.data?.mission?.id` (one level). Same wire shape, same
        // byte-level outcome on success and on error. See JSDoc on the
        // helper in `src/hooks/success-message-for-dispatch.ts` for the
        // 1-level unwrap contract.
        const result = await dispatchMissionAction("dispatch", {
          name: newName,
          ...dispatchPayload({ dispatchMode: "now" }),
        });

        toastFromResult(
          showToast,
          result,
          "Mission re-dispatched",
          "Failed to re-dispatch mission",
        );
        if (result.ok) {
          const body = result.data;
          await fetchData();
          if (body?.mission?.id) {
            setExpandedId(body.mission.id);
            void fetchDetail(body.mission.id);
          }
        }
        return;
      }

      showToast(submitToastForDispatch(newDispatch), "info");

      // The route returns `{ data: { mission: { id } } }` (envelope).
      // The `dispatchMissionAction` helper unwraps the inner envelope via
      // the `MissionActionPayload` type, so `data.data?.mission?.id` (the
      // pre-helper two-level indirection) collapses to `data?.mission?.id`
      // (one level). Same wire shape, same byte-level outcome. See JSDoc
      // on the helper in `src/hooks/success-message-for-dispatch.ts` for
      // the 1-level unwrap contract.
      const { ok, error, data } = await dispatchMissionAction("dispatch", {
        name: newName,
        ...dispatchPayload({
          dispatchMode: newDispatch,
        }),
      });

      toastFromResult(
        showToast,
        { ok, error },
        () => successMessageForDispatch(newDispatch, newSchedule),
        "Failed to create mission",
      );
      if (ok) {
        if (newDispatch === "save" || newDispatch === "queue") {
          resetForm();
          void fetchData();
        } else if (newDispatch === "now") {
          const body = data;
          await fetchData();
          if (body?.mission?.id) {
            setExpandedId(body.mission.id);
            void fetchDetail(body.mission.id);
          }
        } else {
          await fetchData();
        }
      }
    } catch (err) {
      toastError(showToast, err, "Network error — please try again");
    } finally {
      setDispatching(false);
    }
  }, [newName, newInstruction, editingId, dispatchAcknowledged, dispatching, showToast, newDispatch, newSchedule, missions, dispatchPayload, fetchData, resetForm, fetchDetail, expandedId, closeComposer]);

  // ── Mission handlers ───────────────────────────────────────────────

  const handleEdit = useCallback((m: MissionRow) => {
    setEditingId(m.id);
    populateFormFromMission(m, { editing: true });
    setShowCreate(true);
  }, [populateFormFromMission]);

  const handleDuplicateMission = useCallback((m: MissionRow) => {
    setEditingId(null);
    populateFormFromMission(m, { editing: false, namePrefix: "(copy)" });
    setNewDispatch("save");
    setShowCreate(true);
    showToast("Mission duplicated as draft", "success");
  }, [populateFormFromMission, showToast, setNewDispatch]);

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

  const handleSaveAsTemplate = useCallback(async () => {
    if (!newInstruction.trim()) return;

    const name = newName.trim() || "Untitled Template";

    // Check if we're overwriting an existing template
    const existingTemplate = editingTemplateId
      ? templates.find((t) => t.id === editingTemplateId)
      : templates.find(
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

    if (existingTemplate) {
      const confirmed = window.confirm(
        `Overwrite template "${existingTemplate.name}"?`,
      );
      if (!confirmed) return;
    }

    const payload = buildTemplatePayload({
      action: existingTemplate ? "update" : "create",
      templateId: existingTemplate?.id,
      name,
      icon: templateIcon,
      color: templateColor,
      description: templateDescription,
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
  }, [newInstruction, newName, editingTemplateId, templates, templateIcon, templateColor, templateDescription, newContext, newOutputFormat, newConstraints, newGoals, newLocalDirs, newReferences, newSkills, newToolsets, newProfile, newModel, newProvider, newTimeout, newCategoryId, persistTemplate, setEditingTemplateId]);

  const handleCreateNewTemplate = useCallback(() => {
    setEditingTemplateId(null);
    setTemplateName("");
    setTemplateDescription("");
    setTemplateIcon("Zap");
    setTemplateColor("cyan");
    clearMissionFormFields();
    // `closeTemplateManager` is the hook's stable close-callback for
    // the template-manager modal (sibling of `openTemplateManager`).
    // Pre-session-211: this site inlined `setShowTemplateManager
    // (false)` directly. The 2-1/2 line of code is byte-equivalent
    // (same `setShowTemplateManager(false)` payload via the callback
    // body at line 443-445), but the migration keeps the 3 internal
    // hook call sites consistent with the page's `<TemplateManagerModal
    // onClose={closeTemplateManager}>` JSX binding — any future
    // "also clear the template filter" or "also reset template
    // category" extension added to `closeTemplateManager` lands
    // here too, automatically. The deps array adds `closeTemplateManager`
    // (it's a stable `useCallback` with `[]` deps, so the reference
    // is the same on every render of the hook — adding it is a
    // correctness no-op but keeps the linter happy).
    closeTemplateManager();
    setShowTemplateEditor(true);
  }, [closeTemplateManager, clearMissionFormFields, setEditingTemplateId, setTemplateName, setTemplateDescription, setTemplateIcon, setTemplateColor, setShowTemplateEditor]);

  const handleTemplateSave = useCallback(async () => {
    if (!templateName.trim()) return;

    const payload = buildTemplatePayload({
      action: editingTemplateId ? "update" : "create",
      templateId: editingTemplateId ?? undefined,
      name: templateName,
      icon: templateIcon,
      color: templateColor,
      description: templateDescription,
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
      categoryId: newCategoryId ?? null,
      dispatchMode: editingTemplateId ? undefined : newDispatch,
      schedule: editingTemplateId ? undefined : newSchedule,
    });

    await persistTemplate(payload, () => {
      setShowTemplateEditor(false);
      setEditingTemplateId(null);
    });
  }, [templateName, editingTemplateId, templateIcon, templateColor, templateDescription, newInstruction, newContext, newOutputFormat, newConstraints, newGoals, newLocalDirs, newReferences, newSkills, newToolsets, newProfile, newModel, newProvider, newTimeout, newCategoryId, newDispatch, newSchedule, persistTemplate, setShowTemplateEditor, setEditingTemplateId]);

  const handleEditTemplate = useCallback(
    (t: MissionTemplate) => {
      setEditingTemplateId(t.id);
      setTemplateName(t.name);
      setTemplateDescription(t.description || "");
      setTemplateIcon(t.icon);
      setTemplateColor(t.color);
      applyTemplateToForm(t);
      // `closeTemplateManager` is the hook's stable close-callback for
      // the template-manager modal (sister migration to the same
      // pattern in `handleCreateNewTemplate` above and
      // `handleDeleteTemplate` below). Pre-session-211: this site
      // inlined `setShowTemplateManager(false)` directly. The migration
      // is byte-equivalent (same payload via the callback body at
      // line 443-445) and keeps the 3 internal hook call sites
      // consistent with the page's `<TemplateManagerModal onClose={
      // closeTemplateManager}>` JSX binding. The deps array adds
      // `closeTemplateManager` (stable `useCallback` with `[]` deps,
      // so the reference is the same on every render).
      closeTemplateManager();
      setShowTemplateEditor(true);
    },
    [applyTemplateToForm, closeTemplateManager, setEditingTemplateId, setTemplateName, setTemplateDescription, setTemplateIcon, setTemplateColor, setShowTemplateEditor],
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
      // byte-equivalent (same payload via the callback body at line
      // 443-445) and keeps the 3 internal hook call sites consistent
      // with the page's `<TemplateManagerModal onClose={
      // closeTemplateManager}>` JSX binding. The deps array adds
      // `closeTemplateManager` (stable `useCallback` with `[]` deps,
      // so the reference is the same on every render).
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

  const handleDelete = useCallback(async (id: string) => {
    // Migrated from the inline `safeApiCall("/api/missions", { method: "POST", body: { action: "delete", missionId: id } })`
    // form to the shared `dispatchMissionAction` helper. The helper's `MissionActionResponse`
    // envelope type is typed once at the helper, so the call site no longer needs the inline
    // call shape. The toast + fetchData + setExpandedId(null) post-success flow is preserved
    // byte-equivalent. The pre-session 207 form had a `window.confirm(...)` pre-confirm
    // guard here — that guard has moved into the `MissionEditorPanel` leaf component as a
    // per-row `useTwoStepConfirm({ autoDismissMs: 4000 })` instance, where the mission id
    // is in scope at render time. By the time `handleDelete` is called, the user has
    // already confirmed in the leaf; this hook is a thin transport wrapper.
    const result = await dispatchMissionAction("delete", { missionId: id });
    toastFromResult(showToast, result, "Mission deleted", "Failed to delete mission");
    if (result.ok) {
      if (expandedId === id) setExpandedId(null);
      fetchData();
    }
  }, [showToast, expandedId, fetchData]);

  const handleCancel = useCallback(async (id: string) => {
    // The pre-session 207 form had a `window.confirm(...)` pre-confirm
    // guard here — that guard has moved into the `MissionEditorPanel`
    // leaf component as a per-row `useTwoStepConfirm({ autoDismissMs:
    // 4000 })` instance, where the mission id is in scope at render
    // time. By the time `handleCancel` is called, the user has already
    // confirmed in the leaf; this hook is a thin transport wrapper
    // (optimistic status flip + wire cancel + toast + restore-on-fail).
    const previousMission = missions.find((m) => m.id === id);
    setCancellingMissionId(id);
    showToast("Cancelling mission…", "info");
    // Optimistic status flip via the `updateMission(id, updater)`
    // helper — the same id-discriminator + setMissions((prev) =>
    // prev.map((m) => m.id === ID ? updater(m) : m)) shape, just
    // composed once. The updater is intentionally narrow (only the
    // fields the cancel-flip touches) so a future "also clear
    // cronJobId" extension lands in the updater, not in a duplicated
    // inline map call.
    updateMission(id, (m) => ({
      ...m,
      status: "failed" as const,
      result: "Cancelled by user",
    }));

    try {
      // Migrated from the inline `safeApiCall("/api/missions", { method: "POST", body: { action: "cancel", missionId: id } })`
      // form to the shared `dispatchMissionAction` helper. Same wire call, same envelope
      // type, same `ok`/`error` fields. The restore-on-failure path (the 2 sites
      // that used to call the `restoreMission(restored)` 1-line wrapper) now inlines
      // `updateMission(id, () => restored)` directly — the wrapper was just a closure
      // capture of the same `id`, and inlining saves a 3-line closure declaration.
      const result = await dispatchMissionAction("cancel", { missionId: id });
      toastFromResult(
        showToast,
        result,
        "Mission cancelled",
        "Failed to cancel mission",
      );
      if (result.ok) {
        await fetchData();
        if (expandedId === id) void fetchDetail(id);
      } else if (previousMission) {
        updateMission(id, () => previousMission);
      }
    } catch (err) {
      if (previousMission) {
        updateMission(id, () => previousMission);
      }
      toastError(showToast, err, "Network error — could not cancel mission");
    } finally {
      setCancellingMissionId(null);
    }
  }, [missions, showToast, fetchData, expandedId, fetchDetail, updateMission]);

  const filtered = useMemo(
    () => filterMissions(missions, { filter, missionCategoryFilter, search }),
    [missions, filter, search, missionCategoryFilter],
  );

  // Counts are a single .reduce() pass (see computeMissionCounts) whose 5
  // buckets are intentionally NON-mutually-exclusive — a `status:"queued"
  // && queuedForRun:true` mission increments both `active` and `queued`,
  // matching the original 5 independent .filter().length passes.
  const missionCounts = useMemo(() => computeMissionCounts(missions), [missions]);

  const templateCategoryPills = useMemo(
    () => computeTemplateCategoryPills(templates, categories),
    [templates, categories],
  );

  const missionCategoryPills = useMemo(
    () => computeMissionCategoryPills(missions, categories),
    [missions, categories],
  );

  const filteredGrouped = useMemo(
    () => filterGroupedTemplates(templates, categories, categoryFilter),
    [templates, categoryFilter, categories],
  );

  return {
    toastElement,
    loading,
    missions,
    templates,
    fetchData,
    missionCounts,
    showCreate,
    setShowCreate,
    editingId,
    setEditingId,
    filter,
    setFilter,
    search,
    setSearch,
    expandedId,
    setExpandedId,
    detail,
    detailLoading,
    promptCollapsed,
    setPromptCollapsed,
    collapsedColumns,
    setCollapsedColumns,
    categoryFilter,
    setCategoryFilter,
    missionCategoryFilter,
    setMissionCategoryFilter,
    categories,
    categoriesLoadError,
    newCategoryId,
    setNewCategoryId,
    showCategoryManager,
    openCategoryManager,
    closeCategoryManager,
    loadCategories,
    handleCreateCategory,
    handleCreateNewTemplate,
    handleUpdateCategory,
    handleDeleteCategory,
    setCategoryId,
    templateCategoryPills,
    missionCategoryPills,
    filteredGrouped,
    filtered,
    formState,
    setFormField,
    handleCreate,
    openCreate,
    closeComposer,
    handleSaveAsTemplate,
    dispatching,
    cancellingMissionId,
    handleTemplateSelect,
    openTemplateManager,
    closeTemplateManager,
    showTemplateManager,
    handleEditTemplate,
    handleDeleteTemplate,
    showTemplateEditor,
    setShowTemplateEditor,
    closeTemplateEditor,
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
    handleTemplateSave,
    newInstruction,
    setNewInstruction,
    newContext,
    setNewContext,
    newGoals,
    setNewGoals,
    newOutputFormat,
    setNewOutputFormat,
    newConstraints,
    setNewConstraints,
    dispatchAcknowledged,
    setDispatchAcknowledged,
    newProfile,
    setNewProfile,
    newModel,
    newProvider,
    setNewModel,
    setNewProvider,
    setModelAndProvider,
    newMissionTime,
    setNewMissionTime,
    newTimeout,
    setNewTimeout,
    newLocalDirs,
    setNewLocalDirs,
    localDirDraft,
    setLocalDirDraft,
    newReferences,
    setNewReferences,
    referenceInput,
    setReferenceInput,
    newSkills,
    setNewSkills,
    handleEdit,
    handleDelete,
    handleCancel,
    handleDuplicateMission,
  };
}

export type MissionsPageViewModel = ReturnType<typeof useMissionsPage>;
