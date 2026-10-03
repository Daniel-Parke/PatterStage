// ═══════════════════════════════════════════════════════════════
// Scripts — host scripts under PS_DATA_DIR/scripts
//
// File-aware manager: every script file an operator drops under the scripts dir
// appears here with its schedule, last run, and actions — Run now, view Logs,
// and Schedule/Unschedule. Running execs the script server-side
// (path-validated, no shell). A schedule goes to the host crontab where there
// is one and to PatterStage's own table where there is not, so unscheduling
// has to ask the row which of the two it is on (T-0107, decision 10).
//
// Thin page shell: the row, the editor modal and the schedule modal are
// presentational components under src/components/scripts/. The logs modal
// and the template gallery are this page's own (C6, T-0143): each had one
// importer, and a file with one importer is a seam with nothing behind it.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useCallback, useState } from "react";
import { Terminal, RefreshCw, Plus, FileCode, ScrollText } from "lucide-react";
import AppPageShell from "@/components/layout/AppPageShell";
import { SCRIPT_EXT_LIST, hasScriptExt, stripScriptExt } from "@/lib/scripts/script-ext";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { EmptyState } from "@/components/ui/EmptyState";
import LoadErrorBanner from "@/components/ui/LoadErrorBanner";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useScripts, fetchScriptLog, type ScriptFile } from "@/hooks/useScripts";
import { safeApiCall } from "@/lib/api/api-fetch";
import { runWrite } from "@/lib/api/api-write";
import { sectionHeadingClasses } from "@/lib/ui/theme";
import ScriptRow from "@/components/scripts/ScriptRow";
import ScriptEditorModal from "@/components/scripts/ScriptEditorModal";
import ScheduleScriptModal from "@/components/scripts/ScheduleScriptModal";
import { SCRIPT_TEMPLATES } from "@/components/scripts/script-templates";

// ── The logs modal ─────────────────────────────────────────────
// The tail of a script's run log. The fetch stays on the page; this renders
// the text it is handed.

function ScriptLogsModal({
  scriptName,
  text,
  loading,
  onClose,
}: {
  scriptName: string | null;
  text: string;
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <Modal open={scriptName !== null} onClose={onClose} title={scriptName ? `Logs · ${scriptName}` : "Logs"} icon={ScrollText} iconColor="text-neon-cyan" size="lg">
      {loading ? (
        <div className="py-8"><LoadingSpinner text="Loading log..." /></div>
      ) : (
        <pre className="max-h-[60vh] overflow-auto rounded-ps-md bg-ps-surface-inset p-4 font-mono text-micro text-ps-text-secondary whitespace-pre-wrap">
          {text || "(no log output yet — run the script first)"}
        </pre>
      )}
    </Modal>
  );
}

// ── The template gallery ───────────────────────────────────────
// Picking a card opens the template in the editor; nothing is written here.

