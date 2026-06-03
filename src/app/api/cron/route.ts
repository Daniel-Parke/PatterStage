// ═══════════════════════════════════════════════════════════════
// /api/cron — Cron job CRUD via Control Hub SQLite
// ═══════════════════════════════════════════════════════════════
//
// All cron jobs are stored in CH SQLite (cron_jobs table).
// Changes are synced to Hermes jobs.json via pushJobToHermes().
//
// GET    /api/cron              — list all jobs
// POST   /api/cron              — create a job
// PUT    /api/cron              — update/toggle a job
// DELETE /api/cron?id=<id>      — delete a job
// POST   /api/cron  {action:"sync"}  — full bidirectional Hermes sync
// POST   /api/cron  {action:"import"} — import Hermes jobs → CH only

import { NextRequest, NextResponse } from "next/server";

import { logApiError } from "@/lib/api-logger";
import { requireAuth, isChReadOnly } from "@/lib/api-auth";
import { parseJsonBody } from "@/lib/parse-json-body";
import { badRequest, notFound, serverError } from "@/lib/api-response";
import { appendAuditLine } from "@/lib/audit-log";
import { parseSchedule } from "@/lib/utils";
import { buildCronUpdatePayload } from "@/lib/cron-field-updates";

import {
  listCronJobs,
  getCronJob,
  createCronJob,
  updateCronJob,
  deleteCronJob,
  pushJobToHermes,
  removeJobFromHermes,
  importHermesJobs,
  syncCronWithHermes,
  triggerJobViaGateway,
  normalizeRepeat,
  type CronJobRecord,
} from "@/lib/cron-repository";

import { getDefaultModel } from "@/lib/models-repository";

function cronSyncFailureResponse(
  route: string,
  pushResult: { ok: boolean; error?: string },
): NextResponse {
  logApiError(route, "pushJobToHermes", new Error(pushResult.error ?? "unknown"));
  return NextResponse.json(
    { error: "Failed to sync cron job to Hermes", cronPushError: pushResult.error ?? "unknown" },
    { status: 502 },
  );
}

/**
 * Parse a schedule string and return either the parsed schedule (when valid)
 * or a 400 NextResponse the caller can return directly. Eliminates the
 * parseSchedule+kind==="invalid" boilerplate from POST and PUT.
 */
function parseScheduleOrError(schedule: string): { ok: true; parsed: ReturnType<typeof parseSchedule> } | { ok: false; response: NextResponse } {
  const parsed = parseSchedule(schedule);
  if (parsed.kind === "invalid") {
    return {
      ok: false,
      response: badRequest(parsed.message || `Invalid schedule: "${schedule}"`),
    };
  }
  return { ok: true, parsed };
}

/**
 * Apply an enabled/disabled toggle to a cron job and sync to Hermes.
 * Shared between the `pause` and `resume` PUT branches, which differ only
 * in the new (enabled, state) values and the audit action label.
 */
async function applyEnabledChange(
  id: string,
  enabled: boolean,
  state: "paused" | "scheduled",
  auditAction: "cron.pause" | "cron.resume",
): Promise<NextResponse> {
  const updated = updateCronJob(id, { enabled, state });
  if (!updated) {
    return notFound("Job not found after update");
  }
  const pushResult = await pushJobToHermes(id);
  appendAuditLine({
    action: auditAction,
    resource: id,
    ok: pushResult.ok,
    detail: pushResult.ok ? undefined : pushResult.error,
  });
  if (!pushResult.ok) {
    return cronSyncFailureResponse(
      `PUT /api/cron ${state === "paused" ? "pause" : "resume"}`,
      pushResult,
    );
  }
  return NextResponse.json({ data: { success: true, job: recordToApiJob(updated) } });
}

// ── Helpers ───────────────────────────────────────────────────

function recordToApiJob(job: CronJobRecord) {
  // Hermes stores schedule as JSON: { kind: "* * * * *" }
  // CH stores schedule as raw cron string. Normalise both to raw cron for the API.
  let normalizedSchedule: string | null = null;
  if (job.schedule) {
    try {
      // Try parsing as Hermes JSON format { kind: "..." }
      const parsed = JSON.parse(job.schedule);
      normalizedSchedule = typeof parsed.kind === "string" ? parsed.kind : null;
    } catch {
      // Not JSON — treat as raw cron expression
      normalizedSchedule = job.schedule !== "?" ? job.schedule : null;
    }
  }

  const hasValidDisplay = job.schedule_display && job.schedule_display !== "?";
  const resolvedSchedule = hasValidDisplay ? job.schedule_display : normalizedSchedule;
  const resolvedScheduleDisplay = hasValidDisplay ? job.schedule_display : null;

  return {
    id: job.id,
    name: job.name,
    prompt: job.prompt,
    skills: job.skills,
    model: job.model,
    provider: job.provider,
    base_url: job.base_url,
    schedule: resolvedSchedule,
    schedule_display: resolvedScheduleDisplay,
    enabled: job.enabled,
    state: job.state,
    deliver: job.deliver,
    script: job.script ?? "",
    repeat: job.repeat,
    profile_name: job.profile_name,
    next_run_at: job.next_run_at,
    last_run_at: job.last_run_at,
    last_status: job.last_status,
    hermes_job_id: job.hermes_job_id,
    source: job.source,
    orphan: job.orphan,
    workdir: job.workdir,
    created_at: job.created_at,
  };
}

