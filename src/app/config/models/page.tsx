// ═══════════════════════════════════════════════════════════════
// /config/models — registry-backed model + credentials manager
// ═══════════════════════════════════════════════════════════════
//
// Replaces the legacy YAML-direct /config/model editor (deleted in PR 4).
// Two sections:
//   1. My Models  — table of registry rows + Add Model action
//   2. Defaults   — 12-slot grid driving model.* + auxiliary.<task>.*
//                   in ~/.hermes/config.yaml via PR 5's write-through.

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Globe,
  Plus,
  Trash2,
  Edit3,
  Loader2,
  Database,
  RefreshCw,
  Star,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

import AppPageShell from "@/components/layout/AppPageShell";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import { LoadingSpinner, EmptyState, ErrorBanner } from "@/components/ui/LoadingSpinner";
import { useToast } from "@/components/ui/Toast";
import GlowSurface from "@/components/ui/GlowSurface";

import ModelEditor, {
  type ModelEditorRecord,
} from "@/components/models/ModelEditor";
import DefaultsGrid, {
  type DefaultsModelOption,
} from "@/components/models/DefaultsGrid";
import FrameworkSelector from "@/components/models/FrameworkSelector";
import BulkAuxiliaryUpdater from "@/components/models/BulkAuxiliaryUpdater";
import ModelSyncButtons from "@/components/models/ModelSyncButtons";
import FallbackChainList from "@/components/models/FallbackChainList";
import FallbackConfigPanel from "@/components/models/FallbackConfigPanel";
import {
  TASK_TYPES,
  type TaskType,
} from "@/lib/hermes-providers";
import type { FallbackChainEntry, FallbackConfig } from "@/types/hermes";
import type { SyncActionResult } from "@/lib/sync-manager";

// ── API row shapes ──────────────────────────────────────────────

interface ApiModelDefaults {
  agent: string | null;
  hindsight: string | null;
  compression: string | null;
  vision: string | null;
  web_extract: string | null;
  session_search: string | null;
  title_generation: string | null;
  skills_hub: string | null;
  mcp: string | null;
  triage_specifier: string | null;
  approval: string | null;
  delegation: string | null;
}

interface ApiModel {
  id: string;
  name: string;
  provider: string;
  modelId: string;
  baseUrl: string | null;
  contextLength: number | null;
  credentialsId: string | null;
  frameworkId: string;
  defaults: ApiModelDefaults;
  createdAt: string;
  updatedAt: string;
}

interface ApiCredential {
  id: string;
  label: string;
  provider: string;
  keyHint: string;
  createdAt: string;
  updatedAt: string;
}

// ── Sync drift shape ───────────────────────────────────────────

interface SyncDrift {
  hasDrift: boolean;
  driftDetails?: string[];
}

function emptyDefaults(): Record<TaskType, string | null> {
  return TASK_TYPES.reduce<Record<TaskType, string | null>>(
    (acc, slot) => {
      acc[slot] = null;
      return acc;
    },
    {} as Record<TaskType, string | null>
  );
}

function defaultBadgesFor(model: ApiModel): TaskType[] {
  return TASK_TYPES.filter((slot) => model.defaults[slot] === model.id);
}

const DEFAULT_FALLBACK_CONFIG: FallbackConfig = {
  restorePrimaryOnFallback: true,
  fallbackNotification: false,
  apiMaxRetries: 2,
};

