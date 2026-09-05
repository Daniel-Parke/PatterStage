// ═══════════════════════════════════════════════════════════════
// operation-sync-action.ts — "POST and reload" client-side helper
// ═══════════════════════════════════════════════════════════════
//
// Operations pages (Agents, Skills, Tools) each have several
// "click a button, POST to /api/agent/profiles/sync/*, show a toast,
// reload the local data" actions. The boilerplate — setBusy → try
// POST → if response says success:false show error toast → show
// success toast → reload → catch show error toast → finally
// setBusy(false) — was repeated 5+ times in operations/agents
// (doSync), once in operations/skills (importSkillsFromHermes), and
// twice in operations/tools (pullFromHermes / pushToHermes).
//
// Session 55 extended the helper to accept an explicit HTTP `method`
// (default POST) so non-POST flows in operations/agents (handleCreate
// POST, handleDelete DELETE) and operations/tools (saveToolsets PUT)
// can adopt the same pattern. The pre-existing callers are
// unaffected — `method` defaults to "POST" for backward compatibility.
//
// This helper centralises the pattern. It takes the busy-state
// setter, the toast, the URL, the method, the body, the
// success/error messages, an optional reload callback, and an
// optional `checkSuccess` flag for endpoints that return
// `{data: {success: false, ...}}` on logical failure (the sync/*
// routes do this; the toggle routes throw on error instead and rely
// on the catch path).
//
// Usage:
//   const doSync = useCallback(
//     (url, body, successMessage, errorMessage, onSuccess?) =>
//       runSyncAction({
//         setBusy: setSyncBusy,
//         showToast,
//         url,
//         body,
//         successMessage,
//         errorMessage,
//         onSuccess,
//       }),
//     [showToast],
//   );
//
//   // Non-POST (e.g. agents page handleCreate / handleDelete):
//   runSyncAction({
//     setBusy: setCreating,
//     showToast,
//     url: "/api/agent/profiles",
//     method: "POST",
//     body: { name, description, cloneFrom },
//     successMessage: `Profile "${name}" created`,
//     errorMessage: "Failed to create profile",
//     onSuccess: () => { setShowCreate(false); resetForm(); return loadProfiles(); },
//   });

import { apiFetch, toastError } from "@/lib/api-fetch";

/**
 * Type-guard for the `data.data?.success === false` envelope
 * produced by the /api/agent/profiles/sync/* endpoints.
 *
 * The pre-helper form was a 6-clause chained type guard inside
 * `runSyncAction`:
 *
 *   if (
 *     checkSuccess &&
 *     data && typeof data === "object" && "data" in data &&
 *     data.data && typeof data.data === "object" &&
 *     "success" in data.data &&
 *     (data.data as { success: unknown }).success === false
 *   ) { ... }
 *
 * The chain is the **only** place the codebase pattern-matches on
 * `{ data: { success: false, error?: string } }` (verified via
 * `rg '\.data\?\.success'` — single match in this file), so the
 * helper is local to `operation-sync-action.ts` rather than
 * `api-fetch.ts`. Promoting it to a named type-guard does three
 * things:
 *
 *  1. **Readability** — the runSyncAction call site becomes
 *     `if (isApiSuccessFalse(data)) { ... }` instead of a 6-clause
 *     chain. The intent ("the sync endpoint says the operation
 *     failed") is now a single line.
 *  2. **Testability in isolation** — the helper's predicate is
 *     testable without spinning up a `runSyncAction` call. The
 *     `tests/unit/operation-sync-action-is-api-success-false.test.ts`
 *     suite pins every shape: success:false with string error,
 *     success:false with non-string error, success:false with no
 *     error key, success:true (negative), missing data field,
 *     non-object data, null data, undefined data.
 *  3. **TypeScript narrowing** — once the guard returns true, the
 *     `error` property is typed `string | undefined` (rather than
 *     `unknown`), so the `errMsg` extraction below no longer needs
 *     the `typeof (data.data as { error?: unknown }).error === "string"`
 *     inner check. The shape is also enumerable, so future
 *     `error` variants (e.g. `cronPushError` already plumbed
 *     through api-fetch) can extend the type without rippling
 *     through `runSyncAction`.
 *
 * Byte-equivalence: the helper covers exactly the same input
 * shapes as the inlined 6-clause chain. The `data && typeof data
 * === "object"` clause is preserved as `data !== null && typeof
 * data === "object"` (the original `data &&` short-circuit was
 * true for any truthy `data`; null is the only non-object truthy
 * hit in practice, so the explicit `!== null` is byte-equivalent
 * and slightly more defensive against future `data === 0` /
 * `data === ""` cases the type system already excludes via the
 * `T` generic).
 */
