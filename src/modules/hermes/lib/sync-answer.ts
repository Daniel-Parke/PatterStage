// sync-answer.ts: how a sync endpoint answers, said once.
//
// T-0082 gave the profile PUSH route two helpers: a single failed target is a
// 500 naming target and reason, because apiFetch throws on a 500 and every
// caller's catch shows the message; a batch with failures is a 200 with
// `data.success` false and `data.error` naming each, because one profile of
// twelve failing is an outcome, not a server error. The pull, import and
// models-push routes answered 200 with `success: false` where no client reads,
// so a pull that could not read the disk toasted "Pulled from Hermes"
// (T-0095, D125, D19). Now they share these.

import { NextResponse } from "next/server";

import { ok, serverError } from "@/lib/api/api-response";

/** The three facts every sync outcome carries, whatever else it carries. */
export interface SyncOutcome {
  success: boolean;
  slug: string;
  error: string | null;
}

/**
 * One target. `verb` is the subject in the operator's words ("Push to Hermes");
 * the slug goes in the message because the 500 body is only `{ error }`.
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
 * A batch, never converged onto a 500: failures are named at `data.error`, where
 * runSyncAction reads. `noun` is the operation as a countable word ("push").
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
