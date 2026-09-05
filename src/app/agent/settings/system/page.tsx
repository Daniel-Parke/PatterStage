// ═══════════════════════════════════════════════════════════════
// Settings > System — this install, updates, and (soon) backups
//
// Three cards (T-0097, decision 12, D109). "This install" is the boot line as
// a card, from GET /api/status/runtime, with a button that copies the same
// facts as one block for a bug report and never a secret. The deploy block
// that used to sit at the bottom of the rail lives here. Backups arrive with
// the Models and Restore work (B6); the card says so rather than hiding.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useCallback } from "react";
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

const onOff = (v: boolean) => (v ? "on" : "off");

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
  const deploy = useVersionFooter();
  const { showToast, toastElement } = useToast();

  const copy = useCallback(async () => {
    if (!runtime.data) return;
    try {
      await navigator.clipboard.writeText(formatRuntimeStatus(runtime.data));
      showToast("Copied. Paste it into the bug report.", "success");
    } catch {
      showToast("Could not reach the clipboard. Select the rows and copy them instead.", "error");
    }
  }, [runtime.data, showToast]);

  const s = runtime.data;

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
          <p className="text-xs text-ps-text-muted">
            Backups of the database are not here yet. They arrive with the Models and Restore work in this release;
            until then, the database is one file at the path above, and copying it while the server is stopped is a
            complete backup.
          </p>
        </Card>
      </div>
    </AppPageShell>
  );
}
