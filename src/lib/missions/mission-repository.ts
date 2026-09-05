// ═══════════════════════════════════════════════════════════════
// mission-repository.ts — Mission CRUD via SQLite
// ═══════════════════════════════════════════════════════════════

import { clampLimit, MISSION_LIST_BOUNDS } from "@/lib/list-bounds";
import { existsSync, unlinkSync } from "fs";
import { join } from "path";

import { getDb, inTransaction, uuid, now } from "../db";
import { safeJsonParse } from "../utils";
import { PATHS } from "../paths";
import type { Mission, MissionStatus } from "@/lib/missions/mission-types";
// Type-only, so it is erased at compile time and no runtime cycle is
// created with the audit module that consumes these two functions.
import type { ForeignMissionModelRow } from "@/lib/missions/mission-model-audit";
import type { LocalDirEntry } from "@/types/console";
import { normalizeLocalDirsInput } from "@/lib/fs/local-dir-entry";

// ── Row shape ─────────────────────────────────────────────────

interface MissionRow {
  id: string;
  name: string;
  prompt: string;
  profile_id: string | null;
  status: string;
  result: string | null;
  session_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  // New columns (may be null on pre-migration DBs)
  local_dirs: string | null;
  references_: string | null;
  skills: string | null;
  suggested_toolsets: string | null;
  goals: string | null;
  model_id: string | null;
  provider: string | null;
  profile_name: string | null;
  mission_time_minutes: number | null;
  timeout_minutes: number | null;
  schedule: string | null;
  cron_job_id: string | null;
  category_id: string | null;
  output_format: string | null;
  constraints: string | null;
  queued_for_run?: number | null;
}

function rowToMission(row: MissionRow | undefined): Mission | null {
  if (!row || row.deleted_at) return null;
  return {
    id: row.id,
    name: row.name,
    prompt: row.prompt,
    profileId: row.profile_id ?? undefined,
    status: row.status as MissionStatus,
    result: row.result ?? undefined,
    sessionId: row.session_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // Extended fields
    localDirs: normalizeLocalDirsInput(safeJsonParse(row.local_dirs, [] as unknown[])),
    references: safeJsonParse(row.references_, [] as string[]),
    skills: safeJsonParse(row.skills, [] as string[]),
    suggestedToolsets: safeJsonParse(row.suggested_toolsets, [] as string[]),
    goals: safeJsonParse(row.goals, [] as string[]),
    // Runtime settings (migration 013 — may be null on pre-migration DBs)
    modelId: row.model_id ?? undefined,
    provider: row.provider ?? undefined,
    profileName: row.profile_name ?? undefined,
    missionTimeMinutes: row.mission_time_minutes ?? undefined,
    timeoutMinutes: row.timeout_minutes ?? undefined,
    schedule: row.schedule ?? undefined,
    cronJobId: row.cron_job_id ?? undefined,
    categoryId: row.category_id ?? undefined,
    outputFormat: row.output_format ?? undefined,
    constraints: row.constraints ?? undefined,
    queuedForRun: row.queued_for_run != null ? row.queued_for_run === 1 : undefined,
  };
}

// ── Prompt builder (delegates to shared utility) ───────────────
// Keeps the stored prompt complete (used by both dispatch and cron).

export { buildMissionPrompt } from "@/lib/missions/build-mission-prompt";

// ── CRUD ─────────────────────────────────────────────────────

/** Oldest mission waiting for background queue dispatch. */
export function getNextQueuedMission(): Mission | null {
  const row = getDb()
    .prepare(
      `SELECT * FROM missions
       WHERE deleted_at IS NULL
         AND status = 'queued'
         AND COALESCE(queued_for_run, 0) = 1
       ORDER BY created_at ASC
       LIMIT 1`,
    )
    .get() as MissionRow | undefined;
  return rowToMission(row);
}

/** True if any mission is currently running (dispatched). */
export function hasDispatchedMission(): boolean {
  const row = getDb()
    .prepare(
      `SELECT 1 FROM missions
       WHERE deleted_at IS NULL AND status = 'dispatched'
       LIMIT 1`,
    )
    .get();
  return Boolean(row);
}

export function listMissions(opts?: { categoryId?: string | null; limit?: number; offset?: number }): Mission[] {
  let sql =
    "SELECT * FROM missions WHERE deleted_at IS NULL";
  const params: unknown[] = [];
  if (opts?.categoryId !== undefined) {
    if (opts.categoryId === null) {
      sql += " AND category_id IS NULL";
    } else {
      sql += " AND category_id = ?";
      params.push(opts.categoryId);
    }
  }
  // Bounded, always (T-0088, ruling 4). This list had no LIMIT: the board
  // fetched every row, and `?limit=5` answered 61.
  sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
  const limit = clampLimit(opts?.limit, MISSION_LIST_BOUNDS);
  const offset = typeof opts?.offset === "number" && Number.isFinite(opts.offset) ? Math.max(0, Math.floor(opts.offset)) : 0;
  const rows = getDb()
    .prepare(sql)
    .all(...params, limit, offset) as MissionRow[];
  return rows.map(rowToMission).filter(Boolean) as Mission[];
}

