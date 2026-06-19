// ═══════════════════════════════════════════════════════════════
// ApprovalPrompt — HITL gate for a tool the agent wants to run.
// Shown above the composer when a run emits an approval-required event;
// Approve/Deny forwards to runtime.resolveApproval via the chat API.
// ═══════════════════════════════════════════════════════════════

"use client";

import { ShieldQuestion } from "lucide-react";

export default function ApprovalPrompt({
  toolName,
  onApprove,
  onDeny,
}: {
  toolName: string;
  onApprove: () => void;
  onDeny: () => void;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-neon-yellow/30 bg-neon-yellow/[0.08] px-4 py-2.5">
      <ShieldQuestion className="h-4 w-4 text-neon-yellow shrink-0" />
      <span className="text-xs text-white/70">
        The agent wants to run <span className="font-mono text-neon-yellow">{toolName}</span>. Allow it?
      </span>
      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={onDeny}
          className="rounded-md border border-white/15 px-3 py-1 text-xs font-mono text-white/60 hover:bg-white/5"
        >
          Deny
        </button>
        <button
          onClick={onApprove}
          className="rounded-md border border-neon-green/30 bg-neon-green/15 px-3 py-1 text-xs font-mono text-neon-green hover:bg-neon-green/25"
        >
          Approve
        </button>
      </div>
    </div>
  );
}
