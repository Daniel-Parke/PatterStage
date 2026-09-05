// ═══════════════════════════════════════════════════════════════
// runMutation — Consolidate the "mutation handler" boilerplate
// ═══════════════════════════════════════════════════════════════
//
// The Hindsight memory browser (5 handlers in HindsightBrowser.tsx),
// the dashboard's "Sync now" + "Cancel mission" buttons, and other
// pages all follow the exact same shape:
//
//   1. Optional pre-flight guard (e.g. required-field check)
//   2. setBusy(true)
//   3. try { build() → safeApiCall → on success: toast + onSuccess }
//      catch { toast error }
//      finally { setBusy(false) }
//
// The handlers used to be 17-line near-clones; the variable parts were
// just the validation predicate, the request body, the busy setter,
// the success/error message strings, and the post-success work.
//
// `runMutation` collapses the boilerplate into one helper. Each call
// site reads as a flat data object (validation, busy, request body,
// success/error messages, post-success work), with no control-flow
// noise. The `try/catch/finally` lives in one place, so the
// `setBusy(false)` always runs — session-35 + session-57 found 2 prior
// instances of "forgot the finally" bugs that this shape prevents.
//
// `showToast` is injected rather than imported directly so the helper
// stays trivially testable: a 6-line mock of `{ showToast, busy }`
// is enough to assert the full happy + error path.
//
// History: this helper was first added in session 65 as
// `src/components/memory/hindsight/run-mutation.ts` and applied to
// the 5 Hindsight mutation handlers. Session 66 lifted it to
// `src/lib/` so the dashboard's 2 POST handlers (handleSyncNow +
// handleCancelMission.doCancel) can adopt the same shape.
//
// Scope note: the helper defaults to POST. PUT was added in session
// 66 (1 callsite: the dashboard's cron schedule update). The Rule
// of Three threshold (2 POST + 1 PUT = 3 sites) justifies the verb
// parameter. If a future call site needs a 4th verb, consider
// promoting to a generic `runAction({ verb, ... })` shape.

import type { Dispatch, SetStateAction } from "react";

import { safeApiCall, type SafeApiCallResult } from "@/lib/api-fetch";

export type BusySetter = Dispatch<SetStateAction<boolean>>;

export interface RunMutationOptions<TBody extends Record<string, unknown>> {
  /**
   * Pre-flight guard. Return `false` to abort without firing the
   * request (e.g. a form-field validation). The default always
   * passes; pass `() => !x.name.trim()` to enforce a required field.
   */
  isValid?: () => boolean;
  /**
   * React state setter to flip busy → true on entry, false on exit
   * (in finally). Optional — handlers that don't expose a busy
   * indicator (e.g. the Hindsight browser's `handleToggleDirective`
   * which is a single-row icon button with no spinner) can omit
   * it. The default is a no-op that satisfies the existing
   * `Dispatch<SetStateAction<boolean>>` contract.
   */
  busy?: BusySetter;
  /** Build the request body. Runs after the guard, before the call. */
  build: () => TBody;
  /**
   * The path to POST/PUT/PATCH/DELETE to. The verb defaults to POST —
   * pass `method: "PUT"` etc. for the rare non-POST mutation.
   * The pre-existing handlers are all mutation-via-POST (create /
   * update / refresh); the dashboard's cron schedule update uses PUT.
   */
  path: string;
  /** HTTP method. Defaults to "POST". */
  method?: "POST" | "PUT" | "PATCH" | "DELETE";
  /** Toast message shown on a successful response. */
  successMsg: string;
  /**
   * Fallback toast message shown when the server returns `ok: false`
   * with no `error` field, or when the request throws. The server's
   * own `error` field, when present, takes precedence.
   */
  errorMsg: string;
  /**
   * Post-success work. Runs after the success toast. Typical bodies:
   *   - reset the form state
   *   - close the modal
   *   - reload the list
   * The reload can be `async`; the helper awaits it.
   */
  onSuccess?: () => void | Promise<void>;
  /**
   * Callback for successful responses. Receives the parsed
   * `safeApiCall` envelope so callers can read fields beyond
   * `ok`/`error` (e.g. update the local cache). Default is no-op.
   */
  onSuccessResult?: (result: SafeApiCallResult<Record<string, unknown>>) => void;
}

/**
 * Run a mutation: validate, mark busy, fire the request, toast, reset.
 * Always clears `busy` in a `finally` block so a throw or an early
 * `return` cannot leave the button stuck in a loading state.
 *
 * Returns `true` if the mutation succeeded, `false` otherwise (guard
 * failed, `!ok`, or thrown). Callers can use the return to chain
 * additional UI updates (e.g. focus a field on failure).
 */
export async function runMutation<TBody extends Record<string, unknown>>(
  showToast: (msg: string, kind: "success" | "error" | "info") => void,
  opts: RunMutationOptions<TBody>,
): Promise<boolean> {
  // `busy` is optional — handlers that don't expose a loading indicator
  // (e.g. single-row icon buttons) omit it. Resolve to a no-op so the
  // try/finally below doesn't need to repeat the optional-chain.
  const setBusy: BusySetter = opts.busy ?? (() => undefined);
  if (opts.isValid && !opts.isValid()) return false;
  setBusy(true);
  try {
    const body = opts.build();
    const result = await safeApiCall<Record<string, unknown>>(opts.path, {
      method: opts.method ?? "POST",
      body,
    });
    if (!result.ok) {
      showToast(result.error ?? opts.errorMsg, "error");
      return false;
    }
    showToast(opts.successMsg, "success");
    opts.onSuccessResult?.(result);
    if (opts.onSuccess) await opts.onSuccess();
    return true;
  } catch {
    showToast(opts.errorMsg, "error");
    return false;
  } finally {
    setBusy(false);
  }
}
