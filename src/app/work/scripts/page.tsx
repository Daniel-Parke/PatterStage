// ═══════════════════════════════════════════════════════════════
// Scripts — host shell scripts under PS_DATA_DIR/scripts
//
// File-aware manager: every *.sh file an operator drops under the scripts dir
// appears here with its schedule (host crontab), last run, and actions —
// Run now, view Logs, and Schedule/Unschedule. Running execs the script
// server-side (path-validated, no shell); scheduling writes a host crontab entry
// via /api/cron/hardware.
//
// Thin page shell: the row, the template gallery and the three modals are
// presentational components under src/components/scripts/.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useCallback, useState } from "react";
import { Terminal, RefreshCw, Plus } from "lucide-react";
import AppPageShell from "@/components/layout/AppPageShell";
import PageHeader from "@/components/layout/PageHeader";
import { LoadingSpinner, EmptyState } from "@/components/ui/LoadingSpinner";
import LoadErrorBanner from "@/components/ui/LoadErrorBanner";
import { useToast } from "@/components/ui/Toast";
import { useScripts, fetchScriptLog, type ScriptFile } from "@/hooks/useScripts";
import { safeApiCall } from "@/lib/api-fetch";
import ScriptRow from "@/components/scripts/ScriptRow";
import ScriptTemplateGallery from "@/components/scripts/ScriptTemplateGallery";
import ScriptEditorModal from "@/components/scripts/ScriptEditorModal";
import ScriptLogsModal from "@/components/scripts/ScriptLogsModal";
import ScheduleScriptModal from "@/components/scripts/ScheduleScriptModal";

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

  // The editor's ConfirmButton has already asked; this is the second click.
  const deleteEditor = useCallback(async () => {
    if (editorIsNew || !editorName) return;
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
              className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 font-mono text-xs text-ps-text-muted transition-colors hover:bg-white/5 hover:text-ps-text-primary"
            >
              <RefreshCw className="h-3 w-3" /> Refresh
            </button>
          </div>
        }
      />

      <div className="px-6 py-6">
        <p className="mb-5 max-w-3xl font-mono text-xs text-ps-text-muted">
          Drop a <span className="text-ps-text-secondary">.sh</span> file under{" "}
          <span className="text-ps-text-secondary">PS_DATA_DIR/scripts</span> and it appears here — backups, cleanups, health
          checks. Scheduling agent work is on the{" "}
          <a href="/work/missions" className="text-neon-cyan hover:underline">Missions</a> page.
        </p>

        {error && <LoadErrorBanner error={error} onRetry={() => refetch()} />}

        {isLoading ? (
          <LoadingSpinner text="Loading scripts..." />
        ) : scripts.length === 0 ? (
          <div className="rounded-xl border border-cyan-500/20 bg-dark-900/50">
            <EmptyState
              icon={Terminal}
              title="No scripts yet"
              description="Create one with “New script”, install an example below, or drop a .sh file under PS_DATA_DIR/scripts."
            />
          </div>
        ) : (
          <div className="space-y-2">
            {scripts.map((s) => (
              <ScriptRow
                key={s.name}
                script={s}
                busy={run.isPending && run.variables === s.name}
                onRun={handleRun}
                onEdit={(script) => void openEdit(script)}
                onLogs={(script) => void openLogs(script)}
                onSchedule={setScheduleTarget}
                onUnschedule={(script) => void unschedule(script)}
              />
            ))}
          </div>
        )}

        {/* ── Examples gallery (one-click open in the editor) ── */}
        <ScriptTemplateGallery onOpenTemplate={openNew} />
      </div>

      {/* Editor modal */}
      <ScriptEditorModal
        open={editorOpen}
        isNew={editorIsNew}
        name={editorName}
        onNameChange={setEditorName}
        content={editorContent}
        onContentChange={setEditorContent}
        loading={editorLoading}
        saving={editorSaving}
        onClose={() => setEditorOpen(false)}
        onSave={() => void saveEditor()}
        onDelete={() => void deleteEditor()}
      />

      {/* Logs modal */}
      <ScriptLogsModal
        scriptName={logTarget ? logTarget.name : null}
        text={logText}
        loading={logLoading}
        onClose={() => setLogTarget(null)}
      />

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
