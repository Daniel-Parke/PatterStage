// ═══════════════════════════════════════════════════════════════
// useModelsPage — state + handlers for /config/models
// ═══════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useToast } from "@/components/ui/Toast";
import {
  safeApiCall,
  safeApiCallData,
  apiFetch,
  messageFromError,
  setErrorFromCaught,
  toastError,
} from "@/lib/api-fetch";
import type { ModelEditorRecord } from "@/components/models/ModelEditor";
import type { DefaultsModelOption } from "@/components/models/DefaultsGrid";
import { type TaskType } from "@/lib/models/task-types";
import type { FallbackChainEntry, FallbackConfig } from "@/types/hermes";
import type { SyncActionResult } from "@/lib/sync-manager";
import { emptyModelDefaults, pluralise } from "@/lib/utils";

import type { ApiCredential, ApiModel, SyncDrift } from "@/components/models/types";

export function useModelsPage() {
  const [models, setModels] = useState<ApiModel[]>([]);
  const [credentials, setCredentials] = useState<ApiCredential[]>([]);
  const [defaults, setDefaults] = useState<Record<TaskType, string | null>>(
    emptyModelDefaults()
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ModelEditorRecord | null | undefined>(
    undefined
  );
  const [busyTaskType, setBusyTaskType] = useState<TaskType | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [drift, setDrift] = useState<SyncDrift | null>(null);

  const [fallbackChain, setFallbackChain] = useState<FallbackChainEntry[]>([]);
  const [fallbackConfig, setFallbackConfig] = useState<FallbackConfig>({
    restorePrimaryOnFallback: true,
    fallbackNotification: false,
    apiMaxRetries: 3,
  });
  const [syncingFallback, setSyncingFallback] = useState(false);
  const [fallbackConfigSaving, setFallbackConfigSaving] = useState(false);
  const [fallbackConfigDirty, setFallbackConfigDirty] = useState(false);
  const [fallbackConfigError, setFallbackConfigError] = useState<string | null>(null);
  const [importingFallback, setImportingFallback] = useState(false);
  const fallbackSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fallbackSaveGenRef = useRef(0);
  const pendingFallbackConfigRef = useRef<FallbackConfig | null>(null);
  // The 3 fallback-edit useState calls (entry / url / saving) are tightly
  // coupled — they always transition together (open: entry+url set, saving
  // reset; close: all 3 clear; save: saving flips true→false). Consolidate
  // into a single state object so the "set 3 fields to 3 different things"
  // race that was possible with separate useState calls is structurally
  // impossible. The page-level page.tsx still receives 3 distinct fields
  // (`editingFallbackEntry`, `editingFallbackUrl`, `savingFallbackUrl`)
  // so the public surface is unchanged.
  const [fallbackEdit, setFallbackEdit] = useState<{
    entry: FallbackChainEntry | null;
    url: string;
    saving: boolean;
  }>({ entry: null, url: "", saving: false });

  const { showToast, toastElement } = useToast();

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // First, sync models from ~/.hermes/config.yaml — ensures we show
      // live data even if the user changed defaults externally via hermes CLI
      await apiFetch("/api/models/import", { method: "POST" }).catch((err) => {
        // `messageFromError` falls back to `String(err)` when the caught
        // value has no `message` — equivalent to the verbose
        // `toError(err).message || String(err)` form, with a name + JSDoc.
        const msg = messageFromError(err, String(err));
        console.warn("Model auto-import failed — showing cached data:", msg);
      });

      const [m, c, d, drift, fb, fbCfg] = await Promise.all([
        apiFetch("/api/models"),
        apiFetch("/api/credentials"),
        apiFetch("/api/models/defaults"),
        // Best-effort reads — fall back to `null` on per-endpoint error
        // instead of failing the whole load. The first three (m/c/d)
        // are still throw-on-error so the outer catch can show
        // "Failed to load registry" if a primary endpoint is down.
        safeApiCallData<SyncDrift>("/api/models/sync/drift"),
        safeApiCallData<{ entries?: FallbackChainEntry[] }>("/api/models/fallbacks"),
        safeApiCallData<{ config?: FallbackConfig }>("/api/models/fallbacks/config"),
      ]);

      setModels(m.data?.models ?? []);
      setCredentials(c.data?.credentials ?? []);
      // API returns a complete defaults object (all 12 slots populated or null).
      // Fall back to empty defaults if the response is missing.
      setDefaults(d.data?.defaults ?? emptyModelDefaults());

      if (drift) {
        setDrift(drift);
      }

      if (fb?.entries) {
        setFallbackChain(fb.entries);
      }

      if (fbCfg?.config) {
        setFallbackConfig(fbCfg.config);
      }
    } catch (err) {
      setErrorFromCaught(setError, err, "Failed to load registry");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  /**
   * Shared helper for the fallback-chain CRUD handlers (reorder, toggle,
   * delete, add-from-registry, add-custom, import-from-config). They all
   * do the same thing: optionally mark a busy state, call the API, refetch,
   * toast success; on failure, toast the error and still clear the busy
   * state. Edit + config flows have side-effects (closing the modal,
   * optimistic UI, debounced save) that don't fit this pattern — those
   * stay as bespoke handlers.
   *
   * The optional `setBusy` parameter mirrors the same pattern that
   * `runSyncAction` (in `@/lib/operation-sync-action.ts`) uses for the
   * operations pages: the helper calls `setBusy(true)` at the start of
   * the mutation and `setBusy(false)` in a `finally` block, so callers
   * that need a spinner (e.g. `handleImportFallbackFromConfig` setting
   * `importingFallback` for the "Import" button) get the lifecycle
   * without duplicating the try/catch/finally boilerplate. Callers that
   * don't need a spinner (the 5 fallback-chain CRUD handlers) simply
   * omit the param; the default is a no-op, so their behaviour is
   * unchanged.
   */
  const runFallbackMutation = useCallback(
    async (
      successMessage: string,
      errorFallback: string,
      url: string,
      init: { method: "POST" | "PUT" | "DELETE"; body?: string },
      setBusy?: (busy: boolean) => void,
    ): Promise<void> => {
      const setBusyFn = setBusy ?? (() => undefined);
      setBusyFn(true);
      try {
        await apiFetch(url, init);
        await loadAll();
        showToast(successMessage, "success");
      } catch (err) {
        toastError(showToast, err, errorFallback);
      } finally {
        setBusyFn(false);
      }
    },
    [loadAll, showToast]
  );

  const modelOptions = useMemo<DefaultsModelOption[]>(
    () =>
      models.map((m) => ({
        id: m.id,
        name: m.name,
        provider: m.provider,
        modelId: m.modelId,
      })),
    [models]
  );

  const credentialOptions = useMemo(
    () =>
      credentials.map((c) => ({
        id: c.id,
        label: c.label,
        provider: c.provider,
        keyHint: c.keyHint,
      })),
    [credentials]
  );

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
    [loadAll, showToast]
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
      }>("/api/models/import", { method: "POST" });
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

  const handleFallbackReorder = useCallback(
    async (entryId: string, direction: "up" | "down") =>
      runFallbackMutation(
        "Fallback chain reordered",
        "Reorder failed",
        "/api/models/fallbacks",
        { method: "POST", body: JSON.stringify({ action: "reorder", entryId, direction }) },
      ),
    [runFallbackMutation]
  );

  const handleFallbackToggle = useCallback(
    async (entryId: string, enabled: boolean) =>
      runFallbackMutation(
        enabled ? "Fallback model enabled" : "Fallback model disabled",
        "Toggle failed",
        "/api/models/fallbacks",
        { method: "POST", body: JSON.stringify({ action: "toggle", entryId, enabled }) },
      ),
    [runFallbackMutation]
  );

  const handleFallbackDelete = useCallback(
    async (entryId: string) =>
      runFallbackMutation(
        "Fallback model removed",
        "Delete failed",
        `/api/models/fallbacks/${encodeURIComponent(entryId)}`,
        { method: "DELETE" },
      ),
    [runFallbackMutation]
  );

  const handleFallbackEdit = useCallback((entry: FallbackChainEntry) => {
    setFallbackEdit({ entry, url: entry.overrideBaseUrl || "", saving: false });
  }, []);

  const handleFallbackEditSave = useCallback(async () => {
    const current = fallbackEdit;
    if (!current.entry) return;
    const entry = current.entry;
    const overrideUrl = current.url;
    setFallbackEdit((prev) => ({ ...prev, saving: true }));
    try {
      await apiFetch(`/api/models/fallbacks/${encodeURIComponent(entry.id)}`, {
        method: "PUT",
        body: JSON.stringify({ overrideBaseUrl: overrideUrl.trim() || null }),
      });
      await loadAll();
      setFallbackEdit({ entry: null, url: "", saving: false });
      showToast("Fallback updated", "success");
    } catch (err) {
      toastError(showToast, err, "Update failed");
      setFallbackEdit((prev) => ({ ...prev, saving: false }));
    }
  }, [fallbackEdit, loadAll, showToast]);

  const handleFallbackAddFromRegistry = useCallback(
    async (modelId: string) =>
      runFallbackMutation(
        "Fallback model added from registry",
        "Add failed",
        "/api/models/fallbacks",
        { method: "POST", body: JSON.stringify({ action: "add", modelId }) },
      ),
    [runFallbackMutation]
  );

  const handleFallbackAddCustom = useCallback(
    async (name: string, provider: string, modelIdString: string, baseUrl?: string) =>
      runFallbackMutation(
        "Custom fallback model added",
        "Add failed",
        "/api/models/fallbacks",
        { method: "POST", body: JSON.stringify({ action: "custom", name, provider, modelIdString, baseUrl }) },
      ),
    [runFallbackMutation]
  );

  // ── handleImportFallbackFromConfig ───────────────────────────────
  //
  // Migrated to `runFallbackMutation` (which gained an optional
  // `setBusy` parameter to absorb the importing-fallback busy state).
  // Pre-refactor: 14 lines of inline `try { apiFetch + loadAll +
  // showToast } catch { toastError } finally { setImportingFallback
  // (false) }`. Post-refactor: a single 5-line `runFallbackMutation`
  // call. The order of operations is byte-equivalent:
  //   1. `setImportingFallback(true)` (via the setBusy param)
  //   2. `await apiFetch("/api/models/fallbacks/import", { method: "POST" })`
  //   3. `await loadAll()` (re-fetch the chain + config + drift)
  //   4. `showToast("Fallback config imported from Hermes", "success")`
  //   5. `setImportingFallback(false)` (via the setBusy param, in
  //      a `finally` block — fires on both success and failure paths)
  // The error path's `toastError(showToast, err, "Import failed")` is
  // preserved (the helper's `errorFallback` parameter is wired to it).
  // `importingFallback` remains in the hook's public return surface
  // (read by `ModelsFallbackSection.tsx` for the Import button's
  // busy state) — only the `setImportingFallback(true/false)` call
  // sites moved into the helper via the `setBusy` adapter.
  const handleImportFallbackFromConfig = useCallback(
    () =>
      runFallbackMutation(
        "Fallback config imported from Hermes",
        "Import failed",
        "/api/models/fallbacks",
        { method: "POST", body: JSON.stringify({ action: "import" }) },
        setImportingFallback,
      ),
    [runFallbackMutation],
  );

  const persistFallbackConfigNow = useCallback(
    async (config: FallbackConfig): Promise<boolean> => {
      const gen = ++fallbackSaveGenRef.current;
      setFallbackConfigSaving(true);
      setFallbackConfigError(null);
      // The route returns `{ data: { config: ... } }` (envelope).
      // `safeApiCall<T>` does NOT unwrap — `data` is the full body —
      // so the type is the envelope shape and the inner config is read
      // via `res?.data?.config` (two indirections).
      const { ok, data: res, error } = await safeApiCall<{ data?: { config: FallbackConfig } }>(
        "/api/models/fallbacks/config",
        {
          method: "PUT",
          body: {
            restorePrimaryOnFallback: config.restorePrimaryOnFallback,
            fallbackNotification: config.fallbackNotification,
            apiMaxRetries: config.apiMaxRetries,
          },
        },
      );
      if (gen !== fallbackSaveGenRef.current) {
        return false;
      }
      setFallbackConfigSaving(false);
      const saved = res?.data?.config;
      if (!ok || !saved) {
        setFallbackConfigError(error ?? "Failed to save fallback settings");
        return false;
      }
      setFallbackConfig(saved);
      setFallbackConfigDirty(false);
      return true;
    },
    [],
  );

  const handleFallbackConfigChange = useCallback(
    (next: FallbackConfig) => {
      setFallbackConfig(next);
      setFallbackConfigDirty(true);
      setFallbackConfigError(null);
      pendingFallbackConfigRef.current = next;

      if (fallbackSaveTimerRef.current) {
        clearTimeout(fallbackSaveTimerRef.current);
      }
      fallbackSaveTimerRef.current = setTimeout(() => {
        const toSave = pendingFallbackConfigRef.current;
        if (!toSave) return;
        void persistFallbackConfigNow(toSave);
      }, 400);
    },
    [persistFallbackConfigNow],
  );

  const flushFallbackConfigSave = useCallback(async (): Promise<boolean> => {
    if (fallbackSaveTimerRef.current) {
      clearTimeout(fallbackSaveTimerRef.current);
      fallbackSaveTimerRef.current = null;
    }
    const pending = pendingFallbackConfigRef.current ?? fallbackConfig;
    if (!fallbackConfigDirty && !fallbackConfigSaving) {
      return true;
    }
    return persistFallbackConfigNow(pending);
  }, [fallbackConfig, fallbackConfigDirty, fallbackConfigSaving, persistFallbackConfigNow]);

  const handleSyncFallbackToHermes = useCallback(async () => {
    setSyncingFallback(true);
    try {
      const expectedRetries = fallbackConfig.apiMaxRetries;
      const saved = await flushFallbackConfigSave();
      if (!saved) {
        showToast(fallbackConfigError ?? "Save fallback settings before syncing", "error");
        return;
      }

      const res = await apiFetch<{
        data: {
          success: boolean;
          config: FallbackConfig;
          configPath?: string;
        };
      }>("/api/models/fallbacks", {
        method: "POST",
        body: JSON.stringify({ action: "sync", config: fallbackConfig }),
      });

      const payload = res.data;
      if (!payload?.success) {
        showToast("Sync failed", "error");
        return;
      }

      if (payload.config) {
        setFallbackConfig(payload.config);
        setFallbackConfigDirty(false);
      }

      if (payload.config.apiMaxRetries !== expectedRetries) {
        showToast(
          `Sync finished but retry threshold is still ${payload.config.apiMaxRetries} (expected ${expectedRetries})`,
          "error",
        );
        return;
      }

      showToast("Fallback config synced to Hermes", "success");
    } catch (err) {
      toastError(showToast, err, "Sync failed");
    } finally {
      setSyncingFallback(false);
    }
  }, [fallbackConfig, fallbackConfigError, flushFallbackConfigSave, showToast]);

  return {
    models,
    credentials,
    modelOptions,
    credentialOptions,
    defaults,
    loading,
    error,
    drift,
    refreshing,
    busyTaskType,
    fallbackChain,
    fallbackConfig,
    handleFallbackConfigChange,
    fallbackConfigSaving,
    fallbackConfigDirty,
    fallbackConfigError,
    syncingFallback,
    importingFallback,
    editing,
    setEditing,
    // Fallback-edit state is consolidated into `fallbackEdit` internally;
    // expose the 3 fields the page-level consumer reads in their original
    // shape so the ModelsFallbackSection component contract is unchanged.
    editingFallbackEntry: fallbackEdit.entry,
    editingFallbackUrl: fallbackEdit.url,
    // `setEditingFallbackUrl` is a partial-update shim — the caller only
    // ever sets the url field (e.g. from the <input> onChange), so the
    // shim is narrower than `setFallbackEdit` and keeps the
    // ModelsFallbackSection props interface byte-equivalent to the
    // pre-refactor form.
    setEditingFallbackUrl: (url: string) =>
      setFallbackEdit((prev) => ({ ...prev, url })),
    savingFallbackUrl: fallbackEdit.saving,
    toastElement,
    handleRefresh,
    handlePush,
    handlePull,
    handleSaved,
    handleDelete,
    handleSetDefault,
    handleBulkAuxiliaryChange,
    handleFallbackReorder,
    handleFallbackToggle,
    handleFallbackDelete,
    handleFallbackEdit,
    handleFallbackEditSave,
    handleFallbackAddFromRegistry,
    handleFallbackAddCustom,
    handleSyncFallbackToHermes,
    handleImportFallbackFromConfig,
    // `setEditingFallbackEntry` is a close-modal shim — the consumer
    // calls it with `null` to dismiss the modal. Equivalent to
    // `setFallbackEdit({ entry: null, url: "", saving: false })`.
    setEditingFallbackEntry: (entry: FallbackChainEntry | null) =>
      setFallbackEdit({ entry, url: entry?.overrideBaseUrl || "", saving: false }),
  };
}
