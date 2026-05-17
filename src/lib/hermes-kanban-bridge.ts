import { homedir } from "os";
import { join } from "path";
import { execSync } from "child_process";
import Database from "better-sqlite3";

// Types
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
  max_runtime_seconds: number | null;
  current_run_id: number | null;
  skills: string | null;
}

export interface KanbanTaskDetail extends KanbanTask {
  comments: Array<{ id: number; task_id: string; author: string; body: string; created_at: number }>;
  parents: string[];
  children: string[];
  runs: Array<{ id: number; task_id: string; profile: string | null; outcome: string | null; summary: string | null; metadata: string | null; started_at: number; ended_at: number | null; error: string | null }>;
  events: Array<{ id: number; task_id: string; run_id: number | null; kind: string; payload: string | null; created_at: number }>;
}

export interface KanbanBoardSummary {
  by_status: Record<string, number>;
  by_assignee: Record<string, number>;
}

// Resolve the Hermes kanban DB path
function getKanbanDbPath(): string {
  return join(homedir(), ".hermes", "kanban.db");
}

// Read-only SQLite connection (WAL mode — safe for concurrent readers)
let _db: Database.Database | null = null;
function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(getKanbanDbPath(), { readonly: true });
    _db.pragma("journal_mode = WAL");
  }
  return _db;
}

// Helper: run hermes CLI command and parse JSON output
function hermesCli(args: string[]): unknown {
  const fullCmd = `hermes kanban ${args.join(" ")} --json`;
  const output = execSync(fullCmd, {
    encoding: "utf-8",
    timeout: 15000,
    env: { ...process.env, HOME: homedir() },
  });
  return JSON.parse(output.trim());
}

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
  
  const parents = db.prepare("SELECT parent_id FROM task_links WHERE child_id = ?").all(id) as Array<{ parent_id: string }>;
  const _parents = parents.map((r) => r.parent_id);
  const children = db.prepare("SELECT child_id FROM task_links WHERE parent_id = ?").all(id) as Array<{ child_id: string }>;
  const _children = children.map((r) => r.child_id);
  const comments = db.prepare("SELECT * FROM task_comments WHERE task_id = ? ORDER BY created_at ASC").all(id) as Array<{
    id: number; task_id: string; author: string; body: string; created_at: number;
  }>;
  const runs = db.prepare("SELECT * FROM task_runs WHERE task_id = ? ORDER BY started_at DESC").all(id) as Array<{
    id: number; task_id: string; profile: string | null; outcome: string | null;
    summary: string | null; metadata: string | null;
    started_at: number; ended_at: number | null; error: string | null;
  }>;
  const events = db.prepare("SELECT * FROM task_events WHERE task_id = ? ORDER BY id DESC LIMIT 50").all(id) as Array<{
    id: number; task_id: string; run_id: number | null; kind: string;
    payload: string | null; created_at: number;
  }>;

  return { ...task, parents: _parents, children: _children, comments, runs, events };
}

export function getBoardSummary(): KanbanBoardSummary {
  const db = getDb();
  const byStatus = db.prepare("SELECT status, COUNT(*) as count FROM tasks GROUP BY status").all() as Array<{ status: string; count: number }>;
  const byAssignee = db.prepare("SELECT assignee, COUNT(*) as count FROM tasks WHERE assignee IS NOT NULL GROUP BY assignee").all() as Array<{ assignee: string; count: number }>;
  
  return {
    by_status: Object.fromEntries(byStatus.map(r => [r.status, r.count])),
    by_assignee: Object.fromEntries(byAssignee.map(r => [r.assignee, r.count])),
  };
}

// Writes — proxy through hermes CLI for consistency

export function createTask(title: string, options?: {
  body?: string;
  assignee?: string;
  priority?: number;
  tenant?: string;
  triage?: boolean;
  skills?: string[];
  parent?: string;
}): { task_id: string } {
  const args = [`create "${title.replace(/"/g, '\\"')}"`];
  if (options?.body) args.push(`--body "${options.body.replace(/"/g, '\\"')}"`);
  if (options?.assignee) args.push(`--assignee ${options.assignee}`);
  if (options?.priority) args.push(`--priority ${options.priority}`);
  if (options?.tenant) args.push(`--tenant ${options.tenant}`);
  if (options?.triage) args.push("--triage");
  if (options?.skills) options.skills.forEach(s => args.push(`--skill ${s}`));
  if (options?.parent) args.push(`--parent ${options.parent}`);
  
  return hermesCli(args) as { task_id: string };
}

export function completeTask(id: string, summary?: string, metadata?: Record<string, unknown>): void {
  const args = [`complete ${id}`];
  if (summary) args.push(`--summary "${summary.replace(/"/g, '\\"')}"`);
  if (metadata) args.push(`--metadata '${JSON.stringify(metadata)}'`);
  hermesCli(args);
}

export function blockTask(id: string, reason: string): void {
  hermesCli([`block ${id}`, `"${reason.replace(/"/g, '\\"')}"`]);
}

export function unblockTask(id: string): void {
  hermesCli([`unblock ${id}`]);
}

export function assignTask(id: string, assignee: string): void {
  hermesCli([`assign ${id} ${assignee}`]);
}

export function addComment(taskId: string, text: string): void {
  const args = [`comment ${taskId}`, `"${text.replace(/"/g, '\\"')}"`];
  hermesCli(args);
}

export function linkTasks(parentId: string, childId: string): void {
  hermesCli([`link ${parentId} ${childId}`]);
}

export function archiveTask(id: string): void {
  hermesCli([`archive ${id}`]);
}

export function getAssignees(): Array<{ profile: string; task_count: number }> {
  return hermesCli(["assignees"]) as Array<{ profile: string; task_count: number }>;
}

export function dispatchNow(max?: number): void {
  const args = ["dispatch"];
  if (max) args.push(`--max ${max}`);
  hermesCli(args);
}
