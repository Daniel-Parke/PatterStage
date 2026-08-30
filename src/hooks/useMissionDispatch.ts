// ═══════════════════════════════════════════════════════════════
// useMissionDispatch — the mission write path
// ═══════════════════════════════════════════════════════════════
//
// Split out of useMissionsPage (Phase 4 god-file decomposition). Owns
// every handler that changes a mission on the wire — create / update /
// promote / re-dispatch, edit, duplicate, delete, cancel — plus the two
// in-flight flags the UI disables buttons on (`dispatching`,
// `cancellingMissionId`) and the form reset that follows a successful
// write.
//
// Reads the composer's form state and the data hook's list + refetch
// callbacks; owns none of either. Every wire call goes through
// `dispatchMissionAction`, the shared POST /api/missions envelope.

"use client";

import { scheduleBlocksDispatch } from "@/lib/dispatch-mode";
import { firstUnmetSubmitRequirement } from "@/lib/missions/mission-submit-requirement";
import { useCallback, useState } from "react";

import type { ToastType } from "@/components/ui/Toast";
import { toastError } from "@/lib/api-fetch";
import { toastFromResult } from "@/lib/dashboard/toast-from-result";
import {
  successMessageForDispatch,
  dispatchMissionAction,
} from "@/hooks/success-message-for-dispatch";
import type { useMissionComposer } from "@/hooks/useMissionComposer";
import type { MissionRow } from "@/hooks/missions-page-types";
import {
  isMissionDraft,
  isMissionQueuedForRun,
} from "@/lib/missions/mission-board";
import { submitToastForDispatch } from "@/lib/missions/mission-filters";

type ToastFn = (message: string, type?: ToastType) => void;

export interface UseMissionDispatchArgs {
  composer: ReturnType<typeof useMissionComposer>;
  missions: MissionRow[];
  updateMission: (id: string, updater: (mission: MissionRow) => MissionRow) => void;
  fetchData: () => Promise<void>;
  fetchDetail: (id: string, showLoading?: boolean) => void;
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  setShowCreate: (open: boolean) => void;
  /** Close the create/edit sheet (clears `editingId` too). */
  closeComposer: () => void;
  showToast: ToastFn;
}

