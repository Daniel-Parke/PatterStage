"use client";

// ═══════════════════════════════════════════════════════════════
// Settings > Restore — put back what PatterStage ships
// ═══════════════════════════════════════════════════════════════
//
// This page used to open with two paragraphs of operator vocabulary
// ("Import before seed", "merge seed", a tsx command line), count the DATABASE
// when describing what the pack contains, so a fresh install offered to
// restore "0 professional agents", and then run real destructive work in
// silence: no result, no toast, no way to tell a restore that installed seven
// agents from a click that did nothing (T-0100, D16 and D17).
//
// Three rules it now keeps. The numbers come from the pack on disk, so they
// describe what is in the box rather than what is already unpacked. Every
// overwrite is two clicks and says what it did, once under the section and
// once as a toast. And the mechanics live behind a disclosure, so a first-time
// reader meets plain sentences and an operator still gets the detail.

import { useCallback, useState } from "react";
import { RotateCcw, Bot, ListTodo, Database, Trash2 } from "lucide-react";

import AppPageShell from "@/components/layout/AppPageShell";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ConfirmButton from "@/components/ui/ConfirmButton";
import LoadErrorBanner from "@/components/ui/LoadErrorBanner";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useToast } from "@/components/ui/Toast";
import { Panel } from "@/components/dashboard/Panel";
import { API_FETCH_BULK_TIMEOUT_MS, apiFetch, messageFromError } from "@/lib/api-fetch";
import { runWrite } from "@/lib/api-write";
import { useApiResource } from "@/hooks/useApiResource";
import { describeRestoreResult } from "@/lib/seed/describe-restore-result";
import { SYNC_STATUS_LABELS } from "@/lib/status-labels";
import { pluralise } from "@/lib/utils";
import type { AgentProfile } from "@/types/console";

interface SeedState {
  lastRun?: string;
}

/** What the app ships, counted from disk by GET /api/seed. */
interface PackCounts {
  catalogVersion: string;
  root: number;
  profiles: number;
  templates: number;
  categories: number;
  skills: number;
  tools: number;
  memories: number;
}

interface CatalogTemplate {
  id: string;
  name: string;
  seedKey?: string | null;
  isCustom?: boolean;
}

interface RemovedItem {
  id: string;
  label: string;
}

interface CleanPreview {
  workflows: RemovedItem[];
  stories: RemovedItem[];
  missions: RemovedItem[];
}

/** Which section a result line belongs under. */
type SectionKey = "all" | "profiles" | "templates" | "categories" | "clean";

const EMPTY_PACK: PackCounts = {
  catalogVersion: "",
  root: 0,
  profiles: 0,
  templates: 0,
  categories: 0,
  skills: 0,
  tools: 0,
  memories: 0,
};

/** The sync word, from the one status vocabulary. */
function syncLabel(status: string | undefined): string {
  return SYNC_STATUS_LABELS[status as keyof typeof SYNC_STATUS_LABELS] ?? SYNC_STATUS_LABELS.synced;
}

function countedRemovals(counts: { workflows: number; stories: number; missions: number }): string {
  const parts: string[] = [];
  if (counts.workflows > 0) parts.push(`${counts.workflows} workflow${pluralise(counts.workflows)}`);
  if (counts.stories > 0) parts.push(`${counts.stories} stor${counts.stories === 1 ? "y" : "ies"}`);
  if (counts.missions > 0) parts.push(`${counts.missions} mission${pluralise(counts.missions)}`);
  return parts.join(", ");
}

/** What GET /api/seed says: when it last ran, and what the pack on disk holds. */
interface SeedRead {
  state: SeedState | null;
  pack: PackCounts;
}

