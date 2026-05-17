// ═══════════════════════════════════════════════════════════════
// GoalsList — Card grid with progress bars
// ═══════════════════════════════════════════════════════════════
// Displays goals as a responsive card grid with progress bars,
// category/priority badges, status indicators, and hover actions.
// Acts as the main listing view for the goals page.

"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Target, Plus, Filter, ChevronDown, Loader2, RefreshCw,
  CheckCircle2, PlayCircle, Archive, AlertCircle, ListTodo,
} from "lucide-react";
import Button from "@/components/ui/Button";
import GoalDetailPanel from "./GoalDetailPanel";
import GoalCreateModal from "./GoalCreateModal";
import type { Goal, GoalDetail } from "@/lib/goals-bridge";

interface GoalsListProps {
  /** Initial goals data. If omitted, fetches from API. */
  initialGoals?: Goal[];
  /** Fetcher function for refresh. */
  fetchGoals?: (filters?: Record<string, string>) => Promise<Goal[]>;
}

const STATUS_FILTERS = [
  { value: "", label: "All", color: "text-white/60" },
  { value: "active", label: "Active", color: "text-neon-cyan" },
  { value: "in_progress", label: "In Progress", color: "text-neon-purple" },
  { value: "completed", label: "Completed", color: "text-neon-green" },
  { value: "archived", label: "Archived", color: "text-white/40" },
] as const;

const STATUS_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  active: PlayCircle,
  in_progress: ListTodo,
  completed: CheckCircle2,
  archived: Archive,
};

const STATUS_BG: Record<string, string> = {
  active: "bg-neon-cyan/5 border-neon-cyan/15 hover:border-neon-cyan/30",
  in_progress: "bg-neon-purple/5 border-neon-purple/15 hover:border-neon-purple/30",
  completed: "bg-neon-green/5 border-neon-green/15 hover:border-neon-green/30",
  archived: "bg-white/[0.02] border-white/5 hover:border-white/15",
};

const PROGRESS_BAR_COLORS: Record<string, string> = {
  active: "bg-neon-cyan",
  in_progress: "bg-neon-purple",
  completed: "bg-neon-green",
  archived: "bg-white/30",
};

const PRIORITY_COLORS: Record<number, string> = {
  1: "text-white/30",
  2: "text-white/40",
  3: "text-neon-cyan",
  4: "text-neon-orange",
  5: "text-neon-red",
};

