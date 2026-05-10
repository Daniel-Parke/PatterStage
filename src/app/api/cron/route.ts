import { NextRequest, NextResponse } from "next/server";



import { getActiveHermesPaths } from "@/lib/hermes-agent-runtime";

import { getDefaultModel } from "@/lib/models-repository";

import { logApiError } from "@/lib/api-logger";

import { requireMcApiKey, requireNotReadOnly } from "@/lib/api-auth";

import { appendAuditLine } from "@/lib/audit-log";

import { parseSchedule, type CronJobData } from "@/lib/utils";

import {

  readJobsFile,

  withJobsFileLock,

} from "@/lib/jobs-repository";

import {

  type CronPostBody,

  cronPostBodySchema,

  cronPutBodySchema,

  zodErrorResponse,

} from "@/lib/api-schemas";



function cronPaths() {
  const H = getActiveHermesPaths();
  return { CRON_PATH: H.cronJobs, JOBS_BACKUP_DIR: H.backups + "/ch-cron-jobs" };
}



// GET /api/cron — list all cron jobs

export async function GET() {

  try {

    const { CRON_PATH } = cronPaths();

    const parsed = readJobsFile(CRON_PATH);

    if (!parsed.ok) {

      logApiError("GET /api/cron", "corrupt jobs.json", new Error(parsed.error));

      return NextResponse.json(

        { error: parsed.error },

        { status: 503 }

      );

    }

    const jobList = parsed.jobs.map((job) => {

      const scheduleStr =

        typeof job.schedule === "object"

          ? job.schedule.display || job.schedule.kind || ""

          : String(job.schedule || "");

      const repeatBool =

        typeof job.repeat === "object"

          ? job.repeat.times !== null

            ? job.repeat.times !== 1

            : true

          : Boolean(job.repeat);



      return {

        id: job.id,

        name: job.name || job.id,

        schedule: scheduleStr || job.schedule_display || "",

        prompt: job.prompt || "",

        deliver: job.deliver || "",

        model: job.model || "",

        enabled: job.enabled !== false,

        lastRun: job.last_run_at || null,

        nextRun: job.next_run_at || null,

        repeat: repeatBool,

        skills: job.skills || [],

        script: job.script || "",

        state: job.state || "unknown",

      };

    });



    return NextResponse.json({

      data: { jobs: jobList, total: jobList.length },

    });

  } catch (error) {

    logApiError("GET /api/cron", "listing cron jobs", error);

    return NextResponse.json(

      { error: "Failed to read cron jobs" },

      { status: 500 }

    );

  }

}



// POST /api/cron — create a new job (or body.action === "pauseAll")

export async function POST(request: NextRequest) {

  const ro = requireNotReadOnly();

  if (ro) return ro;

  const auth = requireMcApiKey(request);

  if (auth) return auth;



  try {

    const { CRON_PATH, JOBS_BACKUP_DIR } = cronPaths();

    let raw: unknown;

    try {

      raw = await request.json();

    } catch {

      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

    }

    const parsed = cronPostBodySchema.safeParse(raw);

    if (!parsed.success) {

      return zodErrorResponse(parsed.error);

    }



    if ("action" in parsed.data && parsed.data.action === "pauseAll") {

      const out = await withJobsFileLock(

        CRON_PATH,

        JOBS_BACKUP_DIR,

        (jobs) => {

          const next = jobs.map((j) => ({

            ...j,

            enabled: false,

            state: "paused",

            paused_at: new Date().toISOString(),

          }));

          return { action: "write" as const, jobs: next, value: next.length };

        }

      );

      if (!out.ok) {

        return NextResponse.json({ error: out.error }, { status: 503 });

      }

      appendAuditLine({

        action: "cron.pauseAll",

        resource: "jobs.json",

        ok: true,

        detail: String(out.value),

      });

      return NextResponse.json({

        data: { success: true, pausedCount: out.value },

      });

    }



    const { name, schedule, prompt, deliver, model, repeat, skills, script } =

      parsed.data as Exclude<CronPostBody, { action: "pauseAll" }>;



    const id = name

      .toLowerCase()

      .replace(/[^a-z0-9]+/g, "-")

      .replace(/^-|-$/g, "");

    if (!id) {

      return NextResponse.json(

        { error: "Job name must contain at least one alphanumeric character" },

        { status: 400 }

      );

    }



    const registryDefault = (() => {
      try {
        return getDefaultModel("agent");
      } catch {
        return null;
      }
    })();

    const sched = parseSchedule(schedule);

    if (sched.kind === "invalid") {

      return NextResponse.json({ error: sched.message }, { status: 400 });

    }



    const newJob: CronJobData = {

      id,

      name,

      prompt,

      skills: skills || [],

      model: model || registryDefault?.modelId || "",

      provider: registryDefault?.provider || "",

      schedule: sched,

      schedule_display: sched.display,

      repeat: { times: repeat ? null : 1, completed: 0 },

      enabled: true,

      state: "scheduled",

      deliver: deliver || "none",

      script: script || null,

      created_at: new Date().toISOString(),

      next_run_at: null,

    };



    const out = await withJobsFileLock(CRON_PATH, JOBS_BACKUP_DIR, (jobs) => {

      if (jobs.some((j) => j.id === id)) {

        return { action: "abort", error: `Job "${id}" already exists` };

      }

      const next = [...jobs, newJob];

      return { action: "write", jobs: next, value: undefined };

    });



    if (!out.ok) {

      if (out.error.includes("already exists")) {

        return NextResponse.json({ error: out.error }, { status: 409 });

      }

      return NextResponse.json({ error: out.error }, { status: 503 });

    }



    appendAuditLine({

      action: "cron.create",

      resource: id,

      ok: true,

    });



    return NextResponse.json({ data: { success: true, id, job: newJob } });

  } catch (error) {

    logApiError("POST /api/cron", "creating cron job", error);

    return NextResponse.json(

      { error: "Failed to create cron job" },

      { status: 500 }

    );

  }

}



