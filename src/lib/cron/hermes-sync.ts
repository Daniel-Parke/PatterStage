// ═══════════════════════════════════════════════════════════════
// cron/hermes-sync.ts — Hermes jobs.json import/export + Python push
// ═══════════════════════════════════════════════════════════════
//
// Hermes jobs.json lives at ~/.hermes/cron/jobs.json. The Hermes cron
// scheduler (gateway subprocess) reads it directly. We write it via a
// Python subprocess that calls into hermes-agent/cron/jobs.py so we
// get the same validation, atomic writes, and path-resolution the
// scheduler uses.
//
// Hermes venv: $HERMES_HOME/hermes-agent/venv/bin/python3 (see hermes-package-path.ts)

import { existsSync, readFileSync, writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { db, uuid, now } from "../db";
import { getActiveHermesPaths } from "../hermes-agent-runtime";
import { logApiError } from "../api-logger";
import { gatewayUrl } from "../gateway-client";
import { messageFromError } from "@/lib/api-fetch";
import {
  getHermesAgentPackageDir,
  resolveHermesAgentPackage,
  resolveHermesVenvPython,
} from "../hermes-package-path";
import { spawnAsync, formatProcessError } from "../process-utils";
import { looksLikeCronExpression, parseSchedule } from "../schedule/parse-schedule";

import type {
  CronJobRow,
  HermesJobRaw,
  ImportHermesJobResult,
  SyncResult,
} from "./types";
import { getCronJob, getCronJobByHermesId, listCronJobs } from "./read";
import { updateCronJob } from "./write";

/**
 * Resolve Hermes cron runtime paths (agent package + Python binary).
 */
function resolveHermesCronRuntime(hermesHome: string): {
  ok: true;
  hermesAgentPath: string;
  python: string;
} | { ok: false; error: string } {
  const hermesAgentPath = resolveHermesAgentPackage(hermesHome);
  if (!hermesAgentPath) {
    const expected = getHermesAgentPackageDir(hermesHome);
    return {
      ok: false,
      error:
        `Hermes agent package not found at ${expected} (missing cron/jobs.py). ` +
        `Install Hermes under HERMES_HOME (default ~/.hermes).`,
    };
  }
  try {
    const python = resolveHermesVenvPython(hermesHome);
    return { ok: true, hermesAgentPath, python };
  } catch (err) {
    return { ok: false, error: messageFromError(err, "") };
  }
}

// ── Hermes jobs.json read ────────────────────────────────────

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
  // Convert a Hermes-side `job.schedule` (which can be a 5-field cron
  // string, a JSON-stringified ParsedSchedule, or a structured
  // `{kind, expr}` object) into the canonical **raw 5-field cron
  // expression** for storage in the `cron_jobs.schedule` column.
  //
  // The CH→Hermes write path uses the same normaliseScheduleObj helper
  // (see `syncAllJobsToHermes` above), so a round-trip is stable: CH
  // stores raw cron, Hermes stores `{kind: "cron", expr: "...", display:
  // "..."}`, the import path below unwraps `expr`, and the next push
  // re-wraps it. No JSON-stringified-ParsedSchedule ever touches the
  // SQLite column.
  let schedule: string;
  if (typeof job.schedule === "string") {
    // Try to interpret as a 5-field cron directly. If it looks like a
    // JSON-stringified ParsedSchedule (legacy CH export), unwrap one
    // level to get the inner `expr`.
    const trimmed = job.schedule.trim();
    if (looksLikeCronExpression(trimmed)) {
      schedule = trimmed;
    } else if (trimmed.startsWith("{")) {
      try {
        const parsed = JSON.parse(trimmed) as { kind?: string; expr?: string };
        if (typeof parsed.expr === "string" && parsed.expr.trim()) {
          schedule = parsed.expr.trim();
        } else if (typeof parsed.kind === "string" && looksLikeCronExpression(parsed.kind)) {
          schedule = parsed.kind;
        } else {
          schedule = trimmed;
        }
      } catch {
        schedule = trimmed;
      }
    } else {
      schedule = trimmed;
    }
  } else if (typeof job.schedule === "object" && job.schedule !== null) {
    const s = job.schedule as { kind?: unknown; expr?: unknown; display?: unknown };
    if (typeof s.expr === "string" && s.expr.trim()) {
      schedule = s.expr.trim();
    } else if (typeof s.kind === "string" && looksLikeCronExpression(s.kind)) {
      schedule = s.kind;
    } else {
      schedule = "";
    }
  } else {
    schedule = "";
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

  // Resolve schedule_display: prefer top-level field, fall back to nested display/Kind in schedule object,
  // guarding against Hermes' "?" fallback from _schedule_display_for_job() which would overwrite valid CH values.
  const resolvedScheduleDisplay = (() => {
    if (job.schedule_display && job.schedule_display !== "?") return job.schedule_display;
    if (typeof job.schedule === "object" && job.schedule !== null) {
      const s = job.schedule as { display?: string; Kind?: string };
      return s.display ?? s.Kind ?? "";
    }
    return "";
  })();

  return {
    schedule,
    repeat_json: repeatJson,
    name: job.name ?? job.id,
    prompt: job.prompt ?? "",
    skills: JSON.stringify(skills),
    model: typeof job.model === "string" ? job.model : "",
    provider: typeof job.provider === "string" ? job.provider : "",
    base_url: typeof job.base_url === "string" ? job.base_url : null,
    schedule_display: resolvedScheduleDisplay,
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
    last_delivery_error: job.last_delivery_error ?? null,
    created_at: job.created_at ?? new Date().toISOString(),
    workdir: typeof (job as Record<string, unknown>).workdir === "string"
      ? (job as Record<string, unknown>).workdir as string
      : null,
  };
}

// ── Hermes → CH import ────────────────────────────────────────

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
      // Update — preserve CH-specific fields from existing row
      const ts = now();
      // For CH-sourced jobs, don't overwrite enabled/state — the UI controls those
      // For Hermes-sourced jobs, sync everything (they're mirrors)
      const preserveChIntent = existing.source === "ch";
      const updateFields = preserveChIntent
        ? `name=?, prompt=?, skills=?, model=?, provider=?, base_url=?,
            schedule=?, schedule_display=?,
            deliver=?, script=?, profile_name=?, next_run_at=?, last_run_at=?,
            last_status=?, last_delivery_error=?, updated_at=?,
            orphan=0, workdir=?`
        : `name=?, prompt=?, skills=?, model=?, provider=?, base_url=?,
            schedule=?, schedule_display=?, repeat_json=?, enabled=?, state=?,
            deliver=?, script=?, profile_name=?, next_run_at=?, last_run_at=?,
            last_status=?, last_delivery_error=?, updated_at=?,
            orphan=0, workdir=?`;
      // Guard against Hermes returning "?" (fallback from _schedule_display_for_job)
      // which would overwrite a valid CH value on import.
      const safeScheduleDisplay =
        row.schedule_display && row.schedule_display !== "?" ? row.schedule_display : existing.schedule_display;
      const safeSchedule =
        row.schedule && row.schedule !== "?" ? row.schedule : existing.schedule;

      const updateParams = preserveChIntent
        ? [row.name, row.prompt, row.skills, row.model, row.provider, row.base_url,
           safeSchedule, safeScheduleDisplay,
           row.deliver, row.script, row.profile_name, row.next_run_at, row.last_run_at,
           row.last_status, row.last_delivery_error, ts,
           row.workdir ?? existing.workdir ?? '']
        : [row.name, row.prompt, row.skills, row.model, row.provider, row.base_url,
           row.schedule, row.schedule_display, row.repeat_json, row.enabled, row.state,
           row.deliver, row.script, row.profile_name, row.next_run_at, row.last_run_at,
           row.last_status, row.last_delivery_error, ts,
           row.workdir ?? existing.workdir ?? ''];
      db()
        .prepare(
          `UPDATE cron_jobs SET ${updateFields}
          WHERE hermes_job_id=?`
        )
        .run(...updateParams, job.id);
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
            last_status, last_delivery_error, created_at, updated_at, workdir
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
          ts,
          row.workdir ?? '',
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

from cron.jobs import load_jobs, save_jobs
import json

action = sys.argv[1] if len(sys.argv) > 1 else None
hermes_home = %(hermes_home)r

if action == "write_all":
    # Write all CH jobs back to Hermes jobs.json (full replacement)
    all_jobs = []
    for row in json.loads(sys.stdin.read()):
        job = dict(row)
        sched_raw = job.pop("schedule", {})
        if isinstance(sched_raw, dict):
            sched = sched_raw
        else:
            try:
                sched = json.loads(sched_raw)
            except Exception:
                sched = {"kind": "unknown"}
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
function cronTempScriptPath(prefix: string): string {
  return join(tmpdir(), `${prefix}_${process.pid}_${Date.now()}.py`);
}

function buildPythonScript(
  hermesAgentPath: string,
  hermesHome: string,
  _action: "write_all" | "delete"
): string {
  return _tpl
    .split("%(hermes_agent_path)r")
    .join(JSON.stringify(hermesAgentPath))
    .split("%(hermes_home)r")
    .join(JSON.stringify(hermesHome));
}

/**
 * Normalise a schedule object to the canonical {kind: "cron", expr: "..."} or
 * {kind: "interval", minutes: N} shape. Handles the common corruption where
 * a raw cron expression is stored as the "kind" field, AND the interval
 * shorthand case where `kind` is the human "every 30m" string.
 *
 * The Python scheduler's `parse_schedule` accepts a STRING and produces a
 * structured object — but the CH→Hermes push path skips `parse_schedule`
 * and writes the object directly. So we must pre-parse here: if `kind` is
 * an "every Nm / Nh / Nd" string (the only kind of non-cron value that
 * reaches this function), parse it through the local `parseSchedule` to
 * extract the interval minutes, and emit the proper `{kind: "interval",
 * minutes, display}` object the Python scheduler computes `next_run_at`
 * from.
 */
function normaliseScheduleObj(sched: Record<string, unknown>): Record<string, unknown> {
  const kind = sched?.kind;
  if (typeof kind === "string" && looksLikeCronExpression(kind)) {
    return { kind: "cron", expr: kind, ...(sched.display ? { display: sched.display } : {}) };
  }
  // "every Nm / Nh / Nd" shorthand stored as `kind` (the live mission
  // bug — see reference/cron-schedule-canonicalisation-2026-06-09.md
  // and reference/cron-interval-shorthand-push-2026-06-10.md).
  if (typeof kind === "string") {
    const parsed = parseSchedule(kind);
    if (parsed.kind === "interval") {
      return {
        kind: "interval",
        minutes: parsed.minutes,
        ...(sched.display || parsed.display ? { display: sched.display ?? parsed.display } : {}),
      };
    }
  }
  return sched;
}

/**
 * Build the structured schedule object that `syncAllJobsToHermes` (and
 * `hermesJobToRow`, the import path) will hand to the Python scheduler
 * for a given `cron_jobs.schedule` value. Exported for unit tests so
 * the push path's contract — the Python scheduler only accepts
 * `kind ∈ {"cron", "interval", "once", "invalid"}` — can be pinned
 * without spinning up a real Python subprocess.
 *
 * Accepts the same four storage shapes `cron_jobs.schedule` may be in:
 *  - raw 5-field cron (canonical)
 *  - "every Nm / Nh / Nd" shorthand (also canonical, per v7)
 *  - JSON-stringified `ParsedSchedule` (legacy pre-#168)
 *  - corrupted `{kind: "invalid", raw: "..."}` (legacy pre-#168)
 *  - and falls through unchanged for unrecognised input (the Python
 *    scheduler itself will mark it `kind: "invalid"`).
 */
export function buildScheduleObjForHermes(
  schedule: string,
  scheduleDisplay?: string | null,
): Record<string, unknown> {
  const trimmed = (schedule ?? "").trim();
  let scheduleObj: Record<string, unknown>;
  if (trimmed && !trimmed.startsWith("{")) {
    // Canonical (5-field cron or "every Nm / Nh / Nd" shorthand).
    scheduleObj = normaliseScheduleObj({ kind: trimmed });
  } else {
    // Legacy / corrupted: try to parse as JSON.
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      if (typeof parsed.expr === "string" && parsed.expr.trim()) {
        scheduleObj = normaliseScheduleObj({
          kind: parsed.expr,
          display: typeof parsed.display === "string" ? parsed.display : undefined,
        });
      } else if (parsed.kind === "invalid" && typeof parsed.raw === "string") {
        try {
          const inner = JSON.parse(parsed.raw) as Record<string, unknown>;
          if (typeof inner.expr === "string" && inner.expr.trim()) {
            scheduleObj = normaliseScheduleObj({
              kind: inner.expr,
              display: typeof inner.display === "string" ? inner.display : undefined,
            });
          } else {
            scheduleObj = normaliseScheduleObj(parsed);
          }
        } catch {
          scheduleObj = normaliseScheduleObj(parsed);
        }
      } else {
        scheduleObj = normaliseScheduleObj(parsed);
      }
    } catch {
      scheduleObj = { kind: schedule || "unknown" };
    }
  }
  if (scheduleDisplay) {
    scheduleObj.display = scheduleDisplay;
  }
  return scheduleObj;
}

