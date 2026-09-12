// ═══════════════════════════════════════════════════════════════
// composer/schema.ts — Composer graph contracts
//
// A workflow is a directed graph of stage NODES connected by conditional/
// looping EDGES, with per-node human-in-the-loop or auto gates. A run is an
// execution; a node-run is one stage execution (= one Hermes agent run). See
// 021_composer.sql. Includes the seeded "Software Delivery" workflow def.
// ═══════════════════════════════════════════════════════════════

import { z } from "zod";

// ── Enums ────────────────────────────────────────────────────────
const nodeGateSchema = z.enum(["hil", "auto"]);
export type NodeGate = z.infer<typeof nodeGateSchema>;

/** Edge guard. Open string so workflows can add custom conditions later. */
export type EdgeCondition =
  | "always"
  | "on_pass"
  | "on_fail"
  | "on_approve"
  | "on_reject"
  | (string & {});

/**
 * A run's lifecycle state.
 *
 * `rejected` is terminal and DELIBERATE: the operator turned a HIL gate down and
 * the workflow had no `on_reject` edge to follow. It is separated from `failed`
 * because the two need to read differently -- one is a decision, the other is a
 * defect -- and because collapsing them is what let a rejected run render as a
 * pink error above a canvas still drawing the rejected gate green (T-0069).
 *
 * `cancelled` is the operator stopping a run that was still going. It was dead
 * vocabulary for a long time -- admitted by the CHECK, read by the terminal set,
 * written by nothing -- which is what T-0069 warned `rejected` must not become.
 * POST /api/composer/runs/[id]/cancel writes it now (T-0076).
 */
export type ComposerRunStatus =
  | "pending"
  | "running"
  | "awaiting_approval"
  | "completed"
  | "failed"
  | "cancelled"
  | "rejected";

/**
 * A single stage execution's state. `rejected` is the gate the operator turned
 * down; without it the stage kept `completed` from its own successful run and
 * the canvas contradicted the run header.
 *
 * `cancelled` is the stage that was in flight when the operator stopped the run
 * (T-0076, migration 037). It is NOT `failed` -- that would repeat the mistake
 * above with a different status -- and it is NOT `skipped`, which means a stage
 * that never ran.
 */
export type NodeRunStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped"
  | "rejected"
  | "cancelled";

/**
 * The run statuses that mean "this run is over".
 *
 * THE RULE OF THREE IS MET, and the third site is why this exists. The same
 * vocabulary was open-coded in the engine's do-not-advance set, in
 * `settleGroupNode`'s did-the-child-end check, and in the SSE route's
 * stop-streaming set -- three lists that had to be edited together and nothing
 * saying so. Adding `rejected` to the union alone would have left a rejected
 * sub-workflow hanging its parent's group stage forever and left the event
 * stream open on a finished run (T-0069).
 *
 * The `satisfies` clause makes a new status that is never classified a compile
 * error at the point it is added, rather than a silent omission from all three.
 */
export const TERMINAL_COMPOSER_RUN_STATUSES = [
  "completed",
  "failed",
  "cancelled",
  "rejected",
] as const satisfies readonly ComposerRunStatus[];

/** Is this run over? See `TERMINAL_COMPOSER_RUN_STATUSES`. */
export function isTerminalComposerRunStatus(status: string): boolean {
  return (TERMINAL_COMPOSER_RUN_STATUSES as readonly string[]).includes(status);
}

// Two verbs (T-0089, ruling 3). "review" and "add_feature" were vestigial and
// dangerous: add_feature silently routed as APPROVE and review as REJECT.
export const approvalActionSchema = z.enum(["accept", "reject"]);
export type ApprovalAction = z.infer<typeof approvalActionSchema>;

