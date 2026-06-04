// ═══════════════════════════════════════════════════════════════
// /api/missions — Mission CRUD + dispatch (SQLite)
// ═══════════════════════════════════════════════════════════════
// Missions are stored in Control Hub SQLite. Dispatch is handled
// by the Hermes backend for mission execution.
import { NextRequest, NextResponse } from "next/server";
import {
  getMission,
  listMissions,
  createMission,
  updateMission,
  deleteMission,
  buildMissionPrompt,
} from "@/lib/mission-repository";
import { updateSession } from "@/lib/session-repository";
import { normalizeLocalDirsInput } from "@/lib/local-dir-entry";
import { requireAuth, isChReadOnly } from "@/lib/api-auth";
import { logApiError, serverErrorFromCatch } from "@/lib/api-logger";
import { parseJsonBody } from "@/lib/parse-json-body";
import { badRequest, notFound, ok, serverError, serviceUnavailable } from "@/lib/api-response";
import { appendAuditLine } from "@/lib/audit-log";
import { agentBackend } from "@/lib/backends";
import { createCronJob, deleteCronJob, importHermesJobs, pushJobToHermes } from "@/lib/cron-repository";
import { getCategory } from "@/lib/mission-category-repository";
import { listProfiles } from "@/lib/profiles-repository";
import {
  deleteMissionCron,
  enrichMissionCron,
  pauseMissionCron,
  syncMissionToCronJob,
} from "@/lib/mission-cron-sync";
import { dispatchMissionNow } from "@/lib/mission-dispatch";
import { buildMissionFieldPatch } from "@/lib/mission-field-updates";
import { promoteMission } from "@/lib/mission-promote-handler";
import { runMissionQueueTick } from "@/lib/mission-queue-tick";
import { ensureSyncLayer } from "@/lib/sync";
import { cronSyncFailureBody, logCronSyncFailure } from "@/lib/cron-sync-failure";
import { missionResponse } from "@/lib/mission-response";
import { parseDispatchMode } from "@/lib/dispatch-mode";

// ── Helpers ───────────────────────────────────────────────────────

function resolveMissionId(body: Record<string, unknown>): string | undefined {
  return (body.id ?? body.missionId) as string | undefined;
}

/**
 * Resolve a mission id from the request body and return a 400 NextResponse
 * if it is missing. Callers check `if (missionId instanceof NextResponse) return missionId;`
 * to short-circuit. Centralises the "Mission id is required" 400 message
 * — the prior 4 inline copies all returned the exact same string.
 */
function requireMissionId(body: Record<string, unknown>): string | NextResponse {
  const id = resolveMissionId(body);
  if (!id) {
    return badRequest("Mission id is required");
  }
  return id;
}

/**
 * Look up a mission by id and return a 404 NextResponse if it is missing.
 * Callers check `if (mission instanceof NextResponse) return mission;` to
 * short-circuit. Centralises the "Mission not found" 404 message — the
 * prior 5 inline copies all returned the exact same string.
 */
function getMissionOrNotFound(id: string): NonNullable<ReturnType<typeof getMission>> | NextResponse {
  const mission = getMission(id);
  if (!mission) {
    return notFound("Mission not found");
  }
  return mission;
}

/**
 * Look up a mission by id from a request body, returning either the
 * `Mission` record or a `NextResponse` (400 if id missing, 404 if not
 * found). Callers do:
 *
 *   const mission = requireMissionOrNotFound(body);
 *   if (mission instanceof NextResponse) return mission;
 *
 * This is the two-line pattern (`requireMissionId` + `getMissionOrNotFound`)
 * that appeared in 3 POST sites (update, cancel, delete). Both helpers
 * already exist; this is just the composable 2-step form that lets
 * callers stay one line. See session-69 for the audit.
 */
function requireMissionOrNotFound(
  body: Record<string, unknown>,
): NonNullable<ReturnType<typeof getMission>> | NextResponse {
  const id = requireMissionId(body);
  if (id instanceof NextResponse) return id;
  return getMissionOrNotFound(id);
}

function parseCategoryId(
  raw: unknown,
): { ok: true; value: string | null | undefined } | { ok: false; error: string } {
  if (raw === undefined) return { ok: true, value: undefined };
  if (raw === null || raw === "") return { ok: true, value: null };
  if (typeof raw !== "string") {
    return { ok: false, error: "categoryId must be a string" };
  }
  if (!getCategory(raw)) {
    return { ok: false, error: "Category not found" };
  }
  return { ok: true, value: raw };
}

/** Shared fields destructured from mission action body (dispatch/promote/update). */
interface MissionBodyFields {
  name?: string;
  instruction?: string;
  context?: string;
  localDirs?: unknown;
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
  categoryId?: string | null;
  outputFormat?: string;
  constraints?: string;
}

