import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useToast } from "@/components/ui/Toast";
import { useMissionsApi } from "@/hooks/useMissionsApi";
import { safeApiCall, apiFetch, toastError, safeApiCallData, setErrorFromCaught } from "@/lib/api-fetch";
import { toastFromResult } from "@/lib/toast-from-result";
import { successMessageForDispatch, dispatchMissionAction } from "@/hooks/success-message-for-dispatch";
import type { LocalDirEntry, Mission } from "@/types/hermes";
import { normalizeLocalDirsInput } from "@/lib/local-dir-entry";
import { parseMissionPrompt } from "@/lib/build-mission-prompt";
import { unionToolsetsFromPlatforms } from "@/lib/hermes-toolset-unify";
import type { PlatformToolsets } from "@/lib/profile-config-builder";
import type { MissionFormState } from "@/components/missions/MissionCreateForm";
import type { MissionTemplate } from "@/components/missions/TemplateModals";
import {
  categoryFilterPills,
  groupTemplatesByCategory,
} from "@/lib/mission-categories";
import type { ManagedCategory } from "@/components/missions/CategoryManagerModal";
import { buildTemplatePayload, splitGoals } from "@/lib/mission-form-utils";
import { scheduleForDispatch } from "@/lib/dispatch-mode";
import {
  isMissionActive,
  isMissionDraft,
  isMissionQueuedForRun,
  missionBoardColumn,
} from "@/lib/mission-board";

/** localStorage key for the most recently selected mission category */
const LAST_CATEGORY_KEY = "ch-last-mission-category";

/**
 * Read the legacy `categoryId` field from a `MissionTemplate`.
 *
 * The `MissionTemplate` interface (in `src/components/missions/TemplateModals.tsx`)
 * exposes `category: string` as the canonical category field, but the
 * legacy backend response shape also carries a `categoryId?: string`
 * field that 3 call sites in this file (the `applyTemplateToForm` body,
 * the `fetchData` template-apply path, and the `templateCategoryPills`
 * `useMemo`) need to read. The structural cast
 * `(t as MissionTemplate & { categoryId?: string })` was duplicated at
 * all 3 sites — this helper centralises the cast + read + fallback
 * discipline so a future "drop the legacy shape" change lands in one
 * place. The `?? fallback` preserves the original `?? <default>`
 * semantics at every call site.
 *
 * Byte-equivalent to the inline form: same cast, same read, same
 * `?? <fallback>` fallback. The helper body is literally
 * `(t as MissionTemplate & { categoryId?: string }).categoryId ?? fallback`.
 *
 * Exported for unit testing. Not part of the public hook contract;
 * the canonical use is the 3 callsites in this file.
 */
export function getCategoryIdFromTemplate(
  t: MissionTemplate,
  fallback: string | null = null,
): string | null {
  return (t as MissionTemplate & { categoryId?: string }).categoryId ?? fallback;
}

/**
 * Persist the user's last-selected mission category to localStorage.
 * Centralised so the 2 callsites (`setCategoryId` setter + the
 * template-apply path) use the same try/catch+ignore discipline.
 * Failing localStorage writes (quota, private-mode, disabled) are
 * silently ignored — the user-visible flow continues to work because
 * the in-memory `newCategoryId` state has already been set; we just
 * won't restore the same category on next mount.
 *
 * Exported for unit testing. Not part of the public hook contract;
 * the canonical use is the 2 callsites in this file.
 */
