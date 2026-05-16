// ═══════════════════════════════════════════════════════════════
// GoalLoopPanel — Shows active goal session progress for a card
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState } from "react";
import { Zap, CheckCircle2, Circle, XCircle, AlertCircle, Pause, Play, X } from "lucide-react";
import type { GoalSession } from "@/types/hermes";

interface Props {
  session: GoalSession;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onCheckCompletion: (goalIndex: number) => Promise<void>;
  polling?: boolean;
}

const STEP_ICONS = {
  pending: Circle,
  in_progress: Zap,
  done: CheckCircle2,
  failed: XCircle,
  skipped: AlertCircle,
};

const STEP_COLORS = {
  pending: "text-white/30",
  in_progress: "text-neon-purple",
  done: "text-neon-green",
  failed: "text-red-400",
  skipped: "text-white/30",
};

export default function GoalLoopPanel({
  session,
  onPause,
  onResume,
  onCancel,
  onCheckCompletion,
  polling = false,
}: Props) {
  const [checkingIndex, setCheckingIndex] = useState<number | null>(null);

  const completedCount = session.steps.filter((s) => s.status === "done").length;
  const totalCount = session.steps.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const handleCheck = async (goalIndex: number) => {
    setCheckingIndex(goalIndex);
    try {
      await onCheckCompletion(goalIndex);
    } finally {
      setCheckingIndex(null);
    }
  };

  return (
    <div className="rounded-xl border border-neon-purple/20 bg-neon-purple/5 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-neon-purple" />
          <span className="text-sm font-semibold text-white">Goal Loop</span>
          <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-white/40">
            {session.goalLoopMode}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {session.status === "active" && (
            <button
              className="text-xs flex items-center gap-1 px-2 py-1 rounded text-neon-orange/70 hover:text-neon-orange hover:bg-neon-orange/10 transition-colors"
              onClick={onPause}
            >
              <Pause className="w-3 h-3" />
              Pause
            </button>
          )}
          {session.status === "paused" && (
            <button
              className="text-xs flex items-center gap-1 px-2 py-1 rounded text-neon-green/70 hover:text-neon-green hover:bg-neon-green/10 transition-colors"
              onClick={onResume}
            >
              <Play className="w-3 h-3" />
              Resume
            </button>
          )}
          <button
            className="text-xs flex items-center gap-1 px-2 py-1 rounded text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            onClick={onCancel}
          >
            <X className="w-3 h-3" />
            Cancel
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-white/50">
            {session.status === "completed"
              ? "All goals complete"
              : session.status === "failed"
              ? "Goal loop failed"
              : session.status === "paused"
              ? "Paused"
              : `${completedCount} of ${totalCount} goals done`}
          </span>
          <span className="text-xs font-mono text-white/40">{Math.round(progress)}%</span>
        </div>
        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              session.status === "failed"
                ? "bg-red-500"
                : session.status === "completed"
                ? "bg-neon-green"
                : "bg-neon-purple"
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Goal steps */}
      <div className="space-y-2">
        {session.steps.map((step) => {
          const Icon = STEP_ICONS[step.status];
          const color = STEP_COLORS[step.status];
          const isCurrent = session.currentGoalIndex === step.index && session.status === "active";
          const isChecking = checkingIndex === step.index;

          return (
            <div
              key={step.index}
              className={`flex items-start gap-2.5 p-2 rounded-lg transition-colors ${
                isCurrent ? "bg-neon-purple/10 border border-neon-purple/20" : "hover:bg-white/5"
              }`}
            >
              <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${color}`} />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[11px] font-mono text-white/30 w-4">
                    {step.index + 1}.
                  </span>
                  <span
                    className={`text-sm leading-snug ${
                      step.status === "done" ? "text-white/60 line-through" : "text-white/80"
                    }`}
                  >
                    {step.goal}
                  </span>
                </div>

                {/* Mission link */}
                {step.missionId && (
                  <div className="ml-6 text-[11px] text-white/30 mt-0.5">
                    Mission:{" "}
                    <span className="font-mono text-neon-cyan/60">{step.missionId}</span>
                    {step.error && (
                      <span className="text-red-400 ml-2">Error: {step.error}</span>
                    )}
                  </div>
                )}

                {/* Check completion button for active step with a mission */}
                {step.status === "in_progress" && step.missionId && (
                  <div className="ml-6 mt-1">
                    <button
                      className="text-[11px] px-2 py-0.5 rounded bg-neon-cyan/10 text-neon-cyan/70
                        hover:bg-neon-cyan/20 transition-colors disabled:opacity-50"
                      onClick={() => handleCheck(step.index)}
                      disabled={isChecking || polling}
                    >
                      {isChecking ? "Checking…" : "Check GOAL_DONE"}
                    </button>
                  </div>
                )}
              </div>

              {/* Status badge */}
              {step.completedAt && (
                <span className="text-[10px] text-white/30 flex-shrink-0 mt-0.5">
                  {new Date(step.completedAt).toLocaleTimeString()}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
