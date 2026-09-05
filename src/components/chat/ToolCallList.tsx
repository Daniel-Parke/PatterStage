// ═══════════════════════════════════════════════════════════════
// ToolCallList — compact cards for the tools an agent turn invoked.
// Each card shows the tool name + a status chip (running / done / failed /
// awaiting approval). Streamed from the run's tool.* events.
// ═══════════════════════════════════════════════════════════════

import { Wrench, Check, X, Loader2, ShieldQuestion } from "lucide-react";
import type { ToolCall } from "@/types/chat";

const STATUS_META: Record<
  ToolCall["status"],
  { label: string; className: string; Icon: typeof Check }
> = {
  invoked: { label: "running", className: "text-neon-cyan", Icon: Loader2 },
  completed: { label: "done", className: "text-neon-green", Icon: Check },
  failed: { label: "failed", className: "text-neon-red", Icon: X },
  approval_required: { label: "awaiting approval", className: "text-neon-yellow", Icon: ShieldQuestion },
};

export default function ToolCallList({ toolCalls }: { toolCalls: ToolCall[] }) {
  return (
    <div className="mb-2 space-y-1">
      {toolCalls.map((tc, i) => {
        const meta = STATUS_META[tc.status];
        const Icon = meta.Icon;
        return (
          <div
            key={`${tc.name}-${i}`}
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5"
          >
            <Wrench className="h-3 w-3 text-ps-text-muted" />
            <span className="font-mono text-xs text-ps-text-secondary">{tc.name}</span>
            <span className={`ml-auto flex items-center gap-1 text-xs font-mono ${meta.className}`}>
              <Icon className={`h-3 w-3 ${tc.status === "invoked" ? "animate-spin" : ""}`} />
              {meta.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
