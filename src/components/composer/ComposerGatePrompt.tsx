// ═══════════════════════════════════════════════════════════════
// ComposerGatePrompt — human-in-the-loop gate for a Composer stage.
//
// Accept (→ on_approve) or Reject (→ on_reject), with an optional note. The
// older Review / Add-feature buttons were removed: they were recorded but never
// routed (Review behaved like Reject, Add-feature like Accept), so their effect
// was ambiguous. The note is persisted on the approval.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState } from "react";
import { ShieldQuestion } from "lucide-react";

import ConceptHint from "@/components/help/ConceptHint";

export type GateDecision = "accept" | "reject";

export default function ComposerGatePrompt({
  nodeLabel,
  busy,
  onAction,
}: {
  nodeLabel: string;
  busy?: boolean;
  onAction: (action: GateDecision, note?: string) => void;
}) {
  const [note, setNote] = useState("");
  const decide = (action: GateDecision) => onAction(action, note.trim() || undefined);

  return (
    <div className="space-y-2 rounded-lg border border-neon-yellow/30 bg-neon-yellow/[0.08] px-3 py-2.5">
      <div className="flex items-center gap-2">
        <ShieldQuestion className="h-4 w-4 shrink-0 text-neon-yellow" />
        {/* The one moment the word costs something: the chain is stopped here
            until the operator answers, so this is where it is explained. */}
        <span className="text-xs text-ps-text-secondary">
          <ConceptHint id="gate">Gate</ConceptHint> at{" "}
          <span className="font-mono text-neon-yellow">{nodeLabel}</span> — your call:
        </span>
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="Optional note (e.g. what to change on reject)…" aria-label="Gate note"
        className="w-full rounded border border-white/10 bg-dark-950/60 px-2 py-1 text-xs text-ps-text-primary placeholder:text-ps-text-faint focus:border-neon-yellow/40 focus:outline-none"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => decide("accept")}
          className="flex-1 rounded-md border border-neon-green/30 bg-neon-green/15 px-3 py-1 text-xs font-mono text-neon-green transition hover:bg-neon-green/25 disabled:opacity-40"
        >
          Accept
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => decide("reject")}
          className="flex-1 rounded-md border border-neon-pink/30 bg-neon-pink/10 px-3 py-1 text-xs font-mono text-neon-pink transition hover:bg-neon-pink/20 disabled:opacity-40"
        >
          Reject
        </button>
      </div>
    </div>
  );
}
