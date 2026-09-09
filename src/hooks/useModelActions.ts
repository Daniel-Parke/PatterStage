// ═══════════════════════════════════════════════════════════════
// useModelActions — registry writes for /agent/models
// ═══════════════════════════════════════════════════════════════
//
// Owns the write path over the model registry itself: push/pull against
// Hermes, the editor's save, delete, the credentials, the per-task default
// setter and its bulk sibling, the manual refresh and the drift lines.
// Plus the flags the UI disables controls on: `editing` (which record the
// modal has open), `refreshing`, `busyTaskType`, `busyCredentialId`,
// `addingCredential`, `busyDriftLine`.
//
// Reads nothing it does not write. `loadAll` is the registry hook's
// refetch, run after every write through `runWrite`; `setDefaults` is
// passed in only for handleSetDefault's optimistic flip, which is
// reconciled by the reload that follows it either way.

"use client";

import { useCallback, useState, type Dispatch, type SetStateAction } from "react";

import type { ToastType } from "@/components/ui/Toast";
import { API_FETCH_BULK_TIMEOUT_MS, apiFetch, messageFromError } from "@/lib/api-fetch";
import { runWrite, type RunWriteOptions } from "@/lib/api-write";
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

/** What /api/models/sync/* and /api/models/import answer with. */
type SyncEnvelope = { data?: Partial<SyncActionResult> };
type ImportEnvelope = { data?: { modelsImported?: number; modelsSkipped?: number; credentialsUpdated?: number } };

