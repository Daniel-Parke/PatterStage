// ═══════════════════════════════════════════════════════════════
// Kanban Board — Main board with all columns
// ═══════════════════════════════════════════════════════════════

"use client";

import { useMemo } from "react";
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
}

interface HermesKanbanBoardProps {
  tasks: KanbanTask[];
  onCardClick: (task: KanbanTask) => void;
  onInlineCreate: (status: string, title: string) => void;
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
        // Unknown status — put in triage
        map.get("triage")!.push(task);
      }
    }
    return map;
  }, [tasks]);

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
        />
      ))}
    </div>
  );
}
