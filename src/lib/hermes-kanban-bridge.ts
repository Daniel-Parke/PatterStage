// ═══════════════════════════════════════════════════════════════
// Hermes Kanban Bridge — Control Hub ↔ Hermes kanban interface
// ═══════════════════════════════════════════════════════════════
// Reads: Direct SQLite on ~/.hermes/kanban.db (WAL mode, read-only)
// Writes: Promisified "hermes kanban <action>" CLI calls
//
// This bridge wraps ALL available CLI verbs and create flags from
// "hermes kanban --help". Every write action uses exec() wrapped in
// a Promise (not execSync) to avoid blocking the Next.js event loop.
//
// CLI reference: hermes kanban [action] --json
// ═══════════════════════════════════════════════════════════════

import { homedir } from "os";
import { join } from "path";
import { exec } from "child_process";
import { promisify } from "util";
import Database from "better-sqlite3";

const execAsync = promisify(exec);

// ── Types ──────────────────────────────────────────────────────────

/** A kanban task as stored in the Hermes SQLite DB. */
export interface KanbanTask {
  id: string;
  title: string;
  body: string | null;
  assignee: string | null;
  status: "triage" | "todo" | "ready" | "running" | "blocked" | "done" | "archived";
  priority: number;
  tenant: string | null;
  created_at: number;
  updated_at: number;
  result: string | null;
  summary: string | null;
  max_runtime_seconds: number | null;
  current_run_id: number | null;
  skills: string | null;
  workflow_template_id: string | null;
  current_step_key: string | null;
  created_by: string | null;
  spawn_failures: number;
  consecutive_failures: number;
  max_retries: number | null;
  claim_expires_at: number | null;
  workspace_kind: string | null;
  workspace_path: string | null;
  idempotency_key: string | null;
}

/** Full task detail with linked data. */
export interface KanbanTaskDetail extends KanbanTask {
  comments: KanbanComment[];
  parents: string[];
  children: string[];
  runs: KanbanRun[];
  events: KanbanEvent[];
}

export interface KanbanComment {
  id: number;
  task_id: string;
  author: string;
  body: string;
  created_at: number;
}

export interface KanbanRun {
  id: number;
  task_id: string;
  profile: string | null;
  outcome: string | null;
  summary: string | null;
  metadata: string | null;
  started_at: number;
  ended_at: number | null;
  error: string | null;
}

export interface KanbanEvent {
  id: number;
  task_id: string;
  run_id: number | null;
  kind: string;
  payload: string | null;
  created_at: number;
}

export interface KanbanBoardSummary {
  by_status: Record<string, number>;
  by_assignee: Record<string, number>;
}

export interface KanbanDiagnostic {
  task_id: string;
  title: string;
  status: string;
  assignee: string | null;
  issue: string;
  severity: "warning" | "error" | "info";
}

export interface KanbanBoard {
  slug: string;
  name: string;
  task_count: number;
}

export interface KanbanCreateOptions {
  body?: string;
  assignee?: string;
  priority?: number;
  tenant?: string;
  triage?: boolean;
  skills?: string[];
  parent?: string;
  /** Workspace kind: scratch (tmp), dir:<path>, or worktree:<branch> */
  workspace?: string;
  maxRuntime?: number;
  idempotencyKey?: string;
  maxRetries?: number;
  createdBy?: string;
}

// ── Helpers ────────────────────────────────────────────────────────

function getKanbanDbPath(): string {
  return join(homedir(), ".hermes", "kanban.db");
}

let _db: Database.Database | null = null;
function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(getKanbanDbPath(), { readonly: true });
    _db.pragma("journal_mode = WAL");
  }
  return _db;
}

/** Escape shell arguments safely — no subprocess injection vectors. */
function shellEsc(s: string): string {
  // Use single-quote escaping: replace ' with '\'' then wrap in '
  return `'${s.replace(/'/g, "'\\''")}'`;
}

/** Run "hermes kanban <args>" and parse JSON output. Promisified. */
async function hermesCli(args: string[], timeoutMs = 15_000): Promise<unknown> {
  const fullCmd = `hermes kanban ${args.join(" ")} --json`;
  const { stdout } = await execAsync(fullCmd, {
    encoding: "utf-8",
    timeout: timeoutMs,
    env: { ...process.env, HOME: homedir() },
  });
  return JSON.parse(stdout.trim());
}

// ── Reads (SQLite, synchronous, fast) ──────────────────────────────

