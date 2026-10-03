// ═══════════════════════════════════════════════════════════════
// composer/composer-repository.ts — CRUD + graph navigation for Composer
//
// Workflows (definitions) + runs/node-runs (executions) + approvals. The
// engine (ComposerTick + dispatch + reconcile) and the API build on these.
// ═══════════════════════════════════════════════════════════════

import { getDb, inTransaction, uuid, now } from "@/lib/db";
import { parseJson, parseBool } from "@/lib/db/parse-json";
import { workflowDefSchema } from "./schema";
import type {
  ApprovalAction,
  ComposerApproval,
  ComposerEdge,
  ComposerNode,
  ComposerNodeRun,
  ComposerRun,
  ComposerRunStatus,
  ComposerWorkflow,
  ComposerWorkflowGraph,
  EdgeCondition,
  NodeGate,
  NodeRunStatus,
  NodeVerdict,
  WorkflowDef,
} from "./schema";

// ── Row shapes + mappers ─────────────────────────────────────────
interface WorkflowRow { id: string; key: string | null; name: string; description: string; version: number; created_at: string; updated_at: string; }
interface NodeRow { id: string; workflow_id: string; key: string; label: string; kind: string; gate: string; is_start: number; is_terminal: number; config_json: string | null; pos: number; }
interface EdgeRow { id: string; workflow_id: string; from_node_id: string; to_node_id: string; condition: string; label: string | null; }
interface RunRow { id: string; workflow_id: string; status: string; current_node_id: string | null; input: string | null; context_json: string | null; profile_name: string | null; error: string | null; parent_node_run_id: string | null; created_at: string; updated_at: string; completed_at: string | null; }
interface NodeRunRow { id: string; composer_run_id: string; node_id: string; attempt: number; status: string; run_id: string | null; input: string | null; output: string | null; verdict_json: string | null; error: string | null; started_at: string | null; completed_at: string | null; created_at: string; }
interface ApprovalRow { id: string; composer_run_id: string; node_id: string; action: string; approved: number; note: string | null; decided_by: string; created_at: string; }

function rowToWorkflow(r: WorkflowRow): ComposerWorkflow {
  return { id: r.id, key: r.key, name: r.name, description: r.description, version: r.version, createdAt: r.created_at, updatedAt: r.updated_at };
}
function rowToNode(r: NodeRow): ComposerNode {
  return { id: r.id, workflowId: r.workflow_id, key: r.key, label: r.label, kind: r.kind, gate: r.gate as NodeGate, isStart: r.is_start === 1, isTerminal: r.is_terminal === 1, config: parseJson<Record<string, unknown>>(r.config_json), pos: r.pos };
}
function rowToEdge(r: EdgeRow): ComposerEdge {
  return { id: r.id, workflowId: r.workflow_id, fromNodeId: r.from_node_id, toNodeId: r.to_node_id, condition: r.condition as EdgeCondition, label: r.label };
}
function rowToRun(r: RunRow): ComposerRun {
  return { id: r.id, workflowId: r.workflow_id, status: r.status as ComposerRunStatus, currentNodeId: r.current_node_id, input: r.input, context: parseJson<Record<string, unknown>>(r.context_json), profileName: r.profile_name, error: r.error, parentNodeRunId: r.parent_node_run_id ?? null, createdAt: r.created_at, updatedAt: r.updated_at, completedAt: r.completed_at };
}
function rowToNodeRun(r: NodeRunRow): ComposerNodeRun {
  return { id: r.id, composerRunId: r.composer_run_id, nodeId: r.node_id, attempt: r.attempt, status: r.status as NodeRunStatus, runId: r.run_id, input: r.input, output: r.output, verdict: parseJson<NodeVerdict>(r.verdict_json), error: r.error, startedAt: r.started_at, completedAt: r.completed_at, createdAt: r.created_at };
}
function rowToApproval(r: ApprovalRow): ComposerApproval {
  return { id: r.id, composerRunId: r.composer_run_id, nodeId: r.node_id, action: r.action as ApprovalAction, approved: parseBool(r.approved) ?? false, note: r.note, decidedBy: r.decided_by, createdAt: r.created_at };
}

