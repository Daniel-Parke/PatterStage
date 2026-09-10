// ═══════════════════════════════════════════════════════════════
// ComposerGatePrompt — human-in-the-loop gate for a Composer stage.
//
// Accept (→ on_approve) or Reject (→ on_reject), with an optional note. The
// older Review / Add-feature buttons were removed: they were recorded but never
// routed (Review behaved like Reject, Add-feature like Accept), so their effect
// was ambiguous. The note is persisted on the approval.
//
// The panel also shows the work: the stage's output and the verdict a reviewing
// stage reached on it. It used to take a label and nothing else, so the one
// question the product stops everything to ask was asked with nothing on screen
// to answer it by. The evidence was in the stage sheet, which is a modal dialog
// with a full-viewport backdrop, and opening it covers this panel, so reading the
// work and deciding on it could not be done at the same time.
// ═══════════════════════════════════════════════════════════════

"use client";

import { sectionHeadingClasses } from "@/lib/theme";
import { useState } from "react";
import { ShieldQuestion } from "lucide-react";

import { Panel } from "@/components/dashboard/Panel";
import Button from "@/components/ui/Button";
import { Textarea } from "@/components/ui/field";
import ConceptHint from "@/components/help/ConceptHint";
import type { NodeVerdict } from "@/lib/composer/schema";

export type GateDecision = "accept" | "reject";

function Label({ children }: { children: React.ReactNode }) {
  return <h3 className={sectionHeadingClasses}>{children}</h3>;
}

export default function ComposerGatePrompt({
  nodeLabel,
  output,
  verdict,
  busy,
  onAction,
}: {
  nodeLabel: string;
  /** What the stage being decided on produced. */
  output?: string | null;
  /** The verdict that stage reached, when it is a kind that reaches one. */
  verdict?: NodeVerdict | null;
  busy?: boolean;
  onAction: (action: GateDecision, note?: string) => void;
}) {
  const [note, setNote] = useState("");
  const decide = (action: GateDecision) => onAction(action, note.trim() || undefined);
  const body = (output ?? "").trim();

  return (
    // The accented surface, in the gate's yellow: the chain is stopped on this
    // panel until the operator answers, and the tint is how it says so.
    <Panel accent="yellow" tint="yellow" className="space-y-2 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <ShieldQuestion className="h-4 w-4 shrink-0 text-neon-yellow" />
        {/* The one moment the word costs something: the chain is stopped here
            until the operator answers, so this is where it is explained. */}
        <span className="text-body text-ps-text-secondary">
          <ConceptHint id="gate">Gate</ConceptHint> at{" "}
          <span className="font-mono text-neon-yellow">{nodeLabel}</span> — your call:
        </span>
      </div>

      {/* A stage may reach a verdict and still be a gate: the model advises,
          the person decides. A FAIL here is the reviewer's opinion, not the end
          of the run, so it is shown rather than acted on. */}
      {verdict ? (
        <div className="space-y-1">
          <Label>Verdict</Label>
          <span className={`font-mono text-micro ${verdict.pass ? "text-neon-green" : "text-neon-pink"}`}>
            {verdict.pass ? "PASS" : "FAIL"}
          </span>
          {verdict.reasons.length > 0 ? (
            <ul className="space-y-1 text-body text-ps-text-secondary">
              {verdict.reasons.map((r, i) => (
                <li key={i} className="flex gap-1.5">
                  <span className="text-ps-text-faint">•</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-1">
        <Label>What this stage produced</Label>
        {body ? (
          <pre className="max-h-44 overflow-auto whitespace-pre-wrap break-words rounded-ps-md bg-ps-surface-inset px-2 py-1.5 text-body leading-relaxed text-ps-text-secondary">
            {body}
          </pre>
        ) : (
          <p className="text-body text-ps-text-muted">This stage recorded no output.</p>
        )}
      </div>

      <Textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="Optional note (e.g. what to change on reject)…"
        aria-label="Gate note"
      />
      <div className="flex items-center gap-2">
        <Button variant="primary" color="green" size="sm" className="flex-1" disabled={busy} onClick={() => decide("accept")}>
          Accept
        </Button>
        <Button variant="primary" color="pink" size="sm" className="flex-1" disabled={busy} onClick={() => decide("reject")}>
          Reject
        </Button>
      </div>
    </Panel>
  );
}
