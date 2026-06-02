"use client";

import { useCallback, useEffect, useState } from "react";
import { RotateCcw, Database, Bot, ListTodo } from "lucide-react";

import AppPageShell from "@/components/layout/AppPageShell";
import PageHeader from "@/components/layout/PageHeader";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { apiFetch } from "@/lib/api-fetch";
import type { AgentProfile } from "@/types/hermes";

interface SeedState {
  lastRun?: string;
  profiles?: number;
  templates?: number;
  categories?: number;
}

interface CatalogTemplate {
  id: string;
  name: string;
  seedKey?: string | null;
  isCustom?: boolean;
}

export default function ConfigSeedPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const isBusy = busy !== null;
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<SeedState | null>(null);
  const [profiles, setProfiles] = useState<AgentProfile[]>([]);
  const [templates, setTemplates] = useState<CatalogTemplate[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [seedRes, profRes, tplRes] = await Promise.all([
        apiFetch("/api/seed"),
        apiFetch("/api/agent/profiles"),
        apiFetch("/api/templates"),
      ]);
      setState(seedRes.data?.state ?? null);
      setProfiles(
        ((profRes.data?.profiles ?? []) as AgentProfile[]).filter(
          (p) => p.isBundled && !p.isDefault,
        ),
      );
      setTemplates(
        ((tplRes.data?.templates ?? []) as CatalogTemplate[]).filter(
          (t) => !t.isCustom && t.seedKey,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const runSeed = async (
    target: "all" | "root" | "profiles" | "templates" | "categories",
    mode: "merge" | "replace",
    extra?: { slug?: string; templateId?: string },
  ) => {
    const key = `${target}-${mode}-${extra?.slug ?? extra?.templateId ?? "all"}`;
    setBusy(key);
    setError(null);
    try {
      await apiFetch("/api/seed", {
        method: "POST",
        body: JSON.stringify({ target, mode, ...extra }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Seed failed");
    } finally {
      setBusy(null);
    }
  };

  const confirmReseedAll = () => {
    if (
      !window.confirm(
        "Restore entire default catalog? This replaces Bob, seeded profiles, templates, and categories in the database.",
      )
    ) {
      return;
    }
    void runSeed("all", "replace");
  };

  return (
    <AppPageShell>
      <PageHeader
        icon={RotateCcw}
        title="Seed"
        subtitle="Professional catalog — restore defaults from the shipped pack"
        color="cyan"
        backHref="/config"
        backLabel="CONFIG"
      />
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-8">
        {loading ? (
          <LoadingSpinner text="Loading seed status…" />
        ) : (
          <>
            {error ? (
              <p className="text-sm font-mono text-red-400 border border-red-500/30 rounded-lg p-3">
                {error}
              </p>
            ) : null}

            <p className="text-xs text-white/40 font-mono border border-amber-500/20 rounded-lg p-3 bg-amber-500/5">
              <strong className="text-amber-200/80">Import before seed:</strong> if{" "}
              <code className="text-white/50">~/.hermes</code> exists, run{" "}
              <code className="text-white/50">npx tsx scripts/tooling/import-hermes-state.ts</code>{" "}
              (or use setup/ch-deploy) before merge seed. Merge never overwrites imported Bob or
              seeded profiles with existing content.
            </p>

            <section className="border border-neon-cyan/30 rounded-xl p-6 bg-dark-900/80">
              <h2 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-neon-cyan" />
                Reseed all
              </h2>
              <p className="text-sm text-white/60 mb-4">
                Imports existing Hermes state first, then restores Bob, {profiles.length} professional
                agents, {templates.length} mission templates, and default categories.
              </p>
              <button
                type="button"
                disabled={isBusy}
                onClick={confirmReseedAll}
                className="px-4 py-2 rounded-lg bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40 hover:bg-neon-cyan/30 font-mono text-sm disabled:opacity-50"
              >
                {busy?.startsWith("all-replace") ? "Working…" : "Restore entire default catalog"}
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => void runSeed("root", "replace")}
                className="ml-3 px-4 py-2 rounded-lg bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 font-mono text-sm disabled:opacity-50"
              >
                {busy?.startsWith("root-replace") ? "Working…" : "Restore Bob only"}
              </button>
              {state?.lastRun ? (
                <p className="text-[10px] font-mono text-white/30 mt-3">
                  Last run: {state.lastRun}
                </p>
              ) : null}
            </section>

            <section>
              <h2 className="text-md font-semibold text-white mb-3 flex items-center gap-2">
                <Bot className="w-4 h-4 text-neon-purple" />
                Professional agents
              </h2>
              <div className="grid gap-3">
                {profiles.map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-2 border border-white/10 rounded-lg p-3 bg-dark-950/60"
                  >
                    <div>
                      <div className="font-mono text-white">{p.name}</div>
                      <div className="text-[10px] text-white/40">
                        {p.syncStatus === "drift"
                          ? "Drift — disk differs from database"
                          : p.syncStatus === "error"
                            ? `Sync error: ${p.syncError ?? "unknown"}`
                            : "Synced"}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => {
                        if (
                          window.confirm(`Restore agent "${p.name}" from defaults?`)
                        ) {
                          void runSeed("profiles", "replace", { slug: p.id });
                        }
                      }}
                      className="text-xs font-mono px-3 py-1.5 rounded border border-neon-purple/40 text-neon-purple hover:bg-neon-purple/10 disabled:opacity-50"
                    >
                      Restore this agent
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="text-md font-semibold text-white mb-3 flex items-center gap-2">
                <ListTodo className="w-4 h-4 text-neon-cyan" />
                Mission templates
              </h2>
              <div className="grid gap-2 max-h-64 overflow-y-auto">
                {templates.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-2 border border-white/10 rounded-lg px-3 py-2 text-sm"
                  >
                    <span className="font-mono text-white/80">{t.name}</span>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void runSeed("templates", "replace", { templateId: t.id })}
                      className="text-[10px] font-mono px-2 py-1 rounded border border-white/20 text-white/60 hover:text-neon-cyan disabled:opacity-50"
                    >
                      Restore
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="border border-white/10 rounded-lg p-4">
              <h2 className="text-sm font-semibold text-white/70 mb-2 flex items-center gap-2">
                <Database className="w-4 h-4" />
                Categories & advanced
              </h2>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => void runSeed("categories", "replace")}
                className="text-xs font-mono px-3 py-1.5 rounded border border-white/20 text-white/50 hover:text-white disabled:opacity-50 mr-2"
              >
                Restore categories
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => void runSeed("all", "merge")}
                className="text-xs font-mono px-3 py-1.5 rounded border border-white/20 text-white/50 hover:text-white disabled:opacity-50"
              >
                Merge missing defaults
              </button>
            </section>
          </>
        )}
      </div>
    </AppPageShell>
  );
}
