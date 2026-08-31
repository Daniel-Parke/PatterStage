// ═══════════════════════════════════════════════════════════════
// mission-handlers/dispatch.ts — POST /api/missions { action: "dispatch" }
// ═══════════════════════════════════════════════════════════════
//
// Creates a mission from the composer payload and runs it according to
// the dispatch mode: save (draft), queue (queued-for-run), cron
// (recurring on the PatterStage scheduler), or immediate. Extracted
// from the /api/missions route god-file.

import { NextResponse } from "next/server";

import {
  createMission,
  updateMission,
  buildMissionPrompt,
} from "@/lib/missions/mission-repository";
import { normalizeLocalDirsInput } from "@/lib/fs/local-dir-entry";
import { logApiError } from "@/lib/api-logger";
import { badRequest, serverError } from "@/lib/api-response";
import { appendAuditLine } from "@/lib/audit-log";
import { resolveAgentSlug } from "@/lib/agents/roster";
import { createSchedule } from "@/lib/schedules-repository";
import { parseSchedule, scheduleDisplayFromParsed } from "@/lib/schedule/parse-schedule";
import { computeNextRun } from "@/lib/schedule/next-run";
import { dispatchMissionNow } from "@/lib/missions/mission-dispatch";
import { parseMissionBodyFields } from "@/lib/missions/mission-body";
import { runMissionQueueTick } from "@/lib/missions/mission-queue-tick";
import { missionResponse } from "@/lib/missions/mission-response";
import { parseDispatchMode, DISPATCH_MODES, type DispatchMode } from "@/lib/dispatch-mode";

import { parseCategoryIdOrError } from "./shared";

export async function handleDispatchMission(
  body: Record<string, unknown>,
): Promise<NextResponse> {
  const { name, instruction, context, localDirs, references, skills, suggestedToolsets, goals, modelId, provider, profileName, missionTimeMinutes, timeoutMinutes, categoryId: categoryIdRaw, outputFormat, constraints } =
    parseMissionBodyFields(body);
  const { dispatchMode, schedule: scheduleVal, profileId } = body as {
    dispatchMode?: string;
    schedule?: string;
    profileId?: string;
    [key: string]: unknown;
  };

  const categoryId = parseCategoryIdOrError(categoryIdRaw);
  if (categoryId instanceof NextResponse) return categoryId;

  if (!instruction || typeof instruction !== "string" || !instruction.trim()) {
    return badRequest("instruction is required");
  }

  // The mode is judged HERE, before createMission below, and the position is
  // load-bearing. The row is written twenty lines down; a refusal placed beside
  // the mode branch would leave an orphan mission the operator never created,
  // showing on the board as a Draft. The cron-schedule 400 further down still
  // does exactly that, which is why this one moved up rather than joining it.
  //
  // ABSENT is not INVALID. Omitting dispatchMode means "now", a documented
  // legacy contract asserted over HTTP by
  // tests/integration/runtime/full-stack-smoke.mjs. So a blanket `if (!valid)`
  // would be wrong: only a mode that was SUPPLIED and is unrecognised is an
  // error.
  //
  // Without this, parseDispatchMode's `valid` flag was computed and discarded,
  // and the run-now branch below is a negative (`!isSaveMode && !isQueueMode`),
  // so every unrecognised string fell into an immediate unattended run (T-0067).
  if (dispatchMode !== undefined) {
    if (typeof dispatchMode !== "string" || !DISPATCH_MODES.includes(dispatchMode as DispatchMode)) {
      return badRequest(
        `Unknown dispatchMode: ${JSON.stringify(dispatchMode)}. Expected one of: ${DISPATCH_MODES.join(", ")}.`,
      );
    }
    // "cron" without a schedule is not cron: parseDispatchMode un-sets
    // isCronMode, and before T-0067 that dropped into run-now too. It gets its
    // own message because "cron" IS a legal mode, so listing the modes would be
    // the wrong advice.
    if (dispatchMode === "cron" && !scheduleVal?.trim()) {
      return badRequest("dispatchMode cron requires a schedule.");
    }
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

  // Resolve profile slug from PatterStage registry (matches Hermes --profile <slug>).
  let resolvedProfileId: string | undefined;
  const profileKey = profileName ?? profileId;
  if (profileKey) {
    // The operator may have typed a slug or a display name. Resolution goes
    // through the neutral roster, not the module table: agent_profiles belongs
    // to the hermes module now (ADR-0005 rule 2), and the two fields dispatch
    // needs are framework-neutral. resolveAgentSlug returns the key unchanged
    // when nothing matches, preserving the previous pass-through behaviour, and
    // swallows a broken store internally so this path cannot be taken down by it.
    resolvedProfileId = resolveAgentSlug(profileKey);
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
    categoryId: categoryId ?? null,
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
    // ── Recurring mission on the PatterStage scheduler ──
    // PatterStage owns the timer: a `schedules` row (mission_id FK) is the
    // source of truth and the scheduler tick (orchestration/scheduler)
    // dispatches each occurrence via the runtime. There is NO Hermes
    // jobs.json bridge. The first run is kicked off immediately
    // (best-effort) so the user sees activity without waiting for the next
    // tick — the schedule is durable regardless of that run's outcome.
    const parsedSchedule = parseSchedule(scheduleVal!);
    if (parsedSchedule.kind === "invalid") {
      return badRequest(`Unrecognized schedule: ${scheduleVal}`);
    }

    try {
      const next = computeNextRun(scheduleVal!, new Date());
      const schedule = createSchedule({
        missionId: mission.id,
        name: mission.name,
        schedule: scheduleVal!,
        scheduleDisplay: scheduleDisplayFromParsed(parsedSchedule, scheduleVal!),
        enabled: true,
        profileName: profileName ?? mission.profileName ?? null,
        nextRunAt: next ? next.toISOString() : null,
      });

      // Immediate first run — best-effort (the schedule fires on the next
      // tick even if this run fails, e.g. the backend is momentarily down).
      // Pass scheduleId so this first run is linked to its schedule (the
      // run row's schedule_id), matching scheduler-fired runs.
      try {
        await dispatchMissionNow(mission.id, { profileName, modelId, provider, scheduleId: schedule.id });
      } catch (err) {
        logApiError("POST /api/missions", "schedule first-run", err);
      }

      appendAuditLine({ action: "mission.schedule_dispatch", resource: mission.id, ok: true });
      return missionResponse(mission.id, 201);
    } catch (err) {
      logApiError("POST /api/missions", "schedule dispatch", err);
      updateMission(mission.id, { status: "failed" });
      appendAuditLine({ action: "mission.schedule_dispatch", resource: mission.id, ok: false });
      return serverError("Failed to schedule mission");
    }
  }

  let dispatchOk = true;
  if (!isSaveMode && !isQueueMode) {
    // See JSDoc above the cron-mode branch for the typing rationale —
    // `DispatchMissionNowOverrides` accepts `string | undefined`
    // directly, so no `as` casts are needed on the body fields.
    dispatchOk = (await dispatchMissionNow(mission.id, { profileName, modelId, provider })).ok;
  } else if (isQueueMode) {
    void runMissionQueueTick();
  }

  // The result used to be discarded and the audit line hardcoded ok:true, so a
  // dispatch that dispatchMissionRun had already flipped to `failed` was still
  // recorded as a success. promote checks this; dispatch did not.
  appendAuditLine({ action: "mission.dispatch", resource: mission.id, ok: dispatchOk });
  return missionResponse(mission.id, 201);
}