export default function RestorePage() {
  const [busy, setBusy] = useState<string | null>(null);
  const isBusy = busy !== null;
  const [actionError, setActionError] = useState<{ section: SectionKey; message: string } | null>(null);
  const [result, setResult] = useState<{ section: SectionKey; text: string; at: Date } | null>(null);
  const [cleanPreview, setCleanPreview] = useState<CleanPreview | null>(null);
  const { showToast, toastElement } = useToast();

  // The three reads, together: the pack and its last run, the bundled
  // profiles, the seeded templates. The spinner is for the first read only;
  // a restore reloads all three and the page keeps what it has while they
  // land (C6, T-0143).
  const seed = useApiResource<SeedRead>("/api/seed", {
    select: (payload) => {
      const p = payload as { state?: SeedState | null; pack?: PackCounts } | undefined;
      if (!p) return undefined;
      return { state: p.state ?? null, pack: p.pack ?? EMPTY_PACK };
    },
    errorMessage: "The read failed",
  });
  const bundled = useApiResource<AgentProfile[]>("/api/agent/profiles", {
    select: (payload) =>
      ((payload as { profiles?: AgentProfile[] } | undefined)?.profiles ?? []).filter(
        (p) => p.isBundled && !p.isDefault,
      ),
    errorMessage: "The read failed",
  });
  const seeded = useApiResource<CatalogTemplate[]>("/api/templates", {
    select: (payload) =>
      ((payload as { templates?: CatalogTemplate[] } | undefined)?.templates ?? []).filter(
        (t) => !t.isCustom && t.seedKey,
      ),
    errorMessage: "The read failed",
  });
  const loading = !(seed.settled && bundled.settled && seeded.settled);
  // The banner, not an empty list: an install with nothing in it and an
  // install this page could not read look identical otherwise.
  const loadError = seed.error ?? bundled.error ?? seeded.error;
  const state = seed.data?.state ?? null;
  const pack = seed.data?.pack ?? EMPTY_PACK;
  const profiles = bundled.data ?? [];
  const templates = seeded.data ?? [];

  const { refetch: refetchSeed } = seed;
  const { refetch: refetchBundled } = bundled;
  const { refetch: refetchSeeded } = seeded;
  const load = useCallback(async () => {
    await Promise.all([refetchSeed(), refetchBundled(), refetchSeeded()]);
  }, [refetchSeed, refetchBundled, refetchSeeded]);

  const runSeed = useCallback(
    async (
      section: SectionKey,
      body: { target: string; mode: "merge" | "replace"; slug?: string; templateId?: string },
      name?: string,
    ) => {
      const key = `${body.target}-${body.mode}-${body.slug ?? body.templateId ?? "all"}`;
      setActionError(null);
      setResult(null);
      const summarise = (res: { data?: Record<string, unknown> } | undefined) =>
        describeRestoreResult(body.target, body.mode, res?.data ?? {}, name);
      await runWrite<{ data?: Record<string, unknown> } | undefined>({
        setBusy: (on) => setBusy(on ? key : null),
        showToast,
        url: "/api/seed",
        method: "POST",
        body,
        // Bulk: work scales with the install, not the request (T-0047).
        timeoutMs: API_FETCH_BULK_TIMEOUT_MS,
        successMessage: summarise,
        errorMessage: "Restore failed",
        onSuccess: async (res) => {
          setResult({ section, text: summarise(res), at: new Date() });
          await load();
        },
        onError: (e) => setActionError({ section, message: messageFromError(e, "Restore failed") }),
      });
    },
    [load, showToast],
  );

  const lookForTestData = useCallback(async () => {
    setActionError(null);
    try {
      const res = await apiFetch("/api/seed/clean");
      setCleanPreview((res.data?.preview as CleanPreview | null) ?? null);
    } catch (e) {
      setActionError({ section: "clean", message: messageFromError(e, "Restore failed") });
    }
  }, []);

  const runClean = useCallback(async () => {
    setActionError(null);
    setResult(null);
    const summarise = (
      res: { data?: { counts?: { workflows: number; stories: number; missions: number; total: number } } } | undefined,
    ) => {
      const counts = res?.data?.counts ?? { workflows: 0, stories: 0, missions: 0, total: 0 };
      return `Removed ${counts.total} item${pluralise(counts.total)} (${countedRemovals(counts)})`;
    };
    await runWrite<
      { data?: { counts?: { workflows: number; stories: number; missions: number; total: number } } } | undefined
    >({
      setBusy: (on) => setBusy(on ? "clean" : null),
      showToast,
      url: "/api/seed/clean",
      method: "POST",
      // Bulk: deletes across every seeded table (T-0047).
      timeoutMs: API_FETCH_BULK_TIMEOUT_MS,
      successMessage: summarise,
      errorMessage: "Restore failed",
      onSuccess: async (res) => {
        setResult({ section: "clean", text: summarise(res), at: new Date() });
        setCleanPreview(null);
        await load();
      },
      onError: (e) => setActionError({ section: "clean", message: messageFromError(e, "Restore failed") }),
    });
  }, [load, showToast]);

  /** The result line and the failure line, rendered under the section that ran. */
  const outcome = (section: SectionKey) => (
    <>
      {result?.section === section && (
        <p data-testid="restore-result" role="status" className="mt-3 text-micro font-mono text-neon-green/90">
          {`Done at ${result.at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}: ${result.text}`}
        </p>
      )}
      {actionError?.section === section && (
        <LoadErrorBanner className="mt-3 mb-0" error={`Restore failed: ${actionError.message}`} />
      )}
    </>
  );

  const cleanTotal = cleanPreview
    ? cleanPreview.workflows.length + cleanPreview.stories.length + cleanPreview.missions.length
    : 0;

  return (
    <AppPageShell
      header={
        <PageHeader
          icon={RotateCcw}
          subtitle="Put back what PatterStage ships, or clear out test clutter"
          color="cyan"
          backHref="/agent/settings"
          backLabel="SETTINGS"
        />
      }
    >
      <div className="space-y-8">
        {loading ? (
          <LoadingSpinner text="Reading the restore status…" />
        ) : (
          <>
            {loadError && (
              <LoadErrorBanner
                error="Couldn't read the restore status"
                hint={loadError}
                onRetry={() => void load()}
              />
            )}

            <p className="text-body text-ps-text-secondary">
              {`PatterStage ships a starter set: Bob (the default agent), ${pack.profiles} professional agents, ${pack.templates} mission templates, ${pack.categories} mission categories, ${pack.skills} skills, ${pack.tools} tool bundles and ${pack.memories} memory facts. Use this page to put any of it back. Anything you restore is backed up first.`}
            </p>

            {/* A <details> is not a container Card renders, so the card is
                around it: the disclosure is the card's whole content. */}
            <Card padding="sm" className="text-body text-ps-text-muted">
              <details>
                <summary className="cursor-pointer text-ps-text-secondary">How this works</summary>
                <div className="mt-2 space-y-2 font-mono">
                  <p>
                    A restore reads the shipped pack under{" "}
                    <code className="text-ps-text-secondary">data/seed</code> and writes it into the
                    database, overwriting the rows it covers. Before it does, PatterStage copies the
                    database so the previous state can be put back.
                  </p>
                  <p>
                    Restoring also reads your Hermes home folder first, so files you already have are
                    imported rather than overwritten. The command line equivalent is{" "}
                    <code className="text-ps-text-secondary">
                      npx tsx scripts/tooling/import-hermes-state.ts
                    </code>
                    , which the setup and deploy scripts run for you.
                  </p>
                  <p>
                    &quot;Add what&apos;s missing&quot; installs only the rows that are absent, so
                    anything you have edited is left alone. Restoring one agent or one template
                    replaces just that row.
                  </p>
                </div>
              </details>
            </Card>

            {/* The accented panel, as the Tools page's toolsets card is: the
                cyan rule says this is the one that puts everything back. */}
            <Panel accent="cyan" className="p-6">
              <section>
                <h2 className="text-title font-semibold text-ps-text-primary mb-2 flex items-center gap-2">
                  <RotateCcw className="w-5 h-5 text-neon-cyan" />
                  Restore everything
                </h2>
                <p className="text-body text-ps-text-secondary mb-2">
                  {`Puts back Bob, ${pack.profiles} professional agents, ${pack.templates} mission templates, ${pack.categories} categories, ${pack.skills} skills, ${pack.tools} tool bundles and ${pack.memories} memory facts, overwriting any changes you made to them.`}
                </p>
                <p className="text-micro font-mono text-ps-text-muted mb-4">
                  {`Installed now: ${profiles.length} of ${pack.profiles} agents · ${templates.length} of ${pack.templates} templates`}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <ConfirmButton
                    variant="primary"
                    color="cyan"
                    autoDismissMs={0}
                    confirmLabel="Restore everything?"
                    disabled={isBusy && busy !== "all-replace-all"}
                    loading={busy === "all-replace-all"}
                    onConfirm={() => void runSeed("all", { target: "all", mode: "replace" })}
                  >
                    Restore everything
                  </ConfirmButton>
                  <ConfirmButton
                    autoDismissMs={0}
                    confirmLabel="Restore Bob?"
                    disabled={isBusy && busy !== "root-replace-all"}
                    loading={busy === "root-replace-all"}
                    onConfirm={() => void runSeed("all", { target: "root", mode: "replace" })}
                  >
                    Restore Bob
                  </ConfirmButton>
                  <Button
                    disabled={isBusy}
                    loading={busy === "all-merge-all"}
                    onClick={() => void runSeed("all", { target: "all", mode: "merge" })}
                  >
                    Add what&apos;s missing
                  </Button>
                </div>
                {state?.lastRun && (
                  <p className="text-micro font-mono text-ps-text-muted mt-3">
                    {`Last restored: ${new Date(state.lastRun).toLocaleString()}`}
                  </p>
                )}
                {outcome("all")}
              </section>
            </Panel>

            <section>
              <h2 className="text-lead font-semibold text-ps-text-primary mb-3 flex items-center gap-2">
                <Bot className="w-4 h-4 text-neon-purple" />
                Professional agents
              </h2>
              {!loadError && profiles.length === 0 ? (
                <div className="rounded-ps-md border border-ps-edge-hairline p-4">
                  <p className="text-body text-ps-text-secondary">No professional agents installed</p>
                  <p className="text-body text-ps-text-muted mt-1">
                    {`Restore everything to install the ${pack.profiles} the pack ships.`}
                  </p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {profiles.map((p) => (
                    <Card
                      key={p.id}
                      padding="sm"
                      className="flex flex-wrap items-center justify-between gap-2"
                    >
                      <div>
                        <div className="font-mono text-ps-text-primary">{p.name}</div>
                        <div className="text-body text-ps-text-muted flex items-center gap-2">
                          <span>{syncLabel(p.syncStatus)}</span>
                          {p.syncStatus === "error" && p.syncError && (
                            <span className="text-ps-text-faint">{p.syncError}</span>
                          )}
                        </div>
                      </div>
                      <ConfirmButton
                        size="sm"
                        confirmLabel={`Restore ${p.name}?`}
                        disabled={isBusy && busy !== `profiles-replace-${p.id}`}
                        loading={busy === `profiles-replace-${p.id}`}
                        onConfirm={() =>
                          void runSeed(
                            "profiles",
                            { target: "profiles", mode: "replace", slug: p.id },
                            p.name,
                          )
                        }
                      >
                        Restore this agent
                      </ConfirmButton>
                    </Card>
                  ))}
                </div>
              )}
              {outcome("profiles")}
            </section>

            <section>
              <h2 className="text-lead font-semibold text-ps-text-primary mb-3 flex items-center gap-2">
                <ListTodo className="w-4 h-4 text-neon-cyan" />
                Mission templates
              </h2>
              {!loadError && templates.length === 0 ? (
                <div className="rounded-ps-md border border-ps-edge-hairline p-4">
                  <p className="text-body text-ps-text-secondary">No mission templates installed</p>
                  <p className="text-body text-ps-text-muted mt-1">
                    {`Restore everything to install the ${pack.templates} the pack ships.`}
                  </p>
                </div>
              ) : (
                <div className="grid gap-2 max-h-64 overflow-y-auto">
                  {templates.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between gap-2 border border-ps-edge-hairline rounded-ps-md px-3 py-2 text-body"
                    >
                      <span className="font-mono text-ps-text-primary">{t.name}</span>
                      <ConfirmButton
                        size="sm"
                        confirmLabel="Restore?"
                        disabled={isBusy && busy !== `templates-replace-${t.id}`}
                        loading={busy === `templates-replace-${t.id}`}
                        onConfirm={() =>
                          void runSeed(
                            "templates",
                            { target: "templates", mode: "replace", templateId: t.id },
                            t.name,
                          )
                        }
                      >
                        Restore
                      </ConfirmButton>
                    </div>
                  ))}
                </div>
              )}
              {outcome("templates")}
            </section>

            <section className="border border-ps-edge-hairline rounded-ps-md p-4">
              <h2 className="text-body font-semibold text-ps-text-secondary mb-2 flex items-center gap-2">
                <Database className="w-4 h-4" />
                Categories
              </h2>
              <p className="text-body text-ps-text-muted mb-3">
                {`The ${pack.categories} categories missions are filed under.`}
              </p>
              <ConfirmButton
                size="sm"
                confirmLabel="Restore categories?"
                disabled={isBusy && busy !== "categories-replace-all"}
                loading={busy === "categories-replace-all"}
                onConfirm={() => void runSeed("categories", { target: "categories", mode: "replace" })}
              >
                Restore categories
              </ConfirmButton>
              {outcome("categories")}
            </section>

            <Panel accent="orange" tint="orange" className="p-6">
              <section>
                <h2 className="text-title font-semibold text-ps-text-primary mb-2 flex items-center gap-2">
                  <Trash2 className="w-5 h-5 text-neon-orange" />
                  Clear test clutter
                </h2>
                <p className="text-body text-ps-text-secondary mb-4">
                  Removes throwaway workflows, stories and missions whose names look like tests.
                  Agents, templates and your own work are never touched. Look first, then remove.
                </p>

                {cleanPreview && cleanTotal > 0 && (
                  <Card variant="raised" padding="sm" className="text-micro font-mono text-ps-text-muted mb-3 space-y-1 max-h-48 overflow-auto">
                    {(
                      [
                        ["Workflows", cleanPreview.workflows],
                        ["Stories", cleanPreview.stories],
                        ["Missions", cleanPreview.missions],
                      ] as Array<[string, RemovedItem[]]>
                    ).map(([label, items]) =>
                      items.length > 0 ? (
                        <div key={label}>
                          <span className="text-ps-text-muted uppercase tracking-wider">{label}:</span>{" "}
                          {items.map((i) => i.label).join(", ")}
                        </div>
                      ) : null,
                    )}
                  </Card>
                )}
                {cleanPreview && cleanTotal === 0 && (
                  <p className="text-micro font-mono text-ps-text-muted mb-3">
                    Nothing here looks like test data.
                  </p>
                )}

                {cleanPreview && cleanTotal > 0 ? (
                  <ConfirmButton
                    variant="danger"
                    autoDismissMs={0}
                    confirmLabel={`Remove ${cleanTotal} item${pluralise(cleanTotal)}?`}
                    disabled={isBusy && busy !== "clean"}
                    loading={busy === "clean"}
                    onConfirm={() => void runClean()}
                  >
                    {`Remove ${cleanTotal} item${pluralise(cleanTotal)}`}
                  </ConfirmButton>
                ) : (
                  <Button disabled={isBusy} onClick={() => void lookForTestData()}>
                    Look for test data
                  </Button>
                )}
                {outcome("clean")}
              </section>
            </Panel>
          </>
        )}
      </div>
      {toastElement}
    </AppPageShell>
  );
}
