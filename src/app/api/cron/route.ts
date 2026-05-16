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
import { requireAuth, parseJsonBody } from "@/lib/api-auth";
import { appendAuditLine } from "@/lib/audit-log";
import { parseSchedule } from "@/lib/utils";

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
  type CronJobRecord,
} from "@/lib/cron-repository";

import { getDefaultModel } from "@/lib/models-repository";

// ── Helpers ───────────────────────────────────────────────────

function recordToApiJob(job: CronJobRecord) {
  return {
    id: job.id,
    name: job.name,
    prompt: job.prompt,
    skills: job.skills,
    model: job.model,
    provider: job.provider,
    base_url: job.base_url,
    schedule: job.schedule_display || job.schedule,
    schedule_display: job.schedule_display,
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
    created_at: job.created_at,
  };
}

// ── GET ─────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (id) {
      const job = getCronJob(id);
      if (!job) {
        return NextResponse.json({ error: "Job not found" }, { status: 404 });
      }
      return NextResponse.json({ data: { job: recordToApiJob(job) } });
    }

    const rawJobs = listCronJobs();
    const jobs = rawJobs.map(recordToApiJob);
    return NextResponse.json({ data: { jobs, total: jobs.length } });
  } catch (error) {
    logApiError("GET /api/cron", "listing cron jobs", error);
    return NextResponse.json({ error: "Failed to load cron jobs" }, { status: 500 });
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
      const result = syncCronWithHermes();
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
          pushJobToHermes(job.id); // best-effort
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
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    if (!schedule?.trim()) {
      return NextResponse.json({ error: "schedule is required" }, { status: 400 });
    }

    const parsedSchedule = parseSchedule(schedule);
    if (parsedSchedule.kind === "invalid") {
      return NextResponse.json({ error: parsedSchedule.message }, { status: 400 });
    }

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
    let repeatObj: { times: number | null; completed: number } | undefined;
    if (typeof repeat === "boolean") {
      repeatObj = { times: repeat ? null : 1, completed: 0 };
    } else if (typeof repeat === "object" && repeat !== null) {
      repeatObj = {
        times: repeat.times ?? null,
        completed: repeat.completed ?? 0,
      };
    }

    const newJob = createCronJob({
      name: (name as string).trim(),
      prompt: (prompt as string) ?? "",
      skills: (skills as string[]) ?? [],
      model: resolvedModel,
      provider: resolvedProvider,
      base_url: (base_url as string | null) ?? null,
      schedule,
      schedule_display: parsedSchedule.display,
      repeat: repeatObj,
      enabled: true,
      state: "scheduled",
      deliver: (deliver as string) ?? "none",
      script: (script as string | null) ?? null,
      profile_name: (profile_name as string) ?? "default",
      source: "ch",
    });

    // Sync to Hermes
    const pushResult = pushJobToHermes(newJob.id);
    if (!pushResult.ok) {
      logApiError("POST /api/cron", "pushJobToHermes", new Error(pushResult.error ?? "unknown"));
    } else if (pushResult.hermesJobId && pushResult.hermesJobId !== newJob.id) {
      // Update CH with the Hermes-assigned id
      updateCronJob(newJob.id, { hermes_job_id: pushResult.hermesJobId });
    }

    appendAuditLine({ action: "cron.create", resource: newJob.id, ok: true });

    return NextResponse.json(
      { data: { success: true, job: recordToApiJob(getCronJob(newJob.id)!) } },
      { status: 201 }
    );
  } catch (error) {
    logApiError("POST /api/cron", "creating cron job", error);
    return NextResponse.json({ error: "Failed to create cron job" }, { status: 500 });
  }
}

// ── PUT ─────────────────────────────────────────────────────