function parseMissionBodyFields(body: Record<string, unknown>): MissionBodyFields {
  return {
    name: body.name as string | undefined,
    instruction: body.instruction as string | undefined,
    context: body.context as string | undefined,
    localDirs: body.localDirs,
    references: body.references as string[] | undefined,
    skills: body.skills as string[] | undefined,
    suggestedToolsets: body.suggestedToolsets as string[] | undefined,
    goals: body.goals as string[] | undefined,
    modelId: body.modelId as string | undefined,
    provider: body.provider as string | undefined,
    profileName: body.profileName as string | undefined,
    missionTimeMinutes: body.missionTimeMinutes as number | undefined,
    timeoutMinutes: body.timeoutMinutes as number | undefined,
    schedule: body.schedule as string | undefined,
    categoryId: body.categoryId as string | null | undefined,
    outputFormat: body.outputFormat as string | undefined,
    constraints: body.constraints as string | undefined,
  };
}

// ── GET ───────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  ensureSyncLayer();
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  try {
    // Pull latest cron job execution state from Hermes before reading
    importHermesJobs();
    if (id) {
      const mission = getMissionOrNotFound(id);
      if (mission instanceof NextResponse) return mission;
      // Mission status is synced in background by MissionSync
      return ok({ mission: enrichMissionCron(mission) });
    }

    const categoryIdParam = url.searchParams.get("categoryId");
    const missions = listMissions(
      categoryIdParam === "__uncategorized__"
        ? { categoryId: null }
        : categoryIdParam
          ? { categoryId: categoryIdParam }
          : undefined,
    ).map((m) => enrichMissionCron(m));
    return ok({ missions });
  } catch (error) {
    return serverErrorFromCatch("GET /api/missions", id ? `mission ${id}` : "listing missions", error, "Failed to load missions");
  }
}