// ── GET ─────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (id) {
      const job = getCronJob(id);
      if (!job) {
        return notFound("Job not found");
      }
      return NextResponse.json({ data: { job: recordToApiJob(job) } });
    }

    // Pull latest execution state from Hermes before listing all jobs
    const importResult = importHermesJobs();
    if (importResult.errors.length > 0) {
      logApiError("GET /api/cron", "importing Hermes jobs", new Error(importResult.errors.join("; ")));
    }

    const rawJobs = listCronJobs();
    const jobs = rawJobs.map(recordToApiJob);
    return NextResponse.json({ data: { jobs, total: jobs.length } });
  } catch (error) {
    logApiError("GET /api/cron", "listing cron jobs", error);
    return serverError("Failed to load cron jobs");
  }
}

// ── POST ─────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  try {
    const bodyResult = await parseJsonBody(request);
    if (bodyResult instanceof NextResponse) return bodyResult;
    const body = bodyResult;

    const { action } = body as { action?: string };

    // ── Sync actions ───────────────────────────────────────────

    if (action === "sync") {
      // Full bidirectional sync
      const result = await syncCronWithHermes();
      appendAuditLine({
        action: "cron.sync",
        resource: "hermes",
        ok: result.errors.length === 0,
        detail: `imported=${result.hermesImported.length} exported_errors=${result.hermesExportErrors.length}`,
      });
      return NextResponse.json({
        data: {
          success: result.errors.length === 0,
          hermesImported: result.hermesImported,
          exportErrors: result.hermesExportErrors,
          errors: result.errors,
        },
      });
    }

    if (action === "import") {
      // Hermes → CH only
      const result = importHermesJobs();
      appendAuditLine({
        action: "cron.import",
        resource: "hermes",
        ok: result.errors.length === 0,
        detail: `imported=${result.imported.length}`,
      });
      return NextResponse.json({
        data: {
          success: result.errors.length === 0,
          imported: result.imported,
          errors: result.errors,
        },
      });
    }

    if (action === "pauseAll") {
      // Pause all jobs
      const jobs = listCronJobs();
      let paused = 0;
      for (const job of jobs) {
        updateCronJob(job.id, { enabled: false, state: "paused" });
        if (job.hermes_job_id) {
          try {
            await pushJobToHermes(job.id);
          } catch {
            // best-effort
          }
        }
        paused++;
      }
      appendAuditLine({ action: "cron.pauseAll", resource: "all", ok: true, detail: String(paused) });
      return NextResponse.json({ data: { success: true, pausedCount: paused } });
    }

    // ── Create job ─────────────────────────────────────────────

    const {
      name,
      schedule,
      prompt,
      skills,
      model,
      provider,
      base_url,
      repeat,
      deliver,
      script,
      profile_name,
    } = body as {
      name?: string;
      schedule?: string;
      prompt?: string;
      skills?: string[];
      model?: string;
      provider?: string;
      base_url?: string | null;
      repeat?: boolean | { times: number | null; completed?: number };
      deliver?: string;
      script?: string | null;
      profile_name?: string;
    };

    if (!name?.trim()) {
      return badRequest("name is required");
    }
    if (!schedule?.trim()) {
      return badRequest("schedule is required");
    }

    const scheduleCheck = parseScheduleOrError(schedule);
    if (!scheduleCheck.ok) return scheduleCheck.response;
    const parsedSchedule = scheduleCheck.parsed;

    // Resolve model: use explicit model or fall back to registry default
    const registryDefault = (() => {
      try {
        return getDefaultModel("agent");
      } catch {
        return null;
      }
    })();

    const resolvedModel = (model as string | undefined)?.trim() || registryDefault?.modelId || "";
    const resolvedProvider = (provider as string | undefined)?.trim() || registryDefault?.provider || "";

    // Resolve repeat
    const repeatObj = normalizeRepeat(repeat);

    const newJob = createCronJob({
      name: (name as string).trim(),
      prompt: (prompt as string) ?? "",
      skills: (skills as string[]) ?? [],
      model: resolvedModel,
      provider: resolvedProvider,
      base_url: (base_url as string | null) ?? null,
      schedule,
      schedule_display: "display" in parsedSchedule ? (parsedSchedule as { display: string }).display : schedule,
      repeat: repeatObj,
      enabled: true,
      state: "scheduled",
      deliver: (deliver as string) ?? "none",
      script: (script as string | null) ?? null,
      profile_name: (profile_name as string) ?? "default",
      source: "ch",
    });

    // Sync to Hermes
    const pushResult = await pushJobToHermes(newJob.id);
    if (!pushResult.ok) {
      deleteCronJob(newJob.id);
      return cronSyncFailureResponse("POST /api/cron", pushResult);
    }
    if (pushResult.hermesJobId && pushResult.hermesJobId !== newJob.id) {
      updateCronJob(newJob.id, { hermes_job_id: pushResult.hermesJobId });
    }

    appendAuditLine({ action: "cron.create", resource: newJob.id, ok: true });

    return NextResponse.json(
      { data: { success: true, job: recordToApiJob(getCronJob(newJob.id)!) } },
      { status: 201 }
    );
  } catch (error) {
    logApiError("POST /api/cron", "creating cron job", error);
    return serverError("Failed to create cron job");
  }
}

