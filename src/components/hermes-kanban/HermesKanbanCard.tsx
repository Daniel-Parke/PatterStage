// ═══════════════════════════════════════════════════════════════
// Kanban Card — Individual task card on the board
// ═══════════════════════════════════════════════════════════════
// Shows: short ID, priority badge, title, assignee, body indicator,
// comment count, run count, created timestamp, workspace indicator,
// failure warning, blocked indicator.
// Supports HTML5 drag-and-drop.

"use client";

import { useEffect, useRef } from "react";
import { MessageSquare, Play, Clock, AlertTriangle, Ban } from "lucide-react";
import { timeAgo } from "@/lib/utils";

interface KanbanTask {
  id: string;
  title: string;
  body: string | null;
  assignee: string | null;
  status: string;
  priority: number;
  tenant: string | null;
  created_at: number;
  updated_at: number;
  result: string | null;
  max_runtime_seconds: number | null;
  skills: string | null;
  spawn_failures?: number;
  consecutive_failures?: number;
  workspace_kind?: string | null;
}

interface HermesKanbanCardProps {
  task: KanbanTask;
  onClick: () => void;
  /** Comment count — passed separately since list query may not include comments. */
  commentCount?: number;
  /** Run count. */
  runCount?: number;
  /** Index within the column for drag ordering. */
  _index?: number;
}

const priorityColors: Record<number, string> = {
  1: "text-white/40",
  2: "text-white/40",
  3: "text-neon-cyan",
  4: "text-neon-orange",
  5: "text-neon-red",
};

function getPriorityColor(p: number): string {
  if (p >= 5) return priorityColors[5];
  if (p >= 4) return priorityColors[4];
  if (p >= 3) return priorityColors[3];
  return priorityColors[1];
}

const workspaceIcons: Record<string, string> = {
  scratch: "📁",
  dir: "📂",
  worktree: "🌿",
};

export default function HermesKanbanCard({
  task,
  onClick,
  commentCount,
  runCount,
  _index = 0,
}: HermesKanbanCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const shortId = task.id.slice(0, 8);
  const hasBody = !!task.body;
  const isBlocked = task.status === "blocked";
  const hasFailures = (task.spawn_failures ?? 0) > 0 || (task.consecutive_failures ?? 0) > 0;
  const createdAgo = typeof task.created_at === "number"
    ? timeAgo(new Date(task.created_at * 1000).toISOString())
    : "";
  const wsIcon = task.workspace_kind ? workspaceIcons[task.workspace_kind] || "📄" : null;

  // HTML5 drag
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("text/plain", task.id);
    e.dataTransfer.effectAllowed = "move";
    cardRef.current?.classList.add("opacity-50");
  };
  const handleDragEnd = () => {
    cardRef.current?.classList.remove("opacity-50");
  };

  useEffect(() => {
    // Clean up on unmount
    const el = cardRef.current;
    return () => {
      el?.classList.remove("opacity-50");
    };
  }, []);

  return (
    <div
      ref={cardRef}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={onClick}
      className={`
        w-full text-left bg-white/5 border rounded-lg p-3 cursor-pointer
        transition-all duration-150 group
        hover:bg-white/10
        ${isBlocked ? "border-neon-red/30" : "border-white/10 hover:border-white/20"}
        ${hasFailures ? "ring-1 ring-neon-orange/40" : ""}
      `}
    >
      {/* Top row: ID, priority, warnings */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[10px] font-mono text-white/30 uppercase tracking-wider shrink-0">
            #{shortId}
          </span>
          {/* Workspace indicator */}
          {wsIcon && (
            <span className="text-[10px]" title={`Workspace: ${task.workspace_kind}`}>
              {wsIcon}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {/* Failure warning */}
          {hasFailures && (
            <span
              className="text-neon-orange/70"
              title={`${task.spawn_failures ?? 0} spawn failures, ${task.consecutive_failures ?? 0} consecutive`}
            >
              <AlertTriangle className="w-3 h-3" />
            </span>
          )}
          {/* Blocked indicator */}
          {isBlocked && (
            <span className="text-neon-red/70" title="Blocked">
              <Ban className="w-3 h-3" />
            </span>
          )}
          <span className={`text-[10px] font-mono font-bold ${getPriorityColor(task.priority)}`}>
            P{task.priority}
          </span>
        </div>
      </div>

      {/* Title */}
      <p className="text-sm text-white/80 leading-snug line-clamp-2 mb-2 group-hover:text-white transition-colors">
        {task.title}
      </p>

      {/* Bottom row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {/* Assignee */}
          {task.assignee ? (
            <span className="text-[10px] font-mono text-white/40 bg-white/5 px-1.5 py-0.5 rounded truncate max-w-[100px]">
              {task.assignee}
            </span>
          ) : (
            <span className="text-[10px] font-mono text-white/20 italic">unassigned</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Body indicator */}
          {hasBody && (
            <span className="text-[10px] text-white/30">
              <MessageSquare className="w-3 h-3" />
            </span>
          )}
          {/* Comment count */}
          {typeof commentCount === "number" && commentCount > 0 && (
            <span className="text-[10px] text-white/40 font-mono flex items-center gap-0.5">
              <MessageSquare className="w-2.5 h-2.5" />
              {commentCount}
            </span>
          )}
          {/* Run count */}
          {typeof runCount === "number" && runCount > 0 && (
            <span className="text-[10px] text-white/40 font-mono flex items-center gap-0.5" title="Run attempts">
              <Play className="w-2.5 h-2.5" />
              {runCount}
            </span>
          )}
          {/* Created timestamp */}
          {createdAgo && (
            <span className="text-[10px] text-white/30 font-mono flex items-center gap-0.5">
              <Clock className="w-2.5 h-2.5" />
              {createdAgo}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
