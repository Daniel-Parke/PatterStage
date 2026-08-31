// ═══════════════════════════════════════════════════════════════
// useModelActions — registry writes for /config/models
// ═══════════════════════════════════════════════════════════════
//
// Split out of useModelsPage (Phase 4 god-file decomposition). Owns the
// write path over the model registry itself: push/pull against Hermes,
// the editor's save, delete, the per-task default setter and its bulk
// sibling, and the manual refresh. Plus the three flags the UI disables
// controls on: `editing` (which record the modal has open), `refreshing`
// and `busyTaskType`.
//
// Reads nothing it does not write. `loadAll` is the registry hook's
// refetch, called after every successful mutation exactly as before;
// `setDefaults` is passed in only for handleSetDefault's optimistic
// flip, which is reconciled by the loadAll that follows it.

"use client";

import { useCallback, useState, type Dispatch, type SetStateAction } from "react";

import type { ToastType } from "@/components/ui/Toast";
import { API_FETCH_BULK_TIMEOUT_MS, apiFetch, messageFromError, safeApiCallData, toastError } from "@/lib/api-fetch";
import type { ModelEditorRecord } from "@/components/models/ModelEditor";
import { type TaskType } from "@/lib/models/task-types";
import type { SyncActionResult } from "@/lib/models/sync-result";
import { pluralise } from "@/lib/utils";

import type { ApiModel, ApiCredential } from "@/components/models/types";

type ToastFn = (message: string, type?: ToastType) => void;

export interface UseModelActionsArgs {
  loadAll: () => Promise<void>;
  setDefaults: Dispatch<SetStateAction<Record<TaskType, string | null>>>;
  showToast: ToastFn;
}