// ── PUT ─────────────────────────────────────────────────────

export async function PUT(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;
  if (isChReadOnly()) {
    return NextResponse.json({ error: "Control Hub is in read-only mode" }, { status: 503 });
  }

  try {
    const bodyResult = await parseJsonBody(request);
    if (bodyResult instanceof NextResponse) return bodyResult;
    const body = bodyResult;

    const { id, action, ...updates } = body as {
      id?: string;
      action?: string;
      [key: string]: unknown;
    };

    if (!id) {
      return badRequest("id is required");
    }

    const existing = getCronJob(id);
    if (!existing) {
      return notFound("Job not found");
    }

    // ── Pause ─────────────────────────────────────────────────
    if (action === "pause") {
      return applyEnabledChange(id, false, "paused", "cron.pause");
    }

    // ── Resume ────────────────────────────────────────────────
    if (action === "resume") {
      return applyEnabledChange(id, true, "scheduled", "cron.resume");
    }

    // ── Run now ──────────────────────────────────────────────
    if (action === "run") {
      // Push job state to Hermes jobs.json first
      const pushResult = await pushJobToHermes(id);
      appendAuditLine({ action: "cron.run.push", resource: id, ok: pushResult.ok, detail: pushResult.ok ? undefined : pushResult.error });
      if (!pushResult.ok) {
        return cronSyncFailureResponse("PUT /api/cron run (push)", pushResult);
      }

      // Get the hermes_job_id to trigger via gateway
      const job = getCronJob(id);
      const hermesJobId = job?.hermes_job_id ?? job?.id ?? id;

      // Trigger via gateway — this calls trigger_job in Hermes which sets
      // state=scheduled + next_run_at=now, signalling the scheduler
      const triggerResult = await triggerJobViaGateway(hermesJobId);
      appendAuditLine({ action: "cron.run.trigger", resource: id, ok: triggerResult.ok, detail: triggerResult.ok ? undefined : triggerResult.error });
      if (!triggerResult.ok) {
        return cronSyncFailureResponse("PUT /api/cron run (trigger)", triggerResult);
      }

      // Update CH state to reflect the triggered run
      const updated = updateCronJob(id, {
        state: "run_requested",
        next_run_at: new Date().toISOString(),
      });
      if (!updated) {
        return notFound("Job not found after update");
      }
      return NextResponse.json({ data: { success: true, job: recordToApiJob(updated) } });
    }

    // ── Field updates ─────────────────────────────────────────

    const updateResult = buildCronUpdatePayload(updates);
    if (!updateResult.ok) return updateResult.response;
    const updatePayload = updateResult.payload;

    const updated = updateCronJob(id, updatePayload);
    if (!updated) {
      return notFound("Job not found");
    }

    // Sync to Hermes
    const pushResult = await pushJobToHermes(id);
    appendAuditLine({ action: "cron.update", resource: id, ok: pushResult.ok, detail: pushResult.ok ? undefined : pushResult.error });
    if (!pushResult.ok) {
      return cronSyncFailureResponse("PUT /api/cron", pushResult);
    }

    return NextResponse.json({ data: { success: true, job: recordToApiJob(updated) } });
  } catch (error) {
    logApiError("PUT /api/cron", "updating cron job", error);
    return serverError("Failed to update cron job");
  }
}

// ── DELETE ───────────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;
  if (isChReadOnly()) {
    return NextResponse.json({ error: "Control Hub is in read-only mode" }, { status: 503 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return badRequest("id is required");
    }

    const existing = getCronJob(id);
    if (!existing) {
      return notFound("Job not found");
    }

    // Remove from Hermes first (best-effort)
    if (existing.hermes_job_id) {
      const delResult = await removeJobFromHermes(existing.hermes_job_id);
      if (!delResult.ok) {
        logApiError("DELETE /api/cron", "removeJobFromHermes", new Error(delResult.error ?? "unknown"));
      }
    }

    deleteCronJob(id);

    appendAuditLine({ action: "cron.delete", resource: id, ok: true });

    return NextResponse.json({ data: { success: true, deleted: id } });
  } catch (error) {
    logApiError("DELETE /api/cron", "deleting cron job", error);
    return serverError("Failed to delete cron job");
  }
}