/**
 * Compare an on-disk Hermes `schedule` object (read from
 * `~/.hermes/cron/jobs.json`) against the canonical shape that
 * `buildScheduleObjForHermes` produces from the CH DB row.
 *
 * Returns `true` when the two are semantically equivalent (same
 * `kind`, same `expr` or `minutes`, compatible `display`), `false`
 * otherwise. Used by the 4th-layer reconciliation (`ensureCronHermesSync`)
 * to detect on-disk artifacts left over from prior broken push paths.
 *
 * Semantic equivalence (not field-by-field) because the `display`
 * field may be humanised differently between the DB and the on-disk
 * file (e.g. "Every 30 minutes" vs "every 30m"). The `kind` +
 * `expr`/`minutes` pair is the canonical contract; `display` is a
 * label, only relevant for the `kind === "cron"` case.
 *
 * Exported for unit tests so the reconciliation comparator is
 * verifiable without spinning up a real Python subprocess.
 */
export function scheduleObjMatches(
  onDisk: unknown,
  expected: Record<string, unknown>,
): boolean {
  if (!onDisk || typeof onDisk !== "object") return false;
  const disk = onDisk as { kind?: unknown; expr?: unknown; minutes?: unknown; display?: unknown };
  const exp = expected as { kind?: unknown; expr?: unknown; minutes?: unknown; display?: unknown };

  // `kind` must match exactly. The Python scheduler only accepts
  // {"once","interval","cron","invalid"} — anything else is broken
  // (silently dropped on every tick) and must be re-pushed.
  if (disk.kind !== exp.kind) return false;

  // For cron kind, compare the raw expression. This is the only
  // contract that determines when the job actually fires.
  if (exp.kind === "cron") {
    if (typeof disk.expr !== "string" || typeof exp.expr !== "string") return false;
    if (disk.expr.trim() !== exp.expr.trim()) return false;
  }

  // For interval kind, compare the minutes. Same as cron — this
  // is the only contract that determines when the job fires.
  if (exp.kind === "interval") {
    if (typeof disk.minutes !== "number" || typeof exp.minutes !== "number") return false;
    if (disk.minutes !== exp.minutes) return false;
  }

  // `display` is a label, not a contract. We don't require it to
  // match — the reconciliation only repairs the firing contract.
  // (If the user customised the display, we shouldn't clobber it.)

  return true;
}

