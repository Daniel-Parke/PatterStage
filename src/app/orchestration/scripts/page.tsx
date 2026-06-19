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
import {
  Terminal, Play, ScrollText, CalendarClock, RefreshCw, Loader2, X,
  FileCode, Plus, Save, Trash2,
} from "lucide-react";
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

// Starter templates installable from the gallery (open in the editor first).
const SCRIPT_TEMPLATES: Array<{ id: string; name: string; label: string; description: string; content: string }> = [
  {
    id: "skeleton",
    name: "my-script.sh",
    label: "Blank skeleton",
    description: "A safe starting point with logging + strict mode.",
    content: `#!/usr/bin/env bash
# my-script.sh — describe what this does
set -euo pipefail

log() { echo "[$(date -Iseconds 2>/dev/null || date)] $*"; }

log "started"
# … your commands here …
log "done"
`,
  },
  {
    id: "http-ping",
    name: "http-ping.sh",
    label: "HTTP health ping",
    description: "Curl a URL and exit non-zero if it's not 200.",
    content: `#!/usr/bin/env bash
# http-ping.sh — fail (non-zero) unless URL returns 200
set -uo pipefail
URL="\${PING_URL:-https://example.com}"
code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$URL" 2>/dev/null || echo "000")
echo "[$(date -Iseconds 2>/dev/null || date)] $URL -> $code"
[ "$code" = "200" ]
`,
  },
  {
    id: "dir-backup",
    name: "dir-backup.sh",
    label: "Directory backup",
    description: "Tar a directory into a timestamped archive + rotate.",
    content: `#!/usr/bin/env bash
# dir-backup.sh — tar a directory, keep the newest \$KEEP archives
set -euo pipefail
SRC="\${BACKUP_SRC:-$HOME/important}"
DEST="\${BACKUP_DEST:-$HOME/backups}"
KEEP="\${BACKUP_KEEP:-7}"
mkdir -p "$DEST"
ts=$(date -u +%Y%m%dT%H%M%SZ)
tar -czf "$DEST/backup-$ts.tar.gz" -C "$(dirname "$SRC")" "$(basename "$SRC")"
echo "[$(date -Iseconds)] wrote $DEST/backup-$ts.tar.gz"
ls -1t "$DEST"/backup-*.tar.gz | tail -n +"$((KEEP + 1))" | xargs -r rm -f
`,
  },
];

