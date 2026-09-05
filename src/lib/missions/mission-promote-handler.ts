// ═══════════════════════════════════════════════════════════════
// mission-promote-handler.ts — promote draft/queued missions (shared API logic)
// ═══════════════════════════════════════════════════════════════

import {
  getMission,
  updateMission,
} from "@/lib/missions/mission-repository";
import { buildMissionFieldPatch } from "@/lib/missions/mission-field-updates";
import { dispatchMissionNow } from "@/lib/missions/mission-dispatch";
import { runMissionQueueTick } from "@/lib/missions/mission-queue-tick";
import { createSchedule } from "@/lib/schedules-repository";
import { parseSchedule, scheduleDisplayFromParsed } from "@/lib/schedule/parse-schedule";
import { computeNextRun, scheduleCanEverFire } from "@/lib/schedule/next-run";
import { enrichedMission } from "@/lib/missions/mission-response";
import { logApiError } from "@/lib/api-logger";
import { isMissionDraft, isMissionQueuedForRun } from "@/lib/missions/mission-board";
import { DISPATCH_MODES, parseDispatchMode } from "@/lib/dispatch-mode";
import type { Mission } from "@/lib/missions/mission-types";

export interface PromoteMissionInput {
  missionId: string;
  dispatchMode: string;
  schedule?: string;
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
  categoryId?: string | null;
  outputFormat?: string;
  constraints?: string;
}

export type PromoteMissionResult =
  | { ok: true; mission: Mission }
  | { ok: false; status: number; error: string; cronPushError?: string; mission?: Mission };

