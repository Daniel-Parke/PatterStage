// ═══════════════════════════════════════════════════════════════
// useMissionsData — loading, polling and the expanded detail panel
// ═══════════════════════════════════════════════════════════════
//
// Owns the answer to "what is on screen, and when is it refetched": the
// missions + templates slices, the category catalog wiring, the 15s
// poll, the expanded row's detail panel, and the `?template=<id>`
// deep link that opens the composer with a template loaded.
//
// The category hook is composed HERE rather than one level up because
// the wiring is circular at the call site: useMissionCategories needs
// `onMissionsReassigned` (a reload of the two list slices this hook
// owns) and `fetchData` needs the `loadCategories` that same hook
// returns. Composing it here resolves both directions in one pass.
//
// useMissionsApi shares raw query envelopes with the Dashboard. This hook
// retains one visibility-aware polling owner and the board's local projection.

"use client";

import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react";

import { useInterval } from "@/hooks/useInterval";

import type { FeedbackContextValue } from "@/components/ui/feedback-context";
import { messageFromError } from "@/lib/api/api-fetch";
import { useMissionsApi } from "@/hooks/useMissionsApi";
import { useMissionCategories } from "@/hooks/useMissionCategories";
import type { useMissionComposer } from "@/hooks/useMissionComposer";
import type { MissionDetail, MissionRow } from "@/hooks/missions-page-types";
import type { MissionTemplate } from "@/components/missions/TemplateModals";
import {
  getCategoryIdFromTemplate,
  rememberLastCategory,
} from "@/lib/missions/mission-composer-utils";
import {
  MISSIONS_PATH,
  resolveMissionDeepLink,
} from "@/lib/missions/mission-deep-link";

type ToastFn = FeedbackContextValue["showToast"];

function missionRowFromDetail(detail: MissionDetail): MissionRow {
  return { ...detail.mission, run: detail.run, scheduleStatus: detail.schedule };
}

