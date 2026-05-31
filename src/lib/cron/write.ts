// ═══════════════════════════════════════════════════════════════
// cron/write.ts — create/update/delete cron jobs in SQLite
// ═══════════════════════════════════════════════════════════════

import { db, uuid, now } from "../db";
import { parseSchedule } from "../utils";

import type { CronJobRecord, CronJobRow, CreateCronJobInput, UpdateCronJobInput } from "./types";
import { getCronJob } from "./read";

export function parseScheduleToJson(
  schedule: string
): { scheduleJson: string; scheduleDisplay: string } {
  const parsed = parseSchedule(schedule);
  return {
    scheduleJson: JSON.stringify(parsed),
    scheduleDisplay: "display" in parsed ? (parsed.display as string) : schedule,
  };
}

/** Normalize a raw repeat value (boolean or object) to canonical shape. */
export function normalizeRepeat(
  repeat: unknown,
): { times: number | null; completed: number } | undefined {
  if (typeof repeat === "boolean") {
    return { times: repeat ? null : 1, completed: 0 };
  } else if (typeof repeat === "object" && repeat !== null) {
    const r = repeat as { times?: number | null; completed?: number };
    return {
      times: r.times ?? null,
      completed: r.completed ?? 0,
    };
  }
  return undefined;
}

/** Serialize repeat for SQLite storage (exported for tests). */
export function parseRepeatJson(
  repeat?: { times: number | null; completed?: number }
): string {
  if (repeat === undefined) {
    return JSON.stringify({ times: 1, completed: 0 });
  }
  return JSON.stringify({
    times: repeat.times === undefined ? 1 : repeat.times,
    completed: repeat.completed ?? 0,
  });
}

export function createCronJob(input: CreateCronJobInput): CronJobRecord {
  const id = uuid();
  const ts = now();
  const sched = parseScheduleToJson(input.schedule);

  const row: CronJobRow = {
    id,
    name: input.name.trim(),
    prompt: input.prompt ?? "",
    skills: JSON.stringify(input.skills ?? []),
    model: input.model ?? "",
    provider: input.provider ?? "",
    base_url: input.base_url ?? null,
    schedule: sched.scheduleJson,
    schedule_display: input.schedule_display ?? sched.scheduleDisplay,
    repeat_json: parseRepeatJson(input.repeat),
    enabled: input.enabled !== false ? 1 : 0,
    state: input.state ?? "scheduled",
    deliver: input.deliver ?? "none",
    script: input.script ?? null,
    profile_name: input.profile_name ?? "default",
    hermes_job_id: input.hermes_job_id ?? null,
    source: input.source ?? "ch",
    orphan: 0,
    next_run_at: null,
    last_run_at: null,
    last_status: null,
    last_delivery_error: null,
    created_at: ts,
    updated_at: ts,
    workdir: input.workdir ?? "",
  };

  db()
    .prepare(
      `INSERT INTO cron_jobs (
        id, name, prompt, skills, model, provider, base_url,
        schedule, schedule_display, repeat_json, enabled, state, deliver, script,
        profile_name, hermes_job_id, source, orphan, next_run_at, last_run_at,
        last_status, last_delivery_error, created_at, updated_at, workdir
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      row.id,
      row.name,
      row.prompt,
      row.skills,
      row.model,
      row.provider,
      row.base_url,
      row.schedule,
      row.schedule_display,
      row.repeat_json,
      row.enabled,
      row.state,
      row.deliver,
      row.script,
      row.profile_name,
      row.hermes_job_id,
      row.source,
      row.orphan,
      row.next_run_at,
      row.last_run_at,
      row.last_status,
      row.last_delivery_error,
      row.created_at,
      row.updated_at,
      row.workdir,
    );

  return getCronJob(id)!;
}

export function updateCronJob(
  id: string,
  input: UpdateCronJobInput
): CronJobRecord | null {
  const existing = getCronJob(id);
  if (!existing) return null;

  const ts = now();
  const sets: string[] = ["updated_at = ?"];
  const vals: unknown[] = [ts];

  // ── Field mapping: [key, sqlColumn?, transform?] ──────────────
  // Defines how each UpdateCronJobInput field maps to a SQL column and value.
  // Avoids 24 repetitive `if (input.X !== undefined)` blocks.
  type FieldDef = readonly [
    key: keyof UpdateCronJobInput,
    sql?: string,
    transform?: (v: unknown) => unknown,
  ];
  const FIELD_MAP: FieldDef[] = [
    ["name", undefined, (v) => (v as string).trim()],
    ["prompt"],
    ["skills", undefined, (v) => JSON.stringify(v)],
    ["model"],
    ["provider"],
    ["base_url"],
    ["deliver"],
    ["script"],
    ["profile_name"],
    ["state"],
    ["next_run_at"],
    ["last_run_at"],
    ["last_status"],
    ["last_delivery_error"],
    ["hermes_job_id"],
    ["enabled", undefined, (v) => (v ? 1 : 0)],
    ["orphan", undefined, (v) => (v ? 1 : 0)],
    ["workdir", undefined, (v) => (v as string | null) ?? ""],
  ];

  for (const [key, sql, transform] of FIELD_MAP) {
    if (input[key] !== undefined) {
      sets.push(`${sql ?? key} = ?`);
      vals.push(transform ? transform(input[key]) : input[key]);
    }
  }

  // ── Schedule (special handling: parse + generate display) ────
  if (input.schedule !== undefined) {
    const parsed = parseScheduleToJson(input.schedule);
    sets.push("schedule = ?", "schedule_display = ?");
    vals.push(parsed.scheduleJson, parsed.scheduleDisplay);
  }
  if (input.schedule_display !== undefined) {
    sets.push("schedule_display = ?");
    vals.push(input.schedule_display);
  }

  // ── Repeat (special handling: serialize) ─────────────────────
  if (input.repeat !== undefined) {
    sets.push("repeat_json = ?");
    vals.push(parseRepeatJson(input.repeat));
  }

  vals.push(id);
  db()
    .prepare(`UPDATE cron_jobs SET ${sets.join(", ")} WHERE id = ?`)
    .run(...vals);

  return getCronJob(id);
}

export function deleteCronJob(id: string): boolean {
  const result = db()
    .prepare("DELETE FROM cron_jobs WHERE id = ?")
    .run(id);
  return result.changes > 0;
}

/** Delete a cron job by its Hermes job id. */
export function deleteCronJobByHermesId(hermes_job_id: string): boolean {
  const result = db()
    .prepare("DELETE FROM cron_jobs WHERE hermes_job_id = ?")
    .run(hermes_job_id);
  return result.changes > 0;
}
