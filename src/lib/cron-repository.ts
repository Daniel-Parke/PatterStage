// ═══════════════════════════════════════════════════════════════
// cron-repository.ts — SQLite-backed cron jobs + Hermes sync
// ═══════════════════════════════════════════════════════════════
//
// Drives the Cron page in Control Hub. Provides:
//   - CH-owned SQLite CRUD (full UI control, enhanced fields)
//   - Hermes jobs.json import (read agent-created jobs into CH)
//   - CH → Hermes export (write CH jobs back to Hermes via Python)
//   - Bidirectional sync on demand
//
// Hermes jobs.json lives at ~/.hermes/cron/jobs.json. The Hermes cron
// scheduler (gateway subprocess) reads it directly. We write it via a
// Python subprocess that calls into hermes-agent/cron/jobs.py so we
// get the same validation, atomic writes, and path-resolution the
// scheduler uses.
//
// Hermes venv Python path: HERMES_AGENT_VENV_PYTHON from .env.local
// (defaults to ~/.local/share/hermes-agent/venv/bin/python3)

import { spawnSync } from "child_process";
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "fs";
import { resolve } from "path";

import { db, uuid, now } from "./db";
import { getActiveHermesPaths } from "./hermes-agent-runtime";
import { logApiError } from "./api-logger";
import { parseSchedule } from "./utils";

// ── Constants ────────────────────────────────────────────────

const HERMES_VENV_PYTHON =
  process.env.HERMES_AGENT_VENV_PYTHON ??
  resolve(process.env.HOME ?? "", ".local/share/hermes-agent/venv/bin/python3");

// ── Hermes jobs.json read ────────────────────────────────────

export interface HermesJobRaw {
  id: string;
  name?: string;
  prompt?: string;
  skills?: string[];
  skill?: string;
  model?: string;
  provider?: string;
  base_url?: string;
  schedule: unknown;
  schedule_display?: string;
  repeat?: unknown;
  enabled?: boolean;
  state?: string;
  deliver?: string;
  script?: string | null;
  created_at?: string;
  next_run_at?: string | null;
  last_run_at?: string | null;
  last_status?: string | null;
  last_delivery_error?: string | null;
  mission_id?: string;
  [key: string]: unknown;
}

/** Read and parse Hermes jobs.json without writing. Returns raw job list. */
function readHermesJobsJson(): { jobs: HermesJobRaw[]; error?: string } {
  const paths = getActiveHermesPaths();
  const cronPath = paths.cronJobs; // = root/cron/jobs.json

  if (!existsSync(cronPath)) {
    return { jobs: [] };
  }

  try {
    const raw = readFileSync(cronPath, "utf-8");
    const data = JSON.parse(raw) as { jobs?: unknown; updated_at?: string };

    if (Array.isArray(data)) {
      return { jobs: data as HermesJobRaw[] };
    }
    if (data?.jobs && Array.isArray(data.jobs)) {
      return { jobs: data.jobs as HermesJobRaw[] };
    }
    return { jobs: [] };
  } catch (err) {
    return { jobs: [], error: String(err) };
  }
}

/** Convert a Hermes raw job to a flat row object for INSERT/UPDATE (id/updated_at set by caller). */
type HermesJobRowPartial = Omit<CronJobRow, "id" | "updated_at">;

