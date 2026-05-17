// ═══════════════════════════════════════════════════════════════
// Goals Page — Persistent goals tracking
// ═══════════════════════════════════════════════════════════════

"use client";

import { Target } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import GoalsList from "@/components/goals/GoalsList";

export default function GoalsPage() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader
        icon={Target}
        title="Goals"
        subtitle="Persistent goals with checkpoints and kanban task tracking"
        color="green"
      />

      <div className="flex-1 overflow-y-auto p-6">
        <GoalsList />
      </div>
    </div>
  );
}
