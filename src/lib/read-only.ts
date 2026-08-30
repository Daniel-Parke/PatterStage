// ═══════════════════════════════════════════════════════════════
// read-only.ts — one definition of read-only mode, and one sentence for it.
//
// There used to be two of each. `src/proxy.ts` had a private `isReadOnly()`
// built on `readEnv`, `src/lib/api-auth.ts` had another built on a local
// `firstEnvFlag`, and between them the tree carried FOUR different 503 wordings
// for the same refusal:
//
//   proxy.ts                     "(unset PS_READ_ONLY to allow writes)."
//   api-auth.ts                  "(set PS_READ_ONLY=true to allow writes)."
//   backfill-status/route.ts     "(set PS_READ_ONLY=false to allow …)"
//   cron/hardware, scripts/*     bare, with no remedy at all
//
// The second of those is not merely inconsistent, it is BACKWARDS: setting
// PS_READ_ONLY=true is what causes the refusal, so the hint told the operator to
// do the opposite of the fix. It survived because the proxy short-circuits
// first, which made it nearly unreachable and therefore invisible (T-0048).
//
// Two implementations of one sentence is how the two layers come to disagree.
// This module is that sentence, once.
// ═══════════════════════════════════════════════════════════════

import { readEnv } from "@/lib/paths";

/**
 * Whether this instance refuses writes.
 *
 * `CH_READ_ONLY` is the pre-rename alias and is load-bearing: an install that
 * has not migrated its `.env.local` still reads it.
 */
export function isReadOnly(): boolean {
  const value = readEnv("PS_READ_ONLY", "CH_READ_ONLY")?.toLowerCase();
  return value === "1" || value === "true";
}

/**
 * The refusal, in the operator's terms.
 *
 * `context` names the resource when a route can say something more useful than
 * "a write was refused". It never replaces the remedy, because the remedy is the
 * part the operator actually needs and the part the old wording got wrong.
 */
export function readOnlyMessage(context?: string): string {
  const remedy = "unset PS_READ_ONLY to allow writes";
  return context
    ? `PatterStage is in read-only mode: ${context} (${remedy}).`
    : `PatterStage is in read-only mode (${remedy}).`;
}