// ── Workflows (definitions) ──────────────────────────────────────

/** Create a workflow graph from a definition. Idempotent by `key`: re-creating
 *  the same key replaces the prior graph (bumping version). */
export function createWorkflowFromDef(input: WorkflowDef): ComposerWorkflowGraph {
  const def = workflowDefSchema.parse(input); // applies defaults (condition, description, …)
  return inTransaction(() => {
    const ts = now();
    let workflowId = uuid();
    let version = 1;
    if (def.key) {
      const existing = getDb().prepare("SELECT id, version FROM composer_workflows WHERE key = ?").get(def.key) as { id: string; version: number } | undefined;
      if (existing) {
        workflowId = existing.id;
        version = existing.version + 1;
        getDb().prepare("DELETE FROM composer_nodes WHERE workflow_id = ?").run(workflowId); // edges cascade
        getDb().prepare("UPDATE composer_workflows SET name = ?, description = COALESCE(?, description), version = ?, updated_at = ? WHERE id = ?").run(def.name, def.description ?? null, version, ts, workflowId);
      } else {
        getDb().prepare("INSERT INTO composer_workflows (id, key, name, description, version, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)").run(workflowId, def.key, def.name, def.description ?? "", ts, ts);
      }
    } else {
      getDb().prepare("INSERT INTO composer_workflows (id, key, name, description, version, created_at, updated_at) VALUES (?, NULL, ?, ?, 1, ?, ?)").run(workflowId, def.name, def.description ?? "", ts, ts);
    }

    const nodeIdByKey = new Map<string, string>();
    def.nodes.forEach((n, i) => {
      const id = uuid();
      nodeIdByKey.set(n.key, id);
      getDb().prepare(`INSERT INTO composer_nodes (id, workflow_id, key, label, kind, gate, is_start, is_terminal, config_json, pos, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(id, workflowId, n.key, n.label, n.kind, n.gate, n.isStart ? 1 : 0, n.isTerminal ? 1 : 0, n.config ? JSON.stringify(n.config) : null, i, ts);
    });
    for (const e of def.edges) {
      const from = nodeIdByKey.get(e.from);
      const to = nodeIdByKey.get(e.to);
      if (!from || !to) throw new Error(`edge references unknown node: ${e.from} -> ${e.to}`);
      getDb().prepare("INSERT INTO composer_edges (id, workflow_id, from_node_id, to_node_id, condition, label, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .run(uuid(), workflowId, from, to, e.condition, e.label ?? null, ts);
    }
    return getWorkflowGraph(workflowId)!;
  });
}

export function getWorkflow(id: string): ComposerWorkflow | null {
  const row = getDb().prepare("SELECT * FROM composer_workflows WHERE id = ?").get(id) as WorkflowRow | undefined;
  return row ? rowToWorkflow(row) : null;
}

export function getWorkflowByKey(key: string): ComposerWorkflow | null {
  const row = getDb().prepare("SELECT * FROM composer_workflows WHERE key = ?").get(key) as WorkflowRow | undefined;
  return row ? rowToWorkflow(row) : null;
}

export function listWorkflows(): ComposerWorkflow[] {
  const rows = getDb().prepare("SELECT * FROM composer_workflows ORDER BY name COLLATE NOCASE").all() as WorkflowRow[];
  return rows.map(rowToWorkflow);
}

export function listWorkflowNodes(workflowId: string): ComposerNode[] {
  const rows = getDb().prepare("SELECT * FROM composer_nodes WHERE workflow_id = ? ORDER BY pos ASC").all(workflowId) as NodeRow[];
  return rows.map(rowToNode);
}

export function listWorkflowEdges(workflowId: string): ComposerEdge[] {
  const rows = getDb().prepare("SELECT * FROM composer_edges WHERE workflow_id = ?").all(workflowId) as EdgeRow[];
  return rows.map(rowToEdge);
}

export function getWorkflowGraph(id: string): ComposerWorkflowGraph | null {
  const wf = getWorkflow(id);
  if (!wf) return null;
  return { ...wf, nodes: listWorkflowNodes(id), edges: listWorkflowEdges(id) };
}

export function getNode(id: string): ComposerNode | null {
  const row = getDb().prepare("SELECT * FROM composer_nodes WHERE id = ?").get(id) as NodeRow | undefined;
  return row ? rowToNode(row) : null;
}

/** The workflow's start node (is_start = 1; falls back to lowest pos). */
export function getStartNode(workflowId: string): ComposerNode | null {
  const row = getDb().prepare("SELECT * FROM composer_nodes WHERE workflow_id = ? ORDER BY is_start DESC, pos ASC LIMIT 1").get(workflowId) as NodeRow | undefined;
  return row ? rowToNode(row) : null;
}

/** Outgoing edges from a node (the engine picks one by matching the guard). */
export function getOutgoingEdges(nodeId: string): ComposerEdge[] {
  const rows = getDb().prepare("SELECT * FROM composer_edges WHERE from_node_id = ?").all(nodeId) as EdgeRow[];
  return rows.map(rowToEdge);
}

// ── Workflow mutation (the builder saves the whole graph atomically) ──

/**
 * Replace a workflow's whole graph (name/description + all nodes + edges) in one
 * transaction, bumping its version. The structured builder holds the graph in
 * state and PUTs it wholesale — atomic, with no partial-edit races.
 */
/** How many completed runs a structural edit would destroy. */
/** How many runs a structural edit or a delete would destroy. */
export function countWorkflowRuns(workflowId: string): number {
  const row = getDb()
    .prepare("SELECT COUNT(*) AS n FROM composer_runs WHERE workflow_id = ?")
    .get(workflowId) as { n: number } | undefined;
  return row?.n ?? 0;
}

export class WorkflowHistoryWouldBeLost extends Error {
  constructor(readonly runCount: number) {
    super(
      `Saving this workflow would delete ${runCount} completed run(s) of it, including their stage outputs and approvals.`,
    );
    this.name = "WorkflowHistoryWouldBeLost";
  }
}

/**
 * Replace a workflow's whole graph.
 *
 * `composer_node_runs.node_id` references `composer_nodes` with no cascade, so
 * the structural replace cannot drop the old nodes while run history points at
 * them — and the original implementation resolved that by silently deleting
 * every run of the workflow. Renaming one stage destroyed the entire audit
 * trail, with no warning and no undo.
 *
 * Until node rows are versioned rather than replaced (the real fix: history
 * keeps pointing at the node version it ran against), this refuses to run when
 * history exists. `discardRunHistory` is the caller's explicit, informed consent.
 */
export function replaceWorkflowGraph(
  workflowId: string,
  input: WorkflowDef,
  opts: { discardRunHistory?: boolean } = {},
): ComposerWorkflowGraph | null {
  if (!getWorkflow(workflowId)) return null;
  const def = workflowDefSchema.parse(input); // applies defaults + validates

  const runCount = countWorkflowRuns(workflowId);
  if (runCount > 0 && !opts.discardRunHistory) {
    throw new WorkflowHistoryWouldBeLost(runCount);
  }

  return inTransaction(() => {
    const ts = now();
    getDb().prepare("DELETE FROM composer_runs WHERE workflow_id = ?").run(workflowId); // cascades node_runs + approvals
    getDb().prepare("DELETE FROM composer_nodes WHERE workflow_id = ?").run(workflowId); // edges cascade
    // COALESCE, not a bare write: the Build tab saves a canvas, and a canvas
    // that carried no description blanked the stored one every time it was
    // saved (T-0106, D2). Absent means leave it; "" means clear it.
    getDb().prepare("UPDATE composer_workflows SET name = ?, description = COALESCE(?, description), version = version + 1, updated_at = ? WHERE id = ?")
      .run(def.name, def.description ?? null, ts, workflowId);

    const nodeIdByKey = new Map<string, string>();
    def.nodes.forEach((n, i) => {
      const id = uuid();
      nodeIdByKey.set(n.key, id);
      getDb().prepare(`INSERT INTO composer_nodes (id, workflow_id, key, label, kind, gate, is_start, is_terminal, config_json, pos, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(id, workflowId, n.key, n.label, n.kind, n.gate, n.isStart ? 1 : 0, n.isTerminal ? 1 : 0, n.config ? JSON.stringify(n.config) : null, i, ts);
    });
    for (const e of def.edges) {
      const from = nodeIdByKey.get(e.from);
      const to = nodeIdByKey.get(e.to);
      if (!from || !to) throw new Error(`edge references unknown node: ${e.from} -> ${e.to}`);
      getDb().prepare("INSERT INTO composer_edges (id, workflow_id, from_node_id, to_node_id, condition, label, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .run(uuid(), workflowId, from, to, e.condition, e.label ?? null, ts);
    }
    return getWorkflowGraph(workflowId)!;
  });
}

export function deleteWorkflow(id: string): boolean {
  if (!getWorkflow(id)) return false;
  inTransaction(() => {
    // Delete runs first (cascades node_runs + approvals) so the workflow delete
    // (which cascades nodes + edges) doesn't hit the runs→workflow FK.
    getDb().prepare("DELETE FROM composer_runs WHERE workflow_id = ?").run(id);
    getDb().prepare("DELETE FROM composer_workflows WHERE id = ?").run(id); // cascades nodes + edges
  });
  return true;
}

/** Whether a workflow has any non-terminal runs (block destructive edits). */
export function workflowHasActiveRuns(workflowId: string): boolean {
  const row = getDb()
    .prepare("SELECT COUNT(*) AS c FROM composer_runs WHERE workflow_id = ? AND status IN ('pending','running','awaiting_approval')")
    .get(workflowId) as { c: number };
  return row.c > 0;
}

// ── Runs ─────────────────────────────────────────────────────────
export function createComposerRun(input: { workflowId: string; input?: string | null; profileName?: string | null; context?: Record<string, unknown> | null; currentNodeId?: string | null; parentNodeRunId?: string | null }): ComposerRun {
  const id = uuid();
  const ts = now();
  getDb().prepare(`INSERT INTO composer_runs (id, workflow_id, status, current_node_id, input, context_json, profile_name, parent_node_run_id, created_at, updated_at)
                VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, input.workflowId, input.currentNodeId ?? null, input.input ?? null, input.context ? JSON.stringify(input.context) : null, input.profileName ?? null, input.parentNodeRunId ?? null, ts, ts);
  return getComposerRun(id)!;
}

/** The latest sub-workflow run spawned by a given "group" node-run (settle seam). */
export function getComposerRunByParentNodeRunId(nodeRunId: string): ComposerRun | null {
  const row = getDb().prepare("SELECT * FROM composer_runs WHERE parent_node_run_id = ? ORDER BY created_at DESC LIMIT 1").get(nodeRunId) as RunRow | undefined;
  return row ? rowToRun(row) : null;
}

export function getComposerRun(id: string): ComposerRun | null {
  const row = getDb().prepare("SELECT * FROM composer_runs WHERE id = ?").get(id) as RunRow | undefined;
  return row ? rowToRun(row) : null;
}

export function listComposerRuns(limit = 50): ComposerRun[] {
  const rows = getDb().prepare("SELECT * FROM composer_runs ORDER BY created_at DESC LIMIT ?").all(Math.max(1, Math.floor(limit))) as RunRow[];
  return rows.map(rowToRun);
}

export function listActiveComposerRuns(): ComposerRun[] {
  const rows = getDb().prepare("SELECT * FROM composer_runs WHERE status IN ('pending','running','awaiting_approval') ORDER BY created_at ASC").all() as RunRow[];
  return rows.map(rowToRun);
}

export interface UpdateComposerRunInput {
  status?: ComposerRunStatus;
  currentNodeId?: string | null;
  /** The run objective — enriched in place when the user answers a clarification. */
  input?: string | null;
  context?: Record<string, unknown> | null;
  error?: string | null;
  completedAt?: string | null;
}
export function updateComposerRun(id: string, patch: UpdateComposerRunInput): ComposerRun | null {
  const sets: string[] = ["updated_at = ?"];
  const vals: unknown[] = [now()];
  if (patch.status !== undefined) { sets.push("status = ?"); vals.push(patch.status); }
  if (patch.currentNodeId !== undefined) { sets.push("current_node_id = ?"); vals.push(patch.currentNodeId); }
  if (patch.input !== undefined) { sets.push("input = ?"); vals.push(patch.input); }
  if (patch.context !== undefined) { sets.push("context_json = ?"); vals.push(patch.context ? JSON.stringify(patch.context) : null); }
  if (patch.error !== undefined) { sets.push("error = ?"); vals.push(patch.error); }
  if (patch.completedAt !== undefined) { sets.push("completed_at = ?"); vals.push(patch.completedAt); }
  getDb().prepare(`UPDATE composer_runs SET ${sets.join(", ")} WHERE id = ?`).run(...vals, id);
  return getComposerRun(id);
}

// ── Node-runs (stage executions) ─────────────────────────────────
export function createNodeRun(input: { composerRunId: string; nodeId: string; attempt?: number; input?: string | null }): ComposerNodeRun {
  const id = uuid();
  const ts = now();
  getDb().prepare(`INSERT INTO composer_node_runs (id, composer_run_id, node_id, attempt, status, input, started_at, created_at)
                VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)`)
    .run(id, input.composerRunId, input.nodeId, input.attempt ?? 1, input.input ?? null, ts, ts);
  return getNodeRun(id)!;
}

export function getNodeRun(id: string): ComposerNodeRun | null {
  const row = getDb().prepare("SELECT * FROM composer_node_runs WHERE id = ?").get(id) as NodeRunRow | undefined;
  return row ? rowToNodeRun(row) : null;
}

/** Find the node-run that owns a given agent run id (reconcile branch). */
export function getNodeRunByRunId(runId: string): ComposerNodeRun | null {
  const row = getDb().prepare("SELECT * FROM composer_node_runs WHERE run_id = ?").get(runId) as NodeRunRow | undefined;
  return row ? rowToNodeRun(row) : null;
}

export function listNodeRuns(composerRunId: string): ComposerNodeRun[] {
  const rows = getDb().prepare("SELECT * FROM composer_node_runs WHERE composer_run_id = ? ORDER BY created_at ASC").all(composerRunId) as NodeRunRow[];
  return rows.map(rowToNodeRun);
}

/** Latest attempt count for a node within a run (for loop re-entry). */
export function maxAttemptForNode(composerRunId: string, nodeId: string): number {
  const row = getDb().prepare("SELECT COALESCE(MAX(attempt), 0) AS a FROM composer_node_runs WHERE composer_run_id = ? AND node_id = ?").get(composerRunId, nodeId) as { a: number };
  return row.a;
}

export interface UpdateNodeRunInput {
  status?: NodeRunStatus;
  runId?: string | null;
  output?: string | null;
  verdict?: NodeVerdict | null;
  error?: string | null;
  completedAt?: string | null;
}
export function updateNodeRun(id: string, input: UpdateNodeRunInput): ComposerNodeRun | null {
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (input.status !== undefined) { sets.push("status = ?"); vals.push(input.status); }
  if (input.runId !== undefined) { sets.push("run_id = ?"); vals.push(input.runId); }
  if (input.output !== undefined) { sets.push("output = ?"); vals.push(input.output); }
  if (input.verdict !== undefined) { sets.push("verdict_json = ?"); vals.push(input.verdict ? JSON.stringify(input.verdict) : null); }
  if (input.error !== undefined) { sets.push("error = ?"); vals.push(input.error); }
  if (input.completedAt !== undefined) { sets.push("completed_at = ?"); vals.push(input.completedAt); }
  if (sets.length === 0) return getNodeRun(id);
  getDb().prepare(`UPDATE composer_node_runs SET ${sets.join(", ")} WHERE id = ?`).run(...vals, id);
  return getNodeRun(id);
}

// ── Approvals ────────────────────────────────────────────────────
export function recordComposerApproval(input: { composerRunId: string; nodeId: string; action: ApprovalAction; note?: string | null; decidedBy?: string }): ComposerApproval {
  const id = uuid();
  const approved = input.action === "accept";
  getDb().prepare(`INSERT INTO composer_approvals (id, composer_run_id, node_id, action, approved, note, decided_by, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, input.composerRunId, input.nodeId, input.action, approved ? 1 : 0, input.note ?? null, input.decidedBy ?? "user", now());
  return rowToApproval(getDb().prepare("SELECT * FROM composer_approvals WHERE id = ?").get(id) as ApprovalRow);
}

export function listComposerApprovals(composerRunId: string): ComposerApproval[] {
  const rows = getDb().prepare("SELECT * FROM composer_approvals WHERE composer_run_id = ? ORDER BY created_at ASC").all(composerRunId) as ApprovalRow[];
  return rows.map(rowToApproval);
}

// ── Seed back-fills ──────────────────────────────────────────
//
// The two statements behind composer/seed.ts, which idempotently
// back-fills the shipped workflow on installs that predate a change to
// its definition. They are here, beside createWorkflowFromDef's own
// inserts, because they write the same two tables.

/** Insert one edge into an existing workflow. */
export function insertWorkflowEdge(edge: {
  id: string;
  workflowId: string;
  fromNodeId: string;
  toNodeId: string;
  condition: string;
  /** Nullable, as the column is: an unlabelled edge is the ordinary case, and
   *  createWorkflowFromDef has always written null here. */
  label: string | null;
  createdAt: string;
}): void {
  getDb()
    .prepare(
      "INSERT INTO composer_edges (id, workflow_id, from_node_id, to_node_id, condition, label, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .run(edge.id, edge.workflowId, edge.fromNodeId, edge.toNodeId, edge.condition, edge.label, edge.createdAt);
}

/** Replace one node's serialised config. */
/**
 * Clear the End flag on one node, leaving everything else about it alone.
 *
 * Exists for the seed repair: a stage marked End runs no agent, so a stage that
 * was meant to produce something and got marked End produces nothing and the run
 * still reports success. Narrow rather than a general node update, because that
 * is the only field the repair is entitled to touch.
 */
export function clearWorkflowNodeTerminal(nodeId: string): void {
  getDb().prepare("UPDATE composer_nodes SET is_terminal = 0 WHERE id = ?").run(nodeId);
}

/**
 * Add one node to a workflow that already exists.
 *
 * `createWorkflowFromDef` builds a whole workflow from a definition and is
 * idempotent by key, so it cannot add a missing end marker to an install that
 * already has the workflow. This can, and returns the row so the caller can
 * wire an edge to it.
 */
export function insertWorkflowNode(node: {
  id: string;
  workflowId: string;
  key: string;
  label: string;
  kind: string;
  gate: string;
  isStart: boolean;
  isTerminal: boolean;
  configJson: string | null;
  pos: number;
  createdAt: string;
}): ComposerNode {
  getDb()
    .prepare(
      `INSERT INTO composer_nodes (id, workflow_id, key, label, kind, gate, is_start, is_terminal, config_json, pos, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      node.id,
      node.workflowId,
      node.key,
      node.label,
      node.kind,
      node.gate,
      node.isStart ? 1 : 0,
      node.isTerminal ? 1 : 0,
      node.configJson,
      node.pos,
      node.createdAt,
    );
  return getNode(node.id)!;
}

export function updateWorkflowNodeConfig(nodeId: string, configJson: string): void {
  getDb()
    .prepare("UPDATE composer_nodes SET config_json = ? WHERE id = ?")
    .run(configJson, nodeId);
}
