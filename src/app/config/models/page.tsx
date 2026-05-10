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
} from "lucide-react";

import AppPageShell from "@/components/layout/AppPageShell";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import { LoadingSpinner, EmptyState, ErrorBanner } from "@/components/ui/LoadingSpinner";
import { useToast } from "@/components/ui/Toast";

import ModelEditor, {
  type ModelEditorRecord,
} from "@/components/models/ModelEditor";
import DefaultsGrid, {
  type DefaultsModelOption,
} from "@/components/models/DefaultsGrid";
import {
  TASK_TYPES,
  type TaskType,
} from "@/lib/hermes-providers";

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

export default function ModelsPage() {
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
  const { showToast, toastElement } = useToast();

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [mRes, cRes, dRes] = await Promise.all([
        fetch("/api/models"),
        fetch("/api/credentials"),
        fetch("/api/models/defaults"),
      ]);
      if (!mRes.ok) throw new Error(`Failed to load models (${mRes.status})`);
      if (!cRes.ok) throw new Error(`Failed to load credentials (${cRes.status})`);
      if (!dRes.ok) throw new Error(`Failed to load defaults (${dRes.status})`);
      const m = (await mRes.json()) as { data?: { models?: ApiModel[] } };
      const c = (await cRes.json()) as { data?: { credentials?: ApiCredential[] } };
      const d = (await dRes.json()) as { data?: { defaults?: ApiModelDefaults } };
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load registry");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
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

        {loading ? (
          <LoadingSpinner text="Loading models..." />
        ) : (
          <>
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
              )}
            </section>

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
