// ═══════════════════════════════════════════════════════════════
// GoalDetailPanel — Detail drawer with checkpoints + linked tasks
// ═══════════════════════════════════════════════════════════════
// Full detail view for a single goal, sliding in from the right.
// Shows metadata, progress bar, checkpoints, linked tasks.

"use client";

import { useState, useCallback } from "react";
import {
  X, Target, Calendar, Flag, Edit3, Trash2, ChevronRight,
} from "lucide-react";
import GoalCheckpointList from "./GoalCheckpointList";
import GoalKanbanLinker from "./GoalKanbanLinker";
import type { GoalDetail } from "@/lib/goals-bridge";
import { timeAgo } from "@/lib/utils";

interface GoalDetailPanelProps {
  goal: GoalDetail | null;
  onClose: () => void;
  /** Called after any mutation (checkpoints, links, delete). */
  onRefresh: (goalId: string) => void;
  /** Called when user wants to edit the goal. */
  onEdit: (goal: GoalDetail) => void;
  /** Called when goal is deleted. */
  onDelete: (goalId: string) => void;
}

const STATUS_STYLES: Record<string, string> = {
  active: "text-neon-cyan bg-neon-cyan/10 border-neon-cyan/20",
  in_progress: "text-neon-purple bg-neon-purple/10 border-neon-purple/20",
  completed: "text-neon-green bg-neon-green/10 border-neon-green/20",
  archived: "text-white/40 bg-white/10 border-white/10",
};

const PRIORITY_COLORS: Record<number, string> = {
  1: "text-white/40",
  2: "text-white/50",
  3: "text-neon-cyan",
  4: "text-neon-orange",
  5: "text-neon-red",
};

const PROGRESS_COLORS: Record<string, string> = {
  active: "bg-neon-cyan",
  in_progress: "bg-neon-purple",
  completed: "bg-neon-green",
  archived: "bg-white/30",
};

