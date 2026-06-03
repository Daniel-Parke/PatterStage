// ═══════════════════════════════════════════════════════════════
// SystemCronModal — Create / Edit system cron jobs
//
// Works with /api/cron/hardware and /api/cron/hardware/meta (scriptsDir + logDir).
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useEffect } from "react";
import { Cpu, Loader2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import CronScheduleInput from "@/components/cron/CronScheduleInput";
import { baseInputStyles, inputFieldClasses } from "@/lib/theme";
import { safeApiCall, messageFromError } from "@/lib/api-fetch";
import { HARDWARE_CRON_UI_PRESETS } from "@/lib/hardware-cron";
import type { SystemCronJob } from "@/types/hermes";

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (job: Partial<SystemCronJob>) => Promise<void>;
  editingJob?: SystemCronJob | null;
}

function normalizePathSlashes(p: string): string {
  return p.replace(/\\/g, "/");
}

export default function SystemCronModal({ open, onClose, onSave, editingJob }: Props) {
  const isEdit = !!editingJob;

  const [name, setName] = useState("");
  const [schedule, setSchedule] = useState("*/5 * * * *");
  const [command, setCommand] = useState("");
  const [logFile, setLogFile] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [meta, setMeta] = useState<{ scriptsDir: string; logDir: string } | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMeta(null);
    setMetaError(null);
    setScheduleError(null);
    setError(null);
    setMetaLoading(true);
    let cancelled = false;
    void safeApiCall<{ scriptsDir: string; logDir: string }>("/api/cron/hardware/meta", {
      method: "GET",
    }).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setMetaError(result.error ?? `Failed to load system cron paths`);
        setMetaLoading(false);
        return;
      }
      if (result.data?.scriptsDir) {
        setMeta({
          scriptsDir: normalizePathSlashes(result.data.scriptsDir),
          logDir: normalizePathSlashes(result.data.logDir ?? ""),
        });
      } else {
        setMetaError("Failed to load system cron paths");
      }
      if (!cancelled) setMetaLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setScheduleError(null);

    // Edit + reset branches collapse into a single `source = editingJob ?? null`
    // form. When source is null, `source?.field` short-circuits to undefined and
    // the `?? default` fallback fires; when source is the editingJob, the
    // per-field `?? editingJob-default` reads the value verbatim. The two
    // branches above were byte-equivalent to this single block — the edit
    // branch's `editingJob.name` matches `source?.name` for both null source
    // (reset) and non-null source (edit), and the schedule default `*/5 * * * *`
    // preserves the original create-mode value.
    const source = editingJob ?? null;
    setName(source?.name ?? "");
    setSchedule(source?.schedule ?? "*/5 * * * *");
    setCommand(
      source?.command != null ? normalizePathSlashes(source.command) : "",
    );
    setLogFile(source?.logFile ?? "");
    setEnabled(source?.enabled ?? true);
  }, [open, editingJob]);

  useEffect(() => {
    if (!open || editingJob || !meta) return;
    const first = `${meta.scriptsDir}/${HARDWARE_CRON_UI_PRESETS[0].file}`;
    setCommand(first);
  }, [open, editingJob, meta]);

  const presetPaths =
    meta?.scriptsDir != null
      ? HARDWARE_CRON_UI_PRESETS.map((p) => ({
          label: p.label,
          value: `${meta.scriptsDir}/${p.file}`,
        }))
      : [];

  const commandInPresets = presetPaths.some((p) => p.value === command);

  const handleSave = async () => {
    setError(null);

    const fields = schedule.trim().split(/\s+/);
    if (fields.length !== 5) {
      setScheduleError("Schedule must have exactly 5 fields: min hour dom mon dow");
      return;
    }

    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    if (!command.trim()) {
      setError("Command (script) is required");
      return;
    }

    if (!meta) {
      setError("Paths not loaded yet");
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        ...(editingJob ? { id: editingJob.id } : {}),
        name: name.trim(),
        schedule: schedule.trim(),
        command: command.trim(),
        logFile: logFile.trim() || undefined,
        enabled,
      });
      onClose();
    } catch (e: unknown) {
      setError(messageFromError(e, "Failed to save system cron job"));
    } finally {
      setIsSaving(false);
    }
  };

  const footer = (
    <>
      <Button variant="ghost" size="sm" onClick={onClose} disabled={isSaving}>
        Cancel
      </Button>
      <Button
        variant="primary"
        size="sm"
        color="orange"
        onClick={() => void handleSave()}
        loading={isSaving}
        disabled={!!metaError || metaLoading || !meta}
      >
        {isEdit ? "Update Job" : "Create Job"}
      </Button>
    </>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit System Cron Job" : "New System Cron Job"}
      icon={Cpu}
      iconColor="text-neon-orange"
      size="md"
      footer={footer}
    >
      <div className="space-y-5">
        {metaLoading && (
          <div className="flex items-center gap-2 text-sm text-white/50">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading script paths…
          </div>
        )}
        {metaError && (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {metaError}
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-white/70">Job Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Nightly Backup"
            className={baseInputStyles}
          />
        </div>

        <CronScheduleInput
          value={schedule}
          onChange={(val) => {
            setSchedule(val);
            setScheduleError(null);
          }}
          error={scheduleError}
        />

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-white/70">Backup script</label>
          {presetPaths.length <= 1 ? (
            <>
              <input
                type="text"
                readOnly
                value={command || presetPaths[0]?.value || ""}
                className={`${inputFieldClasses("cyan")} opacity-80`}
              />
              <p className="text-xs text-white/30">
                Nightly Hermes backup via{" "}
                <span className="font-mono text-white/50">ch-backup.sh</span>
                {" "}(logs:{" "}
                <span className="font-mono text-white/50">{meta?.logDir ?? "…"}</span>
                ).
              </p>
            </>
          ) : (
            <>
              <select
                value={command || presetPaths[0]?.value || ""}
                onChange={(e) => setCommand(e.target.value)}
                disabled={!meta || presetPaths.length === 0}
                className={`${inputFieldClasses("cyan")} cursor-pointer disabled:opacity-50`}
              >
                {!commandInPresets && command ? (
                  <option value={command}>{command} (current)</option>
                ) : null}
                {presetPaths.map((script) => (
                  <option key={script.value} value={script.value}>
                    {script.label} — {script.value}
                  </option>
                ))}
              </select>
              <p className="text-xs text-white/30">
                Scripts under{" "}
                <span className="font-mono text-white/50">{meta?.scriptsDir ?? "…"}</span>
                ; logs:{" "}
                <span className="font-mono text-white/50">{meta?.logDir ?? "…"}</span>
              </p>
            </>
          )}
        </div>

        {isEdit && (
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-white/70">
              Log File
              <span className="ml-1.5 text-xs text-white/30 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={logFile}
              onChange={(e) => setLogFile(e.target.value)}
              placeholder={
                meta?.logDir ? `e.g. ${meta.logDir}/custom.log` : "e.g. path/to/custom.log"
              }
              className={baseInputStyles}
            />
          </div>
        )}

        {isEdit && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setEnabled((v) => !v)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                enabled ? "bg-neon-orange" : "bg-white/10"
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                  enabled ? "translate-x-4" : "translate-x-0.5"
                }`}
              />
            </button>
            <span className="text-sm text-white/60">
              {enabled ? "Job is active" : "Job is paused"}
            </span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
}