export async function promoteMission(
  input: PromoteMissionInput,
): Promise<PromoteMissionResult> {
  const existing = getMission(input.missionId);
  if (!existing) {
    return { ok: false, status: 404, error: "Mission not found" };
  }

  if (existing.status === "dispatched") {
    return {
      ok: false,
      status: 400,
      error:
        `promote applies to a draft or queued mission; this one is 'dispatched'. ` +
        `To change a running mission, send ` +
        `{"action":"update","id":"${input.missionId}"} with the fields to change, ` +
        `or {"action":"cancel","id":"${input.missionId}"} to stop it first.`,
    };
  }

  if (existing.status === "successful" || existing.status === "failed") {
    // `re-dispatch` is not an action this API has -- the switch is
    // dispatch | promote | update | cancel | delete -- so an operator searching
    // for it found nothing. Name the call that exists (T-0071).
    return {
      ok: false,
      status: 400,
      error:
        `promote applies to a draft or queued mission; this one is ` +
        `'${existing.status}'. A finished mission is not re-opened: send ` +
        `{"action":"dispatch", ...} to start a new run from the same brief.`,
    };
  }

  if (
    existing.status !== "queued" ||
    (!isMissionDraft(existing) && !isMissionQueuedForRun(existing))
  ) {
    return { ok: false, status: 400, error: "Mission cannot be promoted in its current state" };
  }

  const dispatchMode = input.dispatchMode;
  const { isSaveMode, isQueueMode, isCronMode, isNowMode, valid } = parseDispatchMode(dispatchMode, input.schedule);

  if (!valid) {
    // Enumerated, and it names what was actually sent. "Invalid dispatchMode
    // for promote" told an operator neither what they typed nor what they could
    // have typed instead (T-0071). The same refusal covers an ABSENT mode,
    // which is why it says "expected one of" rather than "not recognised".
    return {
      ok: false,
      status: 400,
      error:
        `dispatchMode ${dispatchMode === undefined ? "is required" : `${JSON.stringify(dispatchMode)} is not recognised`}. ` +
        `Expected one of: ${DISPATCH_MODES.join(", ")}. ` +
        `Use "save" to edit a draft without running it.`,
    };
  }

  if (isCronMode && !input.schedule?.trim()) {
    return { ok: false, status: 400, error: "schedule is required for cron promote" };
  }

  const { updates } = buildMissionFieldPatch(
    existing,
    {
      name: input.name,
      instruction: input.instruction,
      context: input.context,
      localDirs: input.localDirs,
      references: input.references,
      skills: input.skills,
      suggestedToolsets: input.suggestedToolsets,
      goals: input.goals,
      modelId: input.modelId,
      provider: input.provider,
      profileName: input.profileName,
      missionTimeMinutes: input.missionTimeMinutes,
      timeoutMinutes: input.timeoutMinutes,
      schedule: input.schedule,
      categoryId: input.categoryId,
      outputFormat: input.outputFormat,
      constraints: input.constraints,
    },
    input.categoryId,
  );

  if (isSaveMode) {
    updates.queuedForRun = false;
  } else if (isQueueMode) {
    updates.queuedForRun = true;
  }

  // Re-activating a mission clears any stale result from a previous run so the
  // queued/dispatched mission doesn't surface old output. (QA #9/#43)
  //
  // NOT on save. `dispatchMode:"save"` is the no-op the console uses to RENAME a
  // draft or edit its prompt, and it was taking this line too -- so renaming a
  // finished mission silently destroyed the output it had produced, with no
  // warning and nothing to undo it with (T-0070). Nothing is being re-activated,
  // so there is no stale result to clear.
  const mission = updateMission(
    input.missionId,
    isSaveMode ? updates : { ...updates, result: null },
  );
  if (!mission) {
    return { ok: false, status: 404, error: "Mission not found" };
  }

  if (isCronMode) {
    // Recurring promote → a PatterStage `schedules` row (the scheduler fires it);
    // no legacy cron_jobs / jobs.json. Mirrors the dispatch cron branch.
    const parsed = parseSchedule(input.schedule!);
    if (parsed.kind === "invalid") {
      return { ok: false, status: 400, error: `Unrecognized schedule: ${input.schedule}` };
    }
    // Shape is not satisfiability -- see the note in src/app/api/schedules/route.ts.
    if (!scheduleCanEverFire(input.schedule!)) {
      return {
        ok: false,
        status: 400,
        error:
          `Schedule "${input.schedule}" can never fire: it names a date that does not ` +
          `exist, or a field outside its range. Check the day-of-month against the month.`,
      };
    }
    try {
      const current = getMission(input.missionId)!;
      const next = computeNextRun(input.schedule!, new Date());
      const schedule = createSchedule({
        missionId: input.missionId,
        name: current.name,
        schedule: input.schedule!,
        scheduleDisplay: scheduleDisplayFromParsed(parsed, input.schedule!),
        enabled: true,
        profileName: input.profileName ?? current.profileName ?? null,
        nextRunAt: next ? next.toISOString() : null,
      });

      // Best-effort first run, linked to the schedule.
      try {
        await dispatchMissionNow(input.missionId, {
          profileName: input.profileName,
          modelId: input.modelId,
          provider: input.provider,
          scheduleId: schedule.id,
        });
      } catch (err) {
        logApiError("promoteMission", "schedule first-run", err);
      }
    } catch (err) {
      logApiError("promoteMission", "schedule promote", err);
      updateMission(input.missionId, { status: "failed" });
      return { ok: false, status: 500, error: "Failed to schedule mission" };
    }

    return { ok: true, mission: enrichedMission(input.missionId)! };
  }

  if (isNowMode) {
    const result = await dispatchMissionNow(input.missionId, {
      profileName: input.profileName,
      modelId: input.modelId,
      provider: input.provider,
    });
    if (!result.ok) {
      return {
        ok: false,
        status: 500,
        error: "Failed to dispatch mission",
        mission: enrichedMission(input.missionId)!,
      };
    }
    return { ok: true, mission: enrichedMission(input.missionId)! };
  }

  if (isQueueMode) {
    void runMissionQueueTick();
  }

  return { ok: true, mission: enrichedMission(input.missionId)! };
}