export default function ScriptsPage() {
  const { scripts, isLoading, error, refetch, run } = useScripts();
  const { showToast, toastElement } = useToast();

  const [logTarget, setLogTarget] = useState<ScriptFile | null>(null);
  const [logText, setLogText] = useState<string>("");
  const [logLoading, setLogLoading] = useState(false);
  const [scheduleTarget, setScheduleTarget] = useState<ScriptFile | null>(null);

  // Editor: editing an existing file by name, or creating a new one.
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorName, setEditorName] = useState("");
  const [editorContent, setEditorContent] = useState("");
  const [editorIsNew, setEditorIsNew] = useState(false);
  const [editorLoading, setEditorLoading] = useState(false);
  const [editorSaving, setEditorSaving] = useState(false);

  const openNew = useCallback((name = "", content = "") => {
    setEditorIsNew(true);
    setEditorName(name);
    setEditorContent(content || "#!/usr/bin/env bash\nset -euo pipefail\n\n");
    setEditorOpen(true);
  }, []);

  const openEdit = useCallback(async (s: ScriptFile) => {
    setEditorIsNew(false);
    setEditorName(s.name);
    setEditorContent("");
    setEditorOpen(true);
    setEditorLoading(true);
    try {
      const res = await safeApiCall<{ data?: { content?: string } }>(`/api/scripts/${encodeURIComponent(s.name)}`);
      setEditorContent(res.ok ? res.data?.data?.content ?? "" : "");
      if (!res.ok) showToast("Failed to load script", "error");
    } finally {
      setEditorLoading(false);
    }
  }, [showToast]);

  const saveEditor = useCallback(async () => {
    let name = editorName.trim();
    if (editorIsNew && name && !name.endsWith(".sh")) name = `${name}.sh`;
    if (!name) {
      showToast("Give the script a name", "error");
      return;
    }
    setEditorSaving(true);
    try {
      const res = await safeApiCall(`/api/scripts/${encodeURIComponent(name)}`, {
        method: "PUT",
        body: { content: editorContent },
      });
      if (!res.ok) {
        showToast(res.error ?? "Failed to save script", "error");
        return;
      }
      showToast(`Saved ${name}`, "success");
      setEditorOpen(false);
      void refetch();
    } finally {
      setEditorSaving(false);
    }
  }, [editorName, editorIsNew, editorContent, refetch, showToast]);

  const deleteEditor = useCallback(async () => {
    if (editorIsNew || !editorName) return;
    if (!window.confirm(`Delete ${editorName}? This cannot be undone.`)) return;
    setEditorSaving(true);
    try {
      const res = await safeApiCall(`/api/scripts/${encodeURIComponent(editorName)}`, { method: "DELETE" });
      showToast(res.ok ? `Deleted ${editorName}` : "Failed to delete", res.ok ? "success" : "error");
      if (res.ok) {
        setEditorOpen(false);
        void refetch();
      }
    } finally {
      setEditorSaving(false);
    }
  }, [editorIsNew, editorName, refetch, showToast]);

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
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openNew()}
              className="flex items-center gap-1.5 rounded-lg border border-neon-cyan/30 px-3 py-1.5 font-mono text-xs text-neon-cyan transition-colors hover:bg-neon-cyan/10"
            >
              <Plus className="h-3 w-3" /> New script
            </button>
            <button
              type="button"
              onClick={() => refetch()}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 font-mono text-xs text-white/50 transition-colors hover:bg-white/5 hover:text-white/80"
            >
              <RefreshCw className="h-3 w-3" /> Refresh
            </button>
          </div>
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
              description="Create one with “New script”, install an example below, or drop a .sh file under CH_DATA_DIR/scripts."
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
                    onClick={() => void openEdit(s)}
                    className="flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1 font-mono text-[11px] text-white/60 hover:bg-white/5"
                  >
                    <FileCode className="h-3 w-3" /> Edit
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

        {/* ── Examples gallery (one-click open in the editor) ── */}
        <div className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-white/40">
            <FileCode className="h-3.5 w-3.5" /> Examples — open in the editor, tweak, then save
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SCRIPT_TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => openNew(t.name, t.content)}
                className="group rounded-xl border border-white/10 bg-dark-900/30 p-3 text-left transition-colors hover:border-neon-cyan/30 hover:bg-neon-cyan/[0.03]"
              >
                <div className="flex items-center gap-2">
                  <FileCode className="h-4 w-4 text-neon-cyan" />
                  <span className="font-mono text-sm text-white/85">{t.label}</span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-white/45">{t.description}</p>
                <span className="mt-2 inline-flex items-center gap-1 font-mono text-[10px] text-white/30 group-hover:text-neon-cyan">
                  <Plus className="h-3 w-3" /> {t.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Editor modal */}
      <Modal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editorIsNew ? "New script" : `Edit · ${editorName}`}
        icon={FileCode}
        iconColor="text-neon-cyan"
        size="xl"
        footer={
          <>
            {!editorIsNew && (
              <Button variant="ghost" size="sm" icon={Trash2} onClick={() => void deleteEditor()} disabled={editorSaving}>
                Delete
              </Button>
            )}
            <div className="flex-1" />
            <Button variant="ghost" size="sm" onClick={() => setEditorOpen(false)} disabled={editorSaving}>
              Cancel
            </Button>
            <Button variant="primary" color="cyan" size="sm" icon={Save} onClick={() => void saveEditor()} loading={editorSaving}>
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {editorIsNew && (
            <div>
              <label className="mb-1 block font-mono text-[11px] text-white/40">Filename</label>
              <input
                value={editorName}
                onChange={(e) => setEditorName(e.target.value)}
                placeholder="my-script.sh"
                spellCheck={false}
                className="w-full rounded-lg border border-white/10 bg-dark-800 px-3 py-2 font-mono text-sm text-white/85 outline-none focus:border-neon-cyan/50"
              />
            </div>
          )}
          {editorLoading ? (
            <div className="py-8"><LoadingSpinner text="Loading script…" /></div>
          ) : (
            <>
              <textarea
                value={editorContent}
                onChange={(e) => setEditorContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Tab") {
                    e.preventDefault();
                    const el = e.currentTarget;
                    const s = el.selectionStart;
                    const next = `${editorContent.slice(0, s)}  ${editorContent.slice(el.selectionEnd)}`;
                    setEditorContent(next);
                    requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = s + 2; });
                  }
                  if ((e.metaKey || e.ctrlKey) && e.key === "s") {
                    e.preventDefault();
                    void saveEditor();
                  }
                }}
                spellCheck={false}
                rows={20}
                className="block w-full resize-y rounded-lg border border-white/10 bg-dark-800 p-3 font-mono text-[13px] leading-relaxed text-white/80 outline-none focus:border-neon-cyan/50"
                style={{ tabSize: 2 }}
              />
              <div className="flex items-center justify-between font-mono text-[10px] text-white/30">
                <span>{editorContent.split("\n").length} lines · {new Blob([editorContent]).size} bytes</span>
                <span>Tab = 2 spaces · ⌘/Ctrl+S to save · runs server-side via /bin/bash</span>
              </div>
            </>
          )}
        </div>
      </Modal>

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
