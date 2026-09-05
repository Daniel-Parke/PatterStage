// ═══════════════════════════════════════════════════════════════
// POST /api/composer/runs/[id]/cancel — stop a Composer run
//
// The affordance the workflow-delete guard has always promised ("let them
// finish or cancel them first") and the product never had. Mirrors
// POST /api/missions/[id]/cancel: the local record is written synchronously so
// the response carries the state the UI will paint, and the backend stop is
// fired afterwards without being awaited (T-0076).
// ═══════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";

import { requireNotReadOnly } from "@/lib/api-auth";
import { serverErrorFromCatch } from "@/lib/api-logger";
import { ok, badRequest, notFound, serviceUnavailable } from "@/lib/api-response";
import { appendAuditLine } from "@/lib/audit-log";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { ensureDb } from "@/lib/db";
import { runtime } from "@/lib/runtime";
import { cancelComposerRun, stopBackendRuns } from "@/lib/composer/cancel";
import { getComposerRun } from "@/lib/composer/composer-repository";
import type { ComposerRun } from "@/lib/composer/schema";

interface Ctx {
  params: Promise<{ id: string }>;
}

/**
 * Explain the state we are refusing from.
 *
 * Modelled on the approve route's `describeNotAwaiting`: the run's own stored
 * `error` is the sentence the operator needs, and answering a bare "not
 * cancellable" while holding it would repeat the defect T-0069 fixed.
 */
function describeNotCancellable(run: ComposerRun): string {
  const because = run.error ? ` ${run.error}` : "";
  if (run.status === "completed") {
    return "This run has already completed, so there is nothing left to cancel.";
  }
  if (run.status === "failed") {
    return `This run has already failed, so cancelling it now would not change how it ended.${because}`;
  }
  if (run.status === "rejected") {
    return `This run was already rejected, so there is nothing left to cancel.${because}`;
  }
  return `This run is ${run.status}, which cannot be cancelled.`;
}

export async function POST(_request: NextRequest, ctx: Ctx) {
  if (!isFeatureEnabled("composer")) {
    return serviceUnavailable("Composer is not enabled. Set PS_COMPOSER=1 to enable workflows.");
  }

  // Read-only mode. NOT authentication: src/proxy.ts authenticates every
  // request before a handler runs. Defence in depth on a write, mirroring
  // POST /api/missions/[id]/cancel (T-0034).
  const readOnly = requireNotReadOnly("composer runs cannot be cancelled");
  if (readOnly) return readOnly;

  const { id } = await ctx.params;
  try {
    ensureDb();
    const existing = getComposerRun(id);
    if (!existing) return notFound("Composer run not found");

    // Already cancelled is what the caller asked for. A second click — or a
    // double click — must not paint a failure for a satisfied intent.
    if (existing.status === "cancelled") return ok({ run: existing });

    const stops = cancelComposerRun(id);
    if (stops === null) return badRequest(describeNotCancellable(existing));

    appendAuditLine({ action: "composer.cancel", resource: id, ok: true });

    // Remote half, deliberately not awaited: the local record is already
    // written, and a gateway that cannot be reached must not turn a successful
    // cancellation into an error the operator has to interpret.
    void stopBackendRuns(stops, (runId, profileName) => runtime.stopRun(runId, profileName));

    return ok({ run: getComposerRun(id) });
  } catch (error) {
    return serverErrorFromCatch(
      "POST /api/composer/runs/[id]/cancel",
      `id=${id}`,
      error,
      "Failed to cancel run",
    );
  }
}
