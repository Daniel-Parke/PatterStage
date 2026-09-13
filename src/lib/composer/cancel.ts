// ═══════════════════════════════════════════════════════════════
// composer/cancel.ts — the one way a cancelled Composer run is written down
//
// Until T-0076 a Composer run could not be stopped: no endpoint, no control, and
// a workflow with a live run refused to be edited with a message naming a
// cancel that did not exist. Missions, chat and research all had one.
//
// THE ORDER MATTERS, and the run row goes first: once it is terminal,
// `advanceComposerRun` returns at its first guard and `nudgeParentRun` is a
// no-op, so nothing restarts the thing being stopped while the rest lands.
//
// THE SEAM THAT MAKES IT SAFE is the agent `runs` row: `listActiveRuns` selects
// `WHERE status='started'`, so writing `cancelled` takes the row out of the
// reconciler's set and no late verdict can overwrite the decision. (The race
// that remains, reconcile mid-await on a snapshot, is closed by the terminal
// guard in `finalizeComposerNodeRun`.)
//
// LOCAL RECORD FIRST, REMOTE STOP AFTER, the doctrine T-0070 settled for
// missions: a gateway that is down is one of the likeliest reasons to be
// cancelling, so the local truth must not depend on it.
// ═══════════════════════════════════════════════════════════════

import { inTransaction, now } from "@/lib/db";
import { logApiError } from "@/lib/api/api-logger";
import { getRun, updateRun } from "@/lib/runs/runs-repository";
import {
  getComposerRun,
  getComposerRunByParentNodeRunId,
  getNode,
  listNodeRuns,
  updateComposerRun,
  updateNodeRun,
} from "./composer-repository";
import { isTerminalComposerRunStatus } from "./schema";

/**
 * The text every writer uses, so the three tables cannot tell three stories.
 * Module-private like `cancel-finalise.ts`'s own: the tests assert the literal
 * a reader sees, so an accidental edit fails an expectation rather than two
 * sides of a rename agreeing with each other.
 */
const CANCELLED_BY_USER = "Cancelled by user";

/** A backend run to ask the gateway to stop, once the local record is safe. */
export interface BackendStop {
  backendRunId: string;
  profileName: string | null;
}

/**
 * Record a cancellation across a Composer run, its in-flight stages, their
 * agent runs, and any sub-workflow it started. Returns the backend runs the
 * caller should ask the gateway to stop (doing it here would make the local
 * write depend on a network call; see the header).
 *
 * @returns null when the run does not exist or was already terminal.
 */
export function cancelComposerRun(composerRunId: string): BackendStop[] | null {
  const run = getComposerRun(composerRunId);
  if (!run || isTerminalComposerRunStatus(run.status)) return null;

  const stops: BackendStop[] = [];
  const seen = new Set<string>();

  const cancelOne = (id: string): void => {
    if (seen.has(id)) return; // a cycle is impossible by construction; cheap anyway
    seen.add(id);

    const current = getComposerRun(id);
    if (!current || isTerminalComposerRunStatus(current.status)) return;

    // 1. The run row first — every tick and nudge no-ops from here.
    updateComposerRun(id, {
      status: "cancelled",
      error: CANCELLED_BY_USER,
      completedAt: now(),
    });

    for (const nodeRun of listNodeRuns(id)) {
      if (nodeRun.status !== "running" && nodeRun.status !== "pending") continue;

      // 2. The stage. One status for pending and running: a stage stopped
      //    before it started is still a deliberate stop.
      updateNodeRun(nodeRun.id, {
        status: "cancelled",
        error: CANCELLED_BY_USER,
        completedAt: now(),
      });

      // 3. The agent run behind it, only if still in flight: a finished run
      //    keeps its real ending, as the mission writer does. This is the seam.
      if (nodeRun.runId) {
        const agentRun = getRun(nodeRun.runId);
        if (agentRun?.status === "started") {
          updateRun(agentRun.id, { status: "cancelled", error: CANCELLED_BY_USER });
          if (agentRun.runId) {
            stops.push({ backendRunId: agentRun.runId, profileName: agentRun.profileName ?? null });
          }
        }
      }

      // 4. A group stage started a whole sub-workflow. Left alone it keeps
      //    running, and keeps spending, against a parent that has ended.
      if (getNode(nodeRun.nodeId)?.kind === "group") {
        const child = getComposerRunByParentNodeRunId(nodeRun.id);
        if (child) cancelOne(child.id);
      }
    }
  };

  inTransaction(() => cancelOne(composerRunId));
  return stops;
}

/**
 * Ask the gateway to stop the backend runs a cancellation orphaned. Best-effort
 * and un-awaited by the route: the local record is written, and an unreachable
 * gateway must not turn a successful cancellation into an error.
 */
export async function stopBackendRuns(
  stops: BackendStop[],
  stopRun: (runId: string, profileName?: string) => Promise<unknown>,
): Promise<void> {
  await Promise.allSettled(
    stops.map(async (s) => {
      try {
        await stopRun(s.backendRunId, s.profileName ?? undefined);
      } catch (err) {
        logApiError("composer.cancel", `stopRun ${s.backendRunId}`, err);
      }
    }),
  );
}
