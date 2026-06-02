// ═══════════════════════════════════════════════════════════════
// useModelsPage — state + handlers for /config/models
// ═══════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useToast } from "@/components/ui/Toast";
import { safeApiCall, apiFetch } from "@/lib/api-fetch";
import type { ModelEditorRecord } from "@/components/models/ModelEditor";
import type { DefaultsModelOption } from "@/components/models/DefaultsGrid";
import { type TaskType } from "@/lib/hermes-providers";
import type { FallbackChainEntry, FallbackConfig } from "@/types/hermes";
import type { SyncActionResult } from "@/lib/sync-manager";
import { emptyModelDefaults } from "@/lib/utils";

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
  const [editingFallbackEntry, setEditingFallbackEntry] = useState<FallbackChainEntry | null>(null);
  const [editingFallbackUrl, setEditingFallbackUrl] = useState("");
  const [savingFallbackUrl, setSavingFallbackUrl] = useState(false);

  const { showToast, toastElement } = useToast();

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // First, sync models from ~/.hermes/config.yaml — ensures we show
      // live data even if the user changed defaults externally via hermes CLI
      await apiFetch("/api/models/import", { method: "POST" }).catch((err) => {
        console.warn("Model auto-import failed — showing cached data:", err instanceof Error ? err.message : err);
      });

      const [mData, cData, dData, driftData, fbData, fbCfgData] = await Promise.all([
        apiFetch("/api/models"),
        apiFetch("/api/credentials"),
        apiFetch("/api/models/defaults"),
        apiFetch("/api/models/sync/drift").catch(() => ({ data: null as SyncDrift | null })),
        apiFetch("/api/models/fallbacks").catch(() => ({ data: null as { entries?: FallbackChainEntry[] } | null })),
        apiFetch("/api/models/fallbacks/config").catch(() => ({ data: null as { config?: FallbackConfig } | null })),
      ]);

      setModels(mData.data?.models ?? []);
      setCredentials(cData.data?.credentials ?? []);
      // API returns a complete defaults object (all 12 slots populated or null).
      // Fall back to empty defaults if the response is missing.
      setDefaults(dData.data?.defaults ?? emptyModelDefaults());

      if (driftData.data) {
        setDrift(driftData.data as SyncDrift);
      }

      if (fbData.data?.entries) {
        setFallbackChain(fbData.data.entries);
      }

      if (fbCfgData.data?.config) {
        setFallbackConfig(fbCfgData.data.config);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load registry");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

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
        showToast(
          err instanceof Error ? err.message : `${label} failed`,
          "error",
        );
        return {
          success: false,
          backupPath: null,
          details: [{ action, detail: err instanceof Error ? err.message : `${label} failed` }],
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

  const handleDelete = useCallback(
    async (model: ApiModel) => {
      if (!confirm(`Delete model "${model.name}"? This cannot be undone.`)) return;
      try {
        await apiFetch(`/api/models/${encodeURIComponent(model.id)}`, {
          method: "DELETE",
        });
        showToast(`Deleted ${model.name}`, "success");
        await loadAll();
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : "Delete failed",
          "error"
        );
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
        showToast(
          err instanceof Error ? err.message : "Default update failed",
          "error"
        );
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
              return { taskType, ok: false, error: err instanceof Error ? err.message : "Failed" };
            }
          })
        );
        await loadAll();
        const failures = results.filter((r) => !r.ok);
        if (failures.length === 0) {
          showToast(
            `Set ${taskTypes.length} auxiliary default${taskTypes.length !== 1 ? "s" : ""}`,
            "success"
          );
        } else {
          showToast(
            `${results.length - failures.length}/${taskTypes.length} updated — ${failures.map((f) => f.taskType).join(", ")} failed`,
            "error"
          );
        }
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : "Bulk update failed",
          "error"
        );
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
      const result = await apiFetch<{
        data?: { modelsImported?: number; modelsSkipped?: number; credentialsUpdated?: number };
      }>("/api/models/import", { method: "POST" });
      const modelsImported = result.data?.modelsImported ?? 0;
      const creds = result.data?.credentialsUpdated ?? 0;
      showToast(
        `Synced: ${modelsImported} model${modelsImported !== 1 ? "s" : ""} ${modelsImported > 0 ? "(updated)" : "(no change)"}${creds > 0 ? `, ${creds} credential${creds !== 1 ? "s" : ""} updated` : ""} from Hermes`,
        "success"
      );
      await loadAll();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Refresh failed",
        "error"
      );
    } finally {
      setRefreshing(false);
    }
  }, [loadAll, showToast]);

  const handleFallbackReorder = useCallback(
    async (entryId: string, direction: "up" | "down") => {
      try {
        await apiFetch("/api/models/fallbacks/reorder", {
          method: "POST",
          body: JSON.stringify({ entryId, direction }),
        });
        await loadAll();
        showToast("Fallback chain reordered", "success");
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : "Reorder failed",
          "error"
        );
      }
    },
    [loadAll, showToast]
  );

  const handleFallbackToggle = useCallback(
    async (entryId: string, enabled: boolean) => {
      try {
        await apiFetch("/api/models/fallbacks/toggle", {
          method: "POST",
          body: JSON.stringify({ entryId, enabled }),
        });
        await loadAll();
        showToast(enabled ? "Fallback model enabled" : "Fallback model disabled", "success");
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : "Toggle failed",
          "error"
        );
      }
    },
    [loadAll, showToast]
  );

  const handleFallbackDelete = useCallback(
    async (entryId: string) => {
      try {
        await apiFetch(`/api/models/fallbacks/${encodeURIComponent(entryId)}`, {
          method: "DELETE",
        });
        await loadAll();
        showToast("Fallback model removed", "success");
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : "Delete failed",
          "error"
        );
      }
    },
    [loadAll, showToast]
  );

  const handleFallbackEdit = useCallback(
    (entry: FallbackChainEntry) => {
      setEditingFallbackEntry(entry);
      setEditingFallbackUrl(entry.overrideBaseUrl || "");
    },
    [],
  );

  const handleFallbackEditSave = useCallback(
    async () => {
      if (!editingFallbackEntry) return;
      const entry = editingFallbackEntry;
      const overrideUrl = editingFallbackUrl;
      setSavingFallbackUrl(true);
      try {
        await apiFetch(`/api/models/fallbacks/${encodeURIComponent(entry.id)}`, {
          method: "PUT",
          body: JSON.stringify({ overrideBaseUrl: overrideUrl.trim() || null }),
        });
        await loadAll();
        setEditingFallbackEntry(null);
        showToast("Fallback updated", "success");
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : "Update failed",
          "error"
        );
      } finally {
        setSavingFallbackUrl(false);
      }
    },
    [editingFallbackEntry, editingFallbackUrl, loadAll, showToast]
  );

  const handleFallbackAddFromRegistry = useCallback(
    async (modelId: string) => {
      try {
        await apiFetch("/api/models/fallbacks", {
          method: "POST",
          body: JSON.stringify({ modelId }),
        });
        await loadAll();
        showToast("Fallback model added from registry", "success");
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : "Add failed",
          "error"
        );
      }
    },
    [loadAll, showToast]
  );

  const handleFallbackAddCustom = useCallback(
    async (name: string, provider: string, modelIdString: string, baseUrl?: string) => {
      try {
        await apiFetch("/api/models/fallbacks/custom", {
          method: "POST",
          body: JSON.stringify({ name, provider, modelIdString, baseUrl }),
        });
        await loadAll();
        showToast("Custom fallback model added", "success");
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : "Add failed",
          "error"
        );
      }
    },
    [loadAll, showToast]
  );

  // ── handleImportFallbackFromConfig ───────────────────────────────

  const handleImportFallbackFromConfig = useCallback(async () => {
    setImportingFallback(true);
    try {
      await apiFetch("/api/models/fallbacks/import", {
        method: "POST",
      });
      await loadAll();
      showToast("Fallback config imported from Hermes", "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Import failed",
        "error"
      );
    } finally {
      setImportingFallback(false);
    }
  }, [loadAll, showToast]);

  const persistFallbackConfigNow = useCallback(
    async (config: FallbackConfig): Promise<boolean> => {
      const gen = ++fallbackSaveGenRef.current;
      setFallbackConfigSaving(true);
      setFallbackConfigError(null);
      const { ok, data: res, error } = await safeApiCall<{ data: { config: FallbackConfig } }>(
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
      }>("/api/models/fallbacks/sync", {
        method: "POST",
        body: JSON.stringify({ config: fallbackConfig }),
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
      showToast(
        err instanceof Error ? err.message : "Sync failed",
        "error"
      );
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
    editingFallbackEntry,
    editingFallbackUrl,
    setEditingFallbackUrl,
    savingFallbackUrl,
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
    setEditingFallbackEntry,
  };
}