/** Convert a Hermes raw job to a flat row object matching the cron_jobs INSERT/UPDATE shape. */
function hermesJobToRow(job: HermesJobRaw): HermesJobRowPartial {
  // Normalize schedule to JSON string
  let scheduleJson: string;
  if (typeof job.schedule === "string") {
    scheduleJson = JSON.stringify({ kind: job.schedule });
  } else if (typeof job.schedule === "object" && job.schedule !== null) {
    scheduleJson = JSON.stringify(job.schedule);
  } else {
    scheduleJson = JSON.stringify({ kind: "unknown" });
  }

  // Normalize repeat
  let repeatJson: string;
  if (typeof job.repeat === "object" && job.repeat !== null) {
    repeatJson = JSON.stringify(job.repeat);
  } else if (typeof job.repeat === "boolean") {
    repeatJson = JSON.stringify({
      times: job.repeat ? null : 1,
      completed: 0,
    });
  } else {
    repeatJson = '{"times":1,"completed":0}';
  }

  // Normalize skills
  let skills: string[];
  if (Array.isArray(job.skills)) {
    skills = job.skills;
  } else if (typeof job.skill === "string") {
    skills = [job.skill];
  } else {
    skills = [];
  }

  return {
    schedule: scheduleJson,
    repeat_json: repeatJson,
    name: job.name ?? job.id,
    prompt: job.prompt ?? "",
    skills: JSON.stringify(skills),
    model: typeof job.model === "string" ? job.model : "",
    provider: typeof job.provider === "string" ? job.provider : "",
    base_url: typeof job.base_url === "string" ? job.base_url : null,
    schedule_display: job.schedule_display ?? "",
    enabled: job.enabled !== false ? 1 : 0,
    state: job.state ?? (job.enabled !== false ? "scheduled" : "paused"),
    deliver: job.deliver ?? "none",
    script: typeof job.script === "string" ? job.script : null,
    profile_name: "default",
    hermes_job_id: job.id,
    source: "hermes",
    orphan: 0,
    next_run_at: job.next_run_at ?? null,
    last_run_at: job.last_run_at ?? null,
    last_status: job.last_status ?? null,
    last_delivery_error: job.last_status ?? null,
    created_at: job.created_at ?? new Date().toISOString(),
  };
}

// ── SQLite schema row → CronJobRecord ────────────────────────

export interface CronJobRecord {
  id: string;
  name: string;
  prompt: string;
  skills: string[];
  model: string;
  provider: string;
  base_url: string | null;
  schedule: string; // JSON string
  schedule_display: string;
  repeat: { times: number | null; completed: number };
  enabled: boolean;
  state: string;
  deliver: string;
  script: string | null;
  profile_name: string;
  hermes_job_id: string | null;
  source: "ch" | "hermes";
  orphan: boolean;
  next_run_at: string | null;
  last_run_at: string | null;
  last_status: string | null;
  last_delivery_error: string | null;
  created_at: string;
  updated_at: string;
}

