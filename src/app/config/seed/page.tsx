"use client";

import { useCallback, useEffect, useState } from "react";
import { RotateCcw, Database, Bot, ListTodo, Trash2 } from "lucide-react";

import AppPageShell from "@/components/layout/AppPageShell";
import PageHeader from "@/components/layout/PageHeader";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { apiFetch, setErrorFromCaught } from "@/lib/api-fetch";
import { useTwoStepConfirm } from "@/hooks/useTwoStepConfirm";
import type { AgentProfile } from "@/types/console";

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
      setErrorFromCaught(setError, e, "Failed to load");
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
      setErrorFromCaught(setError, e, "Seed failed");
    } finally {
      setBusy(null);
    }
  };

  // Two-step confirm hooks — replace the prior `window.confirm(...)` calls
  // (browser-native modal, no styling, no a11y customization) with the
  // in-page two-click pattern from `src/hooks/useTwoStepConfirm.ts`. The
  // user clicks once to arm, twice to confirm; the auto-dismiss timer
  // (4s) clears the armed state so a stray click hours later doesn't
  // re-trigger. See `overnight-refactor-patterns` pattern #13.
  //
  // Two instances because the two confirms have different shapes:
  //   - `reseedAll` (autoDismissMs: 0) — singleton button in the header
  //     section. Deliberate confirm, no auto-dismiss (the user needs
  //     time to read the "Confirm?" armed state).
  //   - `agentRestore` (autoDismissMs: 4000) — per-agent keys (p.id)
  //     so each "Restore this agent" button arms independently and a
  //     second click on a DIFFERENT agent re-arms for that one.
  const reseedAll = useTwoStepConfirm({ autoDismissMs: 0 });
  const agentRestore = useTwoStepConfirm({ autoDismissMs: 4000 });

  // ── Clean dev/test data ──
  // First click scans (GET) and shows exactly what would be removed; second
  // click confirms the delete. Conservative server-side pattern (see
  // clean-dev-data.ts) — only "Testy"/"Test …"/"Untitled Story" names.
  const cleanConfirm = useTwoStepConfirm({ autoDismissMs: 0 });
  const [cleanPreview, setCleanPreview] = useState<{
    workflows: { id: string; label: string }[];
    stories: { id: string; label: string }[];
    missions: { id: string; label: string }[];
  } | null>(null);
  const cleanTotal = cleanPreview
    ? cleanPreview.workflows.length + cleanPreview.stories.length + cleanPreview.missions.length
    : 0;

  const armClean = async () => {
    setError(null);
    try {
      const res = await apiFetch("/api/seed/clean");
      setCleanPreview(res.data?.preview ?? null);
      cleanConfirm.arm();
    } catch (e) {
      setErrorFromCaught(setError, e, "Failed to scan for test data");
    }
  };
  const runClean = async () => {
    setBusy("clean");
    setError(null);
    try {
      await apiFetch("/api/seed/clean", { method: "POST" });
      cleanConfirm.cancel();
      setCleanPreview(null);
      await load();
    } catch (e) {
      setErrorFromCaught(setError, e, "Clean failed");
    } finally {
      setBusy(null);
    }
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

            <p className="text-xs text-ps-text-muted font-mono border border-amber-500/20 rounded-lg p-3 bg-amber-500/5">
              <strong className="text-amber-200/80">Import before seed:</strong> if{" "}
              <code className="text-ps-text-muted">~/.hermes</code> exists, run{" "}
              <code className="text-ps-text-muted">npx tsx scripts/tooling/import-hermes-state.ts</code>{" "}
              (or use setup/ps-deploy) before merge seed. Merge never overwrites imported Bob or
              seeded profiles with existing content.
            </p>

            <p className="text-xs text-ps-text-muted font-mono border border-neon-purple/20 rounded-lg p-3 bg-neon-purple/5">
              <strong className="text-neon-purple">About Bob:</strong> Bob is your local default
              agent — the one missions and chat use when no profile is chosen. The shipped catalog
              below is the seed source; restoring it re-creates Bob and the professional pack if
              they are missing, but it never replaces a Bob you have already imported or customised.
            </p>

            <section className="border border-neon-cyan/30 rounded-xl p-6 bg-dark-900/80">
              <h2 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-neon-cyan" />
                Reseed all
              </h2>
              <p className="text-sm text-ps-text-secondary mb-4">
                Imports existing Hermes state first, then restores Bob, {profiles.length} professional
                agents, {templates.length} mission templates, and default categories.
              </p>
              <button
                type="button"
                disabled={isBusy}
                onClick={reseedAll.isArmed
                  ? () => void reseedAll.confirm(() => runSeed("all", "replace"))
                  : () => reseedAll.arm()
                }
                className={reseedAll.isArmed
                  ? "px-4 py-2 rounded-lg bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500/30 font-mono text-sm disabled:opacity-50"
                  : "px-4 py-2 rounded-lg bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40 hover:bg-neon-cyan/30 font-mono text-sm disabled:opacity-50"
                }
                aria-label={reseedAll.isArmed ? "Click again to confirm reseed" : "Restore entire default catalog"}
              >
                {busy?.startsWith("all-replace")
                  ? "Working…"
                  : reseedAll.isArmed
                    ? "Click again to confirm"
                    : "Restore entire default catalog"}
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => runSeed("root", "replace")}
                className="ml-3 px-4 py-2 rounded-lg bg-white/5 text-ps-text-secondary border border-white/10 hover:bg-white/10 font-mono text-sm disabled:opacity-50"
              >
                {busy?.startsWith("root-replace") ? "Working…" : "Restore Bob only"}
              </button>
              {state?.lastRun ? (
                <p className="text-xs font-mono text-ps-text-muted mt-3">
                  Last run: {state.lastRun}
                </p>
              ) : null}
            </section>

            <section className="border border-neon-orange/20 rounded-xl p-6 bg-neon-orange/5">
              <h2 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-neon-orange" />
                Clean dev / test data
              </h2>
              <p className="text-sm text-ps-text-secondary mb-4">
                Removes obvious throwaway artifacts — workflows, stories, and missions whose names
                start with <code className="text-ps-text-muted">Testy</code>, <code className="text-ps-text-muted">Test …</code>, or{" "}
                <code className="text-ps-text-muted">Untitled Story</code>. Agent profiles are never touched.
                {" "}First click scans; second click confirms.
              </p>

              {cleanConfirm.isArmed && cleanPreview ? (
                cleanTotal === 0 ? (
                  <p className="text-xs font-mono text-ps-text-muted mb-3">No test data found — nothing to remove.</p>
                ) : (
                  <div className="text-xs font-mono text-ps-text-muted mb-3 rounded-lg border border-white/10 bg-dark-900/50 p-3 space-y-1 max-h-48 overflow-auto">
                    {[
                      ["Workflows", cleanPreview.workflows],
                      ["Stories", cleanPreview.stories],
                      ["Missions", cleanPreview.missions],
                    ].map(([label, items]) =>
                      (items as { id: string; label: string }[]).length > 0 ? (
                        <div key={label as string}>
                          <span className="text-ps-text-muted uppercase tracking-wider">{label as string}:</span>{" "}
                          {(items as { id: string; label: string }[]).map((i) => i.label).join(", ")}
                        </div>
                      ) : null,
                    )}
                  </div>
                )
              ) : null}

              <button
                type="button"
                disabled={isBusy}
                onClick={
                  cleanConfirm.isArmed
                    ? (cleanTotal === 0 ? () => cleanConfirm.cancel() : () => void runClean())
                    : () => void armClean()
                }
                className={
                  cleanConfirm.isArmed && cleanTotal > 0
                    ? "px-4 py-2 rounded-lg bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500/30 font-mono text-sm disabled:opacity-50"
                    : "px-4 py-2 rounded-lg bg-neon-orange/15 text-neon-orange border border-neon-orange/30 hover:bg-neon-orange/25 font-mono text-sm disabled:opacity-50"
                }
              >
                {busy === "clean"
                  ? "Cleaning…"
                  : cleanConfirm.isArmed
                    ? cleanTotal === 0
                      ? "Dismiss"
                      : `Remove ${cleanTotal} item${cleanTotal === 1 ? "" : "s"}`
                    : "Scan for test data"}
              </button>
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
                      <div className="text-xs text-ps-text-muted">
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
                      onClick={agentRestore.isArmedFor(p.id)
                        ? () => void agentRestore.confirm(() =>
                            runSeed("profiles", "replace", { slug: p.id }),
                          )
                        : () => agentRestore.arm(p.id)
                      }
                      className={agentRestore.isArmedFor(p.id)
                        ? "text-xs font-mono px-3 py-1.5 rounded border border-red-500/40 text-red-300 bg-red-500/10 hover:bg-red-500/20 disabled:opacity-50"
                        : "text-xs font-mono px-3 py-1.5 rounded border border-neon-purple/40 text-neon-purple hover:bg-neon-purple/10 disabled:opacity-50"
                      }
                      aria-label={
                        agentRestore.isArmedFor(p.id)
                          ? `Click again to confirm restoring ${p.name}`
                          : `Restore agent ${p.name}`
                      }
                    >
                      {agentRestore.isArmedFor(p.id) ? "Click again to confirm" : "Restore this agent"}
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
                    <span className="font-mono text-ps-text-primary">{t.name}</span>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => runSeed("templates", "replace", { templateId: t.id })}
                      className="text-xs font-mono px-2 py-1 rounded border border-white/20 text-ps-text-secondary hover:text-neon-cyan disabled:opacity-50"
                    >
                      Restore
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="border border-white/10 rounded-lg p-4">
              <h2 className="text-sm font-semibold text-ps-text-secondary mb-2 flex items-center gap-2">
                <Database className="w-4 h-4" />
                Categories & advanced
              </h2>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => runSeed("categories", "replace")}
                className="text-xs font-mono px-3 py-1.5 rounded border border-white/20 text-ps-text-muted hover:text-white disabled:opacity-50 mr-2"
              >
                Restore categories
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => runSeed("all", "merge")}
                className="text-xs font-mono px-3 py-1.5 rounded border border-white/20 text-ps-text-muted hover:text-white disabled:opacity-50"
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