export function useMissionDispatch({
  composer,
  missions,
  updateMission,
  fetchData,
  fetchDetail,
  expandedId,
  setExpandedId,
  editingId,
  setEditingId,
  setShowCreate,
  closeComposer,
  showToast,
}: UseMissionDispatchArgs) {
  const {
    newName,
    newInstruction,
    dispatchAcknowledged,
    setDispatchAcknowledged,
    newDispatch,
    scheduleDraftError,
    setNewDispatch,
    setFormField,
    newSchedule,
    dispatchPayload,
    clearMissionFormFields,
    populateFormFromMission,
  } = composer;

  const [dispatching, setDispatching] = useState(false);
  const [cancellingMissionId, setCancellingMissionId] = useState<string | null>(
    null,
  );

  const resetForm = useCallback(() => {
    clearMissionFormFields();
    setDispatchAcknowledged(false);
    setNewDispatch("save");
    setShowCreate(false);
    // setDispatchAcknowledged + setNewDispatch are stable composer-hook
    // setters (listed to satisfy exhaustive-deps now that they're
    // destructured, not local useState setters the linter auto-exempts).
  }, [clearMissionFormFields, setDispatchAcknowledged, setNewDispatch, setShowCreate]);

  /**
   * Finish. One step, used by every branch that succeeded.
   *
   * There used to be two ways to end (`resetForm()` and `closeComposer()`),
   * chosen per branch, and three of the seven branches chose NEITHER: create
   * with dispatchMode `now`, create with `cron`, and re-dispatching a completed
   * mission. The operator submitted a form and it stayed open in front of them
   * (T-0051). All three also expand a row on the board behind the sheet, so even
   * the incidental confirmation was hidden.
   *
   * Ending is not a per-branch decision, so it stops being expressed as one.
   */
  const finishComposer = useCallback(() => {
    closeComposer();
    resetForm();
  }, [closeComposer, resetForm]);

  const handleCreate = useCallback(async () => {
    // One check, one message, in the same order the button reports. It used to
    // return SILENTLY on an empty name or instruction while the acknowledgement
    // branch toasted, so the ack was the only blocker with a voice on either
    // surface (T-0065).
    const blocker = firstUnmetSubmitRequirement({
      name: newName,
      instruction: newInstruction,
      dispatching,
      needsDispatchAck: !editingId && !dispatchAcknowledged,
    });
    if (blocker) {
      // A double-click still returns silently: a spinner already says this.
      if (blocker.code !== "dispatching") showToast(blocker.message, "error");
      return;
    }
    // Above every wire branch, and above setDispatching, so a refusal costs
    // nothing and leaves no spinner. The server WOULD reject this
    // (mission-handlers/dispatch.ts returns badRequest on an invalid schedule);
    // it never got the chance, because the client substituted DEFAULT_SCHEDULE
    // for the draft it could not parse and shipped a cadence the operator never
    // typed, under a green toast affirming it (T-0063).
    //
    // The button is deliberately NOT disabled. This hook already carries the
    // ruling that a control which returns silently is "a button that does
    // nothing and explains nothing": let the click land, refuse the POST, say
    // why.
    const scheduleBlocked = scheduleBlocksDispatch(newDispatch, scheduleDraftError);
    if (scheduleBlocked) {
      showToast(scheduleBlocked, "error");
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
            finishComposer();
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
            finishComposer();
            await fetchData();
            if (expandedId === editingId) void fetchDetail(editingId);
          }
          return;
        }

        if (!isCompleted) {
          // Used to return here with no toast and no state change: a button
          // that does nothing and explains nothing. Reachable whenever the
          // edited mission is not in the board (a stale row, a filtered view).
          showToast(
            "That mission is no longer on the board. Reload and try again.",
            "error",
          );
          return;
        }

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
          // AFTER the request, not before. Clearing it first flips the sheet
          // from "Edit Mission" to "New Mission" mid-flight and can re-arm the
          // dispatch gate; a failure then strands the operator in a
          // create-shaped composer holding edit data.
          setEditingId(null);
          finishComposer();
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
      // Built once, so the toast can report what was actually SENT.
      const payload = dispatchPayload({ dispatchMode: newDispatch });
      const { ok, error, data } = await dispatchMissionAction("dispatch", {
        name: newName,
        ...payload,
      });

      toastFromResult(
        showToast,
        { ok, error },
        // From the payload, not from form state. Two sources for one claim is
        // how a green toast came to read "Mission scheduled: every 5m" for a
        // cadence the operator never typed: the schedule on the wire and the
        // schedule in the form had diverged, and the toast trusted the form.
        () => successMessageForDispatch(newDispatch, payload.schedule as string | undefined),
        "Failed to create mission",
      );
      if (ok) {
        // Every mode finishes. What differs is only what happens NEXT: `now`
        // expands the row it just created so the operator can watch it.
        finishComposer();
        if (newDispatch === "now") {
          const body = data;
          await fetchData();
          if (body?.mission?.id) {
            setExpandedId(body.mission.id);
            void fetchDetail(body.mission.id);
          }
        } else {
          void fetchData();
        }
      }
    } catch (err) {
      toastError(showToast, err, "Network error — please try again");
    } finally {
      setDispatching(false);
    }
  }, [newName, newInstruction, editingId, dispatchAcknowledged, dispatching, showToast, newDispatch, newSchedule, scheduleDraftError, missions, dispatchPayload, fetchData, fetchDetail, expandedId, finishComposer, setEditingId, setExpandedId]);

  const handleEdit = useCallback((m: MissionRow) => {
    setEditingId(m.id);
    populateFormFromMission(m, { editing: true });
    setShowCreate(true);
  }, [populateFormFromMission, setEditingId, setShowCreate]);

  const handleDuplicateMission = useCallback((m: MissionRow) => {
    setEditingId(null);
    populateFormFromMission(m, { editing: false, namePrefix: "(copy)" });
    // Through setFormField, not the raw setter. populateFormFromMission clears
    // the dispatch acknowledgement (editing: false), and only the wrapper
    // re-acknowledges. With the sheet ALREADY OPEN the form does not remount, so
    // its once-per-mount default-reporting effect never runs, and the composer
    // was left with Dispatch rendered open, the ack false, and a dead submit
    // button whose tooltip told the operator to open something already open
    // (T-0065). Duplicating from a CLOSED sheet remounted and healed itself,
    // which is why this only ever reproduced sometimes.
    //
    // Note resetForm keeps the raw setter deliberately: it clears the ack on
    // purpose and routing it through the wrapper would re-acknowledge a form
    // that has just been emptied.
    setFormField("newDispatch", "save");
    setShowCreate(true);
    showToast("Mission duplicated as draft", "success");
  }, [populateFormFromMission, showToast, setFormField, setEditingId, setShowCreate]);

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
  }, [showToast, expandedId, fetchData, setExpandedId]);

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

  return {
    dispatching,
    cancellingMissionId,
    resetForm,
    handleCreate,
    handleEdit,
    handleDuplicateMission,
    handleDelete,
    handleCancel,
  };
}