export async function PUT(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

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
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const existing = getCronJob(id);
    if (!existing) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // ── Pause ─────────────────────────────────────────────────
    if (action === "pause") {
      const updated = updateCronJob(id, { enabled: false, state: "paused" });
      pushJobToHermes(id); // best-effort sync
      appendAuditLine({ action: "cron.pause", resource: id, ok: true });
      return NextResponse.json({ data: { success: true, job: recordToApiJob(updated!) } });
    }

    // ── Resume ────────────────────────────────────────────────
    if (action === "resume") {
      const updated = updateCronJob(id, { enabled: true, state: "scheduled" });
      pushJobToHermes(id); // best-effort sync
      appendAuditLine({ action: "cron.resume", resource: id, ok: true });
      return NextResponse.json({ data: { success: true, job: recordToApiJob(updated!) } });
    }

    // ── Run now ──────────────────────────────────────────────
    if (action === "run") {
      const updated = updateCronJob(id, {
        state: "run_requested",
        next_run_at: new Date().toISOString(),
      });
      pushJobToHermes(id); // best-effort sync
      appendAuditLine({ action: "cron.run", resource: id, ok: true });
      return NextResponse.json({ data: { success: true, job: recordToApiJob(updated!) } });
    }

    // ── Field updates ─────────────────────────────────────────

    // Build update payload
    const updatePayload: Parameters<typeof updateCronJob>[1] = {};

    if (updates.name !== undefined) updatePayload.name = (updates.name as string).trim();
    if (updates.prompt !== undefined) updatePayload.prompt = updates.prompt as string;
    if (updates.skills !== undefined) updatePayload.skills = updates.skills as string[];
    if (updates.model !== undefined) updatePayload.model = updates.model as string;
    if (updates.provider !== undefined) updatePayload.provider = updates.provider as string;
    if (updates.base_url !== undefined) updatePayload.base_url = updates.base_url as string | null;
    if (updates.deliver !== undefined) updatePayload.deliver = updates.deliver as string;
    if (updates.script !== undefined) updatePayload.script = updates.script as string | null;
    if (updates.profile_name !== undefined) updatePayload.profile_name = updates.profile_name as string;
    if (updates.enabled !== undefined) updatePayload.enabled = Boolean(updates.enabled);
    if (updates.state !== undefined) updatePayload.state = updates.state as string;

    if (updates.schedule !== undefined) {
      const parsed = parseSchedule(updates.schedule as string);
      if (parsed.kind === "invalid") {
        return NextResponse.json({ error: parsed.message }, { status: 400 });
      }
      updatePayload.schedule = updates.schedule as string;
      updatePayload.schedule_display = (parsed as { display?: string }).display ?? (updates.schedule as string);
    }

    if (updates.repeat !== undefined) {
      if (typeof updates.repeat === "boolean") {
        updatePayload.repeat = { times: updates.repeat ? null : 1, completed: 0 };
      } else if (typeof updates.repeat === "object" && updates.repeat !== null) {
        updatePayload.repeat = updates.repeat as { times: number | null; completed?: number };
      }
    }

    const updated = updateCronJob(id, updatePayload);
    if (!updated) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Sync to Hermes
    const pushResult = pushJobToHermes(id);
    if (!pushResult.ok) {
      logApiError("PUT /api/cron", "pushJobToHermes", new Error(pushResult.error ?? "unknown"));
    }

    appendAuditLine({ action: "cron.update", resource: id, ok: true });

    return NextResponse.json({ data: { success: true, job: recordToApiJob(updated) } });
  } catch (error) {
    logApiError("PUT /api/cron", "updating cron job", error);
    return NextResponse.json({ error: "Failed to update cron job" }, { status: 500 });
  }
}

// ── DELETE ───────────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const existing = getCronJob(id);
    if (!existing) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Remove from Hermes first (best-effort)
    if (existing.hermes_job_id) {
      const delResult = removeJobFromHermes(existing.hermes_job_id);
      if (!delResult.ok) {
        logApiError("DELETE /api/cron", "removeJobFromHermes", new Error(delResult.error ?? "unknown"));
      }
    }

    deleteCronJob(id);

    appendAuditLine({ action: "cron.delete", resource: id, ok: true });

    return NextResponse.json({ data: { success: true, deleted: id } });
  } catch (error) {
    logApiError("DELETE /api/cron", "deleting cron job", error);
    return NextResponse.json({ error: "Failed to delete cron job" }, { status: 500 });
  }
}
