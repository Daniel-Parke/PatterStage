// ═══════════════════════════════════════════════════════════════
// Kanban Toolbar — Search, filters, actions
// ═══════════════════════════════════════════════════════════════
// Features: search, assignee filter, status filter, tenant filter,
// archived toggle, specify-all-triage, nudge dispatcher, board dropdown.

"use client";

import { Search, Zap, Archive, Sparkles, Layout } from "lucide-react";
import Button from "@/components/ui/Button";

interface HermesKanbanToolbarProps {
  search: string;
  onSearchChange: (v: string) => void;
  assigneeFilter: string;
  onAssigneeFilterChange: (v: string) => void;
  statusFilter?: string;
  onStatusFilterChange?: (v: string) => void;
  tenantFilter?: string;
  onTenantFilterChange?: (v: string) => void;
  assignees: string[];
  showArchived: boolean;
  onToggleArchived: () => void;
  onNudge: () => void;
  onSpecifyAllTriage?: () => void;
  boards?: Array<{ slug: string; name: string }>;
  activeBoard?: string;
  onBoardChange?: (slug: string) => void;
}

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "triage", label: "Triage" },
  { value: "todo", label: "To Do" },
  { value: "ready", label: "Ready" },
  { value: "running", label: "Running" },
  { value: "blocked", label: "Blocked" },
  { value: "done", label: "Done" },
  { value: "archived", label: "Archived" },
];

export default function HermesKanbanToolbar({
  search,
  onSearchChange,
  assigneeFilter,
  onAssigneeFilterChange,
  statusFilter,
  onStatusFilterChange,
  tenantFilter,
  onTenantFilterChange,
  assignees,
  showArchived,
  onToggleArchived,
  onNudge,
  onSpecifyAllTriage,
  boards,
  activeBoard,
  onBoardChange,
}: HermesKanbanToolbarProps) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Board switcher */}
      {boards && boards.length > 0 && onBoardChange && (
        <div className="flex items-center gap-1.5">
          <Layout className="w-3.5 h-3.5 text-white/40" />
          <select
            value={activeBoard || ""}
            onChange={(e) => onBoardChange(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 outline-none focus:border-neon-purple/50 transition-colors font-mono cursor-pointer appearance-none"
          >
            {boards.map((b) => (
              <option key={b.slug} value={b.slug}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      )}

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

      {/* Status filter */}
      {onStatusFilterChange && (
        <select
          value={statusFilter || ""}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 outline-none focus:border-neon-purple/50 transition-colors font-mono cursor-pointer appearance-none"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}

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

      {/* Tenant filter */}
      {onTenantFilterChange && (
        <input
          type="text"
          value={tenantFilter || ""}
          onChange={(e) => onTenantFilterChange(e.target.value)}
          placeholder="Tenant..."
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-neon-purple/50 transition-colors font-mono max-w-[120px]"
        />
      )}

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

      {/* Specify all triage */}
      {onSpecifyAllTriage && (
        <Button
          variant="secondary"
          color="purple"
          size="sm"
          icon={Sparkles}
          onClick={onSpecifyAllTriage}
        >
          Specify Triage
        </Button>
      )}

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
