// ═══════════════════════════════════════════════════════════════
// Kanban Column — Single status column on the board
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState } from "react";
import { Plus, X, Check } from "lucide-react";
import HermesKanbanCard from "./HermesKanbanCard";

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

interface HermesKanbanColumnProps {
  status: string;
  label: string;
  color: string;
  tasks: KanbanTask[];
  onCardClick: (task: KanbanTask) => void;
  onCreateCard: (status: string, title: string) => void;
}

/** Map a tailwind text color class to its border equivalent. */
function textToBorder(textClass: string): string {
  const color = textClass.replace("text-", "border-");
  return color;
}

export default function HermesKanbanColumn({
  status,
  label,
  color,
  tasks,
  onCardClick,
  onCreateCard,
}: HermesKanbanColumnProps) {
  const [showInlineInput, setShowInlineInput] = useState(false);
  const [inlineTitle, setInlineTitle] = useState("");

  const handleSubmit = () => {
    const trimmed = inlineTitle.trim();
    if (trimmed) {
      onCreateCard(status, trimmed);
      setInlineTitle("");
      setShowInlineInput(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === "Escape") {
      setShowInlineInput(false);
      setInlineTitle("");
    }
  };

  const borderClass = textToBorder(color);

  return (
    <div
      className={`flex flex-col bg-white/[0.02] border border-white/10 rounded-xl min-w-[280px] max-w-[320px] flex-shrink-0 border-t-2 ${borderClass}/50`}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 rounded-t-xl">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${color}`} />
          <h3 className="text-sm font-semibold text-white/80">{label}</h3>
          <span className="text-xs font-mono text-white/30 bg-white/5 px-1.5 py-0.5 rounded">
            {tasks.length}
          </span>
        </div>
        <button
          onClick={() => setShowInlineInput(true)}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 text-white/30 hover:text-white/60 transition-colors"
          title={`Create task in ${label}`}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Inline create input */}
      {showInlineInput && (
        <div className="px-3 pt-2">
          <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
            <input
              type="text"
              value={inlineTitle}
              onChange={(e) => setInlineTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Task title..."
              className="flex-1 bg-transparent text-sm text-white placeholder-white/30 outline-none font-mono"
              autoFocus
            />
            <button
              onClick={handleSubmit}
              disabled={!inlineTitle.trim()}
              className="w-5 h-5 flex items-center justify-center rounded hover:bg-neon-green/20 text-neon-green/60 hover:text-neon-green disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                setShowInlineInput(false);
                setInlineTitle("");
              }}
              className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 text-white/30 hover:text-white/60 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[calc(100vh-280px)]">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-xs text-white/20 italic">No tasks</p>
          </div>
        ) : (
          tasks.map((task) => (
            <HermesKanbanCard
              key={task.id}
              task={task}
              onClick={() => onCardClick(task)}
            />
          ))
        )}
      </div>
    </div>
  );
}
