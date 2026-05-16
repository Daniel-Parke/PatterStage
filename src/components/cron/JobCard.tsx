// ═══════════════════════════════════════════════════════════════
// JobCard — Cron job card with expand/collapse, actions
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState } from "react";
import {
  Play,
  Pause,
  Trash2,
  Edit3,
  Calendar,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Zap,
} from "lucide-react";
import { describeSchedule } from "@/components/cron/CronScheduleInput";

export interface CronJob {
  id: string;
  name: string;
  schedule: string;
  schedule_display?: string;
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

interface JobCardProps {
  job: CronJob;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onRun: (id: string) => void;
  onEdit: (job: CronJob) => void;
}

export default function JobCard({
  job,
  onToggle,
  onDelete,
  onRun,
  onEdit,
}: JobCardProps) {
  const [expanded, setExpanded] = useState(false);
  const handleDelete = async () => {
    if (!confirm("Delete this cron job?")) return;
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
                {job.schedule_display || describeSchedule(job.schedule)}
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
              className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Delete"
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