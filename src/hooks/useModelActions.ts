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

import { driftLineKey, type ApiModel, type ApiCredential, type DriftLine } from "@/components/models/types";

type ToastFn = (message: string, type?: ToastType) => void;

export interface UseModelActionsArgs {
  loadAll: () => Promise<void>;
  setDefaults: Dispatch<SetStateAction<Record<TaskType, string | null>>>;
  showToast: ToastFn;
  /** The registry row that is the agent default; the only model a push may write. */
  agentDefaultId?: string | null;
}

export function useModelActions({
  loadAll,
  setDefaults,
  showToast,
  agentDefaultId = null,
}: UseModelActionsArgs) {
  const [busyCredentialId, setBusyCredentialId] = useState<string | null>(null);
  const [busyDriftLine, setBusyDriftLine] = useState<string | null>(null);
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
        const res = await apiFetch<{ data?: Partial<SyncActionResult> }>(`/api/models/sync/${action}`, {
          method: "POST",
          body: JSON.stringify({ modelId, ...options }),
          // Bulk: work scales with the install, not the request (T-0047).
          timeoutMs: API_FETCH_BULK_TIMEOUT_MS,
        });
        // Read the answer. A 2xx used to be enough for the success toast, so a
        // body saying `success: false` toasted "Model pushed to Hermes" over a
        // refusal (T-0095, D11). The push route now answers 500 for that, which
        // the catch below handles; this is the other half, for any 200 that
        // still carries a failed outcome.
        const outcome = res?.data;
        if (outcome?.success === false) {
          const details = outcome.details ?? [];
          showToast(details[0]?.detail || `${label} failed`, "error");
          return { success: false, backupPath: outcome.backupPath ?? null, details };
        }
        showToast(`Model ${action}ed to Hermes`, "success");
        void loadAll();
        return { success: true, backupPath: outcome?.backupPath ?? null, details: outcome?.details ?? [] };
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
          // design-lint-disable-next-line hermes-outside-adapter -- the toast names the exact file the shared key lives in; "the agent's env file" would send the operator hunting
          notes.push("another credential for this provider still uses the key in ~/.hermes/.env");
        } else if (d.envVarRemoved) {
          // design-lint-disable-next-line hermes-outside-adapter -- same remedy-naming rule as the GatewayBanner precedent
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

  /**
   * Replace one credential's key, in the row and in the agent's env file.
   *
   * The only way to change a key used to be to delete the credential and add
   * it again, which unlinked every model pointing at it: an expired key cost
   * the operator their model wiring (T-0100, D14). The route keeps the two
   * copies together, so the toast reports the new hint and whether the env
   * file moved with it.
   */
  const handleRotateCredential = useCallback(
    async (credential: ApiCredential, apiKey: string) => {
      setBusyCredentialId(credential.id);
      try {
        const res = await apiFetch<{
          data?: { credential?: { keyHint?: string }; envVarUpdated?: boolean };
        }>(`/api/credentials/${encodeURIComponent(credential.id)}`, {
          method: "PATCH",
          body: JSON.stringify({ apiKey }),
        });
        const hint = res?.data?.credential?.keyHint ?? "";
        // Only said when it happened: a provider that authenticates by OAuth
        // has no variable to write, and claiming otherwise would send the
        // operator looking for a change that was never made.
        const envNote = res?.data?.envVarUpdated ? "; Hermes .env updated" : "";
        showToast(`Rotated ${credential.label}: now ${hint}${envNote}`, "success");
        await loadAll();
      } catch (err) {
        toastError(showToast, err, "Rotate failed");
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
        const res = await apiFetch<{ data?: { error?: string | null } }>("/api/models/defaults", {
          method: "PUT",
          body: JSON.stringify({ taskType, modelId }),
        });
        await loadAll();
        // The route answers 200 with the yaml writer's refusal beside the
        // saved defaults: the database change happened, the file's did not,
        // and saying "Cleared" over that is the lie this replaces (T-0100, D9).
        const refusal = res?.data?.error;
        if (refusal) {
          showToast(refusal, "error");
        } else {
          showToast(
            modelId ? `Default updated for ${taskType}` : `Cleared default for ${taskType}`,
            "success"
          );
        }
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
        `Re-imported ${modelsImported} model${pluralise(modelsImported)} from config.yaml${creds > 0 ? `, ${creds} credential${pluralise(creds)} updated` : ""}`,
        "success"
      );
      await loadAll();
    } catch (err) {
      toastError(showToast, err, "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }, [loadAll, showToast]);

  /**
   * Resolve one drift line by taking Hermes' side of it.
   *
   * A model Hermes has and the registry does not is a re-import. A primary
   * disagreement where the Hermes model IS in the registry is not: importing
   * would not move the default, so the fix is to make that row the agent
   * default, which is the same write the defaults selector performs.
   */
  const handleDriftPull = useCallback(
    async (line: DriftLine) => {
      setBusyDriftLine(driftLineKey(line));
      try {
        if (line.kind === "primary" && line.registryId) {
          await apiFetch("/api/models/defaults", {
            method: "PUT",
            body: JSON.stringify({ taskType: "agent", modelId: line.registryId }),
          });
        } else {
          await apiFetch("/api/models/import", {
            method: "POST",
            // Bulk: walks the whole catalogue (T-0047).
            timeoutMs: API_FETCH_BULK_TIMEOUT_MS,
          });
        }
        await loadAll();
        showToast("Pulled from Hermes", "success");
      } catch (err) {
        toastError(showToast, err, "Pull failed");
      } finally {
        setBusyDriftLine(null);
      }
    },
    [loadAll, showToast],
  );

  /**
   * Resolve one drift line by taking the registry's side of it.
   *
   * The push writes `config.model`, which is the agent default and nothing
   * else, so that is the only id this ever sends. Without one there is
   * nothing to write, and a POST carrying `modelId: null` would be answered
   * with a 400 the operator cannot act on.
   */
  const handleDriftPush = useCallback(
    async (line: DriftLine) => {
      if (!agentDefaultId) {
        showToast("Set an agent default model first, then push it to Hermes", "error");
        return;
      }
      setBusyDriftLine(driftLineKey(line));
      try {
        const res = await apiFetch<{ data?: Partial<SyncActionResult> }>("/api/models/sync/push", {
          method: "POST",
          body: JSON.stringify({ modelId: agentDefaultId, pushCredential: false }),
        });
        const outcome = res?.data;
        if (outcome?.success === false) {
          showToast(outcome.details?.[0]?.detail || "Push failed", "error");
          return;
        }
        await loadAll();
        showToast("Pushed to Hermes", "success");
      } catch (err) {
        toastError(showToast, err, "Push failed");
      } finally {
        setBusyDriftLine(null);
      }
    },
    [agentDefaultId, loadAll, showToast],
  );

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
    handleRotateCredential,
    busyCredentialId,
    handleSetDefault,
    handleBulkAuxiliaryChange,
    handleRefresh,
    handleDriftPull,
    handleDriftPush,
    busyDriftLine,
  };
}