/**
 * Call Hermes Python to write all CH jobs to Hermes jobs.json.
 * CH is the system of record; Hermes file is updated to match exactly.
 */
export async function syncAllJobsToHermes(): Promise<{ ok: boolean; error?: string }> {
  const paths = getActiveHermesPaths();
  const hermesHome = paths.root;

  const runtime = resolveHermesCronRuntime(hermesHome);
  if (!runtime.ok) return { ok: false, error: runtime.error };
  const { hermesAgentPath, python } = runtime;

  const allJobs = listCronJobs();

  const jobsForPython = allJobs.map((j) => {
    // The schedule payload is built via buildScheduleObjForHermes,
    // which handles the four storage shapes (canonical cron, "every
    // Nm/Nh/Nd" shorthand, JSON-stringified legacy, corrupted
    // {kind: "invalid", raw: "..."}) and always produces an object
    // whose `kind` is in the Python scheduler's accepted vocabulary.
    // See references/cron-schedule-canonicalisation-2026-06-09.md and
    // references/cron-interval-shorthand-push-2026-06-10.md for the
    // history of the corruption cascade this helper closes off.
    const scheduleObj = buildScheduleObjForHermes(j.schedule, j.schedule_display);
    // j.repeat is a parsed object — stringify it for Python's json.loads()
    const repeatObj = j.repeat ?? { times: 1, completed: 0 };
    return {
      id: j.hermes_job_id ?? j.id,
      name: j.name,
      prompt: j.prompt,
      skills: j.skills,
      model: j.model || undefined,
      provider: j.provider || undefined,
      base_url: j.base_url || undefined,
      schedule: scheduleObj,
      repeat_json: JSON.stringify(repeatObj),
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
      workdir: j.workdir || undefined,
    };
  });

  const script = buildPythonScript(hermesAgentPath, hermesHome, "write_all");
  const tmpScript = cronTempScriptPath("ch_cron_export");

  try {
    writeFileSync(tmpScript, script, "utf-8");

    await spawnAsync(
      python,
      [tmpScript, "write_all"],
      {
        input: JSON.stringify(jobsForPython),
        timeout: 15_000,
        killSignal: "SIGTERM" as NodeJS.Signals,
      }
    );

    try { unlinkSync(tmpScript); } catch { /* best-effort */ }

    return { ok: true };
  } catch (err: unknown) {
    try { unlinkSync(tmpScript); } catch { /* best-effort */ }
    const message = formatProcessError(err);
    logApiError("syncAllJobsToHermes", "python write_all", new Error(String(message).slice(0, 500)));
    return { ok: false, error: String(message).slice(0, 500) };
  }
}

