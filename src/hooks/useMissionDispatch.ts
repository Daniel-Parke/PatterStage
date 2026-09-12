// ═══════════════════════════════════════════════════════════════
// useMissionDispatch — the mission write path
// ═══════════════════════════════════════════════════════════════
//
// Owns every handler that changes a mission on the wire — create / update /
// promote / re-dispatch, edit, duplicate, delete, cancel — plus the two
// in-flight flags the UI disables buttons on (`dispatching`,
// `cancellingMissionId`) and the form reset that follows a successful
// write.
//
// Reads the composer's form state and the data hook's list + refetch
// callbacks; owns none of either. Every wire call is a `dispatchMission`,
// which is `runWrite` on POST /api/missions.

"use client";

import { scheduleBlocksDispatch } from "@/lib/ui/dispatch-mode";
import { firstUnmetSubmitRequirement } from "@/lib/missions/mission-submit-requirement";
import { useCallback, useState } from "react";

import type { ToastType } from "@/components/ui/Toast";
import {
  successMessageForDispatch,
  dispatchMission,
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

  /** Open the row a write just created or changed, and refresh its detail. */
  const showMission = useCallback(
    async (id: string | undefined) => {
      await fetchData();
      if (id) {
        setExpandedId(id);
        void fetchDetail(id);
      }
    },
    [fetchData, fetchDetail, setExpandedId],
  );

  const handleCreate = useCallback(async () => {
    // One check, one message, in the same order the button reports. It used to
    // return SILENTLY on an empty name or instruction while the acknowledgement
    // branch toasted, so the ack was the only blocker with a voice on either
    // side of the form (T-0051).
    const blocker = firstUnmetSubmitRequirement({
      name: newName,
      instruction: newInstruction,
      dispatching,
      needsDispatchAck: !editingId && !dispatchAcknowledged,
    });
    if (blocker) {
      if (blocker.code !== "dispatching") showToast(blocker.message, "error");
      return;
    }
    // A cron the composer could not parse is not sent, and the click says so:
    // a control which returns silently is "a button that does nothing and
    // explains nothing".
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
          const updated = await dispatchMission(
            "update",
            { missionId: editingId, name: newName, ...dispatchPayload() },
            { showToast, successMessage: "Mission updated", errorMessage: "Failed to update mission" },
          );
          if (updated) {
            finishComposer();
            void fetchData();
            if (expandedId === editingId) void fetchDetail(editingId);
          }
          return;
        }

        if (isPromotable) {
          showToast(submitToastForDispatch(newDispatch), "info");
          const promoted = await dispatchMission(
            "promote",
            { missionId: editingId, name: newName, ...dispatchPayload({ dispatchMode: newDispatch }) },
            {
              showToast,
              successMessage: () => successMessageForDispatch(newDispatch, newSchedule),
              errorMessage: "Failed to update mission",
            },
          );
          if (promoted) {
            finishComposer();
            await fetchData();
            if (expandedId === editingId) void fetchDetail(editingId);
          }
          return;
        }

        if (!isCompleted) {
          showToast(
            "That mission is no longer on the board. Reload and try again.",
            "error",
          );
          return;
        }

        // Re-dispatch a finished mission as a new one. `editingId` is cleared
        // only once the request has landed: clearing it first flips the sheet
        // from "Edit Mission" to "New Mission" mid-flight, and a failure then
        // strands the operator in a create-shaped composer holding edit data.
        const redispatched = await dispatchMission(
          "dispatch",
          { name: newName, ...dispatchPayload({ dispatchMode: "now" }) },
          { showToast, successMessage: "Mission re-dispatched", errorMessage: "Failed to re-dispatch mission" },
        );
        if (redispatched) {
          setEditingId(null);
          finishComposer();
          await showMission(redispatched.mission?.id);
        }
        return;
      }

      showToast(submitToastForDispatch(newDispatch), "info");
      // Built once, so the toast can report what was actually SENT.
      const payload = dispatchPayload({ dispatchMode: newDispatch });
      const created = await dispatchMission(
        "dispatch",
        { name: newName, ...payload },
        {
          showToast,
          successMessage: () => successMessageForDispatch(newDispatch, payload.schedule as string | undefined),
          errorMessage: "Failed to create mission",
        },
      );
      if (created) {
        finishComposer();
        if (newDispatch === "now") await showMission(created.mission?.id);
        else void fetchData();
      }
    } finally {
      setDispatching(false);
    }
  }, [newName, newInstruction, editingId, dispatchAcknowledged, dispatching, showToast, newDispatch, newSchedule, scheduleDraftError, missions, dispatchPayload, fetchData, fetchDetail, expandedId, finishComposer, setEditingId, showMission]);

  const handleEdit = useCallback((m: MissionRow) => {
    setEditingId(m.id);
    populateFormFromMission(m, { editing: true });
    setShowCreate(true);
  }, [populateFormFromMission, setEditingId, setShowCreate]);

  const handleDuplicateMission = useCallback((m: MissionRow) => {
    setEditingId(null);
    populateFormFromMission(m, { editing: false, namePrefix: "(copy)" });
    setFormField("newDispatch", "save");
    setShowCreate(true);
    showToast("Mission duplicated as draft", "success");
  }, [populateFormFromMission, showToast, setFormField, setEditingId, setShowCreate]);

  // The row's own two-step confirm has already asked; this is the second click.
  const handleDelete = useCallback(async (id: string) => {
    const deleted = await dispatchMission(
      "delete",
      { missionId: id },
      { showToast, successMessage: "Mission deleted", errorMessage: "Failed to delete mission" },
    );
    if (deleted) {
      if (expandedId === id) setExpandedId(null);
      void fetchData();
    }
  }, [showToast, expandedId, fetchData, setExpandedId]);

  /**
   * Cancel a running mission. The row is marked failed ahead of the answer so
   * the board reacts to the click; a refusal or a throw puts the row back.
   */
  const handleCancel = useCallback(async (id: string) => {
    const previousMission = missions.find((m) => m.id === id);
    const restore = () => {
      if (previousMission) updateMission(id, () => previousMission);
    };
    showToast("Cancelling mission…", "info");
    updateMission(id, (m) => ({
      ...m,
      status: "failed" as const,
      result: "Cancelled by user",
    }));
    const cancelled = await dispatchMission(
      "cancel",
      { missionId: id },
      {
        showToast,
        setBusy: (busy) => setCancellingMissionId(busy ? id : null),
        successMessage: "Mission cancelled",
        errorMessage: "Failed to cancel mission",
        onError: restore,
      },
    );
    if (cancelled) {
      await fetchData();
      if (expandedId === id) void fetchDetail(id);
    } else {
      restore();
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
