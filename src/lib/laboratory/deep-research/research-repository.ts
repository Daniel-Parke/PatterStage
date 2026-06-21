// ═══════════════════════════════════════════════════════════════
// laboratory/deep-research/research-repository.ts — CRUD for research runs/steps
//
// Mirrors the benchmark runs/results persistence shape so the page can list
// runs and replay each run's steps. See 019_deep_research.sql.
// ═══════════════════════════════════════════════════════════════

import { db, uuid, now } from "@/lib/db";
import { parseStringArrayOrEmpty } from "@/lib/db/parse-json";
import type { ResearchRun, ResearchStatus, ResearchStep, ResearchStepKind } from "./types";

interface RunRow {
  id: string;
  query: string;
  status: string;
  provider: string | null;
  model_id: string | null;
  report: string | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

interface StepRow {
  id: string;
  run_id: string;
  position: number;
  kind: string;
  input: string | null;
  output: string | null;
  sources_json: string | null;
  created_at: string;
}

function rowToRun(row: RunRow): ResearchRun {
  return {
    id: row.id,
    query: row.query,
    status: row.status as ResearchStatus,
    provider: row.provider,
    modelId: row.model_id,
    report: row.report,
    error: row.error,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

function rowToStep(row: StepRow): ResearchStep {
  return {
    id: row.id,
    runId: row.run_id,
    position: row.position,
    kind: row.kind as ResearchStepKind,
    input: row.input,
    output: row.output,
    sources: parseStringArrayOrEmpty(row.sources_json),
    createdAt: row.created_at,
  };
}

export function createResearchRun(input: { query: string; modelId?: string | null }): ResearchRun {
  const id = uuid();
  db()
    .prepare(
      "INSERT INTO research_runs (id, query, status, model_id, created_at) VALUES (?, ?, 'pending', ?, ?)",
    )
    .run(id, input.query, input.modelId ?? null, now());
  return getResearchRun(id)!;
}

export function getResearchRun(id: string): ResearchRun | null {
  const row = db().prepare("SELECT * FROM research_runs WHERE id = ?").get(id) as RunRow | undefined;
  return row ? rowToRun(row) : null;
}

export function listResearchRuns(limit = 50): ResearchRun[] {
  const rows = db()
    .prepare("SELECT * FROM research_runs ORDER BY created_at DESC LIMIT ?")
    .all(Math.max(1, Math.floor(limit))) as RunRow[];
  return rows.map(rowToRun);
}

export interface UpdateResearchRunInput {
  status?: ResearchStatus;
  provider?: string | null;
  report?: string | null;
  error?: string | null;
  completedAt?: string | null;
}

export function updateResearchRun(id: string, input: UpdateResearchRunInput): ResearchRun | null {
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (input.status !== undefined) { sets.push("status = ?"); vals.push(input.status); }
  if (input.provider !== undefined) { sets.push("provider = ?"); vals.push(input.provider); }
  if (input.report !== undefined) { sets.push("report = ?"); vals.push(input.report); }
  if (input.error !== undefined) { sets.push("error = ?"); vals.push(input.error); }
  if (input.completedAt !== undefined) { sets.push("completed_at = ?"); vals.push(input.completedAt); }
  if (sets.length === 0) return getResearchRun(id);
  db().prepare(`UPDATE research_runs SET ${sets.join(", ")} WHERE id = ?`).run(...vals, id);
  return getResearchRun(id);
}

export function insertResearchStep(input: {
  runId: string;
  position: number;
  kind: ResearchStepKind;
  input: string | null;
  output: string | null;
  sources: string[];
}): void {
  db()
    .prepare(
      `INSERT INTO research_steps (id, run_id, position, kind, input, output, sources_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      uuid(),
      input.runId,
      input.position,
      input.kind,
      input.input,
      input.output,
      input.sources.length ? JSON.stringify(input.sources) : null,
      now(),
    );
}

export function listResearchSteps(runId: string): ResearchStep[] {
  const rows = db()
    .prepare("SELECT * FROM research_steps WHERE run_id = ? ORDER BY position ASC")
    .all(runId) as StepRow[];
  return rows.map(rowToStep);
}
