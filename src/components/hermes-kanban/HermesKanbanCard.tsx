// ═══════════════════════════════════════════════════════════════
// Kanban Card — Individual task card on the board
// ═══════════════════════════════════════════════════════════════

"use client";

import { MessageSquare } from "lucide-react";

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
}

interface HermesKanbanCardProps {
  task: KanbanTask;
  onClick: () => void;
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

export default function HermesKanbanCard({
  task,
  onClick,
}: HermesKanbanCardProps) {
  const shortId = task.id.slice(0, 8);
  const hasBody = !!task.body;

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white/5 border border-white/10 rounded-lg p-3 hover:bg-white/10 hover:border-white/20 transition-all duration-150 cursor-pointer group"
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="text-[10px] font-mono text-white/30 uppercase tracking-wider shrink-0">
          #{shortId}
        </span>
        <span
          className={`text-[10px] font-mono font-bold shrink-0 ${getPriorityColor(task.priority)}`}
        >
          P{task.priority}
        </span>
      </div>
      <p className="text-sm text-white/80 leading-snug line-clamp-2 mb-2 group-hover:text-white transition-colors">
        {task.title}
      </p>
      <div className="flex items-center justify-between gap-2">
        {task.assignee ? (
          <span className="text-[10px] font-mono text-white/40 bg-white/5 px-1.5 py-0.5 rounded truncate max-w-[120px]">
            {task.assignee}
          </span>
        ) : (
          <span className="text-[10px] font-mono text-white/20 italic">
            unassigned
          </span>
        )}
        {hasBody && (
          <span className="text-[10px] text-white/30 flex items-center gap-1 shrink-0">
            <MessageSquare className="w-3 h-3" />
          </span>
        )}
      </div>
    </button>
  );
}
