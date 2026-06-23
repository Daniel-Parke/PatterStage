// ═══════════════════════════════════════════════════════════════
// ReasoningPanel — collapsible "thinking" trace for an assistant turn.
// Streamed from the run's reasoning.* events; collapsed by default so the
// reply stays the focus, expandable for operators who want the chain.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState } from "react";
import { Brain, ChevronDown, ChevronRight } from "lucide-react";

export default function ReasoningPanel({ reasoning }: { reasoning: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-2 rounded-lg border border-neon-purple/20 bg-neon-purple/[0.06]">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title="Show the model's thinking trace for this reply"
        className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-mono text-neon-purple/80 hover:text-neon-purple"
      >
        <Brain className="h-3 w-3" />
        <span className="uppercase tracking-wider">Reasoning</span>
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      </button>
      {open && (
        <div className="border-t border-neon-purple/15 px-3 py-2 text-xs leading-relaxed text-white/55 whitespace-pre-wrap">
          {reasoning}
        </div>
      )}
    </div>
  );
}
