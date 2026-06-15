// ═══════════════════════════════════════════════════════════════
// Scripts — host shell scripts under CH_DATA_DIR/scripts
//
// File-aware manager: every *.sh file an operator drops under the scripts dir
// appears here with its schedule (host crontab), last run, and actions —
// Run now, view Logs, and Schedule/Unschedule. Running execs the script
// server-side (path-validated, no shell); scheduling writes a host crontab entry
// via /api/cron/hardware.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useCallback, useEffect, useState } from "react";
import { Terminal, Play, ScrollText, CalendarClock, RefreshCw, Loader2, X } from "lucide-react";
import AppPageShell from "@/components/layout/AppPageShell";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { LoadingSpinner, EmptyState } from "@/components/ui/LoadingSpinner";
import LoadErrorBanner from "@/components/ui/LoadErrorBanner";
import SchedulePicker from "@/components/schedule/SchedulePicker";
import { useToast } from "@/components/ui/Toast";
import { useScripts, fetchScriptLog, type ScriptFile } from "@/hooks/useScripts";
import { safeApiCall } from "@/lib/api-fetch";
import { timeAgo } from "@/lib/utils";

function fmtSize(n: number): string {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)}MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)}KB`;
  return `${n}B`;
}

export default function ScriptsPage() {
  const { scripts, isLoading, error, refetch, run } = useScripts();
  const { showToast, toastElement } = useToast();

  const [logTarget, setLogTarget] = useState<ScriptFile | null>(null);
  const [logText, setLogText] = useState<string>("");
  const [logLoading, setLogLoading] = useState(false);
  const [scheduleTarget, setScheduleTarget] = useState<ScriptFile | null>(null);

  const handleRun = useCallback(
    (s: ScriptFile) => {
      run.mutate(s.name, {
        onSuccess: (res) => {
          const ok = res.ok && res.data?.data?.ok !== false;
          showToast(ok ? `Ran ${s.name}` : `${s.name} exited non-zero — check Logs`, ok ? "success" : "error");
        },
        onError: () => showToast(`Failed to run ${s.name}`, "error"),
      });
    },
    [run, showToast],
  );

  const openLogs = useCallback(async (s: ScriptFile) => {
    setLogTarget(s);
    setLogText("");
    setLogLoading(true);
    try {
      setLogText(await fetchScriptLog(s.name, 400));
    } catch {
      setLogText("(failed to load log)");
    } finally {
      setLogLoading(false);
    }
  }, []);

  const unschedule = useCallback(
    async (s: ScriptFile) => {
      const id = s.name.replace(/\.sh$/, "");
      const res = await safeApiCall(`/api/cron/hardware?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      showToast(res.ok ? `Unscheduled ${s.name}` : "Failed to unschedule", res.ok ? "success" : "error");
      if (res.ok) void refetch();
    },
    [refetch, showToast],
  );

  return (
    <AppPageShell>
      <PageHeader
        icon={Terminal}
        title="Scripts"
        subtitle={scripts.length > 0 ? `${scripts.length} host script${scripts.length === 1 ? "" : "s"} · run, schedule, and view logs` : "Host shell scripts on a timer"}
        color="cyan"
        actions={
          <button
            type="button"
            onClick={() => refetch()}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 font-mono text-xs text-white/50 transition-colors hover:bg-white/5 hover:text-white/80"
          >
            <RefreshCw className="h-3 w-3" /> Refresh
          </button>
        }
      />

      <div className="px-6 py-6">
        <p className="mb-5 max-w-3xl font-mono text-xs text-white/40">
          Drop a <span className="text-white/60">.sh</span> file under{" "}
          <span className="text-white/60">CH_DATA_DIR/scripts</span> and it appears here — backups, cleanups, health
          checks. Scheduling agent work is on the{" "}
          <a href="/orchestration/missions" className="text-neon-cyan hover:underline">Missions</a> page.
        </p>

        {error && <LoadErrorBanner error={error} onRetry={() => refetch()} />}

        {isLoading ? (
          <LoadingSpinner text="Loading scripts..." />
        ) : scripts.length === 0 ? (
          <div className="rounded-xl border border-cyan-500/20 bg-dark-900/50">
            <EmptyState
              icon={Terminal}
              title="No scripts yet"
              description="Add a .sh file under CH_DATA_DIR/scripts (setup ships ch-backup.sh)."
            />
          </div>
        ) : (
          <div className="space-y-2">
            {scripts.map((s) => {
              const busy = run.isPending && run.variables === s.name;
              return (
                <div key={s.name} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-dark-900/30 px-4 py-3">
                  <Terminal className="h-4 w-4 shrink-0 text-neon-cyan" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono text-sm text-white/85">{s.name}</div>
                    <div className="truncate font-mono text-[11px] text-white/35">
                      {fmtSize(s.size)}
                      {" · "}
                      {s.schedule ? <span className="text-neon-orange/80">{s.schedule}</span> : "not scheduled"}
                      {s.lastRun ? ` · last run ${timeAgo(s.lastRun)}` : ""}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRun(s)}
                    disabled={busy}
                    className="flex items-center gap-1 rounded-lg border border-neon-green/30 px-2.5 py-1 font-mono text-[11px] text-neon-green hover:bg-neon-green/10 disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />} Run
                  </button>
                  <button
                    type="button"
                    onClick={() => void openLogs(s)}
                    className="flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1 font-mono text-[11px] text-white/60 hover:bg-white/5"
                  >
                    <ScrollText className="h-3 w-3" /> Logs
                  </button>
                  {s.schedule ? (
                    <button
                      type="button"
                      onClick={() => void unschedule(s)}
                      className="flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1 font-mono text-[11px] text-white/50 hover:bg-white/5"
                    >
                      <X className="h-3 w-3" /> Unschedule
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setScheduleTarget(s)}
                      className="flex items-center gap-1 rounded-lg border border-neon-orange/30 px-2.5 py-1 font-mono text-[11px] text-neon-orange hover:bg-neon-orange/10"
                    >
                      <CalendarClock className="h-3 w-3" /> Schedule
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Logs modal */}
      <Modal open={logTarget !== null} onClose={() => setLogTarget(null)} title={logTarget ? `Logs · ${logTarget.name}` : "Logs"} icon={ScrollText} iconColor="text-neon-cyan" size="lg">
        {logLoading ? (
          <div className="py-8"><LoadingSpinner text="Loading log..." /></div>
        ) : (
          <pre className="max-h-[60vh] overflow-auto rounded-lg bg-dark-800 p-4 font-mono text-xs text-white/70 whitespace-pre-wrap">
            {logText || "(no log output yet — run the script first)"}
          </pre>
        )}
      </Modal>

      {/* Schedule modal */}
      {scheduleTarget && (
        <ScheduleScriptModal
          script={scheduleTarget}
          onClose={() => setScheduleTarget(null)}
          onSaved={() => {
            setScheduleTarget(null);
            void refetch();
            showToast(`Scheduled ${scheduleTarget.name}`, "success");
          }}
          onError={(m) => showToast(m, "error")}
        />
      )}

      {toastElement}
    </AppPageShell>
  );
}

function ScheduleScriptModal({
  script,
  onClose,
  onSaved,
  onError,
}: {
  script: ScriptFile;
  onClose: () => void;
  onSaved: () => void;
  onError: (msg: string) => void;
}) {
  const [schedule, setSchedule] = useState("0 3 * * *");
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSchedule("0 3 * * *");
    setScheduleError(null);
  }, [script.name]);

  const save = async () => {
    const fields = schedule.trim().split(/\s+/);
    if (fields.length !== 5) {
      setScheduleError("Schedule must have exactly 5 fields: min hour dom mon dow");
      return;
    }
    setSaving(true);
    try {
      const res = await safeApiCall("/api/cron/hardware", {
        method: "POST",
        body: {
          name: script.name.replace(/\.sh$/, "").replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          schedule: schedule.trim(),
          command: script.path,
        },
      });
      if (!res.ok) {
        onError(res.error ?? "Failed to schedule");
        return;
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Schedule · ${script.name}`}
      icon={CalendarClock}
      iconColor="text-neon-orange"
      size="md"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" color="orange" size="sm" onClick={() => void save()} loading={saving}>
            Schedule
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="font-mono text-xs text-white/40">
          Runs <span className="text-white/60">{script.name}</span> on the host crontab.
        </p>
        <SchedulePicker value={schedule} onChange={(v) => { setSchedule(v); setScheduleError(null); }} error={scheduleError} />
      </div>
    </Modal>
  );
}