export function useModelActions({
  loadAll,
  setDefaults,
  showToast,
  agentDefaultId = null,
}: UseModelActionsArgs) {
  const [busyCredentialId, setBusyCredentialId] = useState<string | null>(null);
  const [addingCredential, setAddingCredential] = useState(false);
  const [busyDriftLine, setBusyDriftLine] = useState<string | null>(null);
  const [editing, setEditing] = useState<ModelEditorRecord | null | undefined>(
    undefined
  );
  const [busyTaskType, setBusyTaskType] = useState<TaskType | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  /** A write to the registry: the words, the call, the registry reloaded. */
  const write = useCallback(
    <T,>(opts: Omit<RunWriteOptions<T>, "showToast" | "onSuccess"> & { onSuccess?: (data: T) => void }) =>
      runWrite<T>({
        ...opts,
        showToast,
        onSuccess: async (data) => {
          await loadAll();
          opts.onSuccess?.(data);
        },
      }),
    [loadAll, showToast],
  );

  /**
   * Push or pull one model against Hermes. The route answers 200 with
   * `success: false` and its details when the config could not be written or
   * read, and that is the answer the caller gets back, not a toast alone: the
   * drift banner and the per-row buttons read the outcome (T-0100).
   */
  const syncModel = useCallback(
    async (
      action: "push" | "pull",
      modelId: string,
      options?: Record<string, unknown>,
    ): Promise<SyncActionResult> => {
      const label = action === "push" ? "Push" : "Pull";
      let thrown: unknown;
      const res = await write<SyncEnvelope>({
        url: `/api/models/sync/${action}`,
        body: { modelId, ...options },
        timeoutMs: API_FETCH_BULK_TIMEOUT_MS,
        checkSuccess: false,
        successMessage: (r) =>
          r?.data?.success === false
            ? { message: r.data.details?.[0]?.detail || `${label} failed`, type: "error" }
            : `Model ${action}ed to Hermes`,
        errorMessage: `${label} failed`,
        onError: (err) => {
          thrown = err;
        },
      });
      if (!res) {
        return {
          success: false,
          backupPath: null,
          details: [{ action, detail: messageFromError(thrown, `${label} failed`) }],
        };
      }
      const outcome = res.data;
      return {
        success: outcome?.success !== false,
        backupPath: outcome?.backupPath ?? null,
        details: outcome?.details ?? [],
      };
    },
    [write],
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

  // handleDelete is the post-confirm action — the per-row confirm guard has
  // already fired (see ModelsTableSection's per-row useTwoStepConfirm).
  const handleDelete = useCallback(
    async (model: ApiModel) => {
      await write({
        url: `/api/models/${encodeURIComponent(model.id)}`,
        method: "DELETE",
        successMessage: `Deleted ${model.name}`,
        errorMessage: "Delete failed",
      });
    },
    [write]
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
      await write<{
        data?: {
          envVarRemoved?: boolean;
          envVarKeptForSibling?: boolean;
          envError?: string | null;
          orphanedModels?: string[];
        };
      }>({
        setBusy: (busy) => setBusyCredentialId(busy ? credential.id : null),
        url: `/api/credentials/${encodeURIComponent(credential.id)}`,
        method: "DELETE",
        successMessage: (res) => {
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
          return {
            message: `Deleted ${credential.label}${notes.length ? ` — ${notes.join("; ")}` : ""}`,
            type: orphans.length > 0 || d.envError ? "info" : "success",
          };
        },
        errorMessage: "Delete failed",
      });
    },
    [write],
  );

  const handleAddCredential = useCallback(
    async ({ label, provider, apiKey }: { label: string; provider: string; apiKey: string }) => {
      await write<{ data?: { credential?: { label?: string; keyHint?: string } } }>({
        setBusy: setAddingCredential,
        url: "/api/credentials",
        body: { label, provider, apiKey },
        successMessage: (res) => {
          const saved = res?.data?.credential;
          return `Added ${saved?.label ?? label}${saved?.keyHint ? `: ${saved.keyHint}` : ""}`;
        },
        errorMessage: "Could not add the credential",
      });
    },
    [write],
  );

  const handleRotateCredential = useCallback(
    async (credential: ApiCredential, apiKey: string) => {
      await write<{ data?: { credential?: { keyHint?: string }; envVarUpdated?: boolean } }>({
        setBusy: (busy) => setBusyCredentialId(busy ? credential.id : null),
        url: `/api/credentials/${encodeURIComponent(credential.id)}`,
        method: "PATCH",
        body: { apiKey },
        successMessage: (res) =>
          `Rotated ${credential.label}: now ${res?.data?.credential?.keyHint ?? ""}${res?.data?.envVarUpdated ? "; Hermes .env updated" : ""}`,
        errorMessage: "Rotate failed",
      });
    },
    [write],
  );

  /**
   * Set or clear one task type's default. The flip is optimistic; the reload
   * that follows the answer, refused or not, is what the screen settles on.
   * A refusal comes back as a 200 with `error` set (the model has no key, say),
   * so the success message reads it.
   */
  const handleSetDefault = useCallback(
    async (taskType: TaskType, modelId: string | null) => {
      setDefaults((prev) => ({ ...prev, [taskType]: modelId }));
      await write<{ data?: { error?: string | null } }>({
        setBusy: (busy) => setBusyTaskType(busy ? taskType : null),
        url: "/api/models/defaults",
        method: "PUT",
        body: { taskType, modelId },
        successMessage: (res) =>
          res?.data?.error
            ? { message: res.data.error, type: "error" }
            : modelId
              ? `Default updated for ${taskType}`
              : `Cleared default for ${taskType}`,
        errorMessage: "Default update failed",
        onError: loadAll,
      });
    },
    [write, loadAll, setDefaults]
  );

  /** One PUT per task type, one sentence about all of them. */
  const handleBulkAuxiliaryChange = useCallback(
    async (taskTypes: TaskType[], targetModelId: string) => {
      await runWrite<{ taskType: TaskType; ok: boolean }[]>({
        setBusy: (busy) => setBusyTaskType(busy ? "agent" : null),
        showToast,
        request: () =>
          Promise.all(
            taskTypes.map((taskType) =>
              apiFetch("/api/models/defaults", {
                method: "PUT",
                body: JSON.stringify({ taskType, modelId: targetModelId }),
              }).then(
                () => ({ taskType, ok: true }),
                () => ({ taskType, ok: false }),
              ),
            ),
          ),
        successMessage: (results) => {
          const failures = results.filter((r) => !r.ok);
          return failures.length === 0
            ? `Set ${taskTypes.length} auxiliary default${pluralise(taskTypes.length)}`
            : {
                message: `${results.length - failures.length}/${taskTypes.length} updated — ${failures.map((f) => f.taskType).join(", ")} failed`,
                type: "error",
              };
        },
        errorMessage: "Bulk update failed",
        onSuccess: loadAll,
        onError: loadAll,
      });
    },
    [showToast, loadAll]
  );

  const handleRefresh = useCallback(async () => {
    await write<ImportEnvelope>({
      setBusy: setRefreshing,
      url: "/api/models/import",
      // Bulk: walks the whole catalogue (T-0047).
      timeoutMs: API_FETCH_BULK_TIMEOUT_MS,
      successMessage: (res) => {
        const modelsImported = res?.data?.modelsImported ?? 0;
        const creds = res?.data?.credentialsUpdated ?? 0;
        return `Re-imported ${modelsImported} model${pluralise(modelsImported)} from config.yaml${creds > 0 ? `, ${creds} credential${pluralise(creds)} updated` : ""}`;
      },
      errorMessage: "Refresh failed",
    });
  }, [write]);

  /** Resolve one drift line by taking Hermes' side of it. */
  const handleDriftPull = useCallback(
    async (line: DriftLine) => {
      const primary = line.kind === "primary" && line.registryId;
      await write({
        setBusy: (busy) => setBusyDriftLine(busy ? driftLineKey(line) : null),
        url: primary ? "/api/models/defaults" : "/api/models/import",
        method: primary ? "PUT" : "POST",
        body: primary ? { taskType: "agent", modelId: line.registryId } : undefined,
        timeoutMs: primary ? undefined : API_FETCH_BULK_TIMEOUT_MS,
        successMessage: "Pulled from Hermes",
        errorMessage: "Pull failed",
      });
    },
    [write],
  );

  /**
   * Resolve one drift line by taking PatterStage's side of it.
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
      await write<SyncEnvelope>({
        setBusy: (busy) => setBusyDriftLine(busy ? driftLineKey(line) : null),
        url: "/api/models/sync/push",
        body: { modelId: agentDefaultId, pushCredential: false },
        successMessage: "Pushed to Hermes",
        errorMessage: "Push failed",
      });
    },
    [agentDefaultId, write, showToast],
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
    handleAddCredential,
    addingCredential,
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
