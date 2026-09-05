// ═══════════════════════════════════════════════════════════════
// hindsightMutate — safeApiCall + toastFromResult for /api/memory/hindsight
// ═══════════════════════════════════════════════════════════════
//
// The 4 inline mutation handlers in HindsightBrowser.tsx
// (handleToggleDirective, handleDeleteDirective, handleRefreshModel,
// handleDeleteModel) all follow the exact same 3-line shape:
//
//   const result = await safeApiCall("/api/memory/hindsight", { method, body });
//   toastFromResult(showToast, result, successMsg, errorMsg);
//   if (!result.ok) return;
//
// This helper composes the first 2 lines and returns the result so
// the caller can decide whether to early-return. The pre-form's
// throw-propagation semantics are preserved (no try/catch wrapper —
// the inline form never had one). The successMsg can be a string or
// a thunk, matching `toastFromResult`'s contract. Intentionally NOT
// using `runMutation` here because `runMutation` adds a try/catch
// wrapper that changes throw-propagation semantics on the
// (never-actually-thrown) edge case.
//
// The `Record<string, unknown>` type for the envelope payload matches
// the Hindsight route's contract — the route returns `{ data: T, error? }`
// for happy paths and `{ error: string }` for failures, but the 4
// caller sites don't read the data field, so `Record<string, unknown>`
// is the correct return-shape annotation.

import { safeApiCall, type SafeApiCallResult } from "@/lib/api-fetch";
import { toastFromResult } from "@/lib/dashboard/toast-from-result";

type ShowToast = (message: string, tone?: "success" | "error" | "info") => void;

/**
 * Issue a POST/PUT/PATCH/DELETE against `/api/memory/hindsight` and
 * toast the success/error outcome. Returns the raw `SafeApiCallResult`
 * so the caller can early-return on failure and run post-success
 * work (state updates, refreshes) on the ok branch.
 *
 * **Byte-equivalence:** the helper body is literally the 2-line
 * `safeApiCall + toastFromResult` composition, with no try/catch
 * wrapper (preserves the pre-form's throw-propagation semantics). The
 * `successMsg` thunk form is forwarded to `toastFromResult` unchanged,
 * so handlers that compute the success message lazily (e.g. toggle
 * handlers that pick "Activated" vs "Deactivated" based on a state
 * flag) preserve their existing semantics.
 *
 * @param showToast the `useToast()` return value
 * @param method HTTP verb (POST/PUT/PATCH/DELETE)
 * @param body JSON body for the request
 * @param successMsg shown when the response is ok; may be a string or
 *   a function returning a string (called lazily on the success path)
 * @param errorMsg shown when the response is not-ok and lacks a server
 *   error message
 * @returns the raw `safeApiCall` result envelope for the caller to
 *   inspect via `if (!result.ok) return;`
 */
export async function hindsightMutate<TBody extends Record<string, unknown>>(
  showToast: ShowToast,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  body: TBody,
  successMsg: string | (() => string),
  errorMsg: string,
): Promise<SafeApiCallResult<Record<string, unknown>>> {
  const result = await safeApiCall<Record<string, unknown>>(
    "/api/memory/hindsight",
    {
      method,
      body,
    },
  );
  toastFromResult(showToast, result, successMsg, errorMsg);
  return result;
}
