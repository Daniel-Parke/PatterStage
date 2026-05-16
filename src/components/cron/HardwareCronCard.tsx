// ═══════════════════════════════════════════════════════════════
// HardwareCronCard — Display card for hardware cron jobs
//
// Hardware cron jobs are system crontab entries that survive
// agent restarts and run independently of Hermes.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState } from "react";
import {
  Cpu,
  Clock,
  FileCode,
  Trash2,
  Edit3,
  Play,
  Pause,
  ChevronDown,
  ChevronUp,
  Terminal,
} from "lucide-react";
import { describeSchedule } from "@/components/cron/CronScheduleInput";

export interface HardwareCronJob {
  id: string;
  name: string;
  schedule: string;
  enabled: boolean;
  command: string;
  logFile?: string;
}

interface HardwareCronCardProps {
  job: HardwareCronJob;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (job: HardwareCronJob) => void;
}

export default function HardwareCronCard({
  job,
  onToggle,
  onDelete,
  onEdit,
}: HardwareCronCardProps) {
  const [expanded, setExpanded] = useState(false);

  const handleDelete = () => {
    if (!confirm("Delete this hardware cron job?")) return;
    onDelete(job.id);
  };

  return (
    <div
      className={`rounded-xl border transition-all ${
        job.enabled
          ? "border-white/10 bg-dark-900/50 hover:border-neon-cyan/30"
          : "border-white/5 bg-dark-900/30 opacity-60"
      }`}
    >
      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              {/* Status indicator */}
              <div
                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  !job.enabled
                    ? "bg-white/20"
                    : "bg-neon-cyan pulse-glow"
                }`}
              />
              <h3 className="font-semibold text-white truncate">{job.name}</h3>
              {/* Hardware badge */}
              <span className="text-[10px] font-mono bg-neon-cyan/15 text-neon-cyan px-1.5 py-0.5 rounded flex items-center gap-1">
                <Cpu className="w-3 h-3" />
                Hardware
              </span>
            </div>

            {/* Schedule + command preview */}
            <div className="flex items-center gap-3 text-xs text-white/40 font-mono">
              <span className="flex items-center gap-1 shrink-0">
                <Clock className="w-3 h-3" />
                {describeSchedule(job.schedule)}
              </span>
              {job.command && (
                <span
                  className="flex items-center gap-1 text-white/60 truncate max-w-[200px]"
                  title={job.command}
                >
                  <Terminal className="w-3 h-3 shrink-0" />
                  {job.command.split("/").pop() || job.command}
                </span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Toggle enabled/disabled */}
            <button
              onClick={() => onToggle(job.id)}
              className={`p-1.5 rounded-lg transition-colors ${
                job.enabled
                  ? "text-neon-cyan hover:bg-neon-cyan/10"
                  : "text-white/30 hover:bg-white/5"
              }`}
              title={job.enabled ? "Disable" : "Enable"}
            >
              {job.enabled ? (
                <Pause className="w-3.5 h-3.5" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
            </button>

            {/* Edit */}
            <button
              onClick={() => onEdit(job)}
              className="p-1.5 rounded-lg text-white/40 hover:bg-white/5 transition-colors"
              title="Edit"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>

            {/* Delete with confirmation */}
            <button
              onClick={handleDelete}
              className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>

            {/* Expand/collapse */}
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

        {/* Expanded details */}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-white/5 space-y-3">
            {/* Cron expression */}
            <div>
              <div className="text-[10px] font-mono text-white/30 uppercase tracking-widest mb-1">
                Cron Expression
              </div>
              <div className="text-sm text-neon-cyan font-mono bg-dark-800/50 rounded-lg p-2">
                {job.schedule}
              </div>
            </div>

            {/* Full command */}
            <div>
              <div className="text-[10px] font-mono text-white/30 uppercase tracking-widest mb-1 flex items-center gap-1">
                <FileCode className="w-3 h-3" />
                Command
              </div>
              <div className="text-sm text-white/60 font-mono bg-dark-800/50 rounded-lg p-3 whitespace-pre-wrap max-h-40 overflow-y-auto break-all">
                {job.command}
              </div>
            </div>

            {/* Log file path */}
            {job.logFile && (
              <div>
                <div className="text-[10px] font-mono text-white/30 uppercase tracking-widest mb-1">
                  Log File
                </div>
                <div className="text-xs text-white/40 font-mono bg-dark-800/30 rounded-lg p-2 truncate" title={job.logFile}>
                  {job.logFile}
                </div>
              </div>
            )}

            {/* Job metadata */}
            <div className="flex items-center gap-4 text-xs text-white/30 font-mono">
              <span>ID: {job.id}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
