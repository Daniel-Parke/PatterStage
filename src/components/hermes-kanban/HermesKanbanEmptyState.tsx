// ═══════════════════════════════════════════════════════════════
// Kanban Empty State
// ═══════════════════════════════════════════════════════════════

"use client";

import { Kanban } from "lucide-react";
import Button from "@/components/ui/Button";

interface HermesKanbanEmptyStateProps {
  onCreateTask: () => void;
}

export default function HermesKanbanEmptyState({
  onCreateTask,
}: HermesKanbanEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-4">
      <div className="w-16 h-16 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
        <Kanban className="w-8 h-8 text-white/30" />
      </div>
      <h3 className="text-lg font-semibold text-white/60 mb-1">
        No tasks yet
      </h3>
      <p className="text-sm text-white/40 mb-6 text-center max-w-xs">
        Create your first kanban task to start tracking work on the board.
      </p>
      <Button variant="primary" color="purple" onClick={onCreateTask}>
        Create your first task
      </Button>
    </div>
  );
}