export function useModelActions({
  loadAll,
  setDefaults,
  showToast,
}: UseModelActionsArgs) {
  const [busyCredentialId, setBusyCredentialId] = useState<string | null>(null);
  const [editing, setEditing] = useState<ModelEditorRecord | null | undefined>(
    undefined
  );
  const [busyTaskType, setBusyTaskType] = useState<TaskType | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  /** Shared sync helper — both push and pull follow the same pattern. */
  const syncModel = useCallback(
    async (
      action: "push" | "pull",
      modelId: string,
      options?: Record<string, unknown>,
    ): Promise<SyncActionResult> => {
      const label = action === "push" ? "Push" : "Pull";
      try {
        await apiFetch(`/api/models/sync/${action}`, {
          method: "POST",
          body: JSON.stringify({ modelId, ...options }),
          // Bulk: work scales with the install, not the request (T-0047).
          timeoutMs: API_FETCH_BULK_TIMEOUT_MS,
        });
        showToast(`Model ${action}ed to Hermes`, "success");
        void loadAll();
        return { success: true, backupPath: null, details: [] };
      } catch (err) {
        toastError(showToast, err, `${label} failed`);
        return {
          success: false,
          backupPath: null,
          details: [{ action, detail: messageFromError(err, `${label} failed`) }],
        };
      }
    },
    [loadAll, showToast],
  );

  const handlePush = useCallback(
    (modelId: string, options?: { pushCredential?: boolean }): Promise<SyncActionResult> =>
      syncModel("push", modelId, { pushCredential: options?.pushCredential ?? true }),
    [syncModel],
  );

  const handlePull = useCallback(
    (modelId: string, options?: { excluded?: Set<string> }): Promise<SyncActionResult> =>
      syncModel("pull", modelId, { excluded: [...(options?.excluded ?? new Set<string>())] }),
    [syncModel],
  );

  const handleSaved = useCallback(() => {
    setEditing(undefined);
    void loadAll();
    showToast("Model saved", "success");
  }, [loadAll, showToast]);

  // handleDelete is the post-confirm action — the per-row confirm
  // guard has already fired (see ModelsTableSection's per-row
  // useTwoStepConfirm). The pre-refactor form was a single global
  // `window.confirm` call here, which (a) blocked the JS thread with
  // a native dialog, (b) had no per-row context, and (c) broke the
  // project's two-step-confirm convention (see
  // `tests/unit/window-confirm-source-patterns.test.ts`).
  const handleDelete = useCallback(
    async (model: ApiModel) => {
      try {
        await apiFetch(`/api/models/${encodeURIComponent(model.id)}`, {
          method: "DELETE",
        });
        showToast(`Deleted ${model.name}`, "success");
        await loadAll();
      } catch (err) {
        toastError(showToast, err, "Delete failed");
      }
    },
    [loadAll, showToast]
  );

  /**
   * Delete a credential, and TELL THE OPERATOR WHAT ELSE HAPPENED.
   *
   * The route answers with three facts the toast would otherwise swallow:
   * whether the Hermes .env variable went with it, whether it was kept because
   * a same-provider sibling still needs it, and which models were unlinked by
   * the foreign key. Reporting only "Deleted" would hide the two that change
   * what the operator does next (T-0083).
   */
  const handleDeleteCredential = useCallback(
    async (credential: ApiCredential) => {
      setBusyCredentialId(credential.id);
      try {
        const res = await apiFetch<{
          data?: {
            envVarRemoved?: boolean;
            envVarKeptForSibling?: boolean;
            envError?: string | null;
            orphanedModels?: string[];
          };
        }>(`/api/credentials/${encodeURIComponent(credential.id)}`, { method: "DELETE" });

        const d = res?.data ?? {};
        const notes: string[] = [];
        if (d.envVarKeptForSibling) {
          notes.push("another credential for this provider still uses the key in ~/.hermes/.env");
        } else if (d.envVarRemoved) {
          notes.push("removed from ~/.hermes/.env");
        }
        if (d.envError) notes.push(`.env not updated: ${d.envError}`);
        const orphans = d.orphanedModels ?? [];
        if (orphans.length > 0) {
          notes.push(`${orphans.join(", ")} now ${orphans.length === 1 ? "has" : "have"} no key`);
        }

        showToast(
          `Deleted ${credential.label}${notes.length ? ` — ${notes.join("; ")}` : ""}`,
          orphans.length > 0 || d.envError ? "info" : "success",
        );
        await loadAll();
      } catch (err) {
        toastError(showToast, err, "Delete failed");
      } finally {
        setBusyCredentialId(null);
      }
    },
    [loadAll, showToast],
  );

  const handleSetDefault = useCallback(
    async (taskType: TaskType, modelId: string | null) => {
      setBusyTaskType(taskType);
      setDefaults((prev) => ({ ...prev, [taskType]: modelId }));
      try {
        await apiFetch("/api/models/defaults", {
          method: "PUT",
          body: JSON.stringify({ taskType, modelId }),
        });
        await loadAll();
        showToast(
          modelId ? `Default updated for ${taskType}` : `Cleared default for ${taskType}`,
          "success"
        );
      } catch (err) {
        toastError(showToast, err, "Default update failed");
        await loadAll();
      } finally {
        setBusyTaskType(null);
      }
    },
    [loadAll, showToast, setDefaults]
  );

  const handleBulkAuxiliaryChange = useCallback(
    async (taskTypes: TaskType[], targetModelId: string) => {
      setBusyTaskType("agent");
      try {
        const results = await Promise.all(
          taskTypes.map(async (taskType) => {
            try {
              await apiFetch("/api/models/defaults", {
                method: "PUT",
                body: JSON.stringify({ taskType, modelId: targetModelId }),
              });
              return { taskType, ok: true };
            } catch (err) {
              return { taskType, ok: false, error: messageFromError(err, "Failed") };
            }
          })
        );
        await loadAll();
        const failures = results.filter((r) => !r.ok);
        if (failures.length === 0) {
          showToast(
            `Set ${taskTypes.length} auxiliary default${pluralise(taskTypes.length)}`,
            "success"
          );
        } else {
          showToast(
            `${results.length - failures.length}/${taskTypes.length} updated — ${failures.map((f) => f.taskType).join(", ")} failed`,
            "error"
          );
        }
      } catch (err) {
        toastError(showToast, err, "Bulk update failed");
        await loadAll();
      } finally {
        setBusyTaskType(null);
      }
    },
    [loadAll, showToast]
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // `/api/models/import` returns `{ data: { modelsImported,
      // modelsSkipped, credentialsUpdated } }`. `safeApiCallData`
      // unwraps the envelope in one call — same observable
      // result as the inline form (returns the inner payload
      // or `null` on error). The success-path access is
      // `res?.X` instead of `result.data?.X`; the catch path
      // still surfaces the API's error message via the
      // thrown error, which `toastError` converts to a
      // toast.
      const result = await safeApiCallData<{
        modelsImported?: number;
        modelsSkipped?: number;
        credentialsUpdated?: number;
      }>("/api/models/import", {
        method: "POST",
        // Bulk: walks the whole catalogue (T-0047).
        timeoutMs: API_FETCH_BULK_TIMEOUT_MS,
      });
      const modelsImported = result?.modelsImported ?? 0;
      const creds = result?.credentialsUpdated ?? 0;
      showToast(
        `Synced: ${modelsImported} model${pluralise(modelsImported)} ${modelsImported > 0 ? "(updated)" : "(no change)"}${creds > 0 ? `, ${creds} credential${pluralise(creds)} updated` : ""} from Hermes`,
        "success"
      );
      await loadAll();
    } catch (err) {
      toastError(showToast, err, "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }, [loadAll, showToast]);

  return {
    editing,
    setEditing,
    busyTaskType,
    refreshing,
    handlePush,
    handlePull,
    handleSaved,
    handleDelete,
    handleDeleteCredential,
    busyCredentialId,
    handleSetDefault,
    handleBulkAuxiliaryChange,
    handleRefresh,
  };
}
