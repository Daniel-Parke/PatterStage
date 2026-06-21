// ═══════════════════════════════════════════════════════════════
// composer/verdict.ts — extract a PASS/FAIL verdict from a stage's output
//
// Assessing stages (validate / test / *_test / final_assessment) end their
// output with a structured marker so the engine can route on_pass / on_fail.
// Convention (instructed by the stage prompt):
//   VERDICT: PASS            (or FAIL)
//   REASONS: a; b; c         (optional)
//   SUGGESTIONS: x; y        (optional)
// Non-assessing stages have no verdict — they simply proceed (pass = true).
// ═══════════════════════════════════════════════════════════════

import type { NodeVerdict } from "./schema";

/** Stage kinds that emit a PASS/FAIL verdict (drive conditional routing). */
export const ASSESSING_KINDS = new Set<string>([
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
 * Parse a verdict from stage output. Returns null when the stage is
 * non-assessing AND no explicit marker is present (→ the engine treats it as a
 * pass). A failed run (no output) should be handled by the caller (pass=false).
 */
export function parseVerdict(output: string | null, kind: string): NodeVerdict | null {
  const text = output ?? "";
  const verdictM = text.match(/VERDICT:\s*(PASS|FAIL)/i);
  const reasonsM = text.match(/REASONS?:\s*(.+)/i);
  const suggM = text.match(/SUGGESTIONS?:\s*(.+)/i);

  if (!verdictM && !isAssessingKind(kind)) return null;

  const pass = verdictM ? verdictM[1].toUpperCase() === "PASS" : true;
  return {
    pass,
    reasons: splitList(reasonsM?.[1]),
    suggestions: splitList(suggM?.[1]),
  };
}