// ── POST ──────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;
  if (isChReadOnly()) {
    return serviceUnavailable("Control Hub is in read-only mode");
  }

  ensureSyncLayer();

  // Hoist parseJsonBody out of the main try/catch so malformed JSON returns
  // 400 (REST semantics) instead of being swallowed and re-thrown as a
  // generic 500 from the catch below. Same bug class as the session-37
  // fix for /api/sessions, /api/memory/hindsight, etc.
  const bodyResult = await parseJsonBody(request);
  if (bodyResult instanceof NextResponse) return bodyResult;
  const body = bodyResult as Record<string, unknown>;

  try {
    const { action } = body as { action?: string };

    // ── Dispatch Mission ────────────────────────────────────────
    if (action === "dispatch") {
      const { name, instruction, context, localDirs, references, skills, suggestedToolsets, goals, modelId, provider, profileName, missionTimeMinutes, timeoutMinutes, categoryId: categoryIdRaw, outputFormat, constraints } =
        parseMissionBodyFields(body);
      const { dispatchMode, schedule: scheduleVal, profileId } = body as {
        dispatchMode?: string;
        schedule?: string;
        profileId?: string;
        [key: string]: unknown;
      };

      const categoryParsed = parseCategoryId(categoryIdRaw);
      if (!categoryParsed.ok) {
        return badRequest(categoryParsed.error);
      }

      if (!instruction || typeof instruction !== "string" || !instruction.trim()) {
        return badRequest("instruction is required");
      }

      const dirsNorm = normalizeLocalDirsInput(localDirs);

      const prompt = buildMissionPrompt({
        instruction: instruction.trim(),
        localDirs: dirsNorm,
        references: references ?? [],
        skills: skills ?? [],
        toolsets: suggestedToolsets ?? [],
        goals: goals ?? [],
        context: context ?? "",
        missionTimeMinutes: missionTimeMinutes ?? undefined,
        timeoutMinutes: timeoutMinutes ?? undefined,
        outputFormat: outputFormat ?? "",
        constraints: constraints ?? "",
      });

      // Resolve profile slug from Control Hub registry (matches Hermes --profile <slug>).
      let resolvedProfileId: string | undefined;
      const profileKey = profileName ?? profileId;
      if (profileKey) {
        if (profileKey === "default") {
          resolvedProfileId = "default";
        } else {
          try {
            const profiles = listProfiles();
            const match = profiles.find(
              (p) =>
                p.slug === profileKey ||
                p.displayName === profileKey,
            );
            resolvedProfileId = match?.slug ?? profileKey;
          } catch {
            resolvedProfileId = profileKey;
          }
        }
      }

      const mission = createMission({
        name: (name as string)?.trim() || "Untitled Mission",
        prompt,
        profileId: resolvedProfileId ?? profileId,
        localDirs: dirsNorm,
        references: references ?? [],
        skills: skills ?? [],
        suggestedToolsets: suggestedToolsets ?? [],
        goals: goals ?? [],
        modelId: modelId ?? undefined,
        provider: provider ?? undefined,
        profileName: profileName ?? undefined,
        missionTimeMinutes,
        timeoutMinutes,
        schedule: scheduleVal,
        categoryId: categoryParsed.value ?? null,
        outputFormat: outputFormat?.trim() || undefined,
        constraints: constraints?.trim() || undefined,
      });

      const { isSaveMode, isQueueMode, isCronMode } = parseDispatchMode(dispatchMode, scheduleVal);

      if (isSaveMode) {
        updateMission(mission.id, { queuedForRun: false });
      } else if (isQueueMode) {
        updateMission(mission.id, { queuedForRun: true });
      }

      if (isCronMode) {
        // ── Recurring mission: create a cron job + dispatch first run immediately ──
        // Creating a cron job handles subsequent runs on schedule, but the user
        // expects the first run to start right away rather than waiting for the
        // next schedule tick.

        try {
          const profileNameFinal = profileName as string | undefined;
          const cronJob = createCronJob({
            name: mission.name,
            prompt: mission.prompt,
            skills: skills as string[] | undefined,
            model: modelId as string | undefined,
            provider: provider as string | undefined,
            schedule: scheduleVal!,
            repeat: { times: null }, // infinite
            enabled: true,
            state: "scheduled",
            deliver: "none",
            profile_name: profileNameFinal ?? "default",
            source: "ch",
          });

          // Link mission to cron job
          updateMission(mission.id, { cronJobId: cronJob.id });

          // Push to Hermes so the scheduler picks it up
          const pushResult = await pushJobToHermes(cronJob.id);
          if (!pushResult.ok) {
            deleteCronJob(cronJob.id);
            updateMission(mission.id, { cronJobId: null, status: "failed" });
            appendAuditLine({ action: "mission.cron_dispatch", resource: mission.id, ok: false });
            // Log via the side-effect-only helper (same console shape as
            // the cron/route.ts sites) and splice the mission data into
            // the body before returning the 502.
            logCronSyncFailure("POST /api/missions", pushResult);
            return NextResponse.json(
              {
                ...cronSyncFailureBody(pushResult),
                data: { mission: enrichMissionCron(getMission(mission.id)!) },
              },
              { status: 502 },
            );
          }

          // ── Immediate first-run dispatch ──
          await dispatchMissionNow(mission.id, {
            profileName: profileName as string | undefined,
            modelId: modelId as string | undefined,
            provider: provider as string | undefined,
          });

          appendAuditLine({ action: "mission.cron_dispatch", resource: mission.id, ok: true });
          return missionResponse(mission.id, 201);
        } catch (err) {
          logApiError("POST /api/missions", "cron dispatch", err);
          updateMission(mission.id, { status: "failed" });
          appendAuditLine({ action: "mission.cron_dispatch", resource: mission.id, ok: false });
          return serverError("Failed to create cron job for mission");
        }
      }

      if (!isSaveMode && !isQueueMode) {
        await dispatchMissionNow(mission.id, {
          profileName: profileName as string | undefined,
          modelId: modelId as string | undefined,
          provider: provider as string | undefined,
        });
      } else if (isQueueMode) {
        void runMissionQueueTick();
      }

      appendAuditLine({ action: "mission.dispatch", resource: mission.id, ok: true });
      return missionResponse(mission.id, 201);
    }

    // ── Promote draft / queued-waiting mission ─────────────────
    if (action === "promote") {
      const missionIdFinal = requireMissionId(body as Record<string, unknown>);
      if (missionIdFinal instanceof NextResponse) return missionIdFinal;

      const { dispatchMode, ...rest } = body as {
        dispatchMode?: string;
        [key: string]: unknown;
      };
      const f = parseMissionBodyFields(rest);
      const { name, instruction, context, localDirs, references, skills, suggestedToolsets, goals, modelId, provider, profileName, missionTimeMinutes, timeoutMinutes, schedule: scheduleVal, categoryId: categoryIdRaw, outputFormat, constraints } = f;

      if (!dispatchMode) {
        return badRequest("dispatchMode is required");
      }

      const categoryParsed = parseCategoryId(categoryIdRaw);
      if (!categoryParsed.ok) {
        return badRequest(categoryParsed.error);
      }

      if (
        instruction !== undefined &&
        (typeof instruction !== "string" || !instruction.trim())
      ) {
        return badRequest("instruction cannot be empty");
      }

      const result = await promoteMission({
        missionId: missionIdFinal,
        dispatchMode,
        schedule: scheduleVal,
        name,
        instruction,
        context,
        localDirs,
        references,
        skills,
        suggestedToolsets,
        goals,
        modelId,
        provider,
        profileName,
        missionTimeMinutes,
        timeoutMinutes,
        categoryId: categoryParsed.value,
        outputFormat,
        constraints,
      });

      if (!result.ok) {
        return NextResponse.json(
          {
            error: result.error,
            cronPushError: result.cronPushError,
            data: result.mission ? { mission: result.mission } : undefined,
          },
          { status: result.status },
        );
      }

      appendAuditLine({ action: "mission.promote", resource: missionIdFinal, ok: true });
      return ok({ mission: result.mission });
    }

    // ── Update Mission ─────────────────────────────────────────
    if (action === "update") {
      const { status, result, ...rest } = body as {
        id?: string;
        missionId?: string;
        status?: string;
        result?: string;
        [key: string]: unknown;
      };
      const f = parseMissionBodyFields(rest);
      const { name, instruction, localDirs, references, skills, suggestedToolsets, goals, modelId, provider, profileName, missionTimeMinutes, timeoutMinutes, schedule, context, categoryId: categoryIdRaw, outputFormat, constraints } = f;
      const existing = requireMissionOrNotFound(body as Record<string, unknown>);
      if (existing instanceof NextResponse) return existing;
      const missionIdFinal = existing.id;

      const categoryParsed = parseCategoryId(categoryIdRaw);
      if (!categoryParsed.ok) {
        return badRequest(categoryParsed.error);
      }

      if (existing.status !== "dispatched") {
        return badRequest("Use promote for draft or queued missions; update is for running missions");
      }

      const { shouldRebuildPrompt, prompt, updates } = buildMissionFieldPatch(
        existing,
        {
          status,
          result,
          name,
          instruction,
          context,
          localDirs,
          references,
          skills,
          suggestedToolsets,
          goals,
          modelId,
          provider,
          profileName,
          missionTimeMinutes,
          timeoutMinutes,
          schedule,
          outputFormat,
          constraints,
        },
        categoryParsed.value,
      );

      const mission = updateMission(missionIdFinal, updates);
      if (!mission)
        return notFound("Mission not found");

      const shouldSyncCron =
        mission.cronJobId &&
        (shouldRebuildPrompt ||
          schedule !== undefined ||
          profileName !== undefined ||
          modelId !== undefined ||
          provider !== undefined);

      if (shouldSyncCron) {
        await syncMissionToCronJob(missionIdFinal);
      }

      if (prompt !== undefined) {
        try {
          await agentBackend.syncMission(missionIdFinal, { prompt: mission.prompt });
        } catch (err) {
          logApiError("POST /api/missions", "syncMission disk", err);
        }
      }

      appendAuditLine({ action: "mission.update", resource: missionIdFinal, ok: true });
      return missionResponse(missionIdFinal);
    }

    // ── Cancel Mission ─────────────────────────────────────────
    // The unified V1 status enum has no `cancelled` state — cancellations
    // are recorded as `failed` with an explicit "Cancelled by user" result.
    if (action === "cancel") {
      const existingMission = requireMissionOrNotFound(body as Record<string, unknown>);
      if (existingMission instanceof NextResponse) return existingMission;

      const cancelId = existingMission.id;
      const mission = updateMission(cancelId, {
        status: "failed",
        result: "Cancelled by user",
        queuedForRun: false,
      });
      if (!mission)
        return notFound("Mission not found");

      if (mission.sessionId) {
        try {
          updateSession(mission.sessionId, {
            status: "failed",
            endedAt: new Date().toISOString(),
            error: "Cancelled by user",
          });
        } catch (err) {
          logApiError("POST /api/missions", "cancelMission session update", err);
        }
      }

      await pauseMissionCron(cancelId);

      const shouldKillProcess = existingMission.status === "dispatched";
      if (shouldKillProcess) {
        void agentBackend.cancelMission(cancelId).catch((err: unknown) => {
          logApiError("POST /api/missions", "cancelMission process kill (background)", err);
        });
      }

      appendAuditLine({ action: "mission.cancel", resource: cancelId, ok: true });
      return ok({
        mission: enrichMissionCron(mission),
        cancel: {
          accepted: true,
          processKillPending: shouldKillProcess,
        },
      });
    }

    // ── Delete Mission ─────────────────────────────────────────
    if (action === "delete") {
      const existing = requireMissionOrNotFound(body as Record<string, unknown>);
      if (existing instanceof NextResponse) return existing;

      const missionIdFinal = existing.id;
      await deleteMissionCron(missionIdFinal);

      const deleted = deleteMission(missionIdFinal);
      if (!deleted)
        return notFound("Mission not found");

      appendAuditLine({ action: "mission.delete", resource: missionIdFinal, ok: true });
      return ok({ deleted: missionIdFinal });
    }

    return badRequest(`Unknown action: ${action}`);
  } catch (error) {
    return serverErrorFromCatch("POST /api/missions", "processing request", error, "Internal server error");
  }
}