function rowToRecord(row: CronJobRow): CronJobRecord {
  return {
    id: row.id,
    name: row.name,
    prompt: row.prompt,
    skills: JSON.parse(row.skills) as string[],
    model: row.model,
    provider: row.provider,
    base_url: row.base_url,
    schedule: row.schedule,
    schedule_display: row.schedule_display,
    repeat: JSON.parse(row.repeat_json) as { times: number | null; completed: number },
    enabled: row.enabled === 1,
    state: row.state,
    deliver: row.deliver,
    script: row.script,
    profile_name: row.profile_name,
    hermes_job_id: row.hermes_job_id,
    source: row.source as "ch" | "hermes",
    orphan: row.orphan === 1,
    next_run_at: row.next_run_at,
    last_run_at: row.last_run_at,
    last_status: row.last_status,
    last_delivery_error: row.last_delivery_error,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

interface CronJobRow {
  id: string;
  name: string;
  prompt: string;
  skills: string;
  model: string;
  provider: string;
  base_url: string | null;
  schedule: string;
  schedule_display: string;
  repeat_json: string;
  enabled: number;
  state: string;
  deliver: string;
  script: string | null;
  profile_name: string;
  hermes_job_id: string | null;
  source: string;
  orphan: number;
  next_run_at: string | null;
  last_run_at: string | null;
  last_status: string | null;
  last_delivery_error: string | null;
  created_at: string;
  updated_at: string;
}

// ── Read ─────────────────────────────────────────────────────

/** List all cron jobs from CH SQLite. */
export function listCronJobs(): CronJobRecord[] {
  const rows = db()
    .prepare("SELECT * FROM cron_jobs ORDER BY created_at DESC")
    .all() as CronJobRow[];
  return rows.map(rowToRecord);
}

/** Get a single cron job by CH id. */
export function getCronJob(id: string): CronJobRecord | null {
  const row = db()
    .prepare("SELECT * FROM cron_jobs WHERE id = ?")
    .get(id) as CronJobRow | undefined;
  return row ? rowToRecord(row) : null;
}

/** Get a cron job by its Hermes job id. */
export function getCronJobByHermesId(hermes_job_id: string): CronJobRecord | null {
  const row = db()
    .prepare("SELECT * FROM cron_jobs WHERE hermes_job_id = ?")
    .get(hermes_job_id) as CronJobRow | undefined;
  return row ? rowToRecord(row) : null;
}

// ── Write ────────────────────────────────────────────────────

export interface CreateCronJobInput {
  name: string;
  prompt?: string;
  skills?: string[];
  model?: string;
  provider?: string;
  base_url?: string | null;
  schedule: string; // raw schedule string like "*/5 * * * *"
  schedule_display?: string;
  repeat?: { times: number | null; completed?: number };
  enabled?: boolean;
  state?: string;
  deliver?: string;
  script?: string | null;
  profile_name?: string;
  hermes_job_id?: string | null; // if linking to existing Hermes job
  source?: "ch" | "hermes";
}

export interface UpdateCronJobInput {
  name?: string;
  prompt?: string;
  skills?: string[];
  model?: string;
  provider?: string;
  base_url?: string | null;
  schedule?: string;
  schedule_display?: string;
  repeat?: { times: number | null; completed?: number };
  enabled?: boolean;
  state?: string;
  deliver?: string;
  script?: string | null;
  next_run_at?: string | null;
  last_run_at?: string | null;
  last_status?: string | null;
  last_delivery_error?: string | null;
  profile_name?: string;
  hermes_job_id?: string | null;
  orphan?: boolean;
}

function parseScheduleToJson(
  schedule: string
): { scheduleJson: string; scheduleDisplay: string } {
  const parsed = parseSchedule(schedule);
  return {
    scheduleJson:
      typeof parsed === "object"
        ? JSON.stringify(parsed)
        : JSON.stringify({ kind: parsed }),
    scheduleDisplay: typeof parsed === "object" && "display" in parsed
      ? (parsed.display as string)
      : schedule,
  };
}

function parseRepeatJson(
  repeat?: { times: number | null; completed?: number }
): string {
  return JSON.stringify({
    times: repeat?.times ?? 1,
    completed: repeat?.completed ?? 0,
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
  };

  db()
    .prepare(
      `INSERT INTO cron_jobs (
        id, name, prompt, skills, model, provider, base_url,
        schedule, schedule_display, repeat_json, enabled, state, deliver, script,
        profile_name, hermes_job_id, source, orphan, next_run_at, last_run_at,
        last_status, last_delivery_error, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
      row.updated_at
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

  if (input.name !== undefined) {
    sets.push("name = ?");
    vals.push(input.name.trim());
  }
  if (input.prompt !== undefined) {
    sets.push("prompt = ?");
    vals.push(input.prompt);
  }
  if (input.skills !== undefined) {
    sets.push("skills = ?");
    vals.push(JSON.stringify(input.skills));
  }
  if (input.model !== undefined) {
    sets.push("model = ?");
    vals.push(input.model);
  }
  if (input.provider !== undefined) {
    sets.push("provider = ?");
    vals.push(input.provider);
  }
  if (input.base_url !== undefined) {
    sets.push("base_url = ?");
    vals.push(input.base_url);
  }
  if (input.schedule !== undefined) {
    const parsed = parseScheduleToJson(input.schedule);
    sets.push("schedule = ?", "schedule_display = ?");
    vals.push(parsed.scheduleJson, parsed.scheduleDisplay);
  }
  if (input.schedule_display !== undefined) {
    sets.push("schedule_display = ?");
    vals.push(input.schedule_display);
  }
  if (input.repeat !== undefined) {
    sets.push("repeat_json = ?");
    vals.push(parseRepeatJson(input.repeat));
  }
  if (input.enabled !== undefined) {
    sets.push("enabled = ?");
    vals.push(input.enabled ? 1 : 0);
  }
  if (input.state !== undefined) {
    sets.push("state = ?");
    vals.push(input.state);
  }
  if (input.deliver !== undefined) {
    sets.push("deliver = ?");
    vals.push(input.deliver);
  }
  if (input.script !== undefined) {
    sets.push("script = ?");
    vals.push(input.script);
  }
  if (input.profile_name !== undefined) {
    sets.push("profile_name = ?");
    vals.push(input.profile_name);
  }
  if (input.next_run_at !== undefined) {
    sets.push("next_run_at = ?");
    vals.push(input.next_run_at);
  }
  if (input.last_run_at !== undefined) {
    sets.push("last_run_at = ?");
    vals.push(input.last_run_at);
  }
  if (input.last_status !== undefined) {
    sets.push("last_status = ?");
    vals.push(input.last_status);
  }
  if (input.last_delivery_error !== undefined) {
    sets.push("last_delivery_error = ?");
    vals.push(input.last_delivery_error);
  }
  if (input.hermes_job_id !== undefined) {
    sets.push("hermes_job_id = ?");
    vals.push(input.hermes_job_id);
  }
  if (input.orphan !== undefined) {
    sets.push("orphan = ?");
    vals.push(input.orphan ? 1 : 0);
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

// ── Hermes → CH import ────────────────────────────────────────

export interface ImportHermesJobResult {
  id: string;
  action: "inserted" | "updated" | "skipped";
  hermes_job_id: string;
}

/**
 * Read Hermes jobs.json and upsert each job into CH SQLite.
 * Jobs already in CH (matched by hermes_job_id) are updated; new ones inserted.
 * Hermes jobs that no longer exist on disk are NOT deleted here —
 * use syncFromHermes() for full reconciliation.
 */
export function importHermesJobs(): {
  imported: ImportHermesJobResult[];
  errors: string[];
} {
  const { jobs: hermesJobs, error } = readHermesJobsJson();
  const errors: string[] = [];
  const imported: ImportHermesJobResult[] = [];

  if (error) {
    errors.push(`Failed to read Hermes jobs.json: ${error}`);
    return { imported, errors };
  }

  const hermesIds = new Set<string>();

  for (const job of hermesJobs) {
    hermesIds.add(job.id);

    const existing = getCronJobByHermesId(job.id);
    const row = hermesJobToRow(job);

    if (existing) {
      // Update — preserve CH-specific fields (source, id) from existing row
      const ts = now();
      db()
        .prepare(
          `UPDATE cron_jobs SET
            name=?, prompt=?, skills=?, model=?, provider=?, base_url=?,
            schedule=?, schedule_display=?, repeat_json=?, enabled=?, state=?,
            deliver=?, script=?, profile_name=?, next_run_at=?, last_run_at=?,
            last_status=?, last_delivery_error=?, updated_at=?,
            orphan=0
          WHERE hermes_job_id=?`
        )
        .run(
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
          row.next_run_at,
          row.last_run_at,
          row.last_status,
          row.last_delivery_error,
          ts,
          job.id
        );
      imported.push({ id: existing.id, action: "updated", hermes_job_id: job.id });
    } else {
      // Insert new
      const id = uuid();
      const ts = now();
      db()
        .prepare(
          `INSERT INTO cron_jobs (
            id, name, prompt, skills, model, provider, base_url,
            schedule, schedule_display, repeat_json, enabled, state, deliver, script,
            profile_name, hermes_job_id, source, orphan, next_run_at, last_run_at,
            last_status, last_delivery_error, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          id,
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
          ts
        );
      imported.push({ id, action: "inserted", hermes_job_id: job.id });
    }
  }

  // Mark Hermes-only jobs (source=hermes, no longer on disk) as orphans
  db()
    .prepare(
      `UPDATE cron_jobs SET orphan=1, updated_at=? WHERE source='hermes' AND hermes_job_id IS NOT NULL AND hermes_job_id NOT IN (${hermesJobs.map(() => "?").join(",")})`
    )
    .run(now(), ...Array.from(hermesIds));

  return { imported, errors };
}

// ── Python script template ─────────────────────────────────

const _tpl = `
import sys
import os
sys.path.insert(0, %(hermes_agent_path)r)

# Set HERMES_HOME so the cron module resolves paths correctly
os.environ["HERMES_HOME"] = %(hermes_home)r

from cron.jobs import load_jobs, save_jobs, create_job, update_job, remove_job
import json

action = sys.argv[1] if len(sys.argv) > 1 else None
hermes_home = %(hermes_home)r

if action == "write_all":
    # Write all CH jobs back to Hermes jobs.json (full replacement)
    all_jobs = []
    for row in json.loads(sys.stdin.read()):
        job = dict(row)
        try:
            sched = json.loads(job.pop("schedule"))
        except Exception:
            sched = {"kind": job.get("schedule_display", job.get("schedule", "* * * * *"))}
        job["schedule"] = sched
        try:
            job["repeat"] = json.loads(job.pop("repeat_json"))
        except Exception:
            job["repeat"] = {"times": 1, "completed": 0}
        all_jobs.append(job)

    existing = {j["id"]: j for j in load_jobs()}
    for job in all_jobs:
        existing[job["id"]] = job

    hermes_ids = {j["id"] for j in all_jobs}
    for eid in list(existing.keys()):
        if eid not in hermes_ids:
            del existing[eid]

    save_jobs(list(existing.values()))
    print("ok")
elif action == "create":
    import uuid
    job_def = json.loads(sys.stdin.read())
    job_id = job_def.get("id") or uuid.uuid4().hex[:12]
    # Extract cron expression string from schedule JSON
    # parseSchedule produces: {"kind":"cron","expr":"*/30 * * * *","display":"..."}
    try:
        sched_raw = json.loads(job_def["schedule"])
        if isinstance(sched_raw, dict):
            # Accept expr, expression, or kind as the cron string
            job_def["schedule"] = sched_raw.get("expr") or sched_raw.get("expression") or sched_raw.get("kind") or job_def.get("schedule_display", "* * * * *")
        else:
            job_def["schedule"] = str(sched_raw)
    except Exception:
        job_def["schedule"] = job_def.get("schedule_display", "* * * * *")
    # Extract repeat int from repeat JSON
    try:
        repeat_raw = json.loads(job_def.get("repeat_json", "{}"))
        job_def["repeat"] = repeat_raw.get("times") if isinstance(repeat_raw, dict) else (repeat_raw or 1)
    except Exception:
        job_def["repeat"] = 1
    result = create_job(**{k: v for k, v in job_def.items() if v is not None and k not in (
        "name", "schedule_display", "repeat_json", "ch_job_id", "id",
        "enabled", "state", "hermes_job_id", "source", "orphan",
        "created_at", "next_run_at", "last_run_at", "last_status",
        "last_delivery_error"
    )})
    print(json.dumps({"ok": True, "job_id": result["id"]}))

elif action == "delete":
    job_id = sys.argv[2] if len(sys.argv) > 2 else None
    if not job_id:
        print(json.dumps({"ok": False, "error": "job_id required"}))
        sys.exit(1)
    existing = {j["id"]: j for j in load_jobs()}
    if job_id in existing:
        del existing[job_id]
        save_jobs(list(existing.values()))
    print(json.dumps({"ok": True}))
`;

/** Build a substituted Python script from the template. Uses split+join (ES2020-safe). */
function buildPythonScript(
  hermesAgentPath: string,
  hermesHome: string,
  _action: "write_all" | "create" | "delete"
): string {
  return _tpl
    .split("%(hermes_agent_path)r")
    .join(JSON.stringify(hermesAgentPath))
    .split("%(hermes_home)r")
    .join(JSON.stringify(hermesHome));
}

/**
 * Call Hermes Python to write all CH jobs to Hermes jobs.json.
 * CH is the system of record; Hermes file is updated to match exactly.
 */
export function syncAllJobsToHermes(): { ok: boolean; error?: string } {
  const paths = getActiveHermesPaths();
  const hermesHome = paths.root;

  const hermesAgentPaths = [
    resolve(hermesHome, "../hermes-agent"),
    resolve(hermesHome, ".local/share/hermes-agent"),
    "/home/daniel/.local/share/hermes-agent",
    "/home/daniel/.hermes/hermes-agent",
  ];

  let hermesAgentPath: string | null = null;
  for (const p of hermesAgentPaths) {
    if (existsSync(p + "/cron/jobs.py")) {
      hermesAgentPath = p;
      break;
    }
  }

  if (!hermesAgentPath) {
    return {
      ok: false,
      error: `Could not find hermes-agent cron module. Searched: ${hermesAgentPaths.join(", ")}`,
    };
  }

  const allJobs = listCronJobs();

  const jobsForPython = allJobs.map((j) => ({
    id: j.hermes_job_id ?? j.id,
    name: j.name,
    prompt: j.prompt,
    skills: j.skills,
    model: j.model || undefined,
    provider: j.provider || undefined,
    base_url: j.base_url || undefined,
    schedule: j.schedule,
    schedule_display: j.schedule_display,
    repeat_json: JSON.stringify(j.repeat),
    enabled: j.enabled,
    state: j.state,
    deliver: j.deliver,
    script: j.script,
    profile_name: j.profile_name,
    created_at: j.created_at,
    next_run_at: j.next_run_at,
    last_run_at: j.last_run_at,
    last_status: j.last_status,
    hermes_job_id: j.hermes_job_id,
  }));

  const script = buildPythonScript(hermesAgentPath, hermesHome, "write_all");
  const tmpScript = `/tmp/ch_cron_export_${process.pid}_${Date.now()}.py`;

  try {
    writeFileSync(tmpScript, script, "utf-8");

    const python = HERMES_VENV_PYTHON;
    if (!existsSync(python)) {
      return { ok: false, error: `Hermes venv Python not found at: ${python}` };
    }

    const result = spawnSync(python, [tmpScript, "write_all"], {
      input: JSON.stringify(jobsForPython),
      encoding: "utf-8",
      timeout: 15_000,
      killSignal: "SIGTERM",
    });

    try { unlinkSync(tmpScript); } catch { /* best-effort */ }

    if (result.status !== 0) {
      const err = result.stderr ?? result.stdout ?? "Unknown error";
      logApiError("syncAllJobsToHermes", "python write_all", new Error(String(err)));
      return { ok: false, error: String(err).slice(0, 500) };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/**
 * Push a single CH job to Hermes (create or update).
 */
export function pushJobToHermes(chJobId: string): { ok: boolean; hermesJobId?: string; error?: string } {
  const job = getCronJob(chJobId);
  if (!job) return { ok: false, error: `Job not found: ${chJobId}` };

  const paths = getActiveHermesPaths();
  const hermesHome = paths.root;

  const hermesAgentPaths = [
    resolve(hermesHome, "../hermes-agent"),
    resolve(hermesHome, ".local/share/hermes-agent"),
    "/home/daniel/.local/share/hermes-agent",
    "/home/daniel/.hermes/hermes-agent",
  ];

  let hermesAgentPath: string | null = null;
  for (const p of hermesAgentPaths) {
    if (existsSync(p + "/cron/jobs.py")) {
      hermesAgentPath = p;
      break;
    }
  }

  if (!hermesAgentPath) {
    return { ok: false, error: "Could not find hermes-agent cron module" };
  }

  const python = HERMES_VENV_PYTHON;
  if (!existsSync(python)) {
    return { ok: false, error: `Hermes venv Python not found: ${python}` };
  }

  const jobPayload = {
    id: job.hermes_job_id ?? job.id,
    name: job.name,
    prompt: job.prompt,
    skills: job.skills,
    model: job.model || undefined,
    provider: job.provider || undefined,
    base_url: job.base_url || undefined,
    schedule: job.schedule,
    schedule_display: job.schedule_display,
    repeat_json: JSON.stringify(job.repeat),
    enabled: job.enabled,
    state: job.state,
    deliver: job.deliver,
    script: job.script,
    profile_name: job.profile_name,
    created_at: job.created_at,
    next_run_at: job.next_run_at,
    last_run_at: job.last_run_at,
    last_status: job.last_status,
  };

  const tmpScript = `/tmp/ch_cron_push_${process.pid}_${Date.now()}.py`;

  const script = buildPythonScript(hermesAgentPath, hermesHome, "create");

  try {
    writeFileSync(tmpScript, script, "utf-8");

    const result = spawnSync(
      python,
      [tmpScript, "create"],
      { input: JSON.stringify(jobPayload), encoding: "utf-8", timeout: 15_000, killSignal: "SIGTERM" }
    );

    try { unlinkSync(tmpScript); } catch { /* best-effort */ }

    if (result.status !== 0) {
      return { ok: false, error: String(result.stderr ?? result.stdout).slice(0, 500) };
    }

    let parsed: { ok: boolean; job_id?: string; error?: string } = { ok: false };
    try {
      parsed = JSON.parse(result.stdout ?? "{}");
    } catch {
      /* ignore parse errors */
    }

    const hermesJobId = parsed.job_id ?? job.hermes_job_id ?? job.id;

    if (!job.hermes_job_id) {
      updateCronJob(job.id, { hermes_job_id: hermesJobId });
    }

    return { ok: true, hermesJobId };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/**
 * Remove a job from Hermes jobs.json by its Hermes job id.
 */
export function removeJobFromHermes(hermesJobId: string): { ok: boolean; error?: string } {
  const paths = getActiveHermesPaths();
  const hermesHome = paths.root;

  const hermesAgentPaths = [
    resolve(hermesHome, "../hermes-agent"),
    resolve(hermesHome, ".local/share/hermes-agent"),
    "/home/daniel/.local/share/hermes-agent",
    "/home/daniel/.hermes/hermes-agent",
  ];

  let hermesAgentPath: string | null = null;
  for (const p of hermesAgentPaths) {
    if (existsSync(p + "/cron/jobs.py")) {
      hermesAgentPath = p;
      break;
    }
  }

  if (!hermesAgentPath) {
    return { ok: false, error: "Could not find hermes-agent cron module" };
  }

  const python = HERMES_VENV_PYTHON;
  if (!existsSync(python)) {
    return { ok: false, error: `Hermes venv Python not found: ${python}` };
  }

  const tmpScript = `/tmp/ch_cron_del_${process.pid}_${Date.now()}.py`;

  const script = buildPythonScript(hermesAgentPath, hermesHome, "delete");

  try {
    writeFileSync(tmpScript, script, "utf-8");
    const result = spawnSync(python, [tmpScript, "delete", hermesJobId], {
      encoding: "utf-8",
      timeout: 15_000,
      killSignal: "SIGTERM",
    });
    try { unlinkSync(tmpScript); } catch { /* best-effort */ }

    if (result.status !== 0) {
      return { ok: false, error: String(result.stderr ?? result.stdout).slice(0, 500) };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// ── Bidirectional sync ────────────────────────────────────────

export interface SyncResult {
  hermesImported: ImportHermesJobResult[];
  hermesExportErrors: string[];
  errors: string[];
}

/**
 * Full bidirectional sync:
 *   1. Import all Hermes jobs into CH (upsert by hermes_job_id)
 *   2. Push all CH jobs back to Hermes (full overwrite)
 *
 * For jobs that exist in Hermes but not in CH: they are imported.
 * For jobs that exist in CH but not in Hermes: they are pushed.
 * For jobs deleted in Hermes but still in CH: marked orphan.
 */
export function syncCronWithHermes(): SyncResult {
  const hermesImport = importHermesJobs();

  const exportResult = syncAllJobsToHermes();
  const hermesExportErrors: string[] = exportResult.error ? [exportResult.error] : [];

  return {
    hermesImported: hermesImport.imported,
    hermesExportErrors,
    errors: [...hermesImport.errors, ...hermesExportErrors],
  };
}