/**
 * Push CH cron state to Hermes by full-catalog merge (write_all).
 * Replaces the broken per-job create path that appended duplicates and dropped enabled/state.
 */
export async function pushJobToHermes(chJobId: string): Promise<{ ok: boolean; hermesJobId?: string; error?: string }> {
  const job = getCronJob(chJobId);
  if (!job) return { ok: false, error: `Job not found: ${chJobId}` };

  if (!job.hermes_job_id) {
    updateCronJob(job.id, { hermes_job_id: job.id });
  }

  const result = await syncAllJobsToHermes();
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  const updated = getCronJob(chJobId);
  const hermesJobId = updated?.hermes_job_id ?? job.hermes_job_id ?? job.id;
  return { ok: true, hermesJobId };
}

/**
 * Remove a job from Hermes jobs.json by its Hermes job id.
 */
export async function removeJobFromHermes(hermesJobId: string): Promise<{ ok: boolean; error?: string }> {
  const paths = getActiveHermesPaths();
  const hermesHome = paths.root;

  const runtime = resolveHermesCronRuntime(hermesHome);
  if (!runtime.ok) return { ok: false, error: runtime.error };
  const { hermesAgentPath, python } = runtime;

  const tmpScript = cronTempScriptPath("ch_cron_del");

  const script = buildPythonScript(hermesAgentPath, hermesHome, "delete");

  try {
    writeFileSync(tmpScript, script, "utf-8");
    await spawnAsync(
      python,
      [tmpScript, "delete", hermesJobId],
      {
        timeout: 15_000,
        killSignal: "SIGTERM" as NodeJS.Signals,
      }
    );
    try { unlinkSync(tmpScript); } catch { /* best-effort */ }

    return { ok: true };
  } catch (err: unknown) {
    try { unlinkSync(tmpScript); } catch { /* best-effort */ }
    const message = formatProcessError(err);
    return { ok: false, error: String(message).slice(0, 500) };
  }
}