export function listTasks(filters?: {
  assignee?: string;
  status?: string;
  tenant?: string;
  include_archived?: boolean;
  limit?: number;
}): KanbanTask[] {
  const db = getDb();
  let sql = "SELECT * FROM tasks WHERE 1=1";
  const params: unknown[] = [];

  if (filters?.assignee) {
    sql += " AND assignee = ?";
    params.push(filters.assignee);
  }
  if (filters?.status) {
    sql += " AND status = ?";
    params.push(filters.status);
  }
  if (filters?.tenant) {
    sql += " AND tenant = ?";
    params.push(filters.tenant);
  }
  if (!filters?.include_archived) {
    sql += " AND status != 'archived'";
  }

  sql += " ORDER BY created_at DESC";
  if (filters?.limit) {
    sql += " LIMIT ?";
    params.push(filters.limit);
  }

  return db.prepare(sql).all(...params) as KanbanTask[];
}

export function getTask(id: string): KanbanTaskDetail | null {
  const db = getDb();
  const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as KanbanTask | undefined;
  if (!task) return null;

  const parentRows = db
    .prepare("SELECT parent_id FROM task_links WHERE child_id = ?")
    .all(id) as Array<{ parent_id: string }>;
  const parents = parentRows.map((r) => r.parent_id);

  const childRows = db
    .prepare("SELECT child_id FROM task_links WHERE parent_id = ?")
    .all(id) as Array<{ child_id: string }>;
  const children = childRows.map((r) => r.child_id);

  const comments = db
    .prepare("SELECT * FROM task_comments WHERE task_id = ? ORDER BY created_at ASC")
    .all(id) as KanbanComment[];

  const runs = db
    .prepare("SELECT * FROM task_runs WHERE task_id = ? ORDER BY started_at DESC")
    .all(id) as KanbanRun[];

  const events = db
    .prepare("SELECT * FROM task_events WHERE task_id = ? ORDER BY id DESC LIMIT 100")
    .all(id) as KanbanEvent[];

  return { ...task, parents, children, comments, runs, events };
}

export function getBoardSummary(): KanbanBoardSummary {
  const db = getDb();
  const byStatus = db
    .prepare("SELECT status, COUNT(*) as count FROM tasks GROUP BY status")
    .all() as Array<{ status: string; count: number }>;
  const byAssignee = db
    .prepare("SELECT assignee, COUNT(*) as count FROM tasks WHERE assignee IS NOT NULL GROUP BY assignee")
    .all() as Array<{ assignee: string; count: number }>;

  return {
    by_status: Object.fromEntries(byStatus.map((r) => [r.status, r.count])),
    by_assignee: Object.fromEntries(byAssignee.map((r) => [r.assignee, r.count])),
  };
}

/** Run kanban tail --follow once and return first batch of events. */
export function getRecentEvents(taskId?: string): KanbanEvent[] {
  const db = getDb();
  if (taskId) {
    return db
      .prepare("SELECT * FROM task_events WHERE task_id = ? ORDER BY id DESC LIMIT 50")
      .all(taskId) as KanbanEvent[];
  }
  return db
    .prepare("SELECT * FROM task_events ORDER BY id DESC LIMIT 50")
    .all() as KanbanEvent[];
}

/** Get the latest event ID for SSE tracking. */
export function getLatestEventId(): number {
  const db = getDb();
  const row = db.prepare("SELECT MAX(id) as max_id FROM task_events").get() as { max_id: number | null };
  return row?.max_id ?? 0;
}

// ── Writes (async CLI calls) ───────────────────────────────────────

/** Create a new kanban task. */
export async function createTask(title: string, options?: KanbanCreateOptions): Promise<{ task_id: string }> {
  const args: string[] = ["create", shellEsc(title)];
  if (options?.body) args.push("--body", shellEsc(options.body));
  if (options?.assignee) args.push("--assignee", options.assignee);
  if (options?.priority) args.push("--priority", String(options.priority));
  if (options?.tenant) args.push("--tenant", options.tenant);
  if (options?.triage) args.push("--triage");
  if (options?.skills) for (const s of options.skills) args.push("--skill", s);
  if (options?.parent) args.push("--parent", options.parent);
  if (options?.workspace) args.push("--workspace", options.workspace);
  if (options?.maxRuntime) args.push("--max-runtime", String(options.maxRuntime));
  if (options?.idempotencyKey) args.push("--idempotency-key", options.idempotencyKey);
  if (options?.maxRetries) args.push("--max-retries", String(options.maxRetries));
  if (options?.createdBy) args.push("--created-by", options.createdBy);

  return (await hermesCli(args)) as { task_id: string };
}