// ── Domain records ───────────────────────────────────────────────
export interface ComposerWorkflow {
  id: string;
  key: string | null;
  name: string;
  description: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ComposerNode {
  id: string;
  workflowId: string;
  key: string;
  label: string;
  kind: string;
  gate: NodeGate;
  isStart: boolean;
  isTerminal: boolean;
  config: Record<string, unknown> | null;
  pos: number;
}

export interface ComposerEdge {
  id: string;
  workflowId: string;
  fromNodeId: string;
  toNodeId: string;
  condition: EdgeCondition;
  label: string | null;
}

export interface ComposerWorkflowGraph extends ComposerWorkflow {
  nodes: ComposerNode[];
  edges: ComposerEdge[];
}

/** Structured outcome an assessing stage emits — drives on_pass/on_fail routing. */
export interface NodeVerdict {
  pass: boolean;
  reasons: string[];
  suggestions: string[];
  /**
   * Optional branch label a stage emits (`OUTCOME: <x>`) to choose among many
   * downstream paths beyond pass/fail — the engine follows an `on_<x>` edge when
   * present. Lets a node fan out (e.g. no_action / further_research / write_report).
   */
  outcome?: string;
  /**
   * A question for the user, emitted with `OUTCOME: needs_clarification` when a
   * stage can't proceed because the objective is too vague — the engine pauses
   * the run for an answer instead of dead-ending (interactive clarification).
   */
  question?: string;
}

export interface ComposerRun {
  id: string;
  workflowId: string;
  status: ComposerRunStatus;
  currentNodeId: string | null;
  input: string | null;
  context: Record<string, unknown> | null;
  profileName: string | null;
  error: string | null;
  /** Set when a "group" node spawned this run as a nested sub-workflow. */
  parentNodeRunId: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface ComposerNodeRun {
  id: string;
  composerRunId: string;
  nodeId: string;
  attempt: number;
  status: NodeRunStatus;
  runId: string | null;
  input: string | null;
  output: string | null;
  verdict: NodeVerdict | null;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface ComposerApproval {
  id: string;
  composerRunId: string;
  nodeId: string;
  action: ApprovalAction;
  approved: boolean;
  note: string | null;
  decidedBy: string;
  createdAt: string;
}

// ── Workflow definition (used to create/seed a workflow graph) ───
const nodeDefSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  kind: z.string().default("custom"),
  gate: nodeGateSchema.default("auto"),
  isStart: z.boolean().optional(),
  isTerminal: z.boolean().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});
const edgeDefSchema = z.object({
  from: z.string().min(1), // node key
  to: z.string().min(1), // node key
  condition: z.string().default("always"),
  label: z.string().optional(),
});
export const workflowDefSchema = z.object({
  key: z.string().min(1).optional(),
  name: z.string().min(1),
  // Optional: an absent description leaves whatever is stored, and "" clears
  // it. A default of "" made every save that omitted one blank it (T-0106, D2).
  description: z.string().optional(),
  nodes: z.array(nodeDefSchema).min(1),
  edges: z.array(edgeDefSchema).default([]),
});
/** Input shape (what you author) — defaults are applied by `workflowDefSchema.parse`. */
export type WorkflowDef = z.input<typeof workflowDefSchema>;

// ── Workflow input contract (per-workflow Run form) ──────────────
// A workflow declares what objective it expects from the user, so the Run form
// is self-describing instead of a hardcoded "Feature request / bug report" box.
// Stored on the START node's `config.inputSpec` (round-trips as JSON — no
// migration). Mirrors Dify/n8n "start node input variables".
const inputSpecSchema = z.object({
  /** Label above the objective box (e.g. "Research question"). */
  objectiveLabel: z.string().min(1).default("Objective"),
  /** Placeholder / hint inside the box. */
  objectiveHint: z.string().default(""),
  /** 1-3 click-to-fill example objectives. */
  examples: z.array(z.string()).default([]),
});
export type WorkflowInputSpec = z.infer<typeof inputSpecSchema>;

const DEFAULT_INPUT_SPEC: WorkflowInputSpec = {
  objectiveLabel: "Objective",
  objectiveHint: "Describe what you want this workflow to accomplish — be specific about the subject, scope, and what 'done' looks like.",
  examples: [],
};

/**
 * Resolve the Run form's input contract for a workflow: the start node's
 * `config.inputSpec`, safe-parsed, falling back to a sensible generic default so
 * the form is never blank or broken for older/custom workflows.
 */
export function getInputSpec(graph: ComposerWorkflowGraph): WorkflowInputSpec {
  const start =
    graph.nodes.find((n) => n.isStart) ??
    [...graph.nodes].sort((a, b) => a.pos - b.pos)[0];
  const parsed = inputSpecSchema.safeParse(start?.config?.inputSpec);
  return parsed.success ? parsed.data : DEFAULT_INPUT_SPEC;
}

// ── Seeded default: the whiteboard "Software Delivery" pipeline ───
export const SOFTWARE_DELIVERY_WORKFLOW_KEY = "software-delivery-v1";

/** The seeded Software-Delivery workflow's input contract (kept here so seed + back-fill share it). */
export const SOFTWARE_DELIVERY_INPUT_SPEC: WorkflowInputSpec = {
  objectiveLabel: "Feature request / bug report",
  objectiveHint: "e.g. Add a dark-mode toggle to the settings page, persisted per user.",
  examples: [
    "Add a dark-mode toggle to the settings page, persisted per user.",
    "Fix the N+1 query loading the dashboard sessions list.",
    "Add CSV export to the missions results table.",
  ],
};

export const DEFAULT_SOFTWARE_DELIVERY_WORKFLOW: WorkflowDef = {
  key: SOFTWARE_DELIVERY_WORKFLOW_KEY,
  name: "Software Delivery",
  description:
    "Methodical feature/bug pipeline: prepare → implement → verify, with HIL gates and FAIL loop-backs.",
  nodes: [
    { key: "review", label: "Review", kind: "review", gate: "auto", isStart: true, config: { inputSpec: SOFTWARE_DELIVERY_INPUT_SPEC, framing: "software" } },
    { key: "validate_prep", label: "Validate", kind: "validate", gate: "auto" },
    { key: "research", label: "Research", kind: "research", gate: "auto" },
    { key: "hypothesise", label: "Hypothesise", kind: "hypothesise", gate: "auto" },
    { key: "plan", label: "Plan", kind: "plan", gate: "hil" },
    { key: "build_tests", label: "Build tests (TDD)", kind: "build_tests", gate: "auto" },
    { key: "implement", label: "Implement", kind: "implement", gate: "auto" },
    { key: "test", label: "Test", kind: "test", gate: "auto" },
    { key: "documentation", label: "Documentation", kind: "documentation", gate: "auto" },
    { key: "pr", label: "Open PR", kind: "pr", gate: "hil" },
    { key: "unit_test", label: "Unit tests", kind: "unit_test", gate: "auto" },
    { key: "integration_test", label: "Integration tests", kind: "integration_test", gate: "auto" },
    { key: "acceptance_test", label: "Acceptance tests", kind: "acceptance_test", gate: "auto" },
    { key: "final_assessment", label: "Final assessment", kind: "final_assessment", gate: "auto" },
    { key: "update_pr", label: "Update PR", kind: "pr", gate: "hil" },
    { key: "done", label: "Done", kind: "custom", gate: "auto", isTerminal: true },
  ],
  edges: [
    { from: "review", to: "validate_prep" },
    { from: "validate_prep", to: "research" },
    { from: "research", to: "hypothesise" },
    // Research + hypothesise are best-effort enrichment — a transient failure
    // (e.g. a search/LLM blip) routes FORWARD rather than dead-ending the run.
    { from: "research", to: "hypothesise", condition: "on_fail", label: "skip research" },
    { from: "hypothesise", to: "plan" },
    { from: "hypothesise", to: "plan", condition: "on_fail", label: "continue" },
    { from: "plan", to: "build_tests", condition: "on_approve" },
    { from: "plan", to: "review", condition: "on_reject", label: "rework" },
    { from: "build_tests", to: "implement" },
    { from: "implement", to: "test" },
    { from: "test", to: "documentation", condition: "on_pass" },
    { from: "test", to: "implement", condition: "on_fail", label: "fix" },
    { from: "documentation", to: "pr" },
    { from: "pr", to: "unit_test", condition: "on_approve" },
    { from: "pr", to: "implement", condition: "on_reject", label: "rework" },
    { from: "unit_test", to: "integration_test" },
    { from: "integration_test", to: "acceptance_test" },
    { from: "acceptance_test", to: "final_assessment" },
    { from: "final_assessment", to: "update_pr", condition: "on_pass" },
    { from: "final_assessment", to: "implement", condition: "on_fail", label: "back to build" },
    { from: "update_pr", to: "done", condition: "on_approve" },
    { from: "update_pr", to: "implement", condition: "on_reject", label: "add feature / rework" },
  ],
};

/**
 * Why an awaiting_approval run is waiting.
 *
 * "Waiting for you" is two very different states: a stage asked a question and
 * wants an answer, or a human-in-the-loop gate is open and wants a decision.
 * The board said the same thing for both (T-0106).
 */
export function composerWaitingReason(
  run: { status: string; context: Record<string, unknown> | null },
): "question" | "gate" | null {
  if (run.status !== "awaiting_approval") return null;
  return run.context?.__clarify ? "question" : "gate";
}

// ── The starter workflows ───────────────────────────────────────
//
// Software Delivery is sixteen stages, which is a fine third workflow and an
// intimidating first one. These two are the first run a new operator can make
// sense of, and each one shows a gate doing something: a decision that sends
// the work back, and a reviewer that loops.

export const RESEARCH_SUMMARISE_WORKFLOW_KEY = "research-then-summarise-v1";
export const DRAFT_REVIEW_WORKFLOW_KEY = "draft-and-review-v1";

export const DEFAULT_RESEARCH_SUMMARISE_WORKFLOW: WorkflowDef = {
  key: RESEARCH_SUMMARISE_WORKFLOW_KEY,
  name: "Research then summarise",
  description: "Research a question, check the findings at a gate, then write the summary.",
  nodes: [
    {
      key: "research",
      label: "Research",
      kind: "research",
      gate: "auto",
      isStart: true,
      config: {
        framing: "research",
        inputSpec: {
          objectiveLabel: "Research question",
          objectiveHint:
            "e.g. What are the practical trade-offs of local LLM inference on consumer GPUs?",
          examples: [
            "What are the practical trade-offs of local LLM inference on consumer GPUs?",
            "Summarise the current options for on-device speech to text.",
          ],
        },
      },
    },
    { key: "gate", label: "Check the findings", kind: "review", gate: "hil" },
    // NOT the terminal node, for the reason Draft-and-review states below:
    // resolveNext answers "complete" for a terminal node before it dispatches
    // it, so a terminal stage runs no agent. This one writes the summary, which
    // is the whole point of the workflow, so the run has to pass THROUGH it and
    // stop on the inert marker after it.
    { key: "write", label: "Write the summary", kind: "documentation", gate: "auto" },
    { key: "done", label: "Done", kind: "custom", gate: "auto", isTerminal: true },
  ],
  edges: [
    { from: "research", to: "gate" },
    { from: "gate", to: "write", condition: "on_approve" },
    { from: "gate", to: "research", condition: "on_reject", label: "research again" },
    { from: "write", to: "done" },
  ],
};

export const DEFAULT_DRAFT_REVIEW_WORKFLOW: WorkflowDef = {
  key: DRAFT_REVIEW_WORKFLOW_KEY,
  name: "Draft and review",
  description: "Draft the piece, then review it against the brief and revise until it passes.",
  nodes: [
    {
      key: "draft",
      label: "Draft",
      kind: "custom",
      gate: "auto",
      isStart: true,
      config: {
        inputSpec: {
          objectiveLabel: "What to draft",
          objectiveHint:
            "e.g. A 400-word release note for the new backups page, for existing users.",
          examples: ["A 400-word release note for the new backups page, for existing users."],
        },
      },
    },
    // Not the terminal node: resolveNext answers "complete" for a terminal
    // node BEFORE it reads an edge, so a terminal reviewer could never route
    // its own FAIL back to the draft.
    { key: "review", label: "Review", kind: "review", gate: "auto" },
    { key: "done", label: "Done", kind: "custom", gate: "auto", isTerminal: true },
  ],
  edges: [
    { from: "draft", to: "review" },
    { from: "review", to: "done", condition: "on_pass" },
    { from: "review", to: "draft", condition: "on_fail", label: "revise" },
  ],
};