function ScriptTemplateGallery({
  onOpenTemplate,
}: {
  onOpenTemplate: (name: string, content: string) => void;
}) {
  return (
    <div className="mt-8">
      <h2 className={`${sectionHeadingClasses} flex items-center gap-2`}>
        <FileCode className="h-3.5 w-3.5" /> Examples — open in the editor, tweak, then save
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SCRIPT_TEMPLATES.map((t) => (
          <Card key={t.id} padding="none" hover className="group">
            <button
              type="button"
              onClick={() => onOpenTemplate(t.name, t.content)}
              className="w-full p-3 text-left"
            >
              <div className="flex items-center gap-2">
                <FileCode className="h-4 w-4 text-neon-cyan" />
                <span className="font-mono text-body text-ps-text-primary">{t.label}</span>
              </div>
              <p className="mt-1.5 text-body leading-relaxed text-ps-text-muted">{t.description}</p>
              <span className="mt-2 inline-flex items-center gap-1 font-mono text-micro text-ps-text-muted group-hover:text-neon-cyan">
                <Plus className="h-3 w-3" /> {t.name}
              </span>
            </button>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function ScriptsPage() {
  const { scripts, scheduler, isLoading, error, refetch, run } = useScripts();
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
    // `.sh` stays the default for a bare name; what changed is that a name
    // that already ends in one of the seven no longer gets a second extension,
    // so `backup.mjs` stopped being saved as `backup.mjs.sh` (T-0107, D46).
    if (editorIsNew && name && !hasScriptExt(name)) name = `${name}.sh`;
    if (!name) {
      showToast("Give the script a name", "error");
      return;
    }
    await runWrite({
      showToast,
      setBusy: setEditorSaving,
      url: `/api/scripts/${encodeURIComponent(name)}`,
      method: "PUT",
      body: { content: editorContent },
      successMessage: `Saved ${name}`,
      errorMessage: "Failed to save script",
      onSuccess: () => {
        setEditorOpen(false);
        void refetch();
      },
    });
  }, [editorName, editorIsNew, editorContent, refetch, showToast]);

  // The editor's ConfirmButton has already asked; this is the second click.
  const deleteEditor = useCallback(async () => {
    if (editorIsNew || !editorName) return;
    await runWrite({
      showToast,
      setBusy: setEditorSaving,
      url: `/api/scripts/${encodeURIComponent(editorName)}`,
      method: "DELETE",
      successMessage: `Deleted ${editorName}`,
      errorMessage: "Failed to delete",
      onSuccess: () => {
        setEditorOpen(false);
        void refetch();
      },
    });
  }, [editorIsNew, editorName, refetch, showToast]);

  const handleRun = useCallback(
    (s: ScriptFile) => {
      run.mutate(s.name, {
        onSuccess: (res) => {
          // Three answers, not two. A script the host could not start has no
          // exit code and wrote nothing to its log, so the old sentence
          // ("exited non-zero, check Logs") sent the operator to an empty file
          // for a run that never happened. That case answers non-2xx now, and
          // the server's message is the reason.
          if (!res.ok) {
            showToast(res.error ?? `Could not run ${s.name}`, "error");
            return;
          }
          if (res.data?.data?.outcome === "succeeded") {
            showToast(`Ran ${s.name}`, "success");
            return;
          }
          const code = res.data?.data?.exitCode;
          showToast(
            typeof code === "number"
              ? `${s.name} failed with exit code ${code}. Check Logs.`
              : `${s.name} failed. Check Logs.`,
            "error",
          );
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
      // Whichever table holds it. The id was also stripped with a .sh-only
      // regex, so unscheduling a .mjs asked the crontab to delete a job called
      // "backup.mjs" and got nothing (T-0107, D48).
      const url =
        s.scheduleSource === "patterstage" && s.scheduleId
          ? `/api/schedules/${encodeURIComponent(s.scheduleId)}`
          : `/api/cron/hardware?id=${encodeURIComponent(stripScriptExt(s.name))}`;
      await runWrite({
        showToast,
        url,
        method: "DELETE",
        successMessage: `Unscheduled ${s.name}`,
        errorMessage: "Failed to unschedule",
        onSuccess: () => {
          void refetch();
        },
      });
    },
    [refetch, showToast],
  );

  return (
    <AppPageShell
      header={
        <PageHeader
          icon={Terminal}
          title="Scripts"
          subtitle={scripts.length > 0 ? `${scripts.length} host script${scripts.length === 1 ? "" : "s"} · run, schedule, and view logs` : "Host shell scripts on a timer"}
          color="cyan"
          actions={
            <div className="flex items-center gap-2">
              <Button variant="primary" color="cyan" size="sm" icon={Plus} onClick={() => openNew()}>
                New script
              </Button>
              <Button variant="secondary" size="sm" icon={RefreshCw} onClick={() => refetch()}>
                Refresh
              </Button>
            </div>
          }
        />
      }
    >
      <div>
        <p className="mb-5 max-w-3xl font-mono text-micro text-ps-text-muted">
          Drop a <span className="text-ps-text-secondary">{SCRIPT_EXT_LIST}</span> file under{" "}
          <span className="text-ps-text-secondary">PS_DATA_DIR/scripts</span> and it appears here — backups, cleanups, health
          checks. Everything already on a timer — scripts and missions both — is on the{" "}
          <a href="/work/automation" className="text-neon-cyan hover:underline">Automation</a> page.
        </p>

        {error && <LoadErrorBanner error={error} onRetry={() => refetch()} />}

        {isLoading ? (
          <LoadingSpinner text="Loading scripts..." />
        ) : scripts.length === 0 ? (
          <Card padding="none">
            <EmptyState
              icon={Terminal}
              title="No scripts yet"
              description={`Create one with “New script”, install an example below, or drop a ${SCRIPT_EXT_LIST} file under PS_DATA_DIR/scripts.`}
            />
          </Card>
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
        scheduled={Boolean(scripts.find((s) => s.name === editorName)?.schedule)}
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
          scheduler={scheduler}
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
