// ═══════════════════════════════════════════════════════════════
// HardwareCronModal — Create / Edit hardware cron jobs
//
// Works with /api/cron/hardware and /api/cron/hardware/meta (scriptsDir + logDir).
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useEffect } from "react";
import { Cpu, Loader2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import CronScheduleInput from "@/components/cron/CronScheduleInput";
import { baseInputStyles } from "@/lib/theme";
import { HARDWARE_CRON_UI_PRESETS } from "@/lib/hardware-cron";
import type { HardwareCronJob } from "@/types/hermes";

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (job: Partial<HardwareCronJob>) => Promise<void>;
  editingJob?: HardwareCronJob | null;
}

interface MetaResponse {
  data?: { scriptsDir: string; logDir: string };
  error?: string;
}

function normalizePathSlashes(p: string): string {
  return p.replace(/\\/g, "/");
}

export default function HardwareCronModal({ open, onClose, onSave, editingJob }: Props) {
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
    setMetaLoading(true);
    let cancelled = false;
    void fetch("/api/cron/hardware/meta")
      .then(async (r) => {
        const j = (await r.json()) as MetaResponse;
        if (cancelled) return;
        if (!r.ok) {
          setMetaError(typeof j.error === "string" ? j.error : `HTTP ${r.status}`);
          return;
        }
        if (j.data?.scriptsDir) {
          setMeta({
            scriptsDir: normalizePathSlashes(j.data.scriptsDir),
            logDir: normalizePathSlashes(j.data.logDir ?? ""),
          });
        } else {
          setMetaError(typeof j.error === "string" ? j.error : "Failed to load hardware cron paths");
        }
      })
      .catch(() => {
        if (!cancelled) setMetaError("Failed to load hardware cron paths");
      })
      .finally(() => {
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

    if (editingJob) {
      setName(editingJob.name);
      setSchedule(editingJob.schedule);
      setCommand(normalizePathSlashes(editingJob.command));
      setLogFile(editingJob.logFile ?? "");
      setEnabled(editingJob.enabled);
    } else {
      setName("");
      setSchedule("*/5 * * * *");
      setCommand("");
      setLogFile("");
      setEnabled(true);
    }
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
      setError(e instanceof Error ? e.message : "Failed to save hardware cron job");
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
      title={isEdit ? "Edit Hardware Cron Job" : "New Hardware Cron Job"}
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
          <label className="text-sm font-medium text-white/70">Script Command</label>
          <select
            value={command || presetPaths[0]?.value || ""}
            onChange={(e) => setCommand(e.target.value)}
            disabled={!meta || presetPaths.length === 0}
            className={`${baseInputStyles} cursor-pointer disabled:opacity-50`}
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
            Scripts live under Control Hub&apos;s hardware scripts directory (
            <span className="font-mono text-white/50">{meta?.scriptsDir ?? "…"}</span>
            ). Default logs:{" "}
            <span className="font-mono text-white/50">{meta?.logDir ?? "…"}</span>
          </p>
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