// ── 4th-layer reconciliation (cron startup) ──────────────────

/**
 * Reconciliation-on-startup: ensure the on-disk Hermes artifact
 * `~/.hermes/cron/jobs.json` is canonical for every enabled CH DB
 * job. This is the missing 4th layer of the schedule-canonicalisation
 * pattern (see references/cron-startup-reconciliation-2026-06-10.md).
 *
 * The 3-layer pattern (write-time canonicalisation, push-time
 * normalisation, migration v6→v7) is correct in code, but it cannot
 * repair disk artifacts left over from prior broken push paths. A
 * healthy DB and a corrupted disk is a valid (and silent) state
 * until this reconciliation runs. PR #170 missed this layer, and
 * the live mission `5585c131` continued to silently fail every tick
 * after the merge.
 *
 * Behaviour:
 *   - For each enabled CH DB job, read the matching on-disk entry.
 *   - Build the canonical expected shape with `buildScheduleObjForHermes`.
 *   - Compare semantically with `scheduleObjMatches`. If the on-disk
 *     shape is unrecognised, has a different `kind`, or has a
 *     different `expr`/`minutes`, the artifact is stale — re-push.
 *   - If the on-disk entry is missing entirely, re-push.
 *
 * Idempotent and self-healing: once the artifact is canonical,
 * subsequent calls are no-ops. Module-level `_cronSyncAttempted`
 * flag skips the work entirely after the first attempt on a given
 * server lifetime — but the reconciliation is also cheap enough
 * (one disk read + N comparisons) to run on every call. The flag
 * is a conservative optimisation.
 *
 * Safe to call from `ensureSyncLayer()` (the monitor endpoint calls
 * this on every hit; the flag prevents redundant work) or directly.
 */
