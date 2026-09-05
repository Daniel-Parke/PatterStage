// ═══════════════════════════════════════════════════════════════
// composer/verdict.ts — extract a PASS/FAIL verdict from a stage's output
//
// Assessing stages (validate / test / *_test / final_assessment) end their
// output with a structured marker so the engine can route on_pass / on_fail.
// Convention (instructed by the stage prompt):
//   VERDICT: PASS            (or FAIL)
//   REASONS: a; b; c         (optional)
//   SUGGESTIONS: x; y        (optional)
//   OUTCOME: further_research (optional — a branch label; routes on_<label>)
// Non-assessing stages have no verdict — they simply proceed (pass = true),
// unless they emit an OUTCOME marker to choose a branch.
// ═══════════════════════════════════════════════════════════════

import { stripReasoning } from "@/lib/llm-output";
import type { NodeVerdict } from "./schema";

/** Stage kinds that emit a PASS/FAIL verdict (drive conditional routing). */
const ASSESSING_KINDS = new Set<string>([
  "validate",
  "test",
  "unit_test",
  "integration_test",
  "acceptance_test",
  "final_assessment",
  "review",
]);

export function isAssessingKind(kind: string): boolean {
  return ASSESSING_KINDS.has(kind);
}

function splitList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[;\n]/)
    .map((s) => s.replace(/^[-*\d.\s]+/, "").trim())
    .filter(Boolean);
}

/**
 * The verdict marker, refusing the instruction template.
 *
 * The stage prompt tells the model to end with "VERDICT: PASS or FAIL". A plain
 * /VERDICT:\s*(PASS|FAIL)/ matches that sentence and captures PASS, so a model
 * that echoed its own instructions instead of judging anything scored a pass.
 * The lookahead rejects the template while still accepting a real verdict
 * followed by other text.
 */
const VERDICT_RE = /VERDICT:\s*(PASS|FAIL)\b(?!\s*(?:or|\/)\s*(?:PASS|FAIL)\b)/i;

/**
 * Parse a verdict from stage output. Returns null when the stage is
 * non-assessing AND no explicit marker is present (→ the engine treats it as a
 * pass). A failed run (no output) should be handled by the caller (pass=false).
 *
 * An ASSESSING stage that emits no verdict FAILS. It used to pass: `pass` fell
 * back to `true` whenever the marker was absent, so a test stage that ran out of
 * tokens, returned prose, or crashed into an empty string was indistinguishable
 * from one that had actually verified something. A gate that cannot tell those
 * apart is not a gate — the whole point of an assessing stage is that it has to
 * say so explicitly.
 */
export function parseVerdict(output: string | null, kind: string): NodeVerdict | null {
  // Strip <think>/<reasoning>/<scratchpad> blocks BEFORE looking for any marker.
  // A verdict a model weighed inside its own deliberation was never concluded,
  // and reading one out of there routed on_pass for a stage that said FAIL.
  // Applies to every marker below, not just VERDICT: an OUTCOME the model was
  // only considering must not steer the graph either.
  const text = stripReasoning(output ?? "");
  const verdictM = text.match(VERDICT_RE);
  const reasonsM = text.match(/REASONS?:\s*(.+)/i);
  const suggM = text.match(/SUGGESTIONS?:\s*(.+)/i);
  const outcomeM = text.match(/(?:OUTCOME|ROUTE):\s*([A-Za-z0-9_-]+)/i);
  const questionM = text.match(/QUESTION:\s*(.+)/i);
  const assessing = isAssessingKind(kind);

  // No verdict, no branch label, and a non-assessing stage → just proceed.
  if (!verdictM && !outcomeM && !assessing) return null;

  // An assessing stage that asked a clarifying question has not failed; it is
  // waiting. The engine pauses on the outcome before it looks at `pass`.
  const awaitingClarification = outcomeM?.[1].toLowerCase() === "needs_clarification";

  let pass: boolean;
  let reasons = splitList(reasonsM?.[1]);
  if (verdictM) {
    pass = verdictM[1].toUpperCase() === "PASS";
  } else if (assessing && !awaitingClarification) {
    pass = false;
    if (reasons.length === 0) {
      reasons = ["The stage did not report a verdict, so its result cannot be trusted."];
    }
  } else {
    pass = true;
  }

  return {
    pass,
    reasons,
    suggestions: splitList(suggM?.[1]),
    ...(outcomeM ? { outcome: outcomeM[1].toLowerCase() } : {}),
    ...(questionM ? { question: questionM[1].trim() } : {}),
  };
}
