// ═══════════════════════════════════════════════════════════════
// Cron Job Manager — Full CRUD + Control
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Clock,
  Plus,
  Play,
  Pause,
  Trash2,
  Edit3,
  Calendar,
  MessageSquare,
  Cpu,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Check,
  Loader2,
  Zap,
} from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import { SearchInput } from "@/components/ui/Input";
import { LoadingSpinner, EmptyState } from "@/components/ui/LoadingSpinner";
import { useToast } from "@/components/ui/Toast";
import Modal from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import { baseInputStyles } from "@/lib/theme";
import { parseSchedule } from "@/lib/utils";
import { useApiData } from "@/hooks/useApiData";
import CronScheduleInput from "@/components/cron/CronScheduleInput";
import HardwareCronCard, { HardwareCronJob } from "@/components/cron/HardwareCronCard";
import HardwareCronModal from "@/components/cron/HardwareCronModal";

interface CronJob {
  id: string;
  name: string;
  schedule: string;
  prompt: string;
  deliver: string;
  model: string;
  enabled: boolean;
  lastRun: string | null;
  nextRun: string | null;
  repeat: boolean;
  skills: string[];
  script: string;
  state?: string;
  profile_name?: string;
}

interface CronData {
  jobs: CronJob[];
  total: number;
}

function formatSchedule(schedule: string): string {
  // Human-readable schedule display with friendly interval labels
  if (!schedule) return "No schedule";
  const parts = schedule.trim().split(/\s+/);
  if (parts.length < 5) return schedule;
  const offset = parts.length - 5; // skip seconds field in 6-part
  const [min, hour, dom, mon, dow] = parts.slice(offset);

  // Every N minutes: */N * * * *
  if (min.startsWith("*/") && hour === "*" && dom === "*" && mon === "*" && dow === "*") {
    const n = min.slice(2);
    return `Every ${n}m`;
  }

  // Every N hours: 0 */N * * *
  if (min === "0" && hour.startsWith("*/") && dom === "*" && mon === "*" && dow === "*") {
    const n = hour.slice(2);
    return `Every ${n}h`;
  }

  // Every hour at MM past: MM * * * * (e.g. 30 * * * * = every hour at :30)
  if (min !== "*" && hour === "*" && dom === "*" && mon === "*" && dow === "*") {
    const m = parseInt(min);
    if (Number.isFinite(m) && m >= 0 && m <= 59) {
      return `Every hour:(${String(m).padStart(2, "0")})`;
    }
  }

  // Every minute: * * * * *
  if (min === "*" && hour === "*" && dom === "*" && mon === "*" && dow === "*") {
    return "Every minute";
  }

  // Daily at HH:MM: 0 HH * * *
  if (min !== "*" && hour !== "*" && dom === "*" && mon === "*" && dow === "*") {
    const h = parseInt(hour);
    const m = parseInt(min);
    if (Number.isFinite(h) && Number.isFinite(m)) {
      const period = h >= 12 ? "PM" : "AM";
      const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const displayMin = String(m).padStart(2, "0");
      return `Daily ${displayHour}:${displayMin}${period}`;
    }
  }

  // Weekly: 0 HH * * D
  if (min !== "*" && hour !== "*" && dom === "*" && mon === "*" && dow !== "*") {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dayIndex = parseInt(dow);
    const h = parseInt(hour);
    const m = parseInt(min);
    if (Number.isFinite(dayIndex) && dayIndex >= 0 && dayIndex <= 6 && Number.isFinite(h) && Number.isFinite(m)) {
      const period = h >= 12 ? "PM" : "AM";
      const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const displayMin = String(m).padStart(2, "0");
      return `${days[dayIndex]}s ${displayHour}:${displayMin}${period}`;
    }
  }

  // Monthly: 0 HH DD * *
  if (min !== "*" && hour !== "*" && dom !== "*" && mon === "*" && dow === "*") {
    const h = parseInt(hour);
    const m = parseInt(min);
    const d = parseInt(dom);
    if (Number.isFinite(h) && Number.isFinite(m) && Number.isFinite(d)) {
      const period = h >= 12 ? "PM" : "AM";
      const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const displayMin = String(m).padStart(2, "0");
      return `Day ${d} ${displayHour}:${displayMin}${period}`;
    }
  }

  // Weekdays (1-5): 0 HH * * 1-5
  if (min !== "*" && hour !== "*" && dom === "*" && mon === "*" && /^[1-5](,[1-5])*$/.test(dow)) {
    const h = parseInt(hour);
    const m = parseInt(min);
    if (Number.isFinite(h) && Number.isFinite(m)) {
      const period = h >= 12 ? "PM" : "AM";
      const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const displayMin = String(m).padStart(2, "0");
      return `Weekdays ${displayHour}:${displayMin}${period}`;
    }
  }

  // Fallback: return the raw cron expression
  return schedule;
}

