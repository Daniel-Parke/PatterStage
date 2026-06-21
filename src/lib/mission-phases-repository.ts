// ═══════════════════════════════════════════════════════════════
// mission-phases-repository.ts — CRUD for Mission V2 phases/actions/approvals
//
// Foundation layer for multi-phase missions (see 018_mission_phases.sql +
// schema/mission-v2.ts). The orchestration engine (PhaseTickSource) and the
// V2 composer UI build on these. V1 missions never touch these tables.
// ═══════════════════════════════════════════════════════════════

import { db, inTransaction, uuid, now } from "./db";
import { parseBool } from "./db/parse-json";
import type {
  ActionStatus,
  MissionApproval,
  MissionPhase,
  MissionPhaseAction,
  MissionPhaseWithActions,
  MissionV2Plan,
  PhaseGate,
  PhaseStatus,
} from "./schema/mission-v2";

// ── Row shapes + mappers ─────────────────────────────────────────

interface PhaseRow {
  id: string;
  mission_id: string;
  position: number;
  name: string;
  kind: string;
  status: string;
  gate: string;
  approval_decision: string | null;
  approval_note: string | null;
  decided_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ActionRow {
  id: string;
  phase_id: string;
  position: number;
  kind: string;
  status: string;
  run_id: string | null;
  output: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

interface ApprovalRow {
  id: string;
  phase_id: string;
  decided_by: string;
  approved: number;
  note: string | null;
  created_at: string;
}

function rowToPhase(row: PhaseRow): MissionPhase {
  return {
    id: row.id,
    missionId: row.mission_id,
    position: row.position,
    name: row.name,
    kind: row.kind,
    status: row.status as PhaseStatus,
    gate: row.gate as PhaseGate,
    approvalDecision: (row.approval_decision as "approved" | "rejected" | null) ?? null,
    approvalNote: row.approval_note,
    decidedAt: row.decided_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToAction(row: ActionRow): MissionPhaseAction {
  return {
    id: row.id,
    phaseId: row.phase_id,
    position: row.position,
    kind: row.kind,
    status: row.status as ActionStatus,
    runId: row.run_id,
    output: row.output,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToApproval(row: ApprovalRow): MissionApproval {
  return {
    id: row.id,
    phaseId: row.phase_id,
    decidedBy: row.decided_by,
    approved: parseBool(row.approved) ?? false,
    note: row.note,
    createdAt: row.created_at,
  };
}

// ── Scaffold (build phases + actions from a plan) ────────────────

/**
 * Insert a plan's phases + actions for a mission and mark the mission V2.
 * Idempotency is the caller's concern (this always inserts fresh rows).
 */
export function scaffoldMissionPhases(missionId: string, plan: MissionV2Plan): MissionPhaseWithActions[] {
  return inTransaction(() => {
    const ts = now();
    plan.phases.forEach((phase, pIdx) => {
      const phaseId = uuid();
      db()
        .prepare(
          `INSERT INTO mission_phases (id, mission_id, position, name, kind, status, gate, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
        )
        .run(phaseId, missionId, pIdx, phase.name, phase.kind, phase.gate, ts, ts);
      phase.actions.forEach((action, aIdx) => {
        db()
          .prepare(
            `INSERT INTO mission_phase_actions (id, phase_id, position, kind, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
          )
          .run(uuid(), phaseId, aIdx, action.kind, ts, ts);
      });
    });
    db().prepare("UPDATE missions SET version = 'v2', updated_at = ? WHERE id = ?").run(ts, missionId);
    return listMissionPhases(missionId);
  });
}

// ── Reads ────────────────────────────────────────────────────────

export function listMissionPhases(missionId: string): MissionPhaseWithActions[] {
  const phases = db()
    .prepare("SELECT * FROM mission_phases WHERE mission_id = ? ORDER BY position ASC")
    .all(missionId) as PhaseRow[];
  return phases.map((p) => ({
    ...rowToPhase(p),
    actions: listPhaseActions(p.id),
  }));
}

export function getPhase(id: string): MissionPhase | null {
  const row = db().prepare("SELECT * FROM mission_phases WHERE id = ?").get(id) as PhaseRow | undefined;
  return row ? rowToPhase(row) : null;
}

export function listPhaseActions(phaseId: string): MissionPhaseAction[] {
  const rows = db()
    .prepare("SELECT * FROM mission_phase_actions WHERE phase_id = ? ORDER BY position ASC")
    .all(phaseId) as ActionRow[];
  return rows.map(rowToAction);
}

export function getAction(id: string): MissionPhaseAction | null {
  const row = db().prepare("SELECT * FROM mission_phase_actions WHERE id = ?").get(id) as
    | ActionRow
    | undefined;
  return row ? rowToAction(row) : null;
}

export function listApprovals(phaseId: string): MissionApproval[] {
  const rows = db()
    .prepare("SELECT * FROM mission_approvals WHERE phase_id = ? ORDER BY created_at ASC")
    .all(phaseId) as ApprovalRow[];
  return rows.map(rowToApproval);
}

// ── Writes ───────────────────────────────────────────────────────

export interface UpdatePhaseInput {
  status?: PhaseStatus;
  gate?: PhaseGate;
  startedAt?: string | null;
  completedAt?: string | null;
}

export function updatePhase(id: string, input: UpdatePhaseInput): MissionPhase | null {
  const sets: string[] = ["updated_at = ?"];
  const vals: unknown[] = [now()];
  if (input.status !== undefined) { sets.push("status = ?"); vals.push(input.status); }
  if (input.gate !== undefined) { sets.push("gate = ?"); vals.push(input.gate); }
  if (input.startedAt !== undefined) { sets.push("started_at = ?"); vals.push(input.startedAt); }
  if (input.completedAt !== undefined) { sets.push("completed_at = ?"); vals.push(input.completedAt); }
  db().prepare(`UPDATE mission_phases SET ${sets.join(", ")} WHERE id = ?`).run(...vals, id);
  return getPhase(id);
}

export interface UpdateActionInput {
  status?: ActionStatus;
  runId?: string | null;
  output?: string | null;
  error?: string | null;
}

export function updateAction(id: string, input: UpdateActionInput): MissionPhaseAction | null {
  const sets: string[] = ["updated_at = ?"];
  const vals: unknown[] = [now()];
  if (input.status !== undefined) { sets.push("status = ?"); vals.push(input.status); }
  if (input.runId !== undefined) { sets.push("run_id = ?"); vals.push(input.runId); }
  if (input.output !== undefined) { sets.push("output = ?"); vals.push(input.output); }
  if (input.error !== undefined) { sets.push("error = ?"); vals.push(input.error); }
  db().prepare(`UPDATE mission_phase_actions SET ${sets.join(", ")} WHERE id = ?`).run(...vals, id);
  return getAction(id);
}

export interface RecordApprovalInput {
  approved: boolean;
  note?: string | null;
  decidedBy?: string;
}

/**
 * Record a gate decision: writes the audit row AND resolves the phase
 * (approval_decision + status: approved → 'approved', rejected → 'rejected').
 */
export function recordApproval(phaseId: string, input: RecordApprovalInput): MissionApproval {
  return inTransaction(() => {
    const ts = now();
    const id = uuid();
    db()
      .prepare(
        `INSERT INTO mission_approvals (id, phase_id, decided_by, approved, note, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(id, phaseId, input.decidedBy ?? "user", input.approved ? 1 : 0, input.note ?? null, ts);
    db()
      .prepare(
        `UPDATE mission_phases
           SET approval_decision = ?, approval_note = ?, decided_at = ?, status = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        input.approved ? "approved" : "rejected",
        input.note ?? null,
        ts,
        input.approved ? "approved" : "rejected",
        ts,
        phaseId,
      );
    return rowToApproval(
      db().prepare("SELECT * FROM mission_approvals WHERE id = ?").get(id) as ApprovalRow,
    );
  });
}
