// ═══════════════════════════════════════════════════════════════
// ComposerClarifyPrompt — answer a stage's clarification question
//
// Shown in the run canvas when a stage paused to ask the user something (the run
// is awaiting_approval with a `__clarify` context marker). Submitting the answer
// enriches the objective and re-runs the asking stage. Sibling of
// ComposerGatePrompt (the approve/reject gate).
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState } from "react";
import { HelpCircle } from "lucide-react";

export default function ComposerClarifyPrompt({
  question,
  busy,
  onSubmit,
}: {
  question: string;
  busy?: boolean;
  onSubmit: (answer: string) => void;
}) {
  const [answer, setAnswer] = useState("");
  return (
    <div className="space-y-2 rounded-lg border border-neon-cyan/30 bg-neon-cyan/[0.08] px-3 py-2.5">
      <div className="flex items-start gap-2">
        <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-neon-cyan" />
        <span className="text-xs text-ps-text-primary">{question}</span>
      </div>
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        rows={3}
        placeholder="Your answer…"
        className="w-full rounded border border-white/10 bg-dark-950/60 px-2 py-1 text-xs text-ps-text-primary placeholder:text-ps-text-faint focus:border-neon-cyan/40 focus:outline-none"
      />
      <button
        type="button"
        disabled={busy || answer.trim().length === 0}
        onClick={() => onSubmit(answer.trim())}
        className="w-full rounded-md border border-neon-cyan/30 bg-neon-cyan/15 px-3 py-1 text-xs font-mono text-neon-cyan transition hover:bg-neon-cyan/25 disabled:opacity-40"
      >
        Submit answer
      </button>
    </div>
  );
}