export function getMission(id: string): Mission | null {
  const row = getDb()
    .prepare("SELECT * FROM missions WHERE id = ?")
    .get(id) as MissionRow | undefined;
  return rowToMission(row);
}

export function createMission(data: {
  name: string;
  prompt: string;
  profileId?: string;
  localDirs?: LocalDirEntry[] | string[];
  references?: string[];
  skills?: string[];
  suggestedToolsets?: string[];
  goals?: string[];
  modelId?: string;
  provider?: string;
  profileName?: string;
  missionTimeMinutes?: number;
  timeoutMinutes?: number;
  schedule?: string;
  cronJobId?: string;
  categoryId?: string | null;
  outputFormat?: string;
  constraints?: string;
}): Mission {
  const id = uuid();
  const ts = now();
  const localDirs = JSON.stringify(normalizeLocalDirsInput(data.localDirs ?? []));
  const references = JSON.stringify(data.references ?? []);
  const skills = JSON.stringify(data.skills ?? []);
  const suggestedToolsets = JSON.stringify(data.suggestedToolsets ?? []);
  const goals = JSON.stringify(data.goals ?? []);

  inTransaction(() => {
    getDb()
      .prepare(
        `INSERT INTO missions (id, name, prompt, profile_id, status, created_at, updated_at, local_dirs, references_, skills, suggested_toolsets, goals, model_id, provider, profile_name, mission_time_minutes, timeout_minutes, schedule, cron_job_id, category_id, output_format, constraints)
         VALUES (?, ?, ?, ?, 'queued', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(id, data.name, data.prompt, data.profileId ?? null, ts, ts, localDirs, references, skills, suggestedToolsets, goals,
        data.modelId ?? null, data.provider ?? null, data.profileName ?? null,
        data.missionTimeMinutes ?? null, data.timeoutMinutes ?? null, data.schedule ?? null, data.cronJobId ?? null,
        data.categoryId ?? null, data.outputFormat ?? null, data.constraints ?? null);
  });

  return getMission(id)!;
}

export function updateMission(
  id: string,
  updates: {
    name?: string;
    status?: MissionStatus;
    result?: string | null;
    sessionId?: string;
    prompt?: string;
    localDirs?: LocalDirEntry[] | string[];
    references?: string[];
    skills?: string[];
    suggestedToolsets?: string[];
    goals?: string[];
    modelId?: string | null;
    provider?: string | null;
    profileName?: string | null;
    missionTimeMinutes?: number | null;
    timeoutMinutes?: number | null;
    schedule?: string | null;
    cronJobId?: string | null;
    categoryId?: string | null;
    outputFormat?: string | null;
    constraints?: string | null;
    queuedForRun?: boolean;
  }
): Mission | null {
  const existing = getMission(id);
  if (!existing) return null;
  const ts = now();

  inTransaction(() => {
    const sets: string[] = ["updated_at = ?"];
    const vals: unknown[] = [ts];

    if (updates.name !== undefined) {
      sets.push("name = ?");
      vals.push(updates.name);
    }
    if (updates.status !== undefined) {
      sets.push("status = ?");
      vals.push(updates.status);
    }
    if (updates.result !== undefined) {
      sets.push("result = ?");
      vals.push(updates.result);
    }
    if (updates.sessionId !== undefined) {
      sets.push("session_id = ?");
      vals.push(updates.sessionId);
    }
    if (updates.prompt !== undefined) {
      sets.push("prompt = ?");
      vals.push(updates.prompt);
    }
    if (updates.localDirs !== undefined) {
      sets.push("local_dirs = ?");
      vals.push(JSON.stringify(normalizeLocalDirsInput(updates.localDirs)));
    }
    if (updates.references !== undefined) {
      sets.push("references_ = ?");
      vals.push(JSON.stringify(updates.references));
    }
    if (updates.skills !== undefined) {
      sets.push("skills = ?");
      vals.push(JSON.stringify(updates.skills));
    }
    if (updates.suggestedToolsets !== undefined) {
      sets.push("suggested_toolsets = ?");
      vals.push(JSON.stringify(updates.suggestedToolsets));
    }
    if (updates.goals !== undefined) {
      sets.push("goals = ?");
      vals.push(JSON.stringify(updates.goals));
    }
    if (updates.modelId !== undefined) {
      sets.push("model_id = ?");
      vals.push(updates.modelId);
    }
    if (updates.provider !== undefined) {
      sets.push("provider = ?");
      vals.push(updates.provider);
    }
    if (updates.profileName !== undefined) {
      sets.push("profile_name = ?");
      vals.push(updates.profileName);
    }
    if (updates.missionTimeMinutes !== undefined) {
      sets.push("mission_time_minutes = ?");
      vals.push(updates.missionTimeMinutes);
    }
    if (updates.timeoutMinutes !== undefined) {
      sets.push("timeout_minutes = ?");
      vals.push(updates.timeoutMinutes);
    }
    if (updates.schedule !== undefined) {
      sets.push("schedule = ?");
      vals.push(updates.schedule);
    }
    if (updates.cronJobId !== undefined) {
      sets.push("cron_job_id = ?");
      vals.push(updates.cronJobId);
    }
    if (updates.categoryId !== undefined) {
      sets.push("category_id = ?");
      vals.push(updates.categoryId);
    }
    if (updates.outputFormat !== undefined) {
      sets.push("output_format = ?");
      vals.push(updates.outputFormat);
    }
    if (updates.constraints !== undefined) {
      sets.push("constraints = ?");
      vals.push(updates.constraints);
    }
    if (updates.queuedForRun !== undefined) {
      sets.push("queued_for_run = ?");
      vals.push(updates.queuedForRun ? 1 : 0);
    }

    vals.push(id);
    getDb()
      .prepare(`UPDATE missions SET ${sets.join(", ")} WHERE id = ?`)
      .run(...vals);
  });

  return getMission(id);
}

export function deleteMission(id: string): boolean {
  const existing = getMission(id);
  if (!existing) return false;
  const ts = now();
  getDb()
    .prepare("UPDATE missions SET deleted_at = ? WHERE id = ?")
    .run(ts, id);
  // Best-effort cleanup of on-disk artifacts. We do this AFTER
  // the soft-delete so a crash between them leaves the mission
  // soft-deleted (no longer visible) with orphan on-disk files
  // that MissionSync's orphan sweep will reconcile on the next
  // tick. The reverse order (clean disk first, then DB) would
  // risk a window where the disk is clean but the DB still
  // shows the mission as live, which would confuse the dashboard.
  //
  // Each unlink is best-effort: missing files are expected (the
  // mission may not have completed enough to create them all,
  // e.g. a draft that was deleted before dispatch).
  const artifactFilenames = [
    `${id}.json`,
    `${id}.status.json`,
    `${id}.pid.json`,
    `${id}.session`,
    `${id}.output.log`,
  ];
  for (const filename of artifactFilenames) {
    const artifactPath = join(PATHS.missions, filename);
    if (existsSync(artifactPath)) {
      try {
        unlinkSync(artifactPath);
      } catch {
        // best-effort — leave the orphan for the next sweep if
        // we can't unlink now (e.g. permission, race with a
        // running hermes chat that re-created the file)
      }
    }
  }
  return true;
}

// ── Foreign model audit ──────────────────────────────────────
//
// The two statements behind mission-model-audit.ts, which finds and
// repairs mission rows whose model_id is no longer in the models
// registry. They are here rather than there because they are reads and
// writes of the missions table like every other statement in this file.

/**
 * Mission rows whose `model_id` is set but absent from the registry,
 * most-recently-touched first.
 *
 * The row keys are the SQL column names (`model_id`, `updated_at`); the
 * declared shape is the caller's, and the mismatch predates this move.
 * It is preserved rather than corrected, because correcting it would
 * change what the audit surface returns.
 */
export function readForeignMissionModelRows(): ForeignMissionModelRow[] {
  return getDb()
    .prepare(
      `SELECT m.id, m.name, m.model_id, m.provider, m.status, m.updated_at
         FROM missions m
        WHERE m.model_id IS NOT NULL
          AND m.model_id != ''
          AND NOT EXISTS (
            SELECT 1 FROM models mo WHERE mo.model_id = m.model_id
          )
        ORDER BY m.updated_at DESC`,
    )
    .all() as ForeignMissionModelRow[];
}

/**
 * Null out `model_id` and `provider` on every mission row whose
 * `model_id` is not in the registry. Returns the rows affected.
 *
 * Non-correlated `NOT IN` on purpose. An UPDATE with a correlated
 * subquery in the WHERE clause (`NOT EXISTS (SELECT 1 FROM models mo
 * WHERE mo.model_id = model_id)`) silently matches zero rows in SQLite,
 * even when the audit form of the same query finds them.
 */
export function clearForeignMissionModelRows(): number {
  const result = getDb()
    .prepare(
      `UPDATE missions
          SET model_id = NULL, provider = NULL
        WHERE model_id IS NOT NULL
          AND model_id != ''
          AND model_id NOT IN (SELECT model_id FROM models WHERE model_id IS NOT NULL)`,
    )
    .run();
  return result.changes;
}