export default function GoalDetailPanel({
  goal,
  onClose,
  onRefresh,
  onEdit,
  onDelete,
}: GoalDetailPanelProps) {
  const [deleting, setDeleting] = useState(false);

  // ── API helpers ─────────────────────────────────────────────

  const apiCall = useCallback(
    async (method: string, path: string, body?: unknown): Promise<boolean> => {
      if (!goal) return false;
      try {
        const res = await fetch(`/api/orchestration/goals/${goal.id}${path}`, {
          method,
          headers: { "Content-Type": "application/json" },
          body: body ? JSON.stringify(body) : undefined,
        });
        return res.ok;
      } catch {
        return false;
      }
    },
    [goal],
  );

  // ── Checkpoint handlers ─────────────────────────────────────

  const handleToggleCheckpoint = useCallback(
    async (checkpointId: number) => {
      if (!goal) return;
      const ok = await apiCall("PATCH", `/checkpoints/${checkpointId}`);
      if (ok) onRefresh(goal.id);
    },
    [goal, apiCall, onRefresh],
  );

  const handleAddCheckpoint = useCallback(
    async (title: string) => {
      if (!goal) return;
      const ok = await apiCall("POST", "/checkpoints", { title });
      if (ok) onRefresh(goal.id);
    },
    [goal, apiCall, onRefresh],
  );

  const handleRemoveCheckpoint = useCallback(
    async (checkpointId: number) => {
      if (!goal) return;
      const ok = await apiCall("DELETE", `/checkpoints/${checkpointId}`);
      if (ok) onRefresh(goal.id);
    },
    [goal, apiCall, onRefresh],
  );

  // ── Kanban link handlers ────────────────────────────────────

  const handleLinkTask = useCallback(
    async (taskId: string) => {
      if (!goal) return;
      const ok = await apiCall("POST", "/link", { task_id: taskId });
      if (ok) onRefresh(goal.id);
    },
    [goal, apiCall, onRefresh],
  );

  const handleUnlinkTask = useCallback(
    async (taskId: string) => {
      if (!goal) return;
      const ok = await apiCall("DELETE", `/link/${taskId}`);
      if (ok) onRefresh(goal.id);
    },
    [goal, apiCall, onRefresh],
  );

  // ── Delete handler ──────────────────────────────────────────

  const handleDelete = useCallback(async () => {
    if (!goal) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/orchestration/goals/${goal.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        onDelete(goal.id);
        onClose();
      }
    } catch {
      // fail silently
    }
    setDeleting(false);
  }, [goal, onDelete, onClose]);

  if (!goal) return null;

  const statusStyle = STATUS_STYLES[goal.status] || STATUS_STYLES.active;
  const progressColor = PROGRESS_COLORS[goal.status] || PROGRESS_COLORS.active;
  const createdAgo = timeAgo(new Date(goal.created_at * 1000).toISOString());
  const updatedAgo = timeAgo(new Date(goal.updated_at * 1000).toISOString());
  const linkedTaskIds = (goal.linked_tasks || []).map((t) => t.task_id);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="relative w-[540px] max-w-full h-full bg-gray-950 border-l border-white/10 shadow-2xl overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-gray-950/90 backdrop-blur-sm border-b border-white/10">
          <div className="flex items-center gap-2 min-w-0">
            <Target className="w-5 h-5 text-neon-purple shrink-0" />
            <h2 className="text-lg font-bold text-white truncate">
              {goal.title}
            </h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onEdit(goal)}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/40 hover:text-neon-cyan transition-colors"
              title="Edit goal"
            >
              <Edit3 className="w-4 h-4" />
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/40 hover:text-neon-red transition-colors disabled:opacity-30"
              title="Delete goal"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/40 hover:text-white/80 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* ── Status + Priority badges ────────────────────────── */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Status badge */}
            <span
              className={`text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full border ${statusStyle}`}
            >
              {goal.status.replace("_", " ")}
            </span>

            {/* Priority */}
            <span
              className={`text-xs font-mono font-bold ${PRIORITY_COLORS[goal.priority] || "text-white/40"}`}
            >
              P{goal.priority}
            </span>

            {/* Category */}
            {goal.category && (
              <span className="text-[10px] font-mono text-white/40 bg-white/5 px-2 py-0.5 rounded-full">
                {goal.category}
              </span>
            )}
          </div>

          {/* ── Progress Bar ────────────────────────────────────── */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/50 font-mono">Progress</span>
              <span className="text-xs font-mono text-white/70">
                {goal.progress_pct}%
              </span>
            </div>
            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
                style={{ width: `${Math.min(goal.progress_pct, 100)}%` }}
              />
            </div>
          </div>

          {/* ── Description ─────────────────────────────────────── */}
          {goal.description && (
            <div>
              <h3 className="text-xs font-mono text-white/50 mb-1.5 uppercase tracking-wider">
                Description
              </h3>
              <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">
                {goal.description}
              </p>
            </div>
          )}

          {/* ── Metadata ────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 text-xs text-white/40">
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span>Created {createdAgo}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-white/40">
              <ChevronRight className="w-3.5 h-3.5 shrink-0" />
              <span>Updated {updatedAgo}</span>
            </div>
            {goal.mission_id && (
              <div className="flex items-center gap-2 text-xs text-white/40 col-span-2">
                <Flag className="w-3.5 h-3.5 shrink-0" />
                <span className="font-mono text-[10px]">
                  Mission: {goal.mission_id.slice(0, 12)}
                </span>
              </div>
            )}
            {goal.parent_goal_id && (
              <div className="flex items-center gap-2 text-xs text-white/40 col-span-2">
                <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                <span className="font-mono text-[10px]">
                  Parent: {goal.parent_goal_id.slice(0, 12)}
                </span>
              </div>
            )}
          </div>

          {/* ── Separator ───────────────────────────────────────── */}
          <div className="border-t border-white/5" />

          {/* ── Checkpoints ─────────────────────────────────────── */}
          <GoalCheckpointList
            goalId={goal.id}
            checkpoints={goal.checkpoints}
            onToggle={handleToggleCheckpoint}
            onAdd={handleAddCheckpoint}
            onRemove={handleRemoveCheckpoint}
          />

          {/* ── Separator ───────────────────────────────────────── */}
          <div className="border-t border-white/5" />

          {/* ── Linked Kanban Tasks ─────────────────────────────── */}
          <GoalKanbanLinker
            linkedTaskIds={linkedTaskIds}
            onLink={handleLinkTask}
            onUnlink={handleUnlinkTask}
          />
        </div>
      </div>
    </div>
  );
}
