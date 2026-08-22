// ═══════════════════════════════════════════════════════════════
// useMissionsData — loading, polling and the expanded detail panel
// ═══════════════════════════════════════════════════════════════
//
// Split out of useMissionsPage (Phase 4 god-file decomposition). Owns
// the answer to "what is on screen, and when is it refetched": the
// missions + templates slices, the category catalog wiring, the 15s
// poll, the expanded row's detail panel, and the `?template=<id>`
// deep link that opens the composer with a template loaded.
//
// The category hook is composed HERE rather than one level up because
// the wiring is circular at the call site: useMissionCategories needs
// `onMissionsReassigned` (a reload of the two list slices this hook
// owns) and `fetchData` needs the `loadCategories` that same hook
// returns. Composing it here resolves both directions in one pass, in
// the order the pre-split hook used.
//
// useMissionsApi stays its own hook and is called from here. It is NOT
// folded into useApiResource: that hook's header deliberately excludes
// callback grids (useMissionsApi), mutation hooks (useSchedules) and
// multi-query bundles (useDashboard).

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { ToastType } from "@/components/ui/Toast";
import { toastError } from "@/lib/api-fetch";
import { useMissionsApi } from "@/hooks/useMissionsApi";
import { useMissionCategories } from "@/hooks/useMissionCategories";
import type { useMissionComposer } from "@/hooks/useMissionComposer";
import type { MissionDetail, MissionRow } from "@/hooks/missions-page-types";
import type { MissionTemplate } from "@/components/missions/TemplateModals";
import {
  getCategoryIdFromTemplate,
  rememberLastCategory,
} from "@/lib/missions/mission-composer-utils";

type ToastFn = (message: string, type?: ToastType) => void;

export interface UseMissionsDataArgs {
  showToast: ToastFn;
  /** Composer form population — the deep-link template apply writes through it. */
  applyTemplateToForm: ReturnType<typeof useMissionComposer>["applyTemplateToForm"];
  /** Create-sheet visibility, owned by useMissionsPage. */
  setShowCreate: (open: boolean) => void;
}

export function useMissionsData({
  showToast,
  applyTemplateToForm,
  setShowCreate,
}: UseMissionsDataArgs) {
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MissionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [promptCollapsed, setPromptCollapsed] = useState(true);
  const templateApplied = useRef(false);
  const expandedIdRef = useRef<string | null>(null);

  // Generalised mission-by-id updater. Updates the mission matching
  // `id` by applying the `updater` to its full record. Missions with
  // a different id pass through unchanged. Mirrors the session 180
  // `updateSession(sessionId, updater)` helper in the chat page —
  // same id-discriminator + setState((prev) => prev.map(...)) shape,
  // same "stays out of the way of the existing direct setters"
  // contract.
  //
  // The 2 `setMissions((prev) => prev.map((m) => m.id === X ?
  // { ...m, ...FIELD } : m))` sites (cancel optimistic status flip +
  // cancel restore from snapshot) live in useMissionDispatch and
  // collapse to a single call shape against this helper.
  const updateMission = useCallback(
    (id: string, updater: (mission: MissionRow) => MissionRow) => {
      setMissions((prev) =>
        prev.map((m) => (m.id === id ? updater(m) : m)),
      );
    },
    [],
  );

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
  // selected `newCategoryId` stays in the composer hook (compose state); the
  // category hook owns the catalog itself.
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
   * The `templateApplied.current` latch is intentionally NOT in this
   * helper — it is fetchData's "don't re-apply on the next
   * fetchData()" guard, not part of the "apply template" UX, so the
   * latch stays in fetchData where the fetch-result consumer can see
   * it.
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
    [applyTemplateToForm, setShowCreate, showToast],
  );

  const fetchData = useCallback(async () => {
    try {
      const list = await fetchMissions();
      setMissions(list);
    } catch (error) {
      // `toastError` is the user-facing surface; the pre-session-178
      // `console.error` was the only error reporting and the user
      // saw nothing. Surfaces the same string the sibling
      // `fetchTemplates` catch block reports, and matches the
      // `loadCategories` site — all three slices in `fetchData` now
      // report failures via toast.
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
            // option — it just applies + opens.
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
          // visible contract of `fetchData`'s three slices — all
          // surface failures via toast.
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

  return {
    missions,
    templates,
    loading,
    expandedId,
    setExpandedId,
    detail,
    detailLoading,
    promptCollapsed,
    setPromptCollapsed,
    updateMission,
    fetchData,
    fetchDetail,
    loadAndApplyTemplate,
    categories,
    categoriesLoadError,
    showCategoryManager,
    loadCategories,
    handleCreateCategory,
    handleUpdateCategory,
    handleDeleteCategory,
    openCategoryManager,
    closeCategoryManager,
  };
}
