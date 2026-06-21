// ═══════════════════════════════════════════════════════════════
// schema/mission-v2.ts — Mission V2 multi-phase contracts
//
// A V2 mission is an ordered list of PHASES (Prepare → Implement → Test →
// Release, or custom), each an ordered list of ACTIONS ending in a gate
// (human-in-loop or auto). This file holds the domain types (mirrors the
// V1 mission-types style) + a Zod plan schema for scaffolding a mission.
// The persistence lives in mission-phases-repository.ts.
// ═══════════════════════════════════════════════════════════════

import { z } from "zod";

// ── Enums (mirror the 018_mission_phases.sql CHECK sets) ─────────

export const phaseGateSchema = z.enum(["hil", "auto"]);
export type PhaseGate = z.infer<typeof phaseGateSchema>;

export const phaseKindSchema = z.enum(["prepare", "implement", "test", "release", "custom"]);
export type PhaseKind = z.infer<typeof phaseKindSchema>;

export type PhaseStatus =
  | "pending"
  | "running"
  | "awaiting_approval"
  | "approved"
  | "rejected"
  | "completed"
  | "failed"
  | "skipped";

export const actionKindSchema = z.enum([
  "test",
  "bug_report",
  "review",
  "validate",
  "task",
  "plan",
  "implement",
  "integration",
  "acceptance",
  "deployment",
  "custom",
]);
export type ActionKind = z.infer<typeof actionKindSchema>;

export type ActionStatus = "pending" | "running" | "completed" | "failed" | "skipped";

// ── Domain records ───────────────────────────────────────────────

export interface MissionPhase {
  id: string;
  missionId: string;
  position: number;
  name: string;
  kind: PhaseKind | string;
  status: PhaseStatus;
  gate: PhaseGate;
  approvalDecision: "approved" | "rejected" | null;
  approvalNote: string | null;
  decidedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MissionPhaseAction {
  id: string;
  phaseId: string;
  position: number;
  kind: ActionKind | string;
  status: ActionStatus;
  runId: string | null;
  output: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MissionApproval {
  id: string;
  phaseId: string;
  decidedBy: string;
  approved: boolean;
  note: string | null;
  createdAt: string;
}

/** A phase with its ordered actions (the shape the UI / orchestrator reads). */
export interface MissionPhaseWithActions extends MissionPhase {
  actions: MissionPhaseAction[];
}

// ── Plan input (used to scaffold a V2 mission's phases/actions) ───

export const phaseActionInputSchema = z.object({
  kind: actionKindSchema.default("task"),
});

export const phaseInputSchema = z.object({
  name: z.string().default(""),
  kind: phaseKindSchema.default("custom"),
  gate: phaseGateSchema.default("auto"),
  actions: z.array(phaseActionInputSchema).default([]),
});

export const missionV2PlanSchema = z.object({
  phases: z.array(phaseInputSchema).min(1),
});

export type PhaseActionInput = z.infer<typeof phaseActionInputSchema>;
export type PhaseInput = z.infer<typeof phaseInputSchema>;
export type MissionV2Plan = z.infer<typeof missionV2PlanSchema>;

/** The canonical Prepare → Implement → Test → Release scaffold (HIL gates). */
export const DEFAULT_V2_PLAN: MissionV2Plan = {
  phases: [
    { name: "Prepare", kind: "prepare", gate: "hil", actions: [{ kind: "plan" }, { kind: "review" }, { kind: "validate" }] },
    { name: "Implement", kind: "implement", gate: "hil", actions: [{ kind: "task" }, { kind: "implement" }, { kind: "test" }] },
    { name: "Test", kind: "test", gate: "hil", actions: [{ kind: "integration" }, { kind: "acceptance" }] },
    { name: "Release", kind: "release", gate: "hil", actions: [{ kind: "deployment" }] },
  ],
};