export default function GoalsList({
  initialGoals,
  fetchGoals,
}: GoalsListProps) {
  const [goals, setGoals] = useState<Goal[]>(initialGoals ?? []);
  const [loading, setLoading] = useState(!initialGoals);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  // Detail panel
  const [selectedGoal, setSelectedGoal] = useState<GoalDetail | null>(null);

  // Create/Edit modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<GoalDetail | null>(null);

  // ── Fetch goals ────────────────────────────────────────────

  const loadGoals = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      let data: Goal[];
      if (fetchGoals) {
        data = await fetchGoals(statusFilter ? { status: statusFilter } : {});
      } else {
        const params = statusFilter ? `?status=${statusFilter}` : "";
        const res = await fetch(`/api/orchestration/goals${params}`);
        if (!res.ok) throw new Error("Failed to fetch goals");
        const json = await res.json();
        data = json.data?.goals || [];
      }
      setGoals(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load goals");
      setGoals([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, fetchGoals]);

  useEffect(() => {
    if (!initialGoals) {
      loadGoals();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch goal detail ──────────────────────────────────────

  const fetchGoalDetail = useCallback(async (goalId: string) => {
    try {
      const res = await fetch(`/api/orchestration/goals/${goalId}`);
      if (!res.ok) throw new Error("Failed to fetch goal detail");
      const json = await res.json();
      return json.data as GoalDetail;
    } catch {
      return null;
    }
  }, []);

  // ── Handlers ────────────────────────────────────────────────

  const handleCardClick = useCallback(
    async (goal: Goal) => {
      const detail = await fetchGoalDetail(goal.id);
      if (detail) setSelectedGoal(detail);
    },
    [fetchGoalDetail],
  );

  const handleRefreshDetail = useCallback(
    async (goalId: string) => {
      const detail = await fetchGoalDetail(goalId);
      if (detail) setSelectedGoal(detail);
      // Also refresh the list
      loadGoals();
    },
    [fetchGoalDetail, loadGoals],
  );

  const handleEdit = useCallback(
    (goal: GoalDetail) => {
      setEditingGoal(goal);
      setShowCreateModal(true);
    },
    [],
  );

  const handleDelete = useCallback(
    (_goalId: string) => {
      setSelectedGoal(null);
      loadGoals();
    },
    [loadGoals],
  );

  const handleSaved = useCallback(
    (_goal: Goal) => {
      loadGoals();
    },
    [loadGoals],
  );

  const handleCreateNew = useCallback(() => {
    setEditingGoal(null);
    setShowCreateModal(true);
  }, []);

  // ── Render ──────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Target className="w-5 h-5 text-neon-purple" />
            Goals
          </h1>
          {goals.length > 0 && (
            <span className="text-xs font-mono text-white/40 bg-white/5 px-2 py-0.5 rounded-full">
              {goals.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Status filter */}
          <div className="relative">
            <button
              onClick={() => setShowFilterMenu(!showFilterMenu)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white/60 hover:text-white hover:border-white/30 transition-colors font-mono"
            >
              <Filter className="w-3.5 h-3.5" />
              {statusFilter
                ? STATUS_FILTERS.find((f) => f.value === statusFilter)?.label
                : "All"}
              <ChevronDown className="w-3 h-3" />
            </button>
            {showFilterMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowFilterMenu(false)}
                />
                <div className="absolute right-0 top-full mt-1 z-20 w-36 bg-gray-950 border border-white/10 rounded-xl shadow-2xl py-1">
                  {STATUS_FILTERS.map((f) => (
                    <button
                      key={f.value}
                      onClick={() => {
                        setStatusFilter(f.value);
                        setShowFilterMenu(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-xs font-mono transition-colors ${
                        statusFilter === f.value
                          ? `${f.color} bg-white/5`
                          : "text-white/50 hover:bg-white/5 hover:text-white/80"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <Button
            variant="ghost"
            size="sm"
            icon={RefreshCw}
            onClick={loadGoals}
            loading={loading}
          >
            Refresh
          </Button>

          <Button
            variant="primary"
            color="purple"
            size="sm"
            icon={Plus}
            onClick={handleCreateNew}
          >
            New Goal
          </Button>
        </div>
      </div>

      {/* Loading state */}
      {loading && goals.length === 0 && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-neon-purple animate-spin" />
        </div>
      )}

      {/* Error state */}
      {error && !loading && goals.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <AlertCircle className="w-10 h-10 text-neon-red/60 mb-3" />
          <p className="text-sm text-white/50 mb-4">{error}</p>
          <Button variant="primary" color="cyan" size="sm" onClick={loadGoals}>
            Retry
          </Button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && goals.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Target className="w-12 h-12 text-white/20 mb-4" />
          <p className="text-base text-white/40 mb-2">No goals found</p>
          <p className="text-xs text-white/30 mb-5">
            {statusFilter
              ? "No goals match the current filter."
              : "Create your first goal to start tracking progress."}
          </p>
          {!statusFilter && (
            <Button
              variant="primary"
              color="purple"
              size="sm"
              icon={Plus}
              onClick={handleCreateNew}
            >
              Create Goal
            </Button>
          )}
        </div>
      )}

      {/* Card grid */}
      {goals.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {goals.map((goal) => {
            const StatusIcon = STATUS_ICONS[goal.status] || PlayCircle;
            const cardStyle = STATUS_BG[goal.status] || STATUS_BG.active;
            const barColor = PROGRESS_BAR_COLORS[goal.status] || PROGRESS_BAR_COLORS.active;
            // Approximate progress based on status for list view
            const approxProgress =
              goal.status === "completed"
                ? 100
                : goal.status === "in_progress"
                  ? 50
                  : goal.status === "archived"
                    ? 100
                    : 0;

            return (
              <button
                key={goal.id}
                onClick={() => handleCardClick(goal)}
                className={`text-left rounded-xl border p-4 transition-all duration-200 group ${cardStyle}`}
              >
                {/* Top row: icon + priority */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <StatusIcon className="w-4 h-4 shrink-0 text-white/40" />
                    <span className="text-xs font-mono text-white/30 uppercase tracking-wider shrink-0">
                      #{goal.id.slice(0, 8)}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-mono font-bold shrink-0 ${PRIORITY_COLORS[goal.priority] || "text-white/40"}`}
                  >
                    P{goal.priority}
                  </span>
                </div>

                {/* Title */}
                <h3 className="text-sm font-semibold text-white/80 leading-snug mb-2 line-clamp-2 group-hover:text-white transition-colors">
                  {goal.title}
                </h3>

                {/* Category */}
                {goal.category && (
                  <span className="inline-block text-[10px] font-mono text-white/40 bg-white/5 px-1.5 py-0.5 rounded mb-3">
                    {goal.category}
                  </span>
                )}

                {/* Progress bar */}
                <div className="space-y-1 mt-auto">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-white/40">Progress</span>
                    <span className="text-[10px] font-mono text-white/50">{approxProgress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                      style={{ width: `${approxProgress}%` }}
                    />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Detail panel */}
      <GoalDetailPanel
        goal={selectedGoal}
        onClose={() => setSelectedGoal(null)}
        onRefresh={handleRefreshDetail}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {/* Create/Edit modal */}
      <GoalCreateModal
        open={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setEditingGoal(null);
        }}
        goal={editingGoal}
        onSaved={handleSaved}
      />
    </div>
  );
}
