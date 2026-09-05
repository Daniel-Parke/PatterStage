// ═══════════════════════════════════════════════════════════════
// Settings > System — this install, updates, and (soon) backups
//
// Three cards (T-0097, decision 12, D109; the third filled in by T-0100).
// "This install" is the boot line as a card, from GET /api/status/runtime,
// with a button that copies the same facts as one block for a bug report and
// never a secret. The deploy block that used to sit at the bottom of the rail
// lives here. Backups lists what exists, takes one on demand, and shows the
// restore command rather than running it: restoring wants the server stopped,
// which is not something a web page should do behind your back.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useCallback, useState } from "react";
import { Copy, HardDrive, Settings, Archive, Download } from "lucide-react";

import AppPageShell from "@/components/layout/AppPageShell";
import PageHeader from "@/components/layout/PageHeader";
import LoadErrorBanner from "@/components/ui/LoadErrorBanner";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useToast } from "@/components/ui/Toast";
import { DeployControls } from "@/components/system/DeployControls";
import { useApiResource } from "@/hooks/useApiResource";
import { useVersionFooter } from "@/hooks/useVersionFooter";
import { formatRuntimeStatus, type RuntimeStatus } from "@/lib/status/runtime-status-format";
import { safeApiCall } from "@/lib/api-fetch";
import type { BackupList } from "@/lib/db/backup-types";

const onOff = (v: boolean) => (v ? "on" : "off");

/** KB under a megabyte, MB above it: the sizes an operator compares at a glance. */
function humanSize(bytes: number): string {
  const mb = bytes / 1024 / 1024;
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
}

function Card({ icon: Icon, title, children }: { icon: typeof Settings; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-white/10 bg-dark-900/50 p-5 space-y-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
        <Icon className="w-4 h-4 text-neon-orange" />
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-white/5 py-1.5 last:border-0">
      <dt className="text-xs font-mono text-ps-text-muted shrink-0">{label}</dt>
      <dd className="text-xs font-mono text-ps-text-primary text-right break-all">{value}</dd>
    </div>
  );
}

