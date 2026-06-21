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
export const nodeGateSchema = z.enum(["hil", "auto"]);
export type NodeGate = z.infer<typeof nodeGateSchema>;

export const edgeConditionSchema = z.enum([
  "always",
  "on_pass",
  "on_fail",
  "on_approve",
  "on_reject",
]);
/** Edge guard. Open string so workflows can add custom conditions later. */
export type EdgeCondition = z.infer<typeof edgeConditionSchema> | (string & {});

export type ComposerRunStatus =
  | "pending"
  | "running"
  | "awaiting_approval"
  | "completed"
  | "failed"
  | "cancelled";

export type NodeRunStatus = "pending" | "running" | "completed" | "failed" | "skipped";

export const approvalActionSchema = z.enum(["accept", "reject", "review", "add_feature"]);
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
export const nodeDefSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  kind: z.string().default("custom"),
  gate: nodeGateSchema.default("auto"),
  isStart: z.boolean().optional(),
  isTerminal: z.boolean().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});
export const edgeDefSchema = z.object({
  from: z.string().min(1), // node key
  to: z.string().min(1), // node key
  condition: z.string().default("always"),
  label: z.string().optional(),
});
export const workflowDefSchema = z.object({
  key: z.string().min(1).optional(),
  name: z.string().min(1),
  description: z.string().default(""),
  nodes: z.array(nodeDefSchema).min(1),
  edges: z.array(edgeDefSchema).default([]),
});
/** Input shape (what you author) — defaults are applied by `workflowDefSchema.parse`. */
export type WorkflowDef = z.input<typeof workflowDefSchema>;

// ── Seeded default: the whiteboard "Software Delivery" pipeline ───
export const SOFTWARE_DELIVERY_WORKFLOW_KEY = "software-delivery-v1";

export const DEFAULT_SOFTWARE_DELIVERY_WORKFLOW: WorkflowDef = {
  key: SOFTWARE_DELIVERY_WORKFLOW_KEY,
  name: "Software Delivery",
  description:
    "Methodical feature/bug pipeline: prepare → implement → verify, with HIL gates and FAIL loop-backs.",
  nodes: [
    { key: "review", label: "Review", kind: "review", gate: "auto", isStart: true },
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
    { from: "hypothesise", to: "plan" },
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
