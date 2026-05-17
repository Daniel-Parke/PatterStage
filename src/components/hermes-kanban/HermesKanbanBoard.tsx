// ═══════════════════════════════════════════════════════════════
// Kanban Board — Main board with all columns
// ═══════════════════════════════════════════════════════════════
// Groups tasks by status into 7 columns. Supports drag-and-drop
// between columns, triage "specify all", and board awareness.

"use client";

import { useMemo, useCallback } from "react";
import HermesKanbanColumn from "./HermesKanbanColumn";

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

interface HermesKanbanBoardProps {
  tasks: KanbanTask[];
  onCardClick: (task: KanbanTask) => void;
  onInlineCreate: (status: string, title: string) => void;
  onDropCard?: (taskId: string, newStatus: string) => void;
  onSpecifyAll?: (status: string) => void;
}

interface ColumnDef {
  status: string;
  label: string;
  color: string;
}

const COLUMNS: ColumnDef[] = [
  { status: "triage", label: "Triage", color: "text-neon-purple" },
  { status: "todo", label: "To Do", color: "text-neon-orange" },
  { status: "ready", label: "Ready", color: "text-neon-cyan" },
  { status: "running", label: "Running", color: "text-neon-green" },
  { status: "blocked", label: "Blocked", color: "text-neon-red" },
  { status: "done", label: "Done", color: "text-neon-green/60" },
  { status: "archived", label: "Archived", color: "text-white/30" },
];

export default function HermesKanbanBoard({
  tasks,
  onCardClick,
  onInlineCreate,
  onDropCard,
  onSpecifyAll,
}: HermesKanbanBoardProps) {
  const groupedTasks = useMemo(() => {
    const map = new Map<string, KanbanTask[]>();
    for (const col of COLUMNS) {
      map.set(col.status, []);
    }
    for (const task of tasks) {
      const existing = map.get(task.status);
      if (existing) {
        existing.push(task);
      } else {
        map.get("triage")!.push(task);
      }
    }
    return map;
  }, [tasks]);

  const handleDropCard = useCallback(
    (taskId: string, newStatus: string) => {
      if (onDropCard) {
        onDropCard(taskId, newStatus);
      }
    },
    [onDropCard],
  );

  return (
    <div className="flex gap-4 pb-6 overflow-x-auto">
      {COLUMNS.map((col) => (
        <HermesKanbanColumn
          key={col.status}
          status={col.status}
          label={col.label}
          color={col.color}
          tasks={groupedTasks.get(col.status) || []}
          onCardClick={onCardClick}
          onCreateCard={onInlineCreate}
          onDropCard={handleDropCard}
          onSpecifyAll={onSpecifyAll}
        />
      ))}
    </div>
  );
}
