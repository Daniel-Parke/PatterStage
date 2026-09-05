// ═══════════════════════════════════════════════════════════════
// sync-answer.ts: how a sync endpoint answers, said once
//
// T-0082 gave the profile PUSH route two helpers. A single target that
// failed is a 500 whose message names the target and the reason, because
// apiFetch throws on a 500 and every caller's catch already shows the
// message. A batch with failures is a 200 whose `data.success` is false
// and whose `data.error` names each failure, because one profile out of
// twelve failing is a real outcome and not a server error, and collapsing
// it would throw away the eleven that worked.
//
// The pull route, the import route and the models push route never got
// the helpers. They answered 200 with `success: false` buried where no
// client reads, so a pull that could not read the disk toasted "Pulled
// from Hermes" (T-0095, D125, D19). Now they share these.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";

import { ok, serverError } from "@/lib/api-response";

/** The three facts every sync outcome carries, whatever else it carries. */
export interface SyncOutcome {
  success: boolean;
  slug: string;
  error: string | null;
}

/**
 * One target, answered with the outcome it had.
 *
 * `verb` is the sentence's subject in the operator's words ("Push to Hermes",
 * "Pull from Hermes", "Import from Hermes"). The slug goes in the message
 * because the 500 body is only `{ error }`: there is nowhere else for a client
 * to read which target failed.
 */
export function answerSingle<R extends SyncOutcome>(
  verb: string,
  result: R,
  extra: Record<string, unknown> = {},
): NextResponse {
  if (result.success) return ok({ success: true, result, ...extra });
  return serverError(`${verb} failed for ${result.slug}: ${result.error || "unknown error"}`);
}

/**
 * A batch, answered as a batch. Never converged onto a 500: the failures are
 * named at `data.error`, which is where runSyncAction reads, and everything
 * that worked still travels in `extra`.
 *
 * `noun` is the operation as a countable word ("push", "pull", "import").
 */
export function answerBatch<R extends SyncOutcome>(
  noun: string,
  results: R[],
  extra: Record<string, unknown> = {},
): NextResponse {
  const failures = results.filter((r) => !r.success);
  if (failures.length === 0) return ok({ success: true, ...extra });
  const plural = failures.length === 1 ? "" : "s";
  return ok({
    success: false,
    error: `${failures.length} ${noun}${plural} did not complete: ${failures
      .map((f) => `${f.slug} (${f.error || "unknown"})`)
      .join("; ")}`,
    ...extra,
  });
}