let _cronSyncAttempted = false;

export async function ensureCronHermesSync(): Promise<{
  attempted: boolean;
  repaired: number;
  errors: string[];
}> {
  // Conservative optimisation: if we already attempted this server
  // lifetime, skip the read. The artifact can't regress without a
  // broken push path making it regress, and a broken push path
  // would be a separate bug worth surfacing. Leave the flag off
  // for now to verify the repair happens on first hit; the cost
  // of one disk read is negligible.
  if (_cronSyncAttempted) {
    return { attempted: false, repaired: 0, errors: [] };
  }
  _cronSyncAttempted = true;

  // Read the on-disk artifact without writing.
  const { jobs: onDiskJobs, error: readError } = readHermesJobsJson();
  if (readError) {
    return { attempted: true, repaired: 0, errors: [readError] };
  }
  const onDiskById = new Map<string, HermesJobRaw>();
  for (const j of onDiskJobs) {
    if (j?.id) onDiskById.set(j.id, j);
  }

  // Build the canonical DB set. Only enabled jobs matter for
  // firing — disabled jobs can stay stale on disk indefinitely
  // without affecting anything.
  const chJobs = listCronJobs().filter((j) => j.enabled);
  const errors: string[] = [];
  let repaired = 0;

  for (const chJob of chJobs) {
    const expected = buildScheduleObjForHermes(chJob.schedule, chJob.schedule_display);
    const onDisk = onDiskById.get(chJob.id);

    if (!onDisk) {
      // Missing on disk — push.
      const result = await pushJobToHermes(chJob.id);
      if (result.ok) repaired += 1;
      else errors.push(`${chJob.id}: ${result.error ?? "unknown"}`);
      continue;
    }

    if (!scheduleObjMatches(onDisk.schedule, expected)) {
      // On-disk schedule is stale (left over from a prior broken
      // push path, or someone edited the file directly).
      const result = await pushJobToHermes(chJob.id);
      if (result.ok) repaired += 1;
      else errors.push(`${chJob.id}: ${result.error ?? "unknown"}`);
    }
  }

  return { attempted: true, repaired, errors };
}

/**
 * Reset the in-memory "already attempted" flag. Intended for tests
 * and for the rare manual reconciliation. Not called from any
 * production code path.
 */
export function _resetCronHermesSyncFlag(): void {
  _cronSyncAttempted = false;
}

// ── Gateway trigger (run now) ─────────────────────────────────

/**
 * Trigger a job to run immediately via the Hermes gateway's run endpoint.
 * This calls POST /api/jobs/{job_id}/run which calls trigger_job() in Hermes,
 * setting state=scheduled and next_run_at=now in jobs.json — signalling the
 * scheduler to run the job on its next tick.
 */
export async function triggerJobViaGateway(
  hermesJobId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(
      gatewayUrl(`/api/jobs/${encodeURIComponent(hermesJobId)}/run`),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(10_000),
      }
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: `Gateway returned ${res.status}: ${text}`.slice(0, 500) };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err).slice(0, 500) };
  }
}

// ── Bidirectional sync ────────────────────────────────────────

/**
 * Full bidirectional sync:
 *   1. Import all Hermes jobs into CH (upsert by hermes_job_id)
 *   2. Push all CH jobs back to Hermes (full overwrite)
 *
 * For jobs that exist in Hermes but not in CH: they are imported.
 * For jobs that exist in CH but not in Hermes: they are pushed.
 * For jobs deleted in Hermes but still in CH: marked orphan.
 */
export async function syncCronWithHermes(): Promise<SyncResult> {
  const hermesImport = importHermesJobs();

  const exportResult = await syncAllJobsToHermes();
  const hermesExportErrors: string[] = exportResult.error ? [exportResult.error] : [];

  return {
    hermesImported: hermesImport.imported,
    hermesExportErrors,
    errors: [...hermesImport.errors, ...hermesExportErrors],
  };
}
