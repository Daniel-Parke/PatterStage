// ═══════════════════════════════════════════════════════════════
// composer/stage-prompt.ts — build the agent prompt for one Composer stage
//
// Frames the stage's job (kind-specific), injects the overall objective + the
// accumulated context (prior stage outputs), and — on a loop-back re-run —
// the prior failure's reasons/suggestions. Assessing stages are told to end
// with a PASS/FAIL verdict (parsed by verdict.ts → conditional routing).
// ═══════════════════════════════════════════════════════════════

import type { ComposerNode, ComposerRun, NodeVerdict } from "./schema";
import { isAssessingKind } from "./verdict";

const STAGE_INSTRUCTIONS: Record<string, string> = {
  review: "Review the request. Restate the goal, the scope, the risks, and what 'done' means. Decide if it is well-formed enough to proceed (PASS) or needs rework (FAIL).",
  validate: "Validate the current state/plan against the goal and requirements. Decide if it is sound enough to proceed (PASS) or not (FAIL).",
  research: "Research the problem: gather relevant facts, prior art, constraints, and options. Summarise findings with sources.",
  hypothesise: "Form a clear hypothesis / proposed approach to achieve the goal, with rationale and the alternatives you considered.",
  plan: "Produce a concrete, step-by-step implementation plan: files to change, the approach, the tests, and the risks.",
  build_tests: "Write failing tests (TDD) that capture the desired behaviour BEFORE implementing it.",
  implement: "Implement the change so it satisfies the plan and makes the tests pass.",
  test: "Run (or define and run) the tests for the implementation and report the results. End with a PASS/FAIL verdict.",
  documentation: "Update or write the documentation for the change.",
  pr: "Prepare the pull request: a clear summary, the rationale, and a checklist of what changed.",
  unit_test: "Run the unit tests and report pass/fail with details. End with a PASS/FAIL verdict.",
  integration_test: "Run the integration tests and report pass/fail with details. End with a PASS/FAIL verdict.",
  acceptance_test: "Run the acceptance tests against the original requirements. End with a PASS/FAIL verdict.",
  final_assessment: "Assess the whole change against the original goal and all the tests. Decide PASS or FAIL; on FAIL give concrete reasons and suggestions so the prior stage can fix it.",
  custom: "Complete this stage's objective using the context provided.",
};

/** Render the accumulated workflow context (prior stage outputs), bounded. */
function formatContext(context: Record<string, unknown> | null): string {
  if (!context) return "";
  const parts: string[] = [];
  for (const [key, value] of Object.entries(context)) {
    // Reserved markers are the orchestrator talking to itself: __clarify and
    // __gateNote are not outputs of prior stages and do not belong in a dump
    // of them (T-0106, D8).
    if (key.startsWith("__")) continue;
    const text = typeof value === "string" ? value : JSON.stringify(value);
    const trimmed = text.length > 1500 ? `${text.slice(0, 1500)}…` : text;
    parts.push(`### ${key}\n${trimmed}`);
  }
  return parts.join("\n\n");
}

export function buildStagePrompt(
  node: ComposerNode,
  run: ComposerRun,
  opts: { priorFailure?: NodeVerdict | null; framing?: string | null } = {},
): string {
  const objective = run.input?.trim() || "(no objective provided)";
  // A node may override its kind's default instruction (lets a research/writing
  // workflow describe its own stages without inventing new kinds).
  const override = typeof node.config?.instruction === "string" ? node.config.instruction.trim() : "";
  const instruction = override || STAGE_INSTRUCTIONS[node.kind] || STAGE_INSTRUCTIONS.custom;
  // A workflow may declare a domain word ("software" / "research" / "data") on
  // its start node's `config.framing`; default is neutral so a non-software
  // workflow isn't told it's doing "software".
  const framing = typeof opts.framing === "string" && opts.framing.trim() ? `${opts.framing.trim()} ` : "";
  const ctx = formatContext(run.context);

  const lines: string[] = [
    `You are executing ONE stage of a methodical, multi-stage ${framing}workflow run by an orchestrator.`,
    "",
    "## Overall objective",
    objective,
    "",
    `## Current stage: ${node.label} (${node.kind})`,
    instruction,
  ];

  if (ctx) {
    lines.push("", "## Context so far (outputs of prior stages)", ctx);
  }

  const pf = opts.priorFailure;
  if (pf && (pf.reasons.length > 0 || pf.suggestions.length > 0)) {
    lines.push(
      "",
      "## This stage is being re-run after a downstream FAIL",
      pf.reasons.length ? `Reasons: ${pf.reasons.join("; ")}` : "",
      pf.suggestions.length ? `Suggestions: ${pf.suggestions.join("; ")}` : "",
    );
  }

  const gateNote = run.context?.__gateNote as
    | { nodeLabel?: unknown; action?: unknown; note?: unknown }
    | undefined;
  if (gateNote && typeof gateNote.note === "string" && gateNote.note.trim()) {
    const where = typeof gateNote.nodeLabel === "string" && gateNote.nodeLabel ? gateNote.nodeLabel : "a stage";
    const verdict = gateNote.action === "accept" ? "accepted" : "rejected";
    lines.push(
      "",
      "## Note from the operator's gate decision",
      `The gate at "${where}" was ${verdict}.`,
      gateNote.note.trim(),
    );
  }

  if (isAssessingKind(node.kind)) {
    lines.push(
      "",
      "## Required output format",
      "End your response with these lines:",
      "VERDICT: PASS or FAIL",
      "REASONS: <semicolon-separated reasons, only if FAIL>",
      "SUGGESTIONS: <semicolon-separated concrete suggestions, only if FAIL>",
      "",
      "If the objective is too vague or missing essential detail to proceed at all, do NOT guess or fail — ask the user one question instead, ending with:",
      "OUTCOME: needs_clarification",
      "QUESTION: <one specific question that would unblock you>",
    );
  }

  return lines.filter((l) => l !== undefined).join("\n");
}
