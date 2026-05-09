// ═══════════════════════════════════════════════════════════════
// mission-repository.ts — Mission CRUD via SQLite
// ═══════════════════════════════════════════════════════════════

import { db, inTransaction, uuid, now } from "./db";
import type { Mission, MissionStatus } from "@/lib/agent-backend/types";

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
    localDirs: safeJsonParse(row.local_dirs, [] as string[]),
    references: safeJsonParse(row.references_, [] as string[]),
    skills: safeJsonParse(row.skills, [] as string[]),
    goals: safeJsonParse(row.goals, [] as string[]),
  };
}

// ── Server-side prompt builder ─────────────────────────────────
// Keeps the stored prompt complete (used by both dispatch and cron).

export interface BuildPromptOptions {
  instruction: string;
  localDirs?: string[];
  references?: string[];
  skills?: string[];
  goals?: string[];
  context?: string;
}

export function buildMissionPrompt(opts: BuildPromptOptions): string {
  const parts: string[] = [];

  // 1. WORKING DIRECTORIES — highest priority
  if (opts.localDirs && opts.localDirs.length > 0) {
    parts.push(
      "## Working Directories\n" +
      "Focus all work within the following directories:\n" +
      opts.localDirs.map(d => `  - ${d}`).join("\n") + "\n"
    );
  }

  // 2. KEY REFERENCES
  if (opts.references && opts.references.length > 0) {
    parts.push(
      "## Key References\n" +
      "Consult and prioritise the following sources:\n" +
      opts.references.map(r => `  - ${r}`).join("\n") + "\n"
    );
  }

  // 3. RECOMMENDED SKILLS
  if (opts.skills && opts.skills.length > 0) {
    parts.push(
      "## Recommended Skills\n" +
      "Apply expertise from the following skills where relevant:\n" +
      opts.skills.map(s => `  - ${s}`).join("\n") + "\n"
    );
  }

  // 4. CORE INSTRUCTION
  parts.push(opts.instruction.trim());

  // 5. ADDITIONAL CONTEXT
  if (opts.context && opts.context.trim()) {
    parts.push("", "---", "", "## Additional Context", "", opts.context.trim());
  }

  return parts.join("\n");
}

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
  localDirs?: string[];
  references?: string[];
  skills?: string[];
  goals?: string[];
}): Mission {
  const id = uuid();
  const ts = now();
  const localDirs = JSON.stringify(data.localDirs ?? []);
  const references = JSON.stringify(data.references ?? []);
  const skills = JSON.stringify(data.skills ?? []);
  const goals = JSON.stringify(data.goals ?? []);

  inTransaction(() => {
    db()
      .prepare(
        `INSERT INTO missions (id, name, prompt, profile_id, status, created_at, updated_at, local_dirs, references_, skills, goals)
         VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)`
      )
      .run(id, data.name, data.prompt, data.profileId ?? null, ts, ts, localDirs, references, skills, goals);
  });

  return getMission(id)!;
}

export function updateMission(
  id: string,
  updates: {
    status?: MissionStatus;
    result?: string;
    sessionId?: string;
    localDirs?: string[];
    references?: string[];
    skills?: string[];
    goals?: string[];
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
    if (updates.localDirs !== undefined) {
      sets.push("local_dirs = ?");
      vals.push(JSON.stringify(updates.localDirs));
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