export default function ModelsPage() {
  const [framework, setFramework] = useState<string>("*");
  const [_frameworkLoaded, setFrameworkLoaded] = useState(false);
  const [models, setModels] = useState<ApiModel[]>([]);
  const [credentials, setCredentials] = useState<ApiCredential[]>([]);
  const [defaults, setDefaults] = useState<Record<TaskType, string | null>>(
    emptyDefaults()
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ModelEditorRecord | null | undefined>(
    undefined
  );
  const [busyTaskType, setBusyTaskType] = useState<TaskType | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [drift, setDrift] = useState<SyncDrift | null>(null);

  // Fallback chain state
  const [fallbackChain, setFallbackChain] = useState<FallbackChainEntry[]>([]);
  const [fallbackConfig, setFallbackConfig] = useState<FallbackConfig>(
    DEFAULT_FALLBACK_CONFIG
  );
  const [syncingFallback, setSyncingFallback] = useState(false);
  const [importingFallback, setImportingFallback] = useState(false);

  const { showToast, toastElement } = useToast();

  // ── Framework-scoped data loading ─────────────────────────────

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [mRes, cRes, dRes, driftRes, fbRes, fbCfgRes] = await Promise.all([
        fetch(`/api/models?framework=${encodeURIComponent(framework)}`),
        fetch("/api/credentials"),
        fetch(`/api/models/defaults?framework=${encodeURIComponent(framework)}`),
        fetch("/api/models/sync/drift"),
        fetch("/api/models/fallbacks"),
        fetch("/api/models/fallbacks/config"),
      ]);

      if (!mRes.ok) throw new Error(`Failed to load models (${mRes.status})`);
      if (!cRes.ok) throw new Error(`Failed to load credentials (${cRes.status})`);
      if (!dRes.ok) throw new Error(`Failed to load defaults (${dRes.status})`);
      if (!driftRes.ok) console.warn("Failed to load drift status");
      if (!fbRes.ok) console.warn("Failed to load fallback chain");
      if (!fbCfgRes.ok) console.warn("Failed to load fallback config");

      const m = (await mRes.json()) as { data?: { models?: ApiModel[] } };
      const c = (await cRes.json()) as { data?: { credentials?: ApiCredential[] } };
      const d = (await dRes.json()) as { data?: { defaults?: ApiModelDefaults } };
      const driftData = driftRes.ok
        ? ((await driftRes.json()) as { data?: SyncDrift })
        : { data: null };
      const fbData = fbRes.ok
        ? ((await fbRes.json()) as { data?: { chain?: FallbackChainEntry[] } })
        : { data: null };
      const fbCfgData = fbCfgRes.ok
        ? ((await fbCfgRes.json()) as { data?: { config?: FallbackConfig } })
        : { data: null };

      setModels(m.data?.models ?? []);
      setCredentials(c.data?.credentials ?? []);
      const next = emptyDefaults();
      const incoming = d.data?.defaults;
      if (incoming) {
        for (const slot of TASK_TYPES) {
          next[slot] = incoming[slot] ?? null;
        }
      }
      setDefaults(next);

      // Sync drift
      if (driftData.data) {
        setDrift(driftData.data);
      }

      // Fallback chain
      if (fbData.data?.chain) {
        setFallbackChain(fbData.data.chain);
      }

      // Fallback config
      if (fbCfgData.data?.config) {
        setFallbackConfig(fbCfgData.data.config);
      } else {
        setFallbackConfig(DEFAULT_FALLBACK_CONFIG);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load registry");
    } finally {
      setLoading(false);
    }
  }, [framework]);

  // Load persisted framework on mount, then load data
  useEffect(() => {
    // First, fetch the persisted active framework
    fetch("/api/models/framework")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        const active = data?.data?.active;
        if (active) {
          setFramework(active);
        }
        setFrameworkLoaded(true);
      })
      .catch(() => {
        setFrameworkLoaded(true);
      });
  }, []);

  // Load data once framework is determined
  useEffect(() => {
    if (_frameworkLoaded) {
      void loadAll();
    }
  }, [loadAll, _frameworkLoaded]);

  // ── Framework change handler ───────────────────────────────────

  const handleFrameworkChange = useCallback(async (newFramework: string) => {
    setFramework(newFramework);
    // Persist the active framework via API so it survives page reloads
    try {
      const res = await fetch("/api/models/framework", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ framework: newFramework }),
      });
      if (!res.ok) {
        console.error(`Failed to persist framework: ${res.status}`);
      }
    } catch (e) {
      console.error("Failed to persist framework:", e);
    }
  }, []);

  // ── Derived model options (framework-scoped) ──────────────────

  const modelOptions = useMemo<DefaultsModelOption[]>(
    () =>
      models
        .filter((m) => m.frameworkId === framework || m.frameworkId === "*")
        .map((m) => ({
          id: m.id,
          name: m.name,
          provider: m.provider,
          modelId: m.modelId,
        })),
    [models, framework]
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

  // ── Model sync handlers ────────────────────────────────────────

  const handlePush = useCallback(
    async (modelId: string, options?: { pushCredential?: boolean }): Promise<SyncActionResult> => {
      try {
        const res = await fetch(`/api/models/sync/push`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ modelId, framework, pushCredential: options?.pushCredential !== false }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error || "Push failed");
        }
        showToast("Model pushed to Hermes", "success");
        void loadAll();
        return { success: true, backupPath: null, details: [] };
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : "Push failed",
          "error"
        );
        return {
          success: false,
          backupPath: null,
          details: [{ action: "push", detail: err instanceof Error ? err.message : "Push failed" }],
        };
      }
    },
    [framework, loadAll, showToast]
  );

  const handlePull = useCallback(
    async (modelId: string): Promise<SyncActionResult> => {
      try {
        const res = await fetch(`/api/models/sync/pull`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ modelId, framework }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error || "Pull failed");
        }
        showToast("Model pulled from Hermes", "success");
        void loadAll();
        return { success: true, backupPath: null, details: [] };
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : "Pull failed",
          "error"
        );
        return {
          success: false,
          backupPath: null,
          details: [{ action: "pull", detail: err instanceof Error ? err.message : "Pull failed" }],
        };
      }
    },
    [framework, loadAll, showToast]
  );

  // ── Model editor callbacks ─────────────────────────────────────

  const handleSaved = useCallback(() => {
    setEditing(undefined);
    void loadAll();
    showToast("Model saved", "success");
  }, [loadAll, showToast]);

  const handleDelete = useCallback(
    async (model: ApiModel) => {
      if (deletingId === model.id) {
        try {
          const res = await fetch(`/api/models/${encodeURIComponent(model.id)}`, {
            method: "DELETE",
          });
          if (!res.ok) {
            const data = (await res.json().catch(() => ({}))) as {
              error?: string;
            };
            throw new Error(data.error || "Delete failed");
          }
          showToast(`Deleted ${model.name}`, "success");
          setDeletingId(null);
          await loadAll();
        } catch (err) {
          showToast(
            err instanceof Error ? err.message : "Delete failed",
            "error"
          );
          setDeletingId(null);
        }
      } else {
        setDeletingId(model.id);
        setTimeout(() => {
          setDeletingId((curr) => (curr === model.id ? null : curr));
        }, 4000);
      }
    },
    [deletingId, loadAll, showToast]
  );

  // ── Default model setter ───────────────────────────────────────

  const handleSetDefault = useCallback(
    async (taskType: TaskType, modelId: string | null) => {
      setBusyTaskType(taskType);
      // Optimistic update
      setDefaults((prev) => ({ ...prev, [taskType]: modelId }));
      try {
        const res = await fetch("/api/models/defaults", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskType, modelId, framework }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error || "Failed to update default");
        }
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
    [framework, loadAll, showToast]
  );

  // ── Bulk auxiliary setter ─────────────────────────────────────

  const handleBulkAuxiliaryChange = useCallback(
    async (taskTypes: TaskType[], targetModelId: string) => {
      setBusyTaskType("agent"); // block all while bulk updating
      try {
        await Promise.all(
          taskTypes.map((taskType) =>
            fetch("/api/models/defaults", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ taskType, modelId: targetModelId, framework }),
            })
          )
        );
        await loadAll();
        showToast(
          `Set ${taskTypes.length} auxiliary default${taskTypes.length !== 1 ? "s" : ""}`,
          "success"
        );
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
    [framework, loadAll, showToast]
  );

  // ── Refresh handler ───────────────────────────────────────────

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/models/import", { method: "POST" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Refresh failed");
      }
      const result = (await res.json()) as {
        data?: { modelsImported?: number; modelsSkipped?: number; credentialsUpdated?: number };
      };
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

  // ── Fallback chain handlers ────────────────────────────────────

  const handleFallbackReorder = useCallback(
    async (entryId: string, direction: "up" | "down") => {
      try {
        const res = await fetch("/api/models/fallbacks/reorder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entryId, direction }),
        });
        if (!res.ok) throw new Error("Reorder failed");
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
        const res = await fetch("/api/models/fallbacks/toggle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entryId, enabled }),
        });
        if (!res.ok) throw new Error("Toggle failed");
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
        const res = await fetch(`/api/models/fallbacks/${encodeURIComponent(entryId)}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("Delete failed");
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
    async (entry: FallbackChainEntry) => {
      // For now, allow editing the override base URL
      const overrideBaseUrl = entry.overrideBaseUrl || "";
      const newValue = prompt(
        `Edit override base URL for ${entry.modelName}:\n(Current: ${overrideBaseUrl || "(empty)"})`,
        overrideBaseUrl
      );
      if (newValue === null) return; // cancelled
      try {
        const res = await fetch(`/api/models/fallbacks/${encodeURIComponent(entry.id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ overrideBaseUrl: newValue.trim() || null }),
        });
        if (!res.ok) throw new Error("Update failed");
        await loadAll();
        showToast("Fallback updated", "success");
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : "Update failed",
          "error"
        );
      }
    },
    [loadAll, showToast]
  );

  const handleFallbackAddFromRegistry = useCallback(
    async (modelId: string) => {
      try {
        const res = await fetch("/api/models/fallbacks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ modelId }),
        });
        if (!res.ok) throw new Error("Add failed");
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
        const res = await fetch("/api/models/fallbacks/custom", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, provider, modelIdString, baseUrl }),
        });
        if (!res.ok) throw new Error("Add failed");
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

  const handleSyncFallbackToHermes = useCallback(async () => {
    setSyncingFallback(true);
    try {
      const res = await fetch("/api/models/fallbacks/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: fallbackConfig }),
      });
      if (!res.ok) throw new Error("Sync failed");
      showToast("Fallback config synced to Hermes", "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Sync failed",
        "error"
      );
    } finally {
      setSyncingFallback(false);
    }
  }, [fallbackConfig, showToast]);

  const handleImportFallbackFromConfig = useCallback(async () => {
    setImportingFallback(true);
    try {
      const res = await fetch("/api/models/fallbacks/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Import failed");
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

  // ── Render ────────────────────────────────────────────────────

  return (
    <AppPageShell>
      <PageHeader
        icon={Globe}
        title="Models"
        subtitle={`${models.length} model${models.length === 1 ? "" : "s"} in registry · ${credentials.length} credential${credentials.length === 1 ? "" : "s"}`}
        color="purple"
        backHref="/config"
        backLabel="CONFIG"
        actions={
          <>
            <Button
              variant="secondary"
              color="purple"
              icon={refreshing ? Loader2 : RefreshCw}
              onClick={handleRefresh}
              disabled={refreshing}
              title="Sync models from ~/.hermes/config.yaml and ~/.hermes/.env"
            >
              {refreshing ? "Refreshing…" : "Refresh Models"}
            </Button>
            <Button
              variant="primary"
              color="purple"
              icon={Plus}
              onClick={() => setEditing(null)}
            >
              Add Model
            </Button>
          </>
        }
      />

      {/* Framework Selector — right after PageHeader */}
      <div className="max-w-6xl mx-auto px-6 pt-4">
        <FrameworkSelector
          activeFrameworkId={framework}
          onFrameworkChange={handleFrameworkChange}
        />
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 w-full flex-1 space-y-10">
        {error && <ErrorBanner message={error} />}

        {/* Config Drift Warning Banner */}
        {drift?.hasDrift && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-neon-orange/20 bg-neon-orange/5">
            <AlertTriangle className="w-4 h-4 text-neon-orange/60 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-xs font-mono text-neon-orange/80">
                Config drift detected
              </span>
              {drift.driftDetails && drift.driftDetails.length > 0 && (
                <div className="mt-1 text-[10px] font-mono text-white/30">
                  {drift.driftDetails.join(" · ")}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => void handleRefresh()}
              className="px-3 py-1 text-[10px] font-mono text-neon-orange/70 hover:text-neon-orange bg-neon-orange/10 hover:bg-neon-orange/20 rounded-lg transition-colors"
            >
              Sync Now
            </button>
          </div>
        )}

        {loading ? (
          <LoadingSpinner text="Loading models..." />
        ) : (
          <>
            {/* ── Universal Agent Default (Framework-scoped) ──────────── */}
            <section data-section="agent-default-hero" className="space-y-4">
              <div>
                <h2 className="text-sm font-bold text-white/70 uppercase tracking-wider flex items-center gap-2">
                  <Star className="w-4 h-4 text-neon-orange" />
                  Universal Agent Default (Framework-scoped)
                </h2>
                <p className="text-xs text-white/30 mt-0.5">
                  This model is used by every agent profile by default unless overridden per-profile.
                  Setting a new default here applies immediately to all missions and cron jobs.
                  Changes are scoped to the <span className="text-white/50">{framework}</span> framework.
                </p>
              </div>

              <div className="rounded-xl border border-neon-orange/20 bg-gradient-to-r from-neon-orange/5 to-neon-purple/5 p-6">
                <div className="flex flex-col lg:flex-row lg:items-end gap-4">
                  {/* Model selector */}
                  <div className="flex-1 min-w-0">
                    <label className="block text-xs font-mono text-white/50 uppercase tracking-wider mb-2">
                      Default Model
                    </label>
                    <select
                      className="w-full bg-dark-800 border border-white/10 rounded-lg px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-neon-orange/50 transition-colors"
                      value={defaults.agent ?? ""}
                      onChange={(e) => {
                        const val = e.target.value || null;
                        void handleSetDefault("agent", val);
                      }}
                      disabled={busyTaskType === "agent"}
                    >
                      <option value="">— None —</option>
                      {modelOptions.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.provider} / {m.modelId})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Status indicator */}
                  <div className="flex-shrink-0">
                    {defaults.agent ? (
                      <div className="flex items-center gap-2 text-green-400 text-sm font-mono">
                        <CheckCircle2 className="w-4 h-4" />
                        Active
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-white/30 text-sm font-mono">
                        No default set
                      </div>
                    )}
                  </div>
                </div>

                {/* Show which model is currently the default */}
                {defaults.agent && (() => {
                  const activeModel = models.find((m) => m.id === defaults.agent);
                  return activeModel ? (
                    <div className="mt-3 text-xs text-white/40 font-mono">
                      Currently: <span className="text-white/70">{activeModel.name}</span>
                      {" — "}
                      <span className="text-white/50">{activeModel.provider}</span>
                      {" / "}
                      <span className="text-white/50">{activeModel.modelId}</span>
                    </div>
                  ) : null;
                })()}

                {/* BulkAuxiliaryUpdater — right side of hero */}
                <div className="mt-4 lg:mt-0 lg:ml-4">
                  <BulkAuxiliaryUpdater
                    models={modelOptions}
                    onChange={handleBulkAuxiliaryChange}
                    disabled={busyTaskType !== null}
                  />
                </div>
              </div>
            </section>

            {/* ── My Models ──────────────────────────────────────────── */}
            <section data-section="my-models" className="space-y-4">
              <div>
                <h2 className="text-sm font-bold text-white/70 uppercase tracking-wider">
                  My Models
                </h2>
                <p className="text-xs text-white/30 mt-0.5">
                  Each row owns its own credential row in the registry — adding a
                  model writes the API key through to ~/.hermes/.env so Hermes
                  can use it.
                </p>
              </div>

              {models.length === 0 ? (
                <EmptyState
                  icon={Database}
                  title="No models yet"
                  description="Add your first model to start dispatching missions with custom defaults."
                  action={
                    <Button
                      variant="primary"
                      color="purple"
                      icon={Plus}
                      onClick={() => setEditing(null)}
                    >
                      Add Model
                    </Button>
                  }
                />
              ) : (
                <GlowSurface accent="purple">
                  <div className="overflow-x-auto rounded-xl border border-white/10 bg-dark-900/40">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-[10px] font-mono uppercase tracking-widest text-white/40 border-b border-white/5">
                          <th className="px-4 py-2">Name</th>
                          <th className="px-4 py-2">Provider</th>
                          <th className="px-4 py-2">Model ID</th>
                          <th className="px-4 py-2">Context</th>
                          <th className="px-4 py-2">Default For</th>
                          <th className="px-4 py-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {models.map((m) => {
                          const badges = defaultBadgesFor(m);
                          return (
                            <tr
                              key={m.id}
                              data-row-id={m.id}
                              className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors"
                            >
                              <td className="px-4 py-3 font-mono text-white">
                                {m.name}
                              </td>
                              <td className="px-4 py-3 font-mono text-white/70">
                                {m.provider}
                              </td>
                              <td className="px-4 py-3 font-mono text-white/70">
                                {m.modelId}
                              </td>
                              <td className="px-4 py-3 font-mono text-white/40">
                                {m.contextLength ?? "—"}
                              </td>
                              <td className="px-4 py-3">
                                {badges.length === 0 ? (
                                  <span className="text-white/30 font-mono text-xs">—</span>
                                ) : (
                                  <div className="flex flex-wrap gap-1">
                                    {badges.map((b) => (
                                      <span
                                        key={b}
                                        className="text-[10px] font-mono bg-neon-purple/15 text-neon-purple px-1.5 py-0.5 rounded uppercase tracking-widest"
                                      >
                                        {b}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-end gap-1">
                                  {/* ModelSyncButtons — push/pull */}
                                  <ModelSyncButtons
                                    modelId={m.id}
                                    modelName={m.name}
                                    provider={m.provider}
                                    modelIdString={m.modelId}
                                    onPush={handlePush}
                                    onPull={handlePull}
                                    disabled={busyTaskType !== null}
                                  />

                                  {/* Edit */}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditing({
                                        id: m.id,
                                        name: m.name,
                                        provider: m.provider,
                                        modelId: m.modelId,
                                        baseUrl: m.baseUrl,
                                        contextLength: m.contextLength,
                                        credentialsId: m.credentialsId,
                                      })
                                    }
                                    className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
                                    aria-label={`Edit ${m.name}`}
                                    title="Edit"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Delete */}
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(m)}
                                    className={`p-1.5 rounded-lg transition-colors ${
                                      deletingId === m.id
                                        ? "text-red-400 bg-red-500/10"
                                        : "text-white/30 hover:text-red-400 hover:bg-red-500/10"
                                    }`}
                                    aria-label={`Delete ${m.name}`}
                                    title={
                                      deletingId === m.id
                                        ? "Click again to confirm"
                                        : "Delete"
                                    }
                                  >
                                    {deletingId === m.id ? (
                                      <Loader2 className="w-3.5 h-3.5" />
                                    ) : (
                                      <Trash2 className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </GlowSurface>
              )}
            </section>

            {/* ── Default Models (DefaultsGrid) ─────────────────────── */}
            <section data-section="defaults" className="space-y-4">
              <div>
                <h2 className="text-sm font-bold text-white/70 uppercase tracking-wider">
                  Default Models
                </h2>
                <p className="text-xs text-white/30 mt-0.5">
                  Each task slot maps to a Hermes auxiliary section
                  (~/.hermes/config.yaml). Changing a default re-syncs the
                  config file automatically.
                </p>
              </div>
              <DefaultsGrid
                defaults={defaults}
                models={modelOptions}
                onChange={handleSetDefault}
                busyTaskType={busyTaskType}
              />
            </section>

            {/* ── Fallback Chain ─────────────────────────────────────── */}
            <section data-section="fallback-chain" className="space-y-4">
              <div>
                <h2 className="text-sm font-bold text-white/70 uppercase tracking-wider">
                  Fallback Chain
                </h2>
                <p className="text-xs text-white/30 mt-0.5">
                  Ordered fallback models when the primary model is unavailable.
                  Sync to Hermes to activate.
                </p>
              </div>

              <FallbackChainList
                chain={fallbackChain}
                models={modelOptions}
                onReorder={handleFallbackReorder}
                onToggle={handleFallbackToggle}
                onDelete={handleFallbackDelete}
                onEdit={handleFallbackEdit}
                onAddFromRegistry={handleFallbackAddFromRegistry}
                onAddCustom={handleFallbackAddCustom}
                disabled={busyTaskType !== null}
              />

              <FallbackConfigPanel
                config={fallbackConfig}
                onUpdate={setFallbackConfig}
                onSyncToHermes={handleSyncFallbackToHermes}
                onImportFromConfig={handleImportFallbackFromConfig}
                syncing={syncingFallback}
                importing={importingFallback}
              />
            </section>
          </>
        )}
      </div>

      {editing !== undefined && (
        <ModelEditor
          model={editing}
          credentials={credentialOptions}
          onClose={() => setEditing(undefined)}
          onSaved={handleSaved}
        />
      )}

      {toastElement}
    </AppPageShell>
  );
}