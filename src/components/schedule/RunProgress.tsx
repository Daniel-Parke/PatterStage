// ═══════════════════════════════════════════════════════════════
// RunProgress — live SSE view of an in-flight agent run
// ═══════════════════════════════════════════════════════════════

"use client";

import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useRunProgress } from "@/hooks/useRunProgress";

export default function RunProgress({ runId }: { runId: string }) {
  const { text, status, events, error } = useRunProgress(runId);

  const icon =
    status === "done" ? (
      <CheckCircle2 className="w-4 h-4 text-neon-green" />
    ) : status === "error" ? (
      <XCircle className="w-4 h-4 text-red-400" />
    ) : (
      <Loader2 className="w-4 h-4 text-neon-cyan animate-spin" />
    );

  return (
    <div className="rounded-xl border border-white/10 bg-dark-900/40 p-4">
      <div className="flex items-center gap-2 mb-2 text-xs font-mono text-ps-text-muted">
        {icon}
        <span>live run · {status}</span>
        <span className="ml-auto text-ps-text-faint">{events.length} events</span>
      </div>
      {error && <div className="text-xs text-red-300 mb-2 font-mono">{error}</div>}
      <pre className="text-xs text-ps-text-secondary font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
        {text || "(waiting for output…)"}
      </pre>
    </div>
  );
}