/** Mark a task as complete with summary + metadata. */
export async function completeTask(
  id: string,
  summary?: string,
  metadata?: Record<string, unknown>,
  createdCards?: string[],
): Promise<void> {
  const args: string[] = ["complete", id];
  if (summary) args.push("--summary", shellEsc(summary));
  if (metadata) args.push("--metadata", `'${JSON.stringify(metadata)}'`);
  if (createdCards) for (const c of createdCards) args.push("--created-card", c);
  await hermesCli(args);
}

/** Block a task with a human-readable reason. */
export async function blockTask(id: string, reason: string): Promise<void> {
  await hermesCli(["block", id, shellEsc(reason)]);
}

/** Unblock a previously-blocked task. */
export async function unblockTask(id: string): Promise<void> {
  await hermesCli(["unblock", id]);
}

/** Assign a task to a profile. */
export async function assignTask(id: string, assignee: string, reclaim?: boolean): Promise<void> {
  const args: string[] = ["assign", id, assignee];
  if (reclaim) args.push("--reclaim");
  await hermesCli(args);
}

/** Reclaim a task from a stuck worker — force-release the claim. */
export async function reclaimTask(id: string): Promise<void> {
  await hermesCli(["reclaim", id]);
}

/** Reassign a task to a different profile, optionally reclaiming first. */
export async function reassignTask(id: string, newAssignee: string, reclaim?: boolean): Promise<void> {
  const args: string[] = ["reassign", id, newAssignee];
  if (reclaim) args.push("--reclaim");
  await hermesCli(args);
}

/** Specify (LLM-expand) a triage task into a full task. */
export async function specifyTask(id: string): Promise<{ task_id: string }> {
  return (await hermesCli(["specify", id])) as { task_id: string };
}

/** Add a comment to a task. */
export async function addComment(taskId: string, text: string): Promise<void> {
  await hermesCli(["comment", taskId, shellEsc(text)]);
}

/** Link a parent task to a child task (dependency). */
export async function linkTasks(parentId: string, childId: string): Promise<void> {
  await hermesCli(["link", parentId, childId]);
}

/** Remove a parent→child dependency link. */
export async function unlinkTasks(parentId: string, childId: string): Promise<void> {
  await hermesCli(["unlink", parentId, childId]);
}

/** Edit a task's result/summary/metadata after completion. */
export async function editTask(id: string, updates: { result?: string; summary?: string; metadata?: Record<string, unknown> }): Promise<void> {
  const args: string[] = ["edit", id];
  if (updates.result) args.push("--result", shellEsc(updates.result));
  if (updates.summary) args.push("--summary", shellEsc(updates.summary));
  if (updates.metadata) args.push("--metadata", `'${JSON.stringify(updates.metadata)}'`);
  await hermesCli(args);
}

/** Archive a task (removes from default board view). */
export async function archiveTask(id: string): Promise<void> {
  await hermesCli(["archive", id]);
}

/** Get task execution context (workspace, env, retry info). */
export async function getTaskContext(id: string): Promise<Record<string, unknown>> {
  return (await hermesCli(["context", id])) as Record<string, unknown>;
}

/** Get available assignees (profiles) with task counts. */
export async function getAssignees(): Promise<Array<{ profile: string; task_count: number }>> {
  return (await hermesCli(["assignees"])) as Array<{ profile: string; task_count: number }>;
}

/** List runs for a task, optionally filtered by outcome. */
export async function listRuns(taskId?: string, outcome?: string): Promise<KanbanRun[]> {
  const args: string[] = ["runs"];
  if (taskId) args.push("--task", taskId);
  if (outcome) args.push("--outcome", outcome);
  return (await hermesCli(args)) as KanbanRun[];
}

/** Get active diagnostics for the kanban system. */
export async function getDiagnostics(): Promise<KanbanDiagnostic[]> {
  return (await hermesCli(["diagnostics"])) as KanbanDiagnostic[];
}

/** List all boards. */
export async function listBoards(): Promise<KanbanBoard[]> {
  return (await hermesCli(["boards"])) as KanbanBoard[];
}

/** Get stats for a specific board. */
export async function getBoardStats(board?: string): Promise<KanbanBoardSummary> {
  const args: string[] = ["stats"];
  if (board) args.push("--board", board);
  return (await hermesCli(args)) as KanbanBoardSummary;
}

/** Nudge the kanban dispatcher to process ready tasks. */
export async function dispatchNow(max?: number): Promise<void> {
  const args: string[] = ["dispatch"];
  if (max) args.push("--max", String(max));
  await hermesCli(args);
}

/** Subscribe to kanban notifications for a webhook URL. */
export async function notifySubscribe(url: string, events?: string[]): Promise<void> {
  const args: string[] = ["notify-subscribe", url];
  if (events) for (const e of events) args.push("--event", e);
  await hermesCli(args);
}