function JobCard({
  job,
  onToggle,
  onDelete,
  onRun,
  onEdit,
}: {
  job: CronJob;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onRun: (id: string) => void;
  onEdit: (job: CronJob) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleting) {
      setDeleting(true);
      return;
    }
    await onDelete(job.id);
  };

  return (
    <div
      className={`rounded-xl border transition-colors ${
        job.enabled
          ? "border-white/10 bg-dark-900/50 hover:border-neon-orange/30"
          : "border-white/5 bg-dark-900/30 opacity-60"
      }`}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div
                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  !job.enabled
                    ? "bg-white/20"
                    : job.state === "paused"
                      ? "bg-neon-orange"
                      : job.state === "run_requested"
                        ? "bg-neon-cyan pulse-glow"
                        : "bg-neon-green pulse-glow"
                }`}
              />
              <h3 className="font-semibold text-white truncate">{job.name}</h3>
              {job.repeat && (
                <span className="text-[10px] font-mono bg-neon-purple/15 text-neon-purple px-1.5 py-0.5 rounded">
                  REPEAT
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-white/40 font-mono">
              <span className="flex items-center gap-1 shrink-0">
                <Calendar className="w-3 h-3" />
                {formatSchedule(job.schedule)}
              </span>
              {job.deliver && job.deliver !== "none" && (
                <span
                  className="flex items-center gap-1 text-white/60 truncate max-w-[200px]"
                  title={job.deliver}
                >
                  <MessageSquare className="w-3 h-3 shrink-0" />
                  → {job.deliver.split(":").pop()}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => onToggle(job.id)}
              className={`p-1.5 rounded-lg transition-colors ${
                job.enabled
                  ? "text-neon-green hover:bg-neon-green/10"
                  : "text-white/30 hover:bg-white/5"
              }`}
              title={job.enabled ? "Pause" : "Resume"}
            >
              {job.enabled ? (
                <Pause className="w-3.5 h-3.5" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
            </button>
            <button
              onClick={() => onRun(job.id)}
              className="p-1.5 rounded-lg text-neon-cyan hover:bg-neon-cyan/10 transition-colors"
              title="Run now"
            >
              <Zap className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onEdit(job)}
              className="p-1.5 rounded-lg text-white/40 hover:bg-white/5 transition-colors"
              title="Edit"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleDelete}
              className={`p-1.5 rounded-lg transition-colors ${
                deleting
                  ? "text-red-400 bg-red-500/10"
                  : "text-white/40 hover:bg-white/5"
              }`}
              title={deleting ? "Click again to confirm" : "Delete"}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 rounded-lg text-white/30 hover:bg-white/5 transition-colors"
            >
              {expanded ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {expanded && (
          <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
            <div>
              <div className="text-[10px] font-mono text-white/30 uppercase tracking-widest mb-1">
                Prompt
              </div>
              <div className="text-sm text-white/60 font-mono bg-dark-800/50 rounded-lg p-3 whitespace-pre-wrap max-h-40 overflow-y-auto">
                {job.prompt}
              </div>
            </div>
            {job.skills.length > 0 && (
              <div>
                <div className="text-[10px] font-mono text-white/30 uppercase tracking-widest mb-1">
                  Skills
                </div>
                <div className="flex flex-wrap gap-1">
                  {job.skills.map((s) => (
                    <span
                      key={s}
                      className="text-xs font-mono bg-neon-green/10 text-neon-green px-2 py-0.5 rounded"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center gap-4 text-xs text-white/30 font-mono">
              <span>ID: {job.id}</span>
              {job.lastRun && (
                <span>Last run: {new Date(job.lastRun).toLocaleString()}</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EditJobModal({
  job,
  onClose,
  onSaved,
}: {
  job: CronJob;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [schedule, setSchedule] = useState(job.schedule);
  const [prompt, setPrompt] = useState(job.prompt);
  const [deliver, setDeliver] = useState(job.deliver || "none");
  const [model, setModel] = useState(job.model);
  const [profile_name, setProfileName] = useState(job.profile_name || "default");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!schedule || !prompt) {
      setError("Schedule and prompt are required");
      return;
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
      const res = await fetch("/api/cron", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: job.id,
          schedule,
          schedule_display: parsedSchedule.display,
          prompt,
          deliver,
          model,
          profile_name,
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to update job");
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setSaving(false);
    }
  };

  // Derive the actual cron expression from the current schedule value.
  // CronScheduleInput stores either a raw 5-field expr ("*/5 * * * *")
  // or a parsed interval display ("every 60m"). We re-parse to get the expr.
  const cronExpr =
    schedule.trim().split(/\s+/).length === 5
      ? schedule.trim()
      : (() => {
          const p = parseSchedule(schedule);
          return p.kind !== "invalid" ? p.kind : schedule;
        })();

  return (
    <Modal
      open
      onClose={onClose}
      title={`Edit: ${job.name}`}
      icon={Edit3}
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
            Save Changes
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

        <CronScheduleInput
          value={schedule}
          onChange={setSchedule}
          error={null}
        />

        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-dark-800 border border-white/5">
          <span className="text-xs font-medium text-white/40">Cron:</span>
          <code className="text-xs font-mono text-neon-orange bg-dark-900 px-2 py-0.5 rounded">
            {cronExpr}
          </code>
          <span className="text-xs text-white/30">— base schedule format</span>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-white/70">Prompt</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
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
            <label className="text-sm font-medium text-white/70">Model</label>
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
      </div>
    </Modal>
  );
}

function CreateJobModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [schedule, setSchedule] = useState("");
  const [prompt, setPrompt] = useState("");
  const [deliver, setDeliver] = useState("none");
  const [model, setModel] = useState("");
  const [profile_name, setProfileName] = useState("default");
  const [repeat, setRepeat] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!name || !schedule || !prompt) {
      setError("Name, schedule, and prompt are required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/cron", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          schedule,
          prompt,
          deliver,
          model,
          repeat,
          profile_name,
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to create job");
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="New Cron Job"
      icon={Plus}
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
            icon={saving ? Loader2 : Plus}
          >
            Create Job
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

        <CronScheduleInput
          value={schedule}
          onChange={setSchedule}
          error={null}
        />

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-white/70">Prompt</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            placeholder="What should the agent do?"
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
              Model (optional)
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
      </div>
    </Modal>
  );
}

export default function CronPage() {
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editingJob, setEditingJob] = useState<CronJob | null>(null);
  const [pauseAllBusy, setPauseAllBusy] = useState(false);
  const [hwPauseAllBusy, setHwPauseAllBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [hwSyncing, setHwSyncing] = useState(false);
  // Hardware cron tab state
  const [activeTab, setActiveTab] = useState<"agent" | "hardware">("agent");
  const [showHardwareCreate, setShowHardwareCreate] = useState(false);
  const [editingHardwareJob, setEditingHardwareJob] = useState<HardwareCronJob | null>(null);
  const [hardwareJobs, setHardwareJobs] = useState<HardwareCronJob[]>([]);
  const [hardwareLoading, setHardwareLoading] = useState(false);
  const [hardwareSearch, setHardwareSearch] = useState("");
  const { showToast, toastElement } = useToast();

  const { data, loading, error: _apiError, refetch: loadJobs } = useApiData<CronData>("/api/cron", {
    transform: (raw) => raw as CronData,
  });

  const handleToggle = async (id: string) => {
    const job = data?.jobs.find((j) => j.id === id);
    if (!job) return;
    const action = job.enabled ? "pause" : "resume";
    const res = await fetch("/api/cron", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    if (res.ok) {
      showToast(`Job ${action === "pause" ? "Paused" : "Resumed"}`);
    } else {
      const body = await res.json().catch(() => null);
      showToast(body?.error || `Failed to ${action} job`, "error");
    }
    loadJobs();
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/cron?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      showToast("Job deleted");
    } else {
      const body = await res.json().catch(() => null);
      showToast(body?.error || "Failed to delete job", "error");
    }
    loadJobs();
  };

  const handleRun = async (id: string) => {
    const res = await fetch("/api/cron", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "run" }),
    });
    if (res.ok) {
      showToast("Run triggered");
    } else {
      const body = await res.json().catch(() => null);
      showToast(body?.error || "Failed to trigger run", "error");
    }
    loadJobs();
  };

  const handleEdit = (job: CronJob) => {
    setEditingJob(job);
  };

  const handlePauseAll = async () => {
    if (!data?.jobs.length) return;
    if (
      !confirm(
        "Pause every cron job? Hermes will not run them until you resume each job or edit jobs.json.",
      )
    ) {
      return;
    }
    setPauseAllBusy(true);
    try {
      const res = await fetch("/api/cron", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pauseAll" }),
      });
      const j = (await res.json()) as {
        error?: string;
        data?: { pausedCount?: number };
      };
      if (!res.ok) {
        showToast(j.error || "Failed to pause jobs", "error");
        return;
      }
      showToast(`Paused ${j.data?.pausedCount ?? 0} job(s)`);
      loadJobs();
    } finally {
      setPauseAllBusy(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/cron", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync" }),
      });
      const d = (await res.json()) as {
        error?: string;
        data?: { hermesImported?: { action: string }[] };
      };
      if (!res.ok) {
        showToast(d.error || "Sync failed", "error");
      } else {
        const imported = d.data?.hermesImported?.length ?? 0;
        showToast(`Synced — ${imported} Hermes job(s) imported`);
      }
    } catch {
      showToast("Sync failed", "error");
    } finally {
      setSyncing(false);
      void loadJobs();
    }
  };

  // ── Hardware Cron handlers ────────────────────────────────────

  const loadHardwareJobs = useCallback(async () => {
    setHardwareLoading(true);
    try {
      const res = await fetch("/api/cron/hardware");
      const d = (await res.json()) as { data?: { jobs: HardwareCronJob[] }; error?: string };
      if (!res.ok) {
        showToast(d.error ?? "Failed to load hardware cron jobs", "error");
        setHardwareJobs([]);
        return;
      }
      if (d.data?.jobs) {
        setHardwareJobs(d.data.jobs);
      } else {
        setHardwareJobs([]);
      }
    } catch {
      showToast("Failed to load hardware cron jobs", "error");
      setHardwareJobs([]);
    } finally {
      setHardwareLoading(false);
    }
  }, [showToast]);

  const handleHardwareToggle = async (id: string) => {
    const job = hardwareJobs.find((j) => j.id === id);
    if (!job) return;
    const newEnabled = !job.enabled;
    const res = await fetch("/api/cron/hardware", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, enabled: newEnabled }),
    });
    if (res.ok) {
      showToast(newEnabled ? "Hardware job enabled" : "Hardware job paused");
      loadHardwareJobs();
    } else {
      const body = await res.json().catch(() => null);
      showToast(body?.error || "Failed to update hardware job", "error");
    }
  };

  const handleHardwareDelete = async (id: string) => {
    const res = await fetch(`/api/cron/hardware?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      showToast("Hardware cron job deleted");
      loadHardwareJobs();
    } else {
      const body = await res.json().catch(() => null);
      showToast(body?.error || "Failed to delete hardware job", "error");
    }
  };

  const handleHardwareSave = async (job: Partial<HardwareCronJob>) => {
    if (job.id) {
      // Update existing
      const res = await fetch("/api/cron/hardware", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(job),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Failed to update hardware job");
      }
      showToast("Hardware cron job updated");
    } else {
      // Create new
      const res = await fetch("/api/cron/hardware", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(job),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Failed to create hardware job");
      }
      showToast("Hardware cron job created");
    }
    loadHardwareJobs();
  };

  const handleHwPauseAll = async () => {
    if (!confirm("Pause all hardware cron jobs? They will not run until you re-enable each one individually.")) return;
    setHwPauseAllBusy(true);
    try {
      const res = await fetch("/api/cron/hardware", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pauseAll" }),
      });
      const j = await res.json();
      if (!res.ok) {
        showToast(j.error || "Failed to pause hardware jobs", "error");
      } else {
        showToast(`Paused ${j.data?.pausedCount ?? 0} hardware job(s)`);
        loadHardwareJobs();
      }
    } catch {
      showToast("Failed to pause hardware jobs", "error");
    } finally {
      setHwPauseAllBusy(false);
    }
  };

  const handleHwSync = async () => {
    setHwSyncing(true);
    try {
      const res = await fetch("/api/cron/hardware", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync" }),
      });
      const d = await res.json();
      if (!res.ok) {
        showToast(d.error || "Hardware sync failed", "error");
      } else {
        showToast("Hardware jobs synced");
        loadHardwareJobs();
      }
    } catch {
      showToast("Hardware sync failed", "error");
    } finally {
      setHwSyncing(false);
    }
  };

  const filteredJobs =
    data?.jobs.filter(
      (job) =>
        !search ||
        job.name.toLowerCase().includes(search.toLowerCase()) ||
        job.schedule.includes(search) ||
        job.prompt.toLowerCase().includes(search.toLowerCase()),
    ) || [];

  const filteredHardwareJobs = hardwareJobs.filter(
    (job) =>
      !hardwareSearch ||
      job.name.toLowerCase().includes(hardwareSearch.toLowerCase()) ||
      job.schedule.includes(hardwareSearch),
  );

  const enabledCount = data?.jobs.filter((j) => j.enabled).length || 0;
  const enabledHwCount = hardwareJobs.filter((j) => j.enabled).length || 0;

  // Load hardware jobs when switching to the hardware tab
  const [hwLoaded, setHwLoaded] = useState(false);
  useEffect(() => {
    if (activeTab === "hardware" && !hwLoaded) {
      void loadHardwareJobs();
      setHwLoaded(true);
    }
    if (activeTab !== "hardware") {
      setHwLoaded(false);
    }
  }, [activeTab, hwLoaded, loadHardwareJobs]);

  const pageSubtitle = data
    ? `Agent: ${enabledCount}/${data.total}  •  Hardware: ${enabledHwCount}/${hardwareJobs.length || 0}`
    : "Scheduled tasks";

  return (
    <div className="min-h-screen bg-dark-950 grid-bg">
      <PageHeader
        icon={Clock}
        title="Cron Jobs"
        subtitle={pageSubtitle}
        color="orange"
        actions={
          <div className="flex items-center gap-2">
            {/* Agent / Hardware tab toggle */}
            <div className="flex items-center bg-white/5 border border-white/10 rounded-lg p-0.5">
              <button
                onClick={() => setActiveTab("agent")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  activeTab === "agent"
                    ? "bg-neon-orange/20 text-neon-orange"
                    : "text-white/50 hover:text-white"
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                Agent
              </button>
              <button
                onClick={() => setActiveTab("hardware")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  activeTab === "hardware"
                    ? "bg-neon-cyan/20 text-neon-cyan"
                    : "text-white/50 hover:text-white"
                }`}
              >
                <Cpu className="w-3.5 h-3.5" />
                Hardware
              </button>
            </div>
            {activeTab === "agent" && (
              <>
                <Button
                  variant="secondary"
                  color="orange"
                  size="sm"
                  icon={Pause}
                  disabled={pauseAllBusy || !data?.total}
                  onClick={() => void handlePauseAll()}
                >
                  {pauseAllBusy ? "Pausing…" : "Pause all"}
                </Button>
                <Button
                  variant="secondary"
                  color="orange"
                  size="sm"
                  icon={Zap}
                  loading={syncing}
                  disabled={syncing}
                  onClick={() => void handleSync()}
                >
                  {syncing ? "Syncing…" : "Sync Jobs"}
                </Button>
                <Button
                  variant="primary"
                  color="orange"
                  size="sm"
                  icon={Plus}
                  onClick={() => setShowCreate(true)}
                >
                  New Job
                </Button>
              </>
            )}
            {activeTab === "hardware" && (
              <>
                <Button
                  variant="secondary"
                  color="cyan"
                  size="sm"
                  icon={Pause}
                  disabled={hwPauseAllBusy || !hardwareJobs.length}
                  onClick={() => void handleHwPauseAll()}
                >
                  {hwPauseAllBusy ? "Pausing…" : "Pause all"}
                </Button>
                <Button
                  variant="secondary"
                  color="cyan"
                  size="sm"
                  icon={Zap}
                  loading={hwSyncing}
                  disabled={hwSyncing}
                  onClick={() => void handleHwSync()}
                >
                  {hwSyncing ? "Syncing…" : "Sync Jobs"}
                </Button>
                <Button
                  variant="primary"
                  color="cyan"
                  size="sm"
                  icon={Plus}
                  onClick={() => setShowHardwareCreate(true)}
                >
                  New Job
                </Button>
              </>
            )}
          </div>
        }
      />

      <div className="px-6 py-6">
        {/* ── Agent Tab ── */}
        {activeTab === "agent" && (
          <>
            <div className="mb-6">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search agent jobs..."
                accentColor="orange"
              />
            </div>

            {loading ? (
              <LoadingSpinner text="Loading cron jobs..." />
            ) : filteredJobs.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-dark-900/50">
                <EmptyState
                  icon={Clock}
                  title="No cron jobs"
                  description={
                    search
                      ? "No jobs match your search"
                      : "Create your first scheduled job"
                  }
                  action={
                    !search ? (
                      <Button
                        variant="primary"
                        color="orange"
                        size="sm"
                        icon={Plus}
                        onClick={() => setShowCreate(true)}
                      >
                        Create Agent Job
                      </Button>
                    ) : undefined
                  }
                />
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredJobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    onToggle={handleToggle}
                    onDelete={handleDelete}
                    onRun={handleRun}
                    onEdit={handleEdit}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Hardware Tab ── */}
        {activeTab === "hardware" && (
          <>
            <div className="mb-6">
              <SearchInput
                value={hardwareSearch}
                onChange={setHardwareSearch}
                placeholder="Search hardware jobs..."
                accentColor="cyan"
              />
            </div>

            {hardwareLoading ? (
              <LoadingSpinner text="Loading hardware cron jobs..." />
            ) : filteredHardwareJobs.length === 0 ? (
              <div className="rounded-xl border border-cyan-500/20 bg-dark-900/50">
                <EmptyState
                  icon={Cpu}
                  title="No hardware cron jobs"
                  description={
                    hardwareSearch
                      ? "No jobs match your search"
                      : "Add a real system cron job to run independently of the agent"
                  }
                  action={
                    !hardwareSearch ? (
                      <Button
                        variant="primary"
                        color="cyan"
                        size="sm"
                        icon={Plus}
                        onClick={() => setShowHardwareCreate(true)}
                      >
                        Create Hardware Job
                      </Button>
                    ) : undefined
                  }
                />
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredHardwareJobs.map((job) => (
                  <HardwareCronCard
                    key={job.id}
                    job={job}
                    onToggle={(id) => void handleHardwareToggle(id)}
                    onEdit={(job) => {
                      setEditingHardwareJob(job);
                      setShowHardwareCreate(true);
                    }}
                    onDelete={(id) => void handleHardwareDelete(id)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Agent Modals ── */}
      {showCreate && (
        <CreateJobModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            showToast("Job created!");
            void loadJobs();
          }}
        />
      )}

      {editingJob && (
        <EditJobModal
          job={editingJob}
          onClose={() => setEditingJob(null)}
          onSaved={() => {
            setEditingJob(null);
            showToast("Job updated!");
            void loadJobs();
          }}
        />
      )}

      {/* ── Hardware Modal (create + edit) ── */}
      <HardwareCronModal
        open={showHardwareCreate || !!editingHardwareJob}
        editingJob={editingHardwareJob}
        onClose={() => {
          setShowHardwareCreate(false);
          setEditingHardwareJob(null);
        }}
        onSave={async (job) => {
          await handleHardwareSave(job);
          setShowHardwareCreate(false);
          setEditingHardwareJob(null);
          void loadHardwareJobs();
        }}
      />

      {toastElement}
    </div>
  );
}
