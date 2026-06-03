// ═══════════════════════════════════════════════════════════════
// runMutation — consolidate the Hindsight mutation handler shape
// ═══════════════════════════════════════════════════════════════
//
// All five Hindsight mutation handlers in HindsightBrowser follow the
// exact same shape:
//
//   1. Validate inputs (the "guard" — usually a `!X.trim()` chain)
//   2. setBusy(true)
//   3. try { build() → safeApiCall → on success: toast + reset + reload }
//      catch { toast error }
//      finally { setBusy(false) }
//
// The handlers used to be 17-line near-clones; the variable parts were
// just the validation predicate, the request body, the busy setter,
// the success/error message strings, and the form-reset + reload
// actions.
//
// `runMutation` collapses the boilerplate into one helper. Each call
// site reads as a flat data object (validation, busy, request body,
// success/error messages, post-success work), with no control-flow
// noise. The `try/catch/finally` lives in one place, so the
// `setBusy(false)` always runs — session-35 + session-57 found 2 prior
// instances of "forgot the finally" bugs that this shape prevents.
//
// `showToast` is injected rather than imported directly so the helper
// stays trivially testable: a 6-line mock of `{ showToast, busyRef }`
// is enough to assert the full happy + error path.

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
  /** React state setter to flip busy → true on entry, false on exit (in finally). */
  busy: BusySetter;
  /** Build the request body. Runs after the guard, before the call. */
  build: () => TBody;
  /**
   * The path to POST to. Always POST — the existing handlers are all
   * mutation-via-POST (create / update / refresh). If a future
   * handler needs a different verb, add a `method` field here; don't
   * overload the helper to handle every verb (Rule of Three).
   */
  path: string;
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
 * Run a Hindsight mutation: validate, mark busy, POST, toast, reset.
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
  if (opts.isValid && !opts.isValid()) return false;
  opts.busy(true);
  try {
    const body = opts.build();
    const result = await safeApiCall<Record<string, unknown>>(opts.path, {
      method: "POST",
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
    opts.busy(false);
  }
}
