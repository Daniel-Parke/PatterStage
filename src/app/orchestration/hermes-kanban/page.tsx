// ═══════════════════════════════════════════════════════════════
// Hermes Kanban Board Page
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Kanban, Plus } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useToast } from "@/components/ui/Toast";
import HermesKanbanBoard from "@/components/hermes-kanban/HermesKanbanBoard";
import HermesKanbanToolbar from "@/components/hermes-kanban/HermesKanbanToolbar";
import HermesKanbanDrawer from "@/components/hermes-kanban/HermesKanbanDrawer";
import HermesKanbanCreateModal from "@/components/hermes-kanban/HermesKanbanCreateModal";
import HermesKanbanEmptyState from "@/components/hermes-kanban/HermesKanbanEmptyState";

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

interface KanbanTaskDetail extends KanbanTask {
  comments: Array<{
    id: number;
    author: string;
    body: string;
    created_at: number;
  }>;
  parents: string[];
  children: string[];
  runs: Array<{
    id: number;
    profile: string | null;
    outcome: string | null;
    summary: string | null;
    started_at: number;
    ended_at: number | null;
    error: string | null;
  }>;
  events: Array<{
    id: number;
    kind: string;
    payload: string | null;
    created_at: number;
  }>;
}

export default function HermesKanbanPage() {
  const { showToast } = useToast();

  const [tasks, setTasks] = useState<KanbanTask[]>([]);
  const [assignees, setAssignees] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<KanbanTaskDetail | null>(
    null
  );
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch tasks ───────────────────────────────────────────
  const fetchTasks = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (assigneeFilter) params.set("assignee", assigneeFilter);
      if (showArchived) params.set("include_archived", "true");
      params.set("limit", "200");

      const res = await fetch(
        `/api/orchestration/hermes-kanban?${params.toString()}`
      );
      const json = await res.json();
      if (json.data?.tasks) {
        setTasks(json.data.tasks);
      }
    } catch {
      // silently fail during polling
    } finally {
      setLoading(false);
    }
  }, [assigneeFilter, showArchived]);

  // ── Fetch assignees ───────────────────────────────────────
  const fetchAssignees = useCallback(async () => {
    try {
      const res = await fetch("/api/orchestration/hermes-kanban/assignees");
      const json = await res.json();
      if (json.data) {
        setAssignees(
          json.data.map((a: { profile: string }) => a.profile)
        );
      }
    } catch {
      // silently fail
    }
  }, []);

  // ── Initial load ──────────────────────────────────────────
  useEffect(() => {
    fetchTasks();
    fetchAssignees();
  }, [fetchTasks, fetchAssignees]);

  // ── Poll every 10s ────────────────────────────────────────
  useEffect(() => {
    pollRef.current = setInterval(fetchTasks, 10000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchTasks]);

  // ── Fetch task detail for drawer ──────────────────────────
  const handleCardClick = useCallback(async (task: KanbanTask) => {
    try {
      const res = await fetch(
        `/api/orchestration/hermes-kanban?id=${task.id}`
      );
      const json = await res.json();
      if (json.data) {
        setSelectedTask(json.data);
      }
    } catch {
      // silently fail
    }
  }, []);

  // ── Refresh drawer detail ─────────────────────────────────
  const handleDrawerUpdate = useCallback(
    async (id: string, _data: Record<string, unknown>) => {
      // Re-fetch the task detail and list
      try {
        const res = await fetch(`/api/orchestration/hermes-kanban?id=${id}`);
        const json = await res.json();
        if (json.data) {
          setSelectedTask(json.data);
        }
      } catch {
        // silently fail
      }
      fetchTasks();
    },
    [fetchTasks]
  );

  // ── Create task ───────────────────────────────────────────
  const handleCreateTask = useCallback(
    async (data: Record<string, unknown>) => {
      try {
        const res = await fetch("/api/orchestration/hermes-kanban", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "create", ...data }),
        });
        const json = await res.json();
        if (res.ok) {
          showToast("Task created successfully", "success");
          setShowCreateModal(false);
          fetchTasks();
        } else {
          showToast(json.error || "Failed to create task", "error");
        }
      } catch {
        showToast("Failed to create task", "error");
      }
    },
    [showToast, fetchTasks]
  );

  // ── Inline create ─────────────────────────────────────────
  const handleInlineCreate = useCallback(
    async (status: string, title: string) => {
      try {
        const res = await fetch("/api/orchestration/hermes-kanban", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "create",
            title,
            status,
          }),
        });
        if (res.ok) {
          showToast("Task created", "success");
          fetchTasks();
        }
      } catch {
        showToast("Failed to create task", "error");
      }
    },
    [showToast, fetchTasks]
  );

  // ── Nudge dispatcher ──────────────────────────────────────
  const handleNudge = useCallback(async () => {
    try {
      const res = await fetch("/api/orchestration/hermes-kanban", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dispatch" }),
      });
      if (res.ok) {
        showToast("Dispatcher nudged", "success");
        // Re-fetch after a brief delay
        setTimeout(fetchTasks, 2000);
      } else {
        const json = await res.json();
        showToast(json.error || "Failed to nudge dispatcher", "error");
      }
    } catch {
      showToast("Failed to nudge dispatcher", "error");
    }
  }, [showToast, fetchTasks]);

  // ── Filter tasks locally ─────────────────────────────────
  const filteredTasks = useMemo(() => {
    if (!searchQuery) return tasks;
    const q = searchQuery.toLowerCase();
    return tasks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q) ||
        (t.body && t.body.toLowerCase().includes(q)) ||
        (t.assignee && t.assignee.toLowerCase().includes(q))
    );
  }, [tasks, searchQuery]);

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        icon={Kanban}
        title="Kanban"
        subtitle="Hermes task board"
        color="purple"
        actions={
          <Button
            variant="primary"
            color="purple"
            icon={Plus}
            onClick={() => setShowCreateModal(true)}
          >
            New Task
          </Button>
        }
      />

      {/* Toolbar */}
      <div className="px-6 py-3 border-b border-white/10">
        <HermesKanbanToolbar
          search={searchQuery}
          onSearchChange={setSearchQuery}
          assigneeFilter={assigneeFilter}
          onAssigneeFilterChange={setAssigneeFilter}
          assignees={assignees}
          showArchived={showArchived}
          onToggleArchived={() => setShowArchived(!showArchived)}
          onNudge={handleNudge}
        />
      </div>

      {/* Board */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <LoadingSpinner text="Loading kanban board..." />
        ) : filteredTasks.length === 0 ? (
          <HermesKanbanEmptyState
            onCreateTask={() => setShowCreateModal(true)}
          />
        ) : (
          <HermesKanbanBoard
            tasks={filteredTasks}
            onCardClick={handleCardClick}
            onInlineCreate={handleInlineCreate}
          />
        )}
      </div>

      {/* Drawer */}
      <HermesKanbanDrawer
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onUpdate={handleDrawerUpdate}
      />

      {/* Create Modal */}
      <HermesKanbanCreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        assignees={assignees}
        onCreate={handleCreateTask}
      />
    </div>
  );
}
