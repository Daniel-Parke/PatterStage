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
  Settings,
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
import BulkAuxiliaryUpdater from "@/components/models/BulkAuxiliaryUpdater";
import ModelSyncButtons from "@/components/models/ModelSyncButtons";
import FallbackChainList from "@/components/models/FallbackChainList";
import FallbackConfigPanel from "@/components/models/FallbackConfigPanel";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import {
  TASK_TYPES,
  type TaskType,
} from "@/lib/hermes-providers";
import type { FallbackChainEntry, FallbackConfig } from "@/types/hermes";
import type { SyncActionResult } from "@/lib/sync-manager";
import { emptyModelDefaults } from "@/lib/utils";

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

// ── API row shapes ──────────────────────────────────────────────

function defaultBadgesFor(
  model: ApiModel,
  defaults: Record<TaskType, string | null>,
): TaskType[] {
  return TASK_TYPES.filter((slot) => defaults[slot] === model.id);
}

export default function ModelsPage() {
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

  // Fallback chain state
  const [fallbackChain, setFallbackChain] = useState<FallbackChainEntry[]>([]);
  const [fallbackConfig, setFallbackConfig] = useState<FallbackConfig>({
    restorePrimaryOnFallback: true,
    fallbackNotification: false,
    apiMaxRetries: 2,
  });
  const [syncingFallback, setSyncingFallback] = useState(false);
  const [importingFallback, setImportingFallback] = useState(false);
  const [editingFallbackEntry, setEditingFallbackEntry] = useState<FallbackChainEntry | null>(null);
  const [editingFallbackUrl, setEditingFallbackUrl] = useState("");
  const [savingFallbackUrl, setSavingFallbackUrl] = useState(false);

  const { showToast, toastElement } = useToast();

  // ── Data loading ──────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [mRes, cRes, dRes, driftRes, fbRes, fbCfgRes] = await Promise.all([
        fetch(`/api/models`),
        fetch("/api/credentials"),
        fetch(`/api/models/defaults`),
        fetch("/api/models/sync/drift"),
        fetch("/api/models/fallbacks"),
        fetch("/api/models/fallbacks/config"),
      ]);

      if (!mRes.ok) throw new Error(`Failed to load models (${mRes.status})`);
      if (!cRes.ok) throw new Error(`Failed to load credentials (${cRes.status})`);
      if (!dRes.ok) throw new Error(`Failed to load defaults (${dRes.status})`);
      // Non-critical fetches — silence failures (drift/fallbacks gracefully degrade)
      if (!driftRes.ok) { /* drift check is non-critical */ }
      if (!fbRes.ok) { /* fallback chain is non-critical */ }
      if (!fbCfgRes.ok) { /* fallback config is non-critical */ }

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
      const next = emptyModelDefaults();
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

  // ── Derived model options (model) ──────────────────

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

  // ── Model sync handlers ────────────────────────────────────────

  const handlePush = useCallback(
    async (modelId: string, options?: { pushCredential?: boolean }): Promise<SyncActionResult> => {
      try {
        const res = await fetch(`/api/models/sync/push`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ modelId, pushCredential: options?.pushCredential !== false }),
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
    [loadAll, showToast]
  );

  const handlePull = useCallback(
    async (modelId: string, options?: { excluded?: Set<string> }): Promise<SyncActionResult> => {
      try {
        const excluded = options?.excluded ?? new Set<string>();
        // Filter to only the changes NOT excluded by the user
        const res = await fetch(`/api/models/sync/pull`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ modelId, excluded: [...excluded] }),
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
    [loadAll, showToast]
  );

  // ── Model editor callbacks ─────────────────────────────────────

  const handleSaved = useCallback(() => {
    setEditing(undefined);
    void loadAll();
    showToast("Model saved", "success");
  }, [loadAll, showToast]);

  const handleDelete = useCallback(
    async (model: ApiModel) => {
      if (!confirm(`Delete model "${model.name}"? This cannot be undone.`)) return;
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
          body: JSON.stringify({ taskType, modelId }),
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
    [loadAll, showToast]
  );

  // ── Bulk auxiliary setter ─────────────────────────────────────

  const handleBulkAuxiliaryChange = useCallback(
    async (taskTypes: TaskType[], targetModelId: string) => {
      setBusyTaskType("agent"); // block all while bulk updating
      try {
        const results = await Promise.all(
          taskTypes.map(async (taskType) => {
            const res = await fetch("/api/models/defaults", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ taskType, modelId: targetModelId }),
            });
            if (!res.ok) {
              const data = (await res.json().catch(() => ({}))) as { error?: string };
              return { taskType, ok: false, error: data.error || `Failed (${res.status})` };
            }
            return { taskType, ok: true };
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
        const res = await fetch(`/api/models/fallbacks/${encodeURIComponent(entry.id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ overrideBaseUrl: overrideUrl.trim() || null }),
        });
        if (!res.ok) throw new Error("Update failed");
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
            {/* ── My Models ──────────────────────────────────────────── */}
            <section data-section="my-models" className="space-y-4">
              <h2 className="text-sm font-bold text-white/70 uppercase tracking-wider flex items-center gap-2">
                <Database className="w-4 h-4 text-neon-purple/60" />
                Models
              </h2>

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
                          const badges = defaultBadgesFor(m, defaults);
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
                                    className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                    aria-label={`Delete ${m.name}`}
                                    title="Delete"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
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

            {/* ── Agent Default ─────────────────────────────────────────── */}
            <section data-section="agent-default" className="space-y-4">
              <h2 className="text-sm font-bold text-white/70 uppercase tracking-wider flex items-center gap-2">
                <Star className="w-4 h-4 text-neon-orange" />
                Agent Default
              </h2>

              <GlowSurface accent="orange">
                <div className="rounded-xl border border-neon-orange/20 bg-dark-900/40 p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Left column: Bulk Auxiliaries (compact header) */}
                    <BulkAuxiliaryUpdater
                      models={modelOptions}
                      onChange={handleBulkAuxiliaryChange}
                      disabled={busyTaskType !== null}
                    />

                    {/* Right column: Default Model selector + inline status */}
                    <div className="flex flex-col justify-center gap-3">
                      <label className="block text-xs font-mono text-white/50 uppercase tracking-wider">
                        Default Model
                      </label>
                      <div className="flex items-center gap-3 flex-wrap">
                        <select
                          className="flex-shrink-0 w-full max-w-xs bg-dark-800 border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-sm h-9 min-w-0 focus:outline-none focus:border-neon-orange/50 transition-colors truncate appearance-none"
                          value={defaults.agent ?? ""}
                          onChange={(e) => {
                            const val = e.target.value || null;
                            void handleSetDefault("agent", val);
                          }}
                          disabled={busyTaskType === "agent"}
                          title="Primary model used for all agent missions"
                        >
                          <option value="">— None —</option>
                          {modelOptions.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </select>

                        {/* Inline current model info + status */}
                        {defaults.agent && (() => {
                          const activeModel = models.find((m) => m.id === defaults.agent);
                          return activeModel ? (
                            <div className="min-w-0 flex-1">
                              <span className="text-xs text-white/40 font-mono">
                                {" "}
                                {activeModel.provider}/
                                <span className="text-white/60">{activeModel.modelId}</span>
                              </span>
                              {" "}
                              <span className="inline-flex items-center gap-1 text-green-400 text-xs font-mono">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Active
                              </span>
                            </div>
                          ) : null;
                        })()}
                        {!defaults.agent && (
                          <span className="text-xs text-white/30 font-mono">No default set</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </GlowSurface>
            </section>

            {/* ── Fallback Chain (Collapsible) ───────────────────────── */}
            <section data-section="fallback-chain" className="space-y-4">
              <CollapsibleSection
                title="Fallback Chain"
                description="Ordered models tried sequentially when the primary is unavailable."
                badge={fallbackChain.length}
                badgeColor="purple"
              >
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
              </CollapsibleSection>
            </section>

            {/* ── Default Models ─────────────────────────────────────── */}
            <section data-section="defaults" className="space-y-4">
              <h2 className="text-sm font-bold text-white/70 uppercase tracking-wider flex items-center gap-2">
                <Settings className="w-4 h-4 text-neon-purple/60" />
                Task Defaults
              </h2>
              <DefaultsGrid
                defaults={defaults}
                models={modelOptions}
                onChange={handleSetDefault}
                onSetAllAux={handleBulkAuxiliaryChange}
                busyTaskType={busyTaskType}
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

      {/* Fallback URL Edit Modal */}
      {editingFallbackEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setEditingFallbackEntry(null)}>
          <div className="w-full max-w-md bg-dark-900 border border-white/10 rounded-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-white/10">
              <h3 className="text-sm font-semibold text-white">
                Edit override Base URL: {editingFallbackEntry.modelName}
              </h3>
            </div>
            <div className="p-4">
              <label className="block text-[10px] font-mono text-white/40 uppercase mb-1.5">
                Override Base URL
              </label>
              <input
                type="text"
                value={editingFallbackUrl}
                onChange={(e) => setEditingFallbackUrl(e.target.value)}
                placeholder="https://api.openai.com/v1"
                className="w-full bg-dark-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono outline-none focus:border-neon-purple/50 transition-colors"
                autoFocus
              />
              <p className="text-[10px] text-white/30 font-mono mt-1.5">
                Leave empty to use the model&apos;s default base URL
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setEditingFallbackEntry(null)}
                className="px-3 py-1.5 text-xs font-mono text-white/50 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleFallbackEditSave}
                disabled={savingFallbackUrl}
                className="px-3 py-1.5 text-xs font-mono bg-neon-purple/20 text-neon-purple rounded-lg hover:bg-neon-purple/30 transition-colors disabled:opacity-50"
              >
                {savingFallbackUrl ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppPageShell>
  );
}