// composer/verdict.ts — extract a PASS/FAIL verdict from a stage's output.
//
// Assessing stages end with a structured marker the engine routes on:
//   VERDICT: PASS|FAIL, REASONS: a; b (optional), SUGGESTIONS: x; y (optional),
//   OUTCOME: <label> (optional branch label; routes on_<label>).
// Non-assessing stages proceed (pass = true) unless they emit an OUTCOME.

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
 * The stage prompt says "end with VERDICT: PASS or FAIL"; a plain match
 * captured PASS from a model echoing its instructions. The lookahead rejects
 * the template while accepting a real verdict followed by other text.
 */
const VERDICT_RE = /VERDICT:\s*(PASS|FAIL)\b(?!\s*(?:or|\/)\s*(?:PASS|FAIL)\b)/i;

/**
 * Parse a verdict. Null when the stage is non-assessing AND no marker is present
 * (the engine treats it as a pass); a failed run is the caller's (pass=false).
 * An ASSESSING stage that emits no verdict FAILS: `pass` used to fall back to
 * true, so a test stage that ran out of tokens or returned prose was
 * indistinguishable from one that verified something.
 */
export function parseVerdict(output: string | null, kind: string): NodeVerdict | null {
  // Strip reasoning blocks BEFORE looking for any marker: a verdict weighed in
  // deliberation was never concluded, and reading one routed on_pass for a
  // stage that said FAIL. Applies to OUTCOME too.
  const text = stripReasoning(output ?? "");
  const verdictM = text.match(VERDICT_RE);
  const reasonsM = text.match(/REASONS?:\s*(.+)/i);
  const suggM = text.match(/SUGGESTIONS?:\s*(.+)/i);
  const outcomeM = text.match(/(?:OUTCOME|ROUTE):\s*([A-Za-z0-9_-]+)/i);
  const questionM = text.match(/QUESTION:\s*(.+)/i);
  const assessing = isAssessingKind(kind);

  // No verdict, no branch label, and a non-assessing stage → just proceed.
  if (!verdictM && !outcomeM && !assessing) return null;

  // A clarifying question is not a failure; the engine pauses on the outcome first.
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
