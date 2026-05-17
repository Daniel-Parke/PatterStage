// ═══════════════════════════════════════════════════════════════
// Kanban Toolbar — Search, filters, actions
// ═══════════════════════════════════════════════════════════════

"use client";

import { Search, Zap, Archive } from "lucide-react";
import Button from "@/components/ui/Button";

interface HermesKanbanToolbarProps {
  search: string;
  onSearchChange: (v: string) => void;
  assigneeFilter: string;
  onAssigneeFilterChange: (v: string) => void;
  assignees: string[];
  showArchived: boolean;
  onToggleArchived: () => void;
  onNudge: () => void;
}

export default function HermesKanbanToolbar({
  search,
  onSearchChange,
  assigneeFilter,
  onAssigneeFilterChange,
  assignees,
  showArchived,
  onToggleArchived,
  onNudge,
}: HermesKanbanToolbarProps) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search tasks..."
          className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-neon-purple/50 transition-colors font-mono"
        />
      </div>

      {/* Assignee filter */}
      <select
        value={assigneeFilter}
        onChange={(e) => onAssigneeFilterChange(e.target.value)}
        className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 outline-none focus:border-neon-purple/50 transition-colors font-mono cursor-pointer appearance-none"
      >
        <option value="">All assignees</option>
        {assignees.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>

      {/* Show archived toggle */}
      <button
        onClick={onToggleArchived}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-mono transition-colors ${
          showArchived
            ? "bg-white/10 border-white/20 text-white/80"
            : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white/60"
        }`}
      >
        <Archive className="w-3.5 h-3.5" />
        <span>Archived</span>
      </button>

      {/* Nudge dispatcher */}
      <Button
        variant="secondary"
        color="purple"
        size="sm"
        icon={Zap}
        onClick={onNudge}
      >
        Nudge
      </Button>
    </div>
  );
}
