// ═══════════════════════════════════════════════════════════════
// api-write — the one way a screen writes to the API (T-0138)
// ═══════════════════════════════════════════════════════════════
//
// A write from a screen says six things around the call: mark busy, call,
// say what happened, reload, say why on a throw, clear busy. Four helpers
// used to say them (runSyncAction for the sync pages, runMutation for the
// dashboard and hindsight, hindsightMutate, runFallbackMutation) and the
// mission and model hooks said them by hand around toastFromResult. This
// is the one. A hook that owns query keys writes through react-query's
// useMutation and invalidates instead; that is the other sanctioned way,
// and design-lint's no-raw-write-outside-the-helper knows both.
//
//   await runWrite({
//     setBusy: setSaving,
//     showToast,
//     url: "/api/agent/profiles",
//     method: "POST",
//     body: { name, description },
//     successMessage: `Profile "${name}" created`,
//     errorMessage: "Failed to create profile",
//     onSuccess: loadProfiles,
//   });
//
// It resolves to the response on the success path and to nothing
// otherwise, so a caller that needs the answer reads it, and `onSuccess`
// is awaited before busy clears so a spinner outlives the reload.

import type { ToastType } from "@/components/ui/Toast";
import { apiFetch, messageFromError } from "@/lib/api/api-fetch";

type ShowToastFn = (message: string, type?: ToastType) => void;

/** What to say on success: the words, or the words with their own tone. */
type WriteToast = string | { message: string; type: ToastType };

export interface RunWriteOptions<T = unknown> {
  showToast: ShowToastFn;
  /** The endpoint; with `method` and `body` this is the request. */
  url?: string;
  /** Defaults to POST. */
  method?: "POST" | "PUT" | "PATCH" | "DELETE";
  /** Sent as JSON. Omit for a DELETE that carries none. */
  body?: unknown;
  /**
   * The request, when it is not one call: the bulk default-setter runs one
   * PUT per task type and says one thing about all of them. Replaces url,
   * method and body.
   */
  request?: () => Promise<T>;
  /** The success, as words or as a function of the response. */
  successMessage: WriteToast | ((data: T) => WriteToast);
  /** The failure, when the throw carries no words of its own. */
  errorMessage: string;
  /** Called with true before the call and false after, whatever happened. */
  setBusy?: (busy: boolean) => void;
  /** Awaited before busy clears, so a spinner stays until the reload is on screen. */
  onSuccess?: (data: T) => Promise<void> | void;
  /** On a throw, after the toast: put back what was changed ahead of the answer. */
  onError?: (err: unknown) => Promise<void> | void;
  /**
   * When true (the default), a 2xx whose envelope says `success: false` is
   * a failure: its reason is said with the error tone and the reload still
   * runs, because a batch that partly failed is a real outcome the screen
   * must show (T-0095, D20). Set false for a caller that reads the outcome
   * itself.
   */
  checkSuccess?: boolean;
  /**
   * Deadline in ms. Bulk actions pass API_FETCH_BULK_TIMEOUT_MS, because
   * their work scales with the install, not the request (T-0047).
   */
  timeoutMs?: number;
}

/** The `{ data: { success: false, error? } }` envelope the sync routes answer with. */
export function isApiSuccessFalse(
  response: unknown,
): response is { data: { success: false; error?: unknown; details?: unknown } } {
  const data = (response as { data?: unknown } | null)?.data;
  return (
    response !== null &&
    typeof response === "object" &&
    data !== null &&
    typeof data === "object" &&
    (data as { success?: unknown }).success === false
  );
}

/** The reason an envelope gives: `error`, or the first detail, or nothing. */
function envelopeReason(data: { error?: unknown; details?: unknown }): string | null {
  if (typeof data.error === "string" && data.error) return data.error;
  const first = Array.isArray(data.details) ? (data.details[0] as { detail?: unknown } | undefined) : undefined;
  return typeof first?.detail === "string" && first.detail ? first.detail : null;
}

export async function runWrite<T = unknown>({
  showToast,
  url,
  method = "POST",
  body,
  request,
  successMessage,
  errorMessage,
  setBusy = () => undefined,
  onSuccess,
  onError,
  checkSuccess = true,
  timeoutMs,
}: RunWriteOptions<T>): Promise<T | undefined> {
  setBusy(true);
  try {
    const data = request
      ? await request()
      : ((await apiFetch(url as string, {
          method,
          body: body === undefined ? undefined : JSON.stringify(body),
          timeoutMs,
        })) as T);
    if (checkSuccess && isApiSuccessFalse(data)) {
      showToast(envelopeReason(data.data) ?? errorMessage, "error");
      if (onSuccess) await onSuccess(data);
      return undefined;
    }
    const said = typeof successMessage === "function" ? successMessage(data) : successMessage;
    if (typeof said === "string") showToast(said, "success");
    else showToast(said.message, said.type);
    if (onSuccess) await onSuccess(data);
    return data;
  } catch (err) {
    showToast(messageFromError(err, errorMessage), "error");
    if (onError) await onError(err);
    return undefined;
  } finally {
    setBusy(false);
  }
}
