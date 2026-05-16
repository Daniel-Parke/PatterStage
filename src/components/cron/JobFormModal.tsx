// ═══════════════════════════════════════════════════════════════
// JobFormModal — Unified create + edit modal for agent cron jobs
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState } from "react";
import {
  Plus,
  Edit3,
  AlertCircle,
  Check,
  Loader2,
} from "lucide-react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import { baseInputStyles } from "@/lib/theme";
import { parseSchedule } from "@/lib/utils";
import CronScheduleInput from "@/components/cron/CronScheduleInput";

export interface CronJobFormData {
  id?: string;
  name: string;
  schedule: string;
  prompt: string;
  deliver: string;
  model: string;
  profile_name?: string;
  repeat?: boolean;
}

interface JobFormModalProps {
  /** When provided, the modal operates in edit mode. Omit for create mode. */
  job?: CronJobFormData | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function JobFormModal({
  job,
  open,
  onClose,
  onSaved,
}: JobFormModalProps) {
  const isEdit = !!job?.id;
  const [name, setName] = useState(job?.name ?? "");
  const [schedule, setSchedule] = useState(job?.schedule ?? "");
  const [prompt, setPrompt] = useState(job?.prompt ?? "");
  const [deliver, setDeliver] = useState(job?.deliver || "none");
  const [model, setModel] = useState(job?.model ?? "");
  const [profile_name, setProfileName] = useState(job?.profile_name || "default");
  const [repeat, setRepeat] = useState(job?.repeat ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derive the actual cron expression from the current schedule value.
  const cronExpr =
    schedule.trim().split(/\s+/).length === 5
      ? schedule.trim()
      : (() => {
          const p = parseSchedule(schedule);
          return p.kind !== "invalid" ? p.kind : schedule;
        })();

  const handleSubmit = async () => {
    if (isEdit) {
      if (!schedule || !prompt) {
        setError("Schedule and prompt are required");
        return;
      }
    } else {
      if (!name || !schedule || !prompt) {
        setError("Name, schedule, and prompt are required");
        return;
      }
    }

    setSaving(true);
    setError(null);

    try {
      const parsedSchedule = parseSchedule(schedule);
      if (parsedSchedule.kind === "invalid") {
        setError(parsedSchedule.message);
        setSaving(false);
        return;
      }

      const body: Record<string, unknown> = {
        schedule,
        schedule_display: parsedSchedule.display,
        prompt,
        deliver,
        model,
        profile_name,
      };

      if (isEdit) {
        body.id = job!.id;
      } else {
        body.name = name;
        body.repeat = repeat;
      }

      const res = await fetch("/api/cron", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || (isEdit ? "Failed to update job" : "Failed to create job"));
      }

      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? `Edit: ${job!.name}` : "New Cron Job"}
      icon={isEdit ? Edit3 : Plus}
      iconColor="text-neon-orange"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            color="orange"
            onClick={handleSubmit}
            loading={saving}
            icon={saving ? Loader2 : Check}
          >
            {isEdit ? "Save Changes" : "Create Job"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Name field — only shown in create mode */}
        {!isEdit && (
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-white/70">Job Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. daily-health-check"
              className={baseInputStyles}
            />
          </div>
        )}

        <CronScheduleInput
          value={schedule}
          onChange={setSchedule}
          error={null}
        />

        {/* Cron expression display — shown in edit mode */}
        {isEdit && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-dark-800 border border-white/5">
            <span className="text-xs font-medium text-white/40">Cron:</span>
            <code className="text-xs font-mono text-neon-orange bg-dark-900 px-2 py-0.5 rounded">
              {cronExpr}
            </code>
            <span className="text-xs text-white/30">— base schedule format</span>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-white/70">Prompt</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            placeholder={isEdit ? undefined : "What should the agent do?"}
            className={`${baseInputStyles} resize-y`}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Select
            value={deliver}
            onChange={setDeliver}
            label="Deliver To"
            accentColor="orange"
            options={[
              { value: "none", label: "None" },
              { value: "cli", label: "CLI" },
              { value: "telegram", label: "Telegram" },
              { value: "discord", label: "Discord" },
              { value: "slack", label: "Slack" },
            ]}
          />
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-white/70">
              {isEdit ? "Model" : "Model (optional)"}
            </label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Default model"
              className={baseInputStyles}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-white/70">
            Agent Profile
          </label>
          <select
            value={profile_name}
            onChange={(e) => setProfileName(e.target.value)}
            className={baseInputStyles}
          >
            <option value="default">Bob (default)</option>
            <option value="swe">swe</option>
            <option value="qa">qa</option>
            <option value="devops">devops</option>
            <option value="web-design">web-design</option>
            <option value="researcher">researcher</option>
            <option value="marketing">marketing</option>
            <option value="creative-lead">creative-lead</option>
            <option value="data-scientist">data-scientist</option>
          </select>
        </div>

        {/* Repeat toggle — only shown in create mode */}
        {!isEdit && (
          <div className="flex items-center justify-between py-2">
            <div>
              <div className="text-sm font-medium text-white/70">Repeat</div>
              <p className="text-xs text-white/40 mt-0.5">
                Recurring job vs one-shot
              </p>
            </div>
            <button
              onClick={() => setRepeat(!repeat)}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                repeat
                  ? "bg-neon-orange/30 border border-neon-orange/50"
                  : "bg-white/10 border border-white/20"
              }`}
            >
              <div
                className={`absolute top-0.5 w-4 h-4 rounded-full transition-transform ${
                  repeat
                    ? "translate-x-5 bg-neon-orange"
                    : "translate-x-0.5 bg-white/40"
                }`}
              />
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}