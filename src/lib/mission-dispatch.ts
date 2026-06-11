// ═══════════════════════════════════════════════════════════════
// mission-dispatch.ts — Shared immediate mission dispatch (API + queue sync)
// ═══════════════════════════════════════════════════════════════

import { getMission, updateMission } from "@/lib/mission-repository";
import { createSession, updateSession } from "@/lib/session-repository";
import { agentBackend } from "@/lib/backends";
import { logApiError } from "@/lib/api-logger";

export interface DispatchMissionNowOverrides {
  profileName?: string;
  modelId?: string;
  provider?: string;
}

export interface DispatchMissionNowResult {
  ok: boolean;
  sessionId?: string;
}

async function pollForSessionId(missionId: string): Promise<string | undefined> {
  for (let attempt = 0; attempt < 10; attempt++) {
    await new Promise((r) => setTimeout(r, 800));
    try {
      const sid = await agentBackend.getMissionSessionId?.(missionId);
      if (sid) return sid;
    } catch {
      /* keep polling */
    }
  }
  return undefined;
}

/**
 * Transition a mission to dispatched and spawn the Hermes backend process.
 *
 * Order of operations (matters for crash recovery):
 *   1. Call `agentBackend.dispatchMission` — writes the on-disk
 *      mission.json artifact.
 *   2. Create the sessions row.
 *   3. Update the DB mission to status="dispatched".
 *   4. Call `agentBackend.spawnDispatchedMission` — actually
 *      forks the bash script that runs `hermes chat`.
 *
 * If the next-server crashes between steps 1 and 3, the
 * on-disk mission.json exists with no matching DB row, which
 * MissionSync's disk-only orphan sweep handles on the next
 * tick (it writes a synthetic failed status). If the server
 * crashes between steps 3 and 4, the DB says "dispatched" but
 * no bash process is running — MissionSync's orphan detection
 * + the EXIT-trap helper file take over.
 */
export async function dispatchMissionNow(
  missionId: string,
  overrides: DispatchMissionNowOverrides = {},
): Promise<DispatchMissionNowResult> {
  const mission = getMission(missionId);
  if (!mission) {
    return { ok: false };
  }

  const profileName = overrides.profileName ?? mission.profileName;
  const modelId = overrides.modelId ?? mission.modelId;
  const provider = overrides.provider ?? mission.provider;

  // Step 1: write the on-disk mission.json BEFORE touching the
  // DB. This is the inverse of the original (buggy) order.
  let dispatched: Awaited<ReturnType<typeof agentBackend.dispatchMission>>;
  try {
    dispatched = await agentBackend.dispatchMission({
      missionId,
      name: mission.name,
      prompt: mission.prompt,
      profileId: mission.profileId,
      profileName,
      modelId,
      provider,
    });
  } catch (err) {
    logApiError("dispatchMissionNow", "dispatch", err);
    return { ok: false };
  }

  // Step 2: create the sessions row (pre-registered for the
  // session page). This is idempotent enough that a crash here
  // leaves the row "active" until MissionSync reconciles.
  let sessionIdFromDb: string | undefined;
  try {
    const session = createSession({
      source: "mission",
      missionId,
      profileName: profileName ?? null,
      modelId: modelId ?? null,
      provider: provider ?? null,
      title: mission.name,
      status: "active",
    });
    sessionIdFromDb = session.id;
  } catch (err) {
    logApiError("dispatchMissionNow", "createSession", err);
  }

  // Step 3: update the DB row to "dispatched". From this point
  // forward, the mission is visible to the dashboard as active.
  updateMission(missionId, { status: "dispatched", queuedForRun: false });

  // Step 4: actually spawn the bash script. If this fails, we
  // mark the mission as failed in the DB and close the session.
  try {
    await agentBackend.spawnDispatchedMission(missionId);
  } catch (err) {
    logApiError("dispatchMissionNow", "spawnDispatchedMission", err);
    if (sessionIdFromDb) {
      updateSession(sessionIdFromDb, {
        status: "failed",
        endedAt: new Date().toISOString(),
      });
    }
    updateMission(missionId, { status: "failed", queuedForRun: false });
    return { ok: false };
  }

  let sessionId: string | undefined = dispatched.sessionId ?? sessionIdFromDb;
  if (!sessionId && sessionIdFromDb) {
    sessionId = sessionIdFromDb;
  } else if (!sessionId) {
    sessionId = await pollForSessionId(missionId);
  }

  updateMission(missionId, {
    sessionId,
    status: "dispatched",
    queuedForRun: false,
  });

  return { ok: true, sessionId };
}