function hasHttpStatus(error: unknown, status: number): boolean {
  return typeof error === "object" && error !== null && "status" in error && error.status === status;
}

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
  } = useMissionsApi();

  const [missions, setMissions] = useState<MissionRow[]>([]);
  const [templates, setTemplates] = useState<MissionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  // The missions read's failure, kept apart from the list. It used to be a
  // toast that vanished after four seconds while the board rendered "No
  // missions yet" over the failure (T-0096, D67, the read contract).
  const [missionsLoadError, setMissionsLoadError] = useState<string | null>(null);
  const [templatesLoadError, setTemplatesLoadError] = useState<string | null>(null);
  const [expandedId, setExpandedIdState] = useState<string | null>(null);
  const [detail, setDetail] = useState<MissionDetail | null>(null);
  const [detailLoadError, setDetailLoadError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [promptCollapsed, setPromptCollapsed] = useState(true);
  const templateApplied = useRef(false);
  const missionFocused = useRef(false);
  const pendingMissionLink = useRef<string | null>(null);
  const freshDetailId = useRef<string | null>(null);
  const [deepLinkedMissionId, setDeepLinkedMissionId] = useState<string | null>(
    null,
  );
  const expandedIdRef = useRef<string | null>(null);
  const olderLinkedMission = useRef<MissionRow | null>(null);
  const refreshVersion = useRef(0);
  const templateVersion = useRef(0);
  const detailVersion = useRef(0);
  const selectionVersion = useRef(0);

  const setExpandedId = useCallback((update: SetStateAction<string | null>) => {
    const id = typeof update === "function" ? update(expandedIdRef.current) : update;
    if (id === expandedIdRef.current) return;
    selectionVersion.current++;
    pendingMissionLink.current = null;
    expandedIdRef.current = id;
    detailVersion.current++;
    setExpandedIdState(id);
    setDetail(null);
    setDetailLoadError(null);
    setDetailLoading(false);
  }, []);

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
   * The deep-link path also remembers the category and strips the
   * `?template=` query so a refresh doesn't re-apply the template; the
   * interactive path does neither.
   *
   * The `templateApplied.current` latch is intentionally NOT in this
   * helper — it is fetchData's "don't re-apply on the next fetchData()"
   * guard, so it stays where the fetch-result consumer can see it.
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
      const dispatchError = applyTemplateToForm(t, cid);
      if (opts.rememberCategory) rememberLastCategory(cid);
      setShowCreate(true);
      showToast(dispatchError || `Template loaded: ${t.name}`, dispatchError ? "error" : "success");
      if (opts.clearQueryParam) {
        window.history.replaceState({}, "", MISSIONS_PATH);
      }
    },
    [applyTemplateToForm, setShowCreate, showToast],
  );

  const loadMissions = useCallback(async (afterWrite = false) => {
    const version = ++refreshVersion.current;
    const selection = selectionVersion.current;
    const ownsInitialLink = () => selection === selectionVersion.current && pendingMissionLink.current !== null;
    try {
      const list: MissionRow[] = await fetchMissions(afterWrite);
      let retained = olderLinkedMission.current;
      const retainedIdBeforeRefresh = retained?.id;
      const refreshed = retainedIdBeforeRefresh
        ? list.find((mission) => mission.id === retainedIdBeforeRefresh)
        : undefined;
      if (refreshed) {
        retained = refreshed;
        olderLinkedMission.current = refreshed;
      } else if (retained) {
        const retainedId = retained.id;
        try {
          const latest: MissionDetail | null = await fetchMissionDetail(retainedId, afterWrite);
          if (version !== refreshVersion.current || olderLinkedMission.current?.id !== retainedId) return;
          if (latest?.mission) {
            retained = missionRowFromDetail(latest);
            olderLinkedMission.current = retained;
            setDetail((current) => current?.mission.id === retainedId ? latest : current);
          } else {
            olderLinkedMission.current = null;
            retained = null;
          }
        } catch (error) {
          if (version !== refreshVersion.current || olderLinkedMission.current?.id !== retainedId) return;
          if (!hasHttpStatus(error, 404)) throw error;
          olderLinkedMission.current = null;
          retained = null;
        }
        if (!retained) {
          if (expandedIdRef.current === retainedId) setExpandedId(null);
          setDeepLinkedMissionId((current) => current === retainedId ? null : current);
          setDetail((current) => current?.mission.id === retainedId ? null : current);
          // The delete action already reports success. A refresh cannot tell
          // whether this 404 followed that action or another writer's delete.
        }
      }
      if (version !== refreshVersion.current) return;
      setMissions(retained && !refreshed ? [...list, retained] : list);
      setMissionsLoadError(null);
      // A fresh list can resolve a pending older-link lookup before it settles.
      const pendingInList = pendingMissionLink.current && list.find(row => row.id === pendingMissionLink.current);
      if (pendingInList && selection === selectionVersion.current) {
        freshDetailId.current = pendingInList.id;
        setExpandedId(pendingInList.id);
        setDeepLinkedMissionId(pendingInList.id);
        window.history.replaceState({}, "", MISSIONS_PATH);
      }
      // `?mission=<id>` deep link, the destination of every "open the
      // parent mission" affordance on the sessions surface. Sibling of the
      // `?template=<id>` branch below, and latched the same way so the 15s
      // poll does not re-open a panel the user closed.
      if (!missionFocused.current) {
        const link = resolveMissionDeepLink(window.location.href, list);
        if (link.kind !== "none") {
          missionFocused.current = true;
          if (link.kind === "open") {
            setExpandedId(link.missionId);
            // Published so the board's view state can make the panel
            // actually visible, because the Completed and Failed columns start
            // collapsed, and an arrived-at mission usually lives in one
            // of them. Distinct from `expandedId` because a plain click
            // must NOT expand the column it was clicked in.
            setDeepLinkedMissionId(link.missionId);
            window.history.replaceState({}, "", MISSIONS_PATH);
          } else {
            // The board is bounded to 200 rows. Absence from that page does
            // not establish deletion, so ask the by-ID route before showing
            // missing feedback or consuming the URL.
            pendingMissionLink.current = link.missionId;
            try {
              const linked: MissionDetail | null = await fetchMissionDetail(link.missionId);
              if (!ownsInitialLink()) return;
              if (linked?.mission) {
                const row = missionRowFromDetail(linked);
                olderLinkedMission.current = row;
                setMissions((current) =>
                  current.some((mission) => mission.id === row.id)
                    ? current
                    : [...current, row],
                );
                setExpandedId(row.id);
                setDeepLinkedMissionId(row.id);
              } else {
                pendingMissionLink.current = null;
                showToast(`Mission ${link.missionId.slice(0, 8)} no longer exists`, "error");
              }
              window.history.replaceState({}, "", MISSIONS_PATH);
            } catch (error) {
              if (!ownsInitialLink()) return;
              pendingMissionLink.current = null;
              if (hasHttpStatus(error, 404)) {
                showToast(`Mission ${link.missionId.slice(0, 8)} no longer exists`, "error");
                window.history.replaceState({}, "", MISSIONS_PATH);
              } else {
                missionFocused.current = false;
                setMissionsLoadError(messageFromError(error, "Failed to load linked mission"));
              }
            }
          }
        }
      }
    } catch (error) {
      // Not a toast: the board reads this and shows the failure with a
      // Retry in place of the list, so a failed read never looks like an
      // empty install.
      if (version === refreshVersion.current) setMissionsLoadError(messageFromError(error, "Failed to load missions"));
    }
  }, [fetchMissions, fetchMissionDetail, showToast, setExpandedId]);

  const loadTemplates = useCallback(async (afterWrite = false) => {
    const version = ++templateVersion.current;
    try {
      const loaded = await fetchTemplates(afterWrite);
      if (version !== templateVersion.current) return;
      setTemplates(loaded);
      setTemplatesLoadError(null);
      if (!templateApplied.current && loaded.length > 0) {
        const url = new URL(window.location.href);
        const templateId = url.searchParams.get("template");
        if (templateId) {
          const t = loaded.find(
            (tmpl: MissionTemplate) => tmpl.id === templateId,
          );
          if (t) {
            loadAndApplyTemplate(t, {
              rememberCategory: true,
              clearQueryParam: true,
            });
            templateApplied.current = true;
          }
        }
      }
    } catch (error) {
      if (version === templateVersion.current) setTemplatesLoadError(messageFromError(error, "Failed to load templates"));
    }
  }, [fetchTemplates, loadAndApplyTemplate]);

  const reloadMissionsAndTemplates = useCallback(async () => {
    await Promise.all([loadMissions(true), loadTemplates(true)]);
  }, [loadMissions, loadTemplates]);
  const category = useMissionCategories({
    fetchCategories,
    showToast,
    onMissionsReassigned: reloadMissionsAndTemplates,
  });
  const { loadCategories } = category;
  const fetchData = useCallback(async (afterWrite = false) => {
    await Promise.all([loadMissions(afterWrite), loadTemplates(afterWrite), loadCategories(afterWrite)]);
  }, [loadMissions, loadTemplates, loadCategories]);

  const fetchDetail = useCallback(
    (id: string, showLoading = true, afterWrite = false) => {
      if (expandedIdRef.current !== id) return;
      const version = ++detailVersion.current;
      if (showLoading) setDetailLoading(true);
      const ownsDetail = () => version === detailVersion.current && expandedIdRef.current === id;
      fetchMissionDetail(id, afterWrite)
        .then((data) => {
          if (!ownsDetail()) return;
          setDetail(data);
          setDetailLoadError(data ? null : "Mission detail was not returned");
        })
        .catch((error) => {
          if (ownsDetail()) setDetailLoadError(messageFromError(error, "Failed to load mission detail"));
        })
        .finally(() => {
          if (ownsDetail()) setDetailLoading(false);
        });
    },
    [fetchMissionDetail],
  );

  useEffect(() => () => {
    selectionVersion.current++;
    pendingMissionLink.current = null;
    refreshVersion.current++;
    templateVersion.current++;
    detailVersion.current++;
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetchData().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchData]);

  // The 15s refresh. Routed through useInterval rather than a raw setInterval
  // so it stops while the tab is hidden and takes one catch-up tick on return.
  // Each tick costs three requests (missions, templates, categories), so a
  // console left open overnight was making about 5,700 of them at nothing.
  useInterval(
    () => {
      void fetchData();
      const id = expandedIdRef.current;
      if (id) fetchDetail(id, false);
    },
    { ms: 15_000 },
  );

  useEffect(() => {
    if (expandedId) {
      setPromptCollapsed(true);
      const fresh = freshDetailId.current === expandedId;
      freshDetailId.current = null;
      fetchDetail(expandedId, true, fresh);
    } else {
      setDetail(null);
    }
  }, [expandedId, fetchDetail]);

  return {
    missions,
    templates,
    loading,
    missionsLoadError,
    templatesLoadError,
    detailLoadError,
    loadMissions,
    loadTemplates,
    expandedId,
    setExpandedId,
    deepLinkedMissionId,
    detail,
    detailLoading,
    promptCollapsed,
    setPromptCollapsed,
    updateMission,
    fetchData,
    fetchDetail,
    loadAndApplyTemplate,
    ...category,
  };
}
