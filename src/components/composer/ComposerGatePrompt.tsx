// ═══════════════════════════════════════════════════════════════
// ComposerGatePrompt — human-in-the-loop gate for a Composer stage.
// Generalised from chat/ApprovalPrompt: Accept / Reject / Review / Add feature.
// ═══════════════════════════════════════════════════════════════

"use client";

import { ShieldQuestion } from "lucide-react";
import type { ApprovalAction } from "@/lib/composer/schema";

const BUTTONS: { action: ApprovalAction; label: string; className: string }[] = [
  { action: "accept", label: "Accept", className: "border-neon-green/30 bg-neon-green/15 text-neon-green hover:bg-neon-green/25" },
  { action: "reject", label: "Reject", className: "border-neon-pink/30 bg-neon-pink/10 text-neon-pink hover:bg-neon-pink/20" },
  { action: "review", label: "Review", className: "border-white/15 text-white/60 hover:bg-white/5" },
  { action: "add_feature", label: "Add feature", className: "border-neon-cyan/30 bg-neon-cyan/10 text-neon-cyan hover:bg-neon-cyan/20" },
];

export default function ComposerGatePrompt({
  nodeLabel,
  busy,
  onAction,
}: {
  nodeLabel: string;
  busy?: boolean;
  onAction: (action: ApprovalAction) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-neon-yellow/30 bg-neon-yellow/[0.08] px-4 py-2.5">
      <ShieldQuestion className="h-4 w-4 shrink-0 text-neon-yellow" />
      <span className="text-xs text-white/70">
        Gate at <span className="font-mono text-neon-yellow">{nodeLabel}</span> — your call:
      </span>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {BUTTONS.map((b) => (
          <button
            key={b.action}
            type="button"
            disabled={busy}
            onClick={() => onAction(b.action)}
            className={`rounded-md border px-3 py-1 text-xs font-mono transition disabled:opacity-40 ${b.className}`}
          >
            {b.label}
          </button>
        ))}
      </div>
    </div>
  );
}