export function isApiSuccessFalse(
  response: unknown,
): response is { data: { success: false; error?: unknown } } {
  return (
    response !== null &&
    typeof response === "object" &&
    "data" in response &&
    (response as { data: unknown }).data !== null &&
    typeof (response as { data: unknown }).data === "object" &&
    "success" in (response as { data: Record<string, unknown> }).data &&
    (response as { data: { success: unknown } }).data.success === false
  );
}

export interface RunSyncActionOptions {
  /** Optional setter for the page's busy/syncing state. Called with
   *  true on start, false in finally. Omit when the action is
   *  sub-100ms and no spinner is desired (e.g. operations/
   *  personalities' handleActivate — switching the active personality
   *  is a single PUT that returns in tens of milliseconds; showing
   *  a spinner would be UI noise). The default is a no-op. */
  setBusy?: (busy: boolean) => void;
  /** Toast helper from useToast(). The `variant` arg matches
   *  `toastError`'s `ShowToastFn` signature (optional "success" |
   *  "error" | "info") so the helper is callable directly. */
  showToast: (message: string, variant?: "success" | "error" | "info") => void;
  /** POST endpoint. */
  url: string;
  /** HTTP method. Defaults to "POST" for backward compat with the
   *  original sync/* callers. Use "PUT" for upserts, "DELETE" for
   *  removals, etc. */
  method?: "POST" | "PUT" | "PATCH" | "DELETE";
  /** JSON body to send. Always stringified — pass `{}` for callers
   *  that don't need a body (e.g. many DELETE handlers). */
  body: Record<string, unknown>;
  /** Toast message on success. */
  successMessage: string;
  /** Toast message on caught exceptions or logical-failure responses. */
  errorMessage: string;
  /** Optional reload callback, awaited before clearing the busy
   *  state so a "Pulling..." spinner doesn't disappear before the
   *  re-fetched data is on screen. */
  onSuccess?: () => Promise<void> | void;
  /** When true (default), check the response shape for
   *  `data.data?.success === false` (via the `isApiSuccessFalse`
   *  type-guard helper) and show the error toast without throwing.
   *  Set false for endpoints that throw on error (rely on the catch
   *  path). */
  checkSuccess?: boolean;
  /**
   * Deadline for this call, in ms. Omit for the interactive default.
   *
   * Bulk actions — "Push all", "Pull all", catalogue sync and import — pass
   * `API_FETCH_BULK_TIMEOUT_MS`, because their work scales with the size of the
   * install rather than with the request, and the interactive ceiling aborted
   * large ones mid-flight and called it a timeout (T-0047).
   */
  timeoutMs?: number;
}

export async function runSyncAction({
  setBusy = () => undefined,
  showToast,
  url,
  method = "POST",
  body,
  successMessage,
  errorMessage,
  onSuccess,
  checkSuccess = true,
  timeoutMs,
}: RunSyncActionOptions): Promise<void> {
  setBusy(true);
  try {
    const data = await apiFetch(url, { method, body: JSON.stringify(body), timeoutMs });
    if (checkSuccess && isApiSuccessFalse(data)) {
      const errMsg =
        typeof data.data.error === "string" ? data.data.error : errorMessage;
      showToast(errMsg, "error");
      // Reload anyway. A batch that partly failed is a real outcome: eleven
      // profiles pushed and one did not. Returning before the reload left the
      // page showing the pre-push state for all twelve, so the operator could
      // not see which eleven had moved (T-0095, D20). The toast names the
      // failure; the reload shows the truth.
      if (onSuccess) await onSuccess();
      return;
    }
    showToast(successMessage, "success");
    if (onSuccess) await onSuccess();
  } catch (e) {
    toastError(showToast, e, errorMessage);
  } finally {
    setBusy(false);
  }
}