// PUT /api/cron — update or toggle a job

export async function PUT(request: NextRequest) {

  const ro = requireNotReadOnly();

  if (ro) return ro;

  const auth = requireMcApiKey(request);

  if (auth) return auth;



  try {

    const { CRON_PATH, JOBS_BACKUP_DIR } = cronPaths();

    let raw: unknown;

    try {

      raw = await request.json();

    } catch {

      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

    }

    const parsed = cronPutBodySchema.safeParse(raw);

    if (!parsed.success) {

      return zodErrorResponse(parsed.error);

    }

    const { id, action, ...updates } = parsed.data;



    if (typeof updates.schedule === "string") {

      const p = parseSchedule(updates.schedule);

      if (p.kind === "invalid") {

        return NextResponse.json({ error: p.message }, { status: 400 });

      }

    }

    // Validate model field: if set, it must exist in the registry
    const modelUpdate = (updates as Record<string, unknown>).model;
    if (typeof modelUpdate === "string" && modelUpdate.trim() !== "") {
      try {
        const { listModels } = await import("@/lib/models-repository");
        const models = listModels();
        const known = models.some(
          (m) => m.modelId === modelUpdate || m.modelId === modelUpdate.trim()
        );
        if (!known) {
          return NextResponse.json(
            {
              error: `Model "${modelUpdate}" is not in the registry. Add it under Config → Models, or leave blank to use the default.`,
            },
            { status: 400 }
          );
        }
      } catch {
        // Registry unavailable — skip validation
      }
    }


    const out = await withJobsFileLock(CRON_PATH, JOBS_BACKUP_DIR, (jobs) => {

      const jobIndex = jobs.findIndex((j) => j.id === id);

      if (jobIndex === -1) {

        return { action: "abort", error: `Job "${id}" not found` };

      }

      const next = jobs.map((j) => ({ ...j }));

      const job = { ...next[jobIndex] } as CronJobData;



      if (action === "pause") {

        job.enabled = false;

        job.paused_at = new Date().toISOString();

        job.state = "paused";

      } else if (action === "resume") {

        job.enabled = true;

        job.paused_at = null;

        job.state = "scheduled";

      } else if (action === "run") {

        job.next_run_at = new Date().toISOString();

        job.state = "scheduled";

        job.enabled = true;

        job.paused_at = null;

      } else {

        const ALLOWED_FIELDS = [

          "name",

          "prompt",

          "skills",

          "model",

          "deliver",

          "enabled",

          "schedule",

          "schedule_display",

        ] as const;

        for (const field of ALLOWED_FIELDS) {

          if (field in updates) {

            const value = (updates as Record<string, unknown>)[field];

            if (field === "schedule" && typeof value === "string") {

              (job as Record<string, unknown>)[field] = parseSchedule(value);

            } else {

              (job as Record<string, unknown>)[field] = value;

            }

          }

        }

      }



      next[jobIndex] = job;

      return { action: "write", jobs: next, value: job };

    });



    if (!out.ok) {

      const st = out.error.includes("not found") ? 404 : 503;

      return NextResponse.json({ error: out.error }, { status: st });

    }



    appendAuditLine({

      action: "cron.update",

      resource: id,

      ok: true,

    });



    return NextResponse.json({

      data: { success: true, id, job: out.value },

    });

  } catch (error) {

    logApiError("PUT /api/cron", "updating cron job", error);

    return NextResponse.json(

      { error: "Failed to update cron job" },

      { status: 500 }

    );

  }

}



// DELETE /api/cron — delete a job

export async function DELETE(request: NextRequest) {

  const ro = requireNotReadOnly();

  if (ro) return ro;

  const auth = requireMcApiKey(request);

  if (auth) return auth;



  try {

    const { CRON_PATH, JOBS_BACKUP_DIR } = cronPaths();

    const { searchParams } = new URL(request.url);

    const id = searchParams.get("id");



    if (!id) {

      return NextResponse.json({ error: "Missing job id" }, { status: 400 });

    }



    const out = await withJobsFileLock(CRON_PATH, JOBS_BACKUP_DIR, (jobs) => {

      const jobIndex = jobs.findIndex((j) => j.id === id);

      if (jobIndex === -1) {

        return { action: "abort", error: `Job "${id}" not found` };

      }

      const next = jobs.filter((j) => j.id !== id);

      return { action: "write", jobs: next, value: undefined };

    });



    if (!out.ok) {

      const st = out.error.includes("not found") ? 404 : 503;

      return NextResponse.json({ error: out.error }, { status: st });

    }



    appendAuditLine({

      action: "cron.delete",

      resource: id,

      ok: true,

    });



    return NextResponse.json({ data: { success: true, deleted: id } });

  } catch (error) {

    logApiError("DELETE /api/cron", "deleting cron job", error);

    return NextResponse.json(

      { error: "Failed to delete cron job" },

      { status: 500 }

    );

  }

}

