// ═══════════════════════════════════════════════════════════════
// composer/cancel.ts — the one way a cancelled Composer run is written down
//
// WHY THIS EXISTS. Until T-0076 a Composer run could not be stopped at all:
// there was no endpoint, no control, and no exit from a paused run except
// approving or rejecting the gate it was parked at. A workflow with a live run
// then refused to be edited or deleted, with a message telling the operator to
// "let them finish or cancel them first" — naming an affordance that did not
// exist. Missions, chat and research all had a working cancel; Composer was the
// gap.
//
// THE ORDER MATTERS, and the run row goes first. Once the run is terminal,
// `advanceComposerRun` returns at its first guard and `nudgeParentRun` becomes a
// no-op, so nothing can restart or advance the thing being stopped while the
// rest of the writes land.
//
// THE SEAM THAT MAKES IT SAFE is the agent `runs` row. `listActiveRuns` selects
// `WHERE status='started'`, so writing `cancelled` there takes the row out of
// the reconciler's set entirely: it stops polling, and it can never come back
// with a late verdict that overwrites the decision. (The race that remains —
// reconcile having already snapshotted the set and being mid-await — is closed
// by the terminal guard in `finalizeComposerNodeRun`.)
//
// LOCAL RECORD FIRST, REMOTE STOP AFTER, which is the doctrine T-0070 settled
// for missions: the operator's record is written the same way whether or not
// the gateway answers. A gateway that is down is one of the likeliest reasons
// to be cancelling in the first place, so making the local truth depend on it
// would fail exactly when it is needed.
// ═══════════════════════════════════════════════════════════════

import { inTransaction, now } from "@/lib/db";
import { logApiError } from "@/lib/api-logger";
import { getRun, updateRun } from "@/lib/runs-repository";
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
 *
 * Module-private for the same reason `cancel-finalise.ts` keeps its own: it is
 * this writer's constant, not shared vocabulary. The tests assert the literal a
 * reader would actually see, so an accidental edit shows up as a failing
 * expectation rather than as two sides of a rename agreeing with each other.
 */
const CANCELLED_BY_USER = "Cancelled by user";

/** A backend run to ask the gateway to stop, once the local record is safe. */
export interface BackendStop {
  backendRunId: string;
  profileName: string | null;
}

/**
 * Record a cancellation across a Composer run, its in-flight stages, their
 * agent runs, and any sub-workflow it started.
 *
 * Returns the backend runs the caller should ask the gateway to stop. Doing
 * that here would make the local write depend on a network call; see the header.
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

      // 2. The stage. One status for both pending and running: a stage stopped
      //    before it started is still a deliberate stop, and a second word for
      //    it would buy nothing a reader wants.
      updateNodeRun(nodeRun.id, {
        status: "cancelled",
        error: CANCELLED_BY_USER,
        completedAt: now(),
      });

      // 3. The agent run behind it. Only one still in flight — a run that had
      //    already finished keeps its real ending, exactly as the mission
      //    writer does. This is also the seam: it leaves listActiveRuns.
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
 * Ask the gateway to stop the backend runs a cancellation orphaned.
 *
 * Best-effort and deliberately un-awaited by the route: the local record is
 * already written, and a gateway that cannot be reached must not turn a
 * successful cancellation into an error the operator has to interpret.
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
