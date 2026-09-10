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
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import LoadErrorBanner from "@/components/ui/LoadErrorBanner";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useToast } from "@/components/ui/Toast";
import { DeployControls } from "@/components/system/DeployControls";
import { useApiResource } from "@/hooks/useApiResource";
import { useVersionFooter } from "@/hooks/useVersionFooter";
import { formatRuntimeStatus, type RuntimeStatus } from "@/lib/status/runtime-status-format";
import { runWrite } from "@/lib/api/api-write";
import type { BackupList } from "@/lib/db/backup-types";

const onOff = (v: boolean) => (v ? "on" : "off");

/** KB under a megabyte, MB above it: the sizes an operator compares at a glance. */
function humanSize(bytes: number): string {
  const mb = bytes / 1024 / 1024;
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
}

/** One of the page's three cards: a section, headed by its icon and title. */
function SystemCard({ icon: Icon, title, children }: { icon: typeof Settings; title: string; children: React.ReactNode }) {
  return (
    <Card as="section" padding="lg" className="space-y-4">
      <h2 className="flex items-center gap-2 text-body font-semibold text-ps-text-primary">
        <Icon className="w-4 h-4 text-neon-orange" />
        {title}
      </h2>
      {children}
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-ps-edge-hairline py-1.5 last:border-0">
      <dt className="text-micro font-mono text-ps-text-muted shrink-0">{label}</dt>
      <dd className="text-micro font-mono text-ps-text-primary text-right break-all">{value}</dd>
    </div>
  );
}

export default function SystemPage() {
  const runtime = useApiResource<RuntimeStatus>("/api/status/runtime", {
    select: (p) => p as RuntimeStatus | undefined,
    errorMessage: "Could not read how this install is configured",
  });
  const backups = useApiResource<BackupList>("/api/backup", {
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
  const { refetch: refetchBackups } = backups;
  const backUpNow = useCallback(async () => {
    await runWrite<{ data?: { backup?: { name?: string } } } | undefined>({
      setBusy: setBackingUp,
      showToast,
      url: "/api/backup",
      method: "POST",
      successMessage: (res) => `Backed up to ${res?.data?.backup?.name ?? "the backups folder"}.`,
      errorMessage: "Failed to take a database backup",
      onSuccess: async () => {
        await refetchBackups();
      },
    });
  }, [refetchBackups, showToast]);

  const s = runtime.data;
  const readOnly = runtime.data?.readOnly === true;

  return (
    <AppPageShell
      header={
        <PageHeader icon={Settings} subtitle="How this install is configured, updates, and backups" color="orange" backHref="/agent/settings" backLabel="SETTINGS" />
      }
    >
      {toastElement}
      <div className="space-y-6">
        <SystemCard icon={HardDrive} title="This install">
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
              <Button variant="secondary" size="sm" icon={Copy} onClick={() => void copy()}>
                Copy for a bug report
              </Button>
            </>
          )}
        </SystemCard>

        <SystemCard icon={Download} title="Updates">
          <DeployControls state={deploy} />
        </SystemCard>

        <SystemCard icon={Archive} title="Backups">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="secondary"
              color="orange"
              size="sm"
              icon={Archive}
              loading={backingUp}
              onClick={() => void backUpNow()}
              disabled={readOnly}
            >
              {backingUp ? "Backing up…" : "Back up now"}
            </Button>
            {readOnly && (
              <p className="text-micro font-mono text-semantic-warning">
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
            <p className="text-body text-ps-text-muted">No backups yet.</p>
          ) : (
            <ul className="divide-y divide-ps-edge-hairline">
              {backups.data.backups.map((b) => (
                <li key={b.path} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-1.5">
                  <span className="font-mono text-micro text-ps-text-primary break-all">{b.name}</span>
                  <span className="font-mono text-micro text-ps-text-muted">
                    {humanSize(b.bytes)} · {new Date(b.takenAt).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="space-y-2">
            <p className="text-body text-ps-text-muted">
              Restoring is a shell step: stop the server, copy the backup over the database, then start it again.
            </p>
            {backups.data?.restoreCommand && (
              <>
                <pre className="max-h-40 overflow-auto rounded-ps-md bg-ps-surface-inset px-3 py-2 text-micro font-mono text-ps-text-muted whitespace-pre-wrap break-words">
                  {backups.data.restoreCommand}
                </pre>
                <Button variant="secondary" size="sm" icon={Copy} onClick={() => void copyRestore()}>
                  Copy the restore command
                </Button>
              </>
            )}
          </div>
        </SystemCard>
      </div>
    </AppPageShell>
  );
}