export default function SystemPage() {
  const runtime = useApiResource<RuntimeStatus>(["runtime-status"], "/api/status/runtime", {
    select: (p) => p as RuntimeStatus | undefined,
    errorMessage: "Could not read how this install is configured",
  });
  const backups = useApiResource<BackupList>(["database-backups"], "/api/backup", {
    select: (p) => p as BackupList | undefined,
    errorMessage: "Could not list the database backups",
  });
  const deploy = useVersionFooter();
  const { showToast, toastElement } = useToast();
  const [backingUp, setBackingUp] = useState(false);

  const copy = useCallback(async () => {
    if (!runtime.data) return;
    try {
      await navigator.clipboard.writeText(formatRuntimeStatus(runtime.data));
      showToast("Copied. Paste it into the bug report.", "success");
    } catch {
      showToast("Could not reach the clipboard. Select the rows and copy them instead.", "error");
    }
  }, [runtime.data, showToast]);

  const copyRestore = useCallback(async () => {
    const command = backups.data?.restoreCommand;
    if (!command) return;
    try {
      await navigator.clipboard.writeText(command);
      showToast("Copied. Run it with the server stopped.", "success");
    } catch {
      showToast("Could not reach the clipboard. Select the command and copy it instead.", "error");
    }
  }, [backups.data?.restoreCommand, showToast]);

  // Taking a backup is not destructive, so it is one click, not a ConfirmButton.
  const backUpNow = useCallback(async () => {
    setBackingUp(true);
    try {
      const res = await safeApiCall<{ data?: { backup?: { name?: string } } }>("/api/backup", { method: "POST" });
      if (!res.ok) {
        showToast(res.error ?? "Failed to take a database backup", "error");
        return;
      }
      showToast(`Backed up to ${res.data?.data?.backup?.name ?? "the backups folder"}.`, "success");
      await backups.refetch();
    } finally {
      setBackingUp(false);
    }
  }, [backups, showToast]);

  const s = runtime.data;
  const readOnly = runtime.data?.readOnly === true;

  return (
    <AppPageShell>
      {toastElement}
      <PageHeader icon={Settings} subtitle="How this install is configured, updates, and backups" color="orange" backHref="/agent/settings" backLabel="SETTINGS" />

      <div className="max-w-4xl mx-auto px-6 py-6 space-y-6 flex-1 w-full">
        <Card icon={HardDrive} title="This install">
          {runtime.error ? (
            <LoadErrorBanner error={runtime.error} onRetry={() => void runtime.refetch()} className="mb-0" />
          ) : !s ? (
            <LoadingSpinner text="Reading the runtime…" />
          ) : (
            <>
              <dl>
                <Row label="Auth mode" value={s.authMode} />
                <Row label="Deploy API" value={onOff(s.deployApiEnabled)} />
                <Row label="Read-only" value={onOff(s.readOnly)} />
                <Row label="Composer" value={onOff(s.composerEnabled)} />
                <Row label="Data directory" value={s.dataDir} />
                <Row label="Database" value={s.dbPath} />
                <Row label="Hermes home" value={s.hermesHome} />
                <Row label="Gateway" value={s.gatewayUrl} />
                <Row label="Port" value={s.port} />
                <Row label="Schema version" value={s.schemaVersion} />
                <Row label="Version" value={s.appVersion} />
                <Row label="Commit" value={s.gitHash} />
                <Row label="Node" value={s.node} />
                <Row label="Platform" value={s.platform} />
              </dl>
              <button
                type="button"
                onClick={() => void copy()}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs font-mono text-ps-text-secondary hover:bg-white/10 transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                Copy for a bug report
              </button>
            </>
          )}
        </Card>

        <Card icon={Download} title="Updates">
          <DeployControls state={deploy} />
        </Card>

        <Card icon={Archive} title="Backups">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void backUpNow()}
              disabled={backingUp || readOnly}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-neon-orange/10 border border-neon-orange/20 text-xs font-mono text-neon-orange hover:bg-neon-orange/20 transition-colors disabled:opacity-50"
            >
              <Archive className={`w-3.5 h-3.5 ${backingUp ? "animate-pulse" : ""}`} />
              {backingUp ? "Backing up…" : "Back up now"}
            </button>
            {readOnly && (
              <p className="text-xs font-mono text-semantic-warning">
                Read-only is on, so a backup cannot be taken from here.
              </p>
            )}
          </div>

          {/* The read contract: the failure before the empty state, never instead of it. */}
          {backups.error ? (
            <LoadErrorBanner error={backups.error} onRetry={() => void backups.refetch()} className="mb-0" />
          ) : !backups.data ? (
            <LoadingSpinner text="Reading the backups…" />
          ) : backups.data.backups.length === 0 ? (
            <p className="text-xs text-ps-text-muted">No backups yet.</p>
          ) : (
            <ul className="divide-y divide-white/5">
              {backups.data.backups.map((b) => (
                <li key={b.path} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-1.5">
                  <span className="font-mono text-xs text-ps-text-primary break-all">{b.name}</span>
                  <span className="font-mono text-xs text-ps-text-muted">
                    {humanSize(b.bytes)} · {new Date(b.takenAt).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="space-y-2">
            <p className="text-xs text-ps-text-muted">
              Restoring is a shell step: stop the server, copy the backup over the database, then start it again.
            </p>
            {backups.data?.restoreCommand && (
              <>
                <pre className="max-h-40 overflow-auto rounded-lg bg-ps-surface-well px-3 py-2 text-xs font-mono text-ps-text-muted whitespace-pre-wrap break-words">
                  {backups.data.restoreCommand}
                </pre>
                <button
                  type="button"
                  onClick={() => void copyRestore()}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs font-mono text-ps-text-secondary hover:bg-white/10 transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copy the restore command
                </button>
              </>
            )}
          </div>
        </Card>
      </div>
    </AppPageShell>
  );
}