export function rememberLastCategory(id: string | null | undefined): void {
  if (!id) return;
  try {
    localStorage.setItem(LAST_CATEGORY_KEY, id);
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

/**
 * Read the user's last-selected mission category from localStorage.
 * Mirrors `rememberLastCategory()` — same try/catch+ignore discipline
 * (failing localStorage reads return `null` and the user-visible
 * flow continues to work because the in-memory `newCategoryId` state
 * stays empty; we just won't restore the same category on next mount).
 *
 * The 1 callsite (`useEffect` at the showCreate+!editingId guard
 * inside `useMissionsPage`) previously inlined a 3-line try/catch +
 * `getItem` + guard. Promoting to a helper here keeps the write and
 * read paths in lockstep — a future "migrate to a different
 * storage backend" change lands in both helpers in one place.
 *
 * Returns `null` on any failure (storage unavailable, parse error,
 * key missing). Exported for unit testing.
 */
export function readLastCategory(): string | null {
  try {
    return localStorage.getItem(LAST_CATEGORY_KEY);
  } catch {
    return null;
  }
}

function submitToastForDispatch(mode: "save" | "now" | "cron" | "queue"): string {
  if (mode === "save") return "Saving draft...";
  if (mode === "queue") return "Queueing mission...";
  if (mode === "cron") return "Scheduling mission...";
  return "Dispatching mission...";
}

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
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(
    null,
  );
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [templateIcon, setTemplateIcon] = useState("Zap");
  const [templateColor, setTemplateColor] = useState("cyan");
  const [templateSaving, setTemplateSaving] = useState(false);

  const [newName, setNewName] = useState("");
  const [newInstruction, setNewInstruction] = useState("");
  const [newContext, setNewContext] = useState("");
  const [newGoals, setNewGoals] = useState("");
  const [newOutputFormat, setNewOutputFormat] = useState("");
  const [newConstraints, setNewConstraints] = useState("");
  const [dispatchAcknowledged, setDispatchAcknowledged] = useState(false);
  const [newDispatch, setNewDispatch] = useState<"save" | "now" | "cron" | "queue">(
    "save",
  );
  const [newSchedule, setNewSchedule] = useState("every 5m");
  const [scheduleType, setScheduleType] = useState<"interval" | "wall-clock" | "post-run">("interval");
  const [scheduleStartTime, setScheduleStartTime] = useState("00:00");
  const [newMissionTime, setNewMissionTime] = useState(15);
  const [newTimeout, setNewTimeout] = useState(10);
  const [newProfile, setNewProfile] = useState("");
  const [newModel, setNewModel] = useState("");
  const [newProvider, setNewProvider] = useState("");
  const [newLocalDirs, setNewLocalDirs] = useState<LocalDirEntry[]>([]);
  const [localDirDraft, setLocalDirDraft] = useState<LocalDirEntry>({
    path: "",
    branch: null,
  });
  const [newReferences, setNewReferences] = useState<string[]>([]);
  const [newSkills, setNewSkills] = useState<string[]>([]);
  const [newToolsets, setNewToolsets] = useState<string[]>([]);
  const [referenceInput, setReferenceInput] = useState("");
  const [dispatching, setDispatching] = useState(false);
  const [cancellingMissionId, setCancellingMissionId] = useState<string | null>(
    null,
  );
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [missionCategoryFilter, setMissionCategoryFilter] = useState("all");
  const [categories, setCategories] = useState<ManagedCategory[]>([]);
  const [categoriesLoadError, setCategoriesLoadError] = useState<string | null>(
    null,
  );
  const [newCategoryId, setNewCategoryId] = useState<string | null>(null);
  const [showCategoryManager, setShowCategoryManager] = useState(false);

  const formState: MissionFormState = {
    newName,
    newInstruction,
    newContext,
    newGoals,
    newOutputFormat,
    newConstraints,
    newDispatch,
    newSchedule,
    scheduleType,
    scheduleStartTime,
    newMissionTime,
    newTimeout,
    newProfile,
    newModel,
    newProvider,
    newLocalDirs,
    localDirDraft,
    newReferences,
    referenceInput,
    newSkills,
    newToolsets,
  };

  // Typed map from form field → setter. The mapped type
  // `{ [P in keyof MissionFormState]: (v: MissionFormState[P]) => void }`
  // preserves each setter's per-field parameter type, so calling
  // `setters[field](value)` requires no `as` cast — replacing the prior
  // `Record<..., (v: union-of-everything) => void>` shape that lost types
  // and forced `(v as string)`, `(v as string[])`, etc. everywhere.
  // `newDispatch` has a side effect (also acknowledges the dispatch warning),
  // so it gets a custom wrapper.
  const setFormField = useCallback(
    <K extends keyof MissionFormState>(field: K, value: MissionFormState[K]) => {
      const setters: { [P in keyof MissionFormState]: (v: MissionFormState[P]) => void } = {
        newName: (v) => setNewName(v),
        newInstruction: (v) => setNewInstruction(v),
        newContext: (v) => setNewContext(v),
        newGoals: (v) => setNewGoals(v),
        newOutputFormat: (v) => setNewOutputFormat(v),
        newConstraints: (v) => setNewConstraints(v),
        newDispatch: (v) => {
          setNewDispatch(v);
          setDispatchAcknowledged(true);
        },
        newSchedule: (v) => setNewSchedule(v),
        scheduleType: (v) => setScheduleType(v),
        newMissionTime: (v) => setNewMissionTime(v),
        newTimeout: (v) => setNewTimeout(v),
        newProfile: (v) => setNewProfile(v),
        newModel: (v) => setNewModel(v),
        newProvider: (v) => setNewProvider(v),
        newLocalDirs: (v) => setNewLocalDirs(v),
        localDirDraft: (v) => setLocalDirDraft(v),
        newReferences: (v) => setNewReferences(v),
        referenceInput: (v) => setReferenceInput(v),
        newSkills: (v) => setNewSkills(v),
        newToolsets: (v) => setNewToolsets(v),
        scheduleStartTime: (v) => setScheduleStartTime(v),
      };
      setters[field](value);
    },
    [],
  );

  // Builds the JSON payload for `POST /api/missions` (dispatch, promote,
  // update) from the current form state. The `schedule` field is derived
  // internally via the canonical `scheduleForDispatch(newDispatch, newSchedule)`
  // helper from `@/lib/dispatch-mode` — the 3 call sites (update, promote,
  // dispatch-new) used to pass `schedule: scheduleForDispatch(newDispatch,
  // newSchedule)` as an override, but the override was always the SAME
  // expression (mode-aware, dispatch-mode-derived) so the per-call-site
  // override is pure noise. Centralising the derivation here means:
  //   1. Call sites drop the `schedule:` override (1-line collapse).
  //   2. Future dispatch modes that need a different `scheduleForDispatch`
  //      signature land in one place (this helper), not in 3 call sites.
  //   3. The 3 call sites that previously had `schedule: <undefined>` for
  //      non-cron modes (i.e. always — the override is only meaningful
  //      when mode is "cron") now get the same `schedule: undefined`
  //      from inside this helper, which JSON.stringify drops from the
  //      wire payload — byte-equivalent to the pre-refactor override form.
  const dispatchPayload = useCallback(
    (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
      instruction: newInstruction.trim(),
      context: newContext.trim() || undefined,
      outputFormat: newOutputFormat.trim() || undefined,
      constraints: newConstraints.trim() || undefined,
      categoryId: newCategoryId,
      goals: splitGoals(newGoals),
      profileName: newProfile || undefined,
      modelId: newModel || undefined,
      provider: newProvider || undefined,
      missionTimeMinutes: newMissionTime,
      timeoutMinutes: newTimeout,
      schedule: scheduleForDispatch(newDispatch, newSchedule),
      localDirs: newLocalDirs,
      references: newReferences,
      skills: newSkills,
      suggestedToolsets: newToolsets,
      ...overrides,
    }),
    [
      newInstruction, newContext, newOutputFormat, newConstraints, newCategoryId, newGoals,
      newProfile, newModel, newProvider, newMissionTime, newTimeout,
      newDispatch, newSchedule,
      newLocalDirs, newReferences, newSkills, newToolsets,
    ],
  );

  // `newModel` and `newProvider` are always set together (a model id
  // implies its provider). Centralise the pair so callers don't have to
  // remember to update both, and so the inline `onModelChange` handler
  // in the page stays a one-liner.
  const setModelAndProvider = useCallback(
    (modelId: string, provider: string) => {
      setNewModel(modelId);
      setNewProvider(provider);
    },
    [],
  );

  // Clears the mission-creation form fields shared between resetForm and
  // handleCreateNewTemplate. Does NOT touch the dispatch-acknowledgement flag
  // or the visibility of the create sheet — callers decide those.
  const clearMissionFormFields = useCallback(() => {
    setNewName("");
    setNewInstruction("");
    setNewContext("");
    setNewGoals("");
    setNewOutputFormat("");
    setNewConstraints("");
    setModelAndProvider("", "");
    setNewLocalDirs([]);
    setLocalDirDraft({ path: "", branch: null });
    setNewReferences([]);
    setNewSkills([]);
    setNewToolsets([]);
  }, [setModelAndProvider]);

  const resetForm = useCallback(() => {
    clearMissionFormFields();
    setDispatchAcknowledged(false);
    setNewDispatch("save");
    setShowCreate(false);
  }, [clearMissionFormFields]);

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

  // Open the category manager modal (the "Manage categories" button in
  // `MissionsList`, plus the `onManageCategories` prop in the page's
  // `<MissionCreateForm>`). The 2 inline `() => setShowCategoryManager(true)`
  // arrows that used to live at those call sites are now this single
  // named callback — the open/close pair is `openCategoryManager` here +
  // the page's `closeCategoryManager` (defined locally because the close
  // direction needs the inline `setShowCategoryManager` setter). The
  // `useCallback` deps array is `[]` (the setter is stable), matching
  // the sibling `openCreate` and `closeComposer` callbacks. Session 118
  // promoted this from inline-arrow to named-callback per session 116 P-7.
  const openCategoryManager = useCallback(() => {
    setShowCategoryManager(true);
  }, []);

  // Open the template manager modal (the "Edit Templates" button in
  // `MissionsList`). Sibling to the page's `closeTemplateManager` close
  // callback — same `useCallback` + `[]` deps shape as `openCategoryManager`.
  // The single inline `() => setShowTemplateManager(true)` arrow that
  // lived at the MissionsList call site is now this named callback.
  // Session 118 promoted this from inline-arrow to named-callback per
  // session 116 P-7.
  const openTemplateManager = useCallback(() => {
    setShowTemplateManager(true);
  }, []);

  useEffect(() => {
    if (!newProfile) return;
    const controller = new AbortController();
    const slug = encodeURIComponent(newProfile);
    Promise.all([
      apiFetch<{ data: { skills?: Array<{ name: string; enabled: boolean }> } }>(`/api/skills?profile=${slug}`, { signal: controller.signal }),
      apiFetch<{ data: { platformToolsets?: PlatformToolsets } }>(`/api/agent/profiles/${slug}/toolsets`, { signal: controller.signal }),
    ])
      .then(([skillsResult, toolsetsResult]) => {
        const enabled = new Set(
          (skillsResult.data?.skills ?? [])
            .filter((s) => s.enabled)
            .map((s) => s.name),
        );
        const toolsetIds = new Set(
          unionToolsetsFromPlatforms(
            toolsetsResult.data?.platformToolsets ?? {},
          ),
        );
        setNewSkills((prev) => prev.filter((s) => enabled.has(s)));
        setNewToolsets((prev) => prev.filter((t) => toolsetIds.has(t)));
      })
      .catch((err) => {
        if (err instanceof Error && err.name !== "AbortError") {
          console.warn("[useMissionsPage] failed to load profile skills/toolsets:", err.message);
        }
      });
    return () => controller.abort();
  }, [newProfile]);

  const loadCategories = useCallback(async () => {
    try {
      const list = await fetchCategories();
      setCategories(list);
      setCategoriesLoadError(null);
    } catch (error) {
      // The error is already surfaced to the user via (a) the inline
      // `categoriesLoadError` state the page renders and (b) the toast.
      // `setErrorFromCaught` composes `messageFromError(error, fallback)`
      // with the setter so this site reads as one call instead of the
      // 2-hop `setCategoriesLoadError(messageFromError(error, ...))` form.
      // This is the List 2 carryover closed in session 178 — same
      // byte-equivalent migration that closed the 4 List 1 pages
      // (session 159) and the Sidebar (session 176). The helper
      // returns the resolved message so the dual-dispatch (state + toast)
      // stays a single resolve — the same string lands in both the
      // rendered error and the toast.
      const msg = setErrorFromCaught(setCategoriesLoadError, error, "Failed to load categories");
      showToast(msg, "error");
    }
  }, [fetchCategories, showToast]);

  const handleCreateCategory = useCallback(
    async (name: string, color?: string): Promise<string | null> => {
      try {
        const cat = await createCategory(name, color);
        if (cat?.id) {
          await loadCategories();
          showToast(`Category "${name}" created`, "success");
          return cat.id as string;
        }
        showToast("Could not create category", "error");
      } catch (error) {
        // `toastError` already shows the user-facing message; the
        // pre-refactor `console.error` was redundant dev-only noise
        // duplicating the same string.
        toastError(showToast, error, "Failed to create category");
      }
      return null;
    },
    [createCategory, loadCategories, showToast],
  );

  const handleUpdateCategory = useCallback(
    async (id: string, patch: { name?: string; color?: string }) => {
      await updateCategory(id, patch);
      await loadCategories();
    },
    [updateCategory, loadCategories],
  );

  // Refresh all three data slices (missions + categories + templates) in
  // parallel. The 3 fetches are independent — none of them passes data
  // to the others — so they can run concurrently instead of sequentially.
  // Each fetch has its own per-promise error handling (loadCategories in
  // its own try/catch, fetchMissions/fetchTemplates in their respective
  // calling sites), so Promise.allSettled is the right primitive: the
  // refetch attempt continues even if one slice fails, instead of the
  // previous "stop on first rejection" behavior (where the rejection
  // was unhandled in the caller anyway). Byte-equivalent at runtime when
  // all 3 succeed (the common case); strictly more informative when one
  // or more fail (the user gets a more complete UI instead of a partial
  // refetch).
  const reloadAllData = useCallback(async () => {
    await Promise.allSettled([
      fetchMissions().then(setMissions),
      loadCategories(),
      fetchTemplates().then(setTemplates),
    ]);
  }, [fetchMissions, loadCategories, fetchTemplates]);

  const handleDeleteCategory = useCallback(
    async (id: string, reassignToId: string | null) => {
      await deleteCategory(id, reassignToId);
      await reloadAllData();
    },
    [deleteCategory, reloadAllData],
  );

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

  const setCategoryId = useCallback((id: string | null) => {
    setNewCategoryId(id);
    rememberLastCategory(id);
  }, []);

  useEffect(() => {
    if (showCreate && !editingId) {
      const last = readLastCategory();
      if (last && !newCategoryId) setNewCategoryId(last);
    }
  }, [showCreate, editingId, newCategoryId]);

  // ── Shared form population helpers ─────────────────────────────────

  /**
   * Populate form state from a mission template.
   * Used by handleTemplateSelect, handleTemplateEdit, and fetchData.
   *
   * The 5 inline `(t as MissionTemplate & { X?: Y })` casts that used to
   * wrap reads of `outputFormat`, `constraints`, `localDirs`, `references`,
   * `suggestedToolsets`, and `timeoutMinutes` were redundant: those fields
   * are already declared (as optional) on the `MissionTemplate` interface
   * in `src/components/missions/TemplateModals.tsx`. The `categoryId`
   * read is the only one that genuinely needs a cast — `MissionTemplate`
   * exposes `category: string`, not `categoryId: string`, so the legacy
   * backend response shape (`{ categoryId }`) needs a one-off structural
   * cast to read the id.
   */
  const applyTemplateToForm = useCallback(
    (
      t: MissionTemplate & {
        instruction?: string;
        context?: string;
        dispatchMode?: string;
        schedule?: string;
        name?: string;
      },
      categoryIdOverride?: string | null,
    ) => {
      setNewName(t.name ?? "");
      setNewInstruction(t.instruction || "");
      setNewContext(t.context || "");
      setNewGoals((t.goals || []).join("\n"));
      setNewOutputFormat(t.outputFormat ?? "");
      setNewConstraints(t.constraints ?? "");
      setNewProfile(t.profile || "");
      setModelAndProvider(t.defaultModel || "", t.defaultProvider || "");
      setNewLocalDirs(normalizeLocalDirsInput(t.localDirs));
      setLocalDirDraft({ path: "", branch: null });
      setNewReferences(t.references ?? []);
      setNewSkills(t.suggestedSkills || []);
      setNewToolsets(t.suggestedToolsets ?? []);
      setNewCategoryId(
        categoryIdOverride !== undefined
          ? categoryIdOverride
          : getCategoryIdFromTemplate(t)
      );
      const tm = t.timeoutMinutes;
      if (typeof tm === "number" && Number.isFinite(tm)) {
        setNewTimeout(tm);
      }
      if (t.dispatchMode) {
        setNewDispatch(t.dispatchMode as "save" | "now" | "cron" | "queue");
      }
      if (t.schedule) setNewSchedule(t.schedule);
    },
    [setModelAndProvider],
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
            const cid = getCategoryIdFromTemplate(t);
            applyTemplateToForm(t, cid);
            rememberLastCategory(cid);
            setShowCreate(true);
            templateApplied.current = true;
            showToast(`Template loaded: ${t.name}`, "success");
            window.history.replaceState({}, "", "/orchestration/missions");
          }
        }
      }
    } catch (error) {
      // The toast surfaces the real error to the user; the pre-refactor
      // `console.error` was redundant dev-only noise duplicating the
      // same string. Per session 131 P-131-4 console.error-redundancy rule.
      toastError(showToast, error, "Failed to load templates");
    }
  }, [fetchMissions, fetchTemplates, showToast, loadCategories, applyTemplateToForm]);

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

  // ── Shared form population helpers ─────────────────────────────────

  /**
   * Populate form state from a mission.
   * Used by both handleEdit (in-place edit) and handleDuplicateMission.
   */
  const populateFormFromMission = useCallback(
    (m: MissionRow, opts: { editing: boolean; namePrefix?: string }) => {
    const parsed = parseMissionPrompt(m.prompt);
    setNewName(opts.namePrefix ? `${m.name} ${opts.namePrefix}` : m.name);
    setNewInstruction(parsed.instruction);
    setNewContext(parsed.context);
    setNewOutputFormat(m.outputFormat ?? parsed.outputFormat ?? "");
    setNewConstraints(m.constraints ?? parsed.constraints ?? "");
    setNewGoals(m.goals?.join("\n") ?? "");
    setDispatchAcknowledged(opts.editing);
    setNewLocalDirs(normalizeLocalDirsInput(m.localDirs));
    setLocalDirDraft({ path: "", branch: null });
    setNewReferences(m.references ?? []);
    setNewSkills(m.skills ?? []);
    setNewCategoryId(m.categoryId ?? null);
    setModelAndProvider(m.modelId || m.model || "", m.provider || "");
    if (m.profileName) setNewProfile(m.profileName);
    if (typeof m.missionTimeMinutes === "number") setNewMissionTime(m.missionTimeMinutes);
    if (typeof m.timeoutMinutes === "number") setNewTimeout(m.timeoutMinutes);
    if (m.schedule) {
      setNewSchedule(m.schedule);
      const s = m.schedule.trim();
      setScheduleType(s.includes("*") || /^\d/.test(s) ? "wall-clock" : "interval");
    } else {
      setNewSchedule("every 5m");
      setScheduleType("interval");
    }
    if (opts.editing) {
      if (m.status === "successful" || m.status === "failed") {
        setNewDispatch("now");
      } else if (isMissionQueuedForRun(m)) {
        setNewDispatch("queue");
      } else if (m.status === "queued") {
        setNewDispatch("save");
      } else if (m.cronJobId) {
        setNewDispatch("cron");
      } else if (m.status === "dispatched") {
        setNewDispatch("now");
      }
    }
  }, [setModelAndProvider]);

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
  }, [populateFormFromMission, showToast]);

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
    [showToast, fetchData],
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
  }, [newInstruction, newName, editingTemplateId, templates, templateIcon, templateColor, templateDescription, newContext, newOutputFormat, newConstraints, newGoals, newLocalDirs, newReferences, newSkills, newToolsets, newProfile, newModel, newProvider, newTimeout, newCategoryId, persistTemplate]);

  const handleCreateNewTemplate = useCallback(() => {
    setEditingTemplateId(null);
    setTemplateName("");
    setTemplateDescription("");
    setTemplateIcon("Zap");
    setTemplateColor("cyan");
    clearMissionFormFields();
    setShowTemplateManager(false);
    setShowTemplateEditor(true);
  }, [clearMissionFormFields]);

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
  }, [templateName, editingTemplateId, templateIcon, templateColor, templateDescription, newInstruction, newContext, newOutputFormat, newConstraints, newGoals, newLocalDirs, newReferences, newSkills, newToolsets, newProfile, newModel, newProvider, newTimeout, newCategoryId, newDispatch, newSchedule, persistTemplate]);

  const handleEditTemplate = useCallback(
    (t: MissionTemplate) => {
      setEditingTemplateId(t.id);
      setTemplateName(t.name);
      setTemplateDescription(t.description || "");
      setTemplateIcon(t.icon);
      setTemplateColor(t.color);
      applyTemplateToForm(t);
      setShowTemplateManager(false);
      setShowTemplateEditor(true);
    },
    [applyTemplateToForm],
  );

  const handleDeleteTemplate = useCallback(async (templateId: string) => {
    if (!confirm("Delete this template?")) return;
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
      setShowTemplateManager(false);
      fetchData();
    }
  }, [showToast, fetchData]);

  const handleTemplateSelect = useCallback((t: MissionTemplate) => {
    applyTemplateToForm(t);
    setShowCreate(true);
    showToast(`Template loaded: ${t.name}`, "success");
  }, [applyTemplateToForm, showToast]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm("Delete this mission and its cron job?")) return;
    // Migrated from the inline `safeApiCall("/api/missions", { method: "POST", body: { action: "delete", missionId: id } })`
    // form to the shared `dispatchMissionAction` helper. The helper's `MissionActionResponse`
    // envelope type is typed once at the helper, so the call site no longer needs the inline
    // call shape. The toast + fetchData + setExpandedId(null) post-success flow is preserved
    // byte-equivalent.
    const result = await dispatchMissionAction("delete", { missionId: id });
    toastFromResult(showToast, result, "Mission deleted", "Failed to delete mission");
    if (result.ok) {
      if (expandedId === id) setExpandedId(null);
      fetchData();
    }
  }, [showToast, expandedId, fetchData]);

  const handleCancel = useCallback(async (id: string) => {
    if (
      !confirm(
        "Cancel this mission? The running agent (and any subagents) will be stopped, and linked cron jobs will be paused.",
      )
    )
      return;

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
    () =>
      missions.filter((m) => {
        if (filter !== "all") {
          const column = missionBoardColumn(m);
          if (filter !== column) return false;
        }
        if (missionCategoryFilter !== "all") {
          if (missionCategoryFilter === "__uncategorized__") {
            if (m.categoryId) return false;
          } else if (m.categoryId !== missionCategoryFilter) {
            return false;
          }
        }
        if (
          search &&
          !m.name.toLowerCase().includes(search.toLowerCase()) &&
          !m.prompt.toLowerCase().includes(search.toLowerCase())
        )
          return false;
        return true;
      }),
    [missions, filter, search, missionCategoryFilter],
  );

  // Single .reduce() pass over `missions` instead of 5 separate
  // .filter().length passes. The 5 buckets match the original
  // `missions.filter(predicate).length` shape VERBATIM — including the
  // non-mutually-exclusive nature of (a) `active` vs (b) `queued`.
  // Per the source in src/lib/mission-board.ts:
  //   isMissionActive       = status==="dispatched" || queuedForRun===true
  //   isMissionQueuedForRun = status==="queued" && queuedForRun===true
  // So a `status:"queued" && queuedForRun:true` mission increments BOTH
  // `active` AND `queued` — the same as the original 5 independent
  // .filter().length passes. We can't use `else if` to make them
  // mutually exclusive without changing observable counts. Independent
  // `if` branches are required to preserve the original semantics. The
  // named keys + per-branch increment match the previous shape
  // verbatim, so consumers (MissionsList) see no change in totals.
  const missionCounts = useMemo(
    () =>
      missions.reduce(
        (acc, m) => {
          if (isMissionActive(m)) acc.active += 1;
          if (m.status === "successful") acc.completed += 1;
          if (m.status === "failed") acc.failed += 1;
          if (isMissionDraft(m)) acc.drafts += 1;
          if (isMissionQueuedForRun(m)) acc.queued += 1;
          return acc;
        },
        { active: 0, completed: 0, failed: 0, drafts: 0, queued: 0 },
      ),
    [missions],
  );

  useEffect(() => {
    if (!showCreate || editingId) return;
    if (newModel.trim()) return;

    const controller = new AbortController();
    void (async () => {
      try {
        // Both endpoints return `{ data: <inner> }`. `safeApiCallData`
        // unwraps the envelope directly so `defaults?.defaults?.agent`
        // and `models?.models` read the actual payloads. The pre-
        // refactor code read the envelope and the agent-default auto-
        // fill was always a no-op (the values were on
        // `result.data.data`, not `result.data`). This is the same
        // "feature is not working" fix applied to `useGatewayHealth`
        // and `useCronJobMutation` in this session.
        const [defaults, models] = await Promise.all([
          safeApiCallData<{ defaults?: { agent?: string | null } }>(
            "/api/models/defaults",
            { signal: controller.signal },
          ),
          safeApiCallData<{ models?: Array<{ id: string; modelId: string; provider: string }> }>(
            "/api/models",
            { signal: controller.signal },
          ),
        ]);
        if (!defaults || !models) return;

        const agentRegistryId = defaults.defaults?.agent;
        if (!agentRegistryId) return;

        const match = models.models?.find((m) => m.id === agentRegistryId);
        if (!match) return;

        setModelAndProvider(match.modelId, match.provider);
      } catch {
        /* aborted or network */
      }
    })();

    return () => controller.abort();
  }, [showCreate, editingId, newModel, setModelAndProvider]);

  const templateCategoryPills = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of templates) {
      const cid = getCategoryIdFromTemplate(t, "general")!;
      counts[cid] = (counts[cid] ?? 0) + 1;
    }
    return categoryFilterPills(categories, counts, false, 0);
  }, [templates, categories]);

  const missionCategoryPills = useMemo(() => {
    const counts: Record<string, number> = {};
    let uncategorized = 0;
    for (const m of missions) {
      if (!m.categoryId) {
        uncategorized += 1;
      } else {
        counts[m.categoryId] = (counts[m.categoryId] ?? 0) + 1;
      }
    }
    return categoryFilterPills(categories, counts, true, uncategorized);
  }, [missions, categories]);

  const filteredGrouped = useMemo(() => {
    const grouped = groupTemplatesByCategory(
      templates as Array<MissionTemplate & { categoryId?: string }>,
      categories,
    );
    if (categoryFilter === "all") return grouped;
    return grouped.filter((g) => {
      if (categoryFilter === "__uncategorized__") {
        return g.categoryId === null;
      }
      return g.categoryId === categoryFilter;
    });
  }, [templates, categoryFilter, categories]);

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
    setShowCategoryManager,
    openCategoryManager,
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
    setShowTemplateManager,
    openTemplateManager,
    showTemplateManager,
    handleEditTemplate,
    handleDeleteTemplate,
    showTemplateEditor,
    setShowTemplateEditor,
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
