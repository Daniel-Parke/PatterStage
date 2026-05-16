// ═══════════════════════════════════════════════════════════════
// mission-repository.ts — Mission CRUD via SQLite
// ═══════════════════════════════════════════════════════════════

import { db, inTransaction, uuid, now } from "./db";
import type { Mission, MissionStatus } from "@/lib/agent-backend/types";
import type { LocalDirEntry } from "@/types/hermes";
import { normalizeLocalDirsInput } from "@/lib/local-dir-entry";

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
  goals: string | null;
  model_id: string | null;
  provider: string | null;
  profile_name: string | null;
  mission_time_minutes: number | null;
  timeout_minutes: number | null;
  schedule: string | null;
}

function safeJsonParse<T>(val: string | null | undefined, fallback: T): T {
  if (!val) return fallback;
  try { return JSON.parse(val) as T; }
  catch { return fallback; }
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
    goals: safeJsonParse(row.goals, [] as string[]),
    // Runtime settings (migration 013 — may be null on pre-migration DBs)
    modelId: row.model_id ?? undefined,
    provider: row.provider ?? undefined,
    profileName: row.profile_name ?? undefined,
    missionTimeMinutes: row.mission_time_minutes ?? undefined,
    timeoutMinutes: row.timeout_minutes ?? undefined,
    schedule: row.schedule ?? undefined,
  };
}

// ── Prompt builder (delegates to shared utility) ───────────────
// Keeps the stored prompt complete (used by both dispatch and cron).

export type { BuildPromptOptions } from "@/lib/build-mission-prompt";
export { buildMissionPrompt } from "@/lib/build-mission-prompt";

// ── CRUD ─────────────────────────────────────────────────────

export function listMissions(): Mission[] {
  const rows = db()
    .prepare(
      "SELECT * FROM missions WHERE deleted_at IS NULL ORDER BY created_at DESC"
    )
    .all() as MissionRow[];
  return rows.map(rowToMission).filter(Boolean) as Mission[];
}

export function getMission(id: string): Mission | null {
  const row = db()
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
  goals?: string[];
  modelId?: string;
  provider?: string;
  profileName?: string;
  missionTimeMinutes?: number;
  timeoutMinutes?: number;
  schedule?: string;
}): Mission {
  const id = uuid();
  const ts = now();
  const localDirs = JSON.stringify(normalizeLocalDirsInput(data.localDirs ?? []));
  const references = JSON.stringify(data.references ?? []);
  const skills = JSON.stringify(data.skills ?? []);
  const goals = JSON.stringify(data.goals ?? []);

  inTransaction(() => {
    db()
      .prepare(
        `INSERT INTO missions (id, name, prompt, profile_id, status, created_at, updated_at, local_dirs, references_, skills, goals, model_id, provider, profile_name, mission_time_minutes, timeout_minutes, schedule)
         VALUES (?, ?, ?, ?, 'queued', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(id, data.name, data.prompt, data.profileId ?? null, ts, ts, localDirs, references, skills, goals,
        data.modelId ?? null, data.provider ?? null, data.profileName ?? null,
        data.missionTimeMinutes ?? null, data.timeoutMinutes ?? null, data.schedule ?? null);
  });

  return getMission(id)!;
}

export function updateMission(
  id: string,
  updates: {
    status?: MissionStatus;
    result?: string;
    sessionId?: string;
    prompt?: string;
    localDirs?: LocalDirEntry[] | string[];
    references?: string[];
    skills?: string[];
    goals?: string[];
    modelId?: string | null;
    provider?: string | null;
    profileName?: string | null;
    missionTimeMinutes?: number | null;
    timeoutMinutes?: number | null;
    schedule?: string | null;
  }
): Mission | null {
  const existing = getMission(id);
  if (!existing) return null;
  const ts = now();

  inTransaction(() => {
    const sets: string[] = ["updated_at = ?"];
    const vals: unknown[] = [ts];

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

    vals.push(id);
    db()
      .prepare(`UPDATE missions SET ${sets.join(", ")} WHERE id = ?`)
      .run(...vals);
  });

  return getMission(id);
}

export function deleteMission(id: string): boolean {
  const existing = getMission(id);
  if (!existing) return false;
  const ts = now();
  db()
    .prepare("UPDATE missions SET deleted_at = ? WHERE id = ?")
    .run(ts, id);
  return true;
}
