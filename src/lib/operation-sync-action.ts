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
// This helper centralises the pattern. It takes the busy-state
// setter, the toast, the URL, the body, the success/error messages,
// an optional reload callback, and an optional `checkSuccess` flag
// for endpoints that return `{data: {success: false, ...}}` on
// logical failure (the sync/* routes do this; the toggle routes
// throw on error instead and rely on the catch path).
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

import { apiFetch } from "@/lib/api-fetch";

export interface RunSyncActionOptions {
  /** Setter for the page's busy/syncing state. Called with true on
   *  start, false in finally. */
  setBusy: (busy: boolean) => void;
  /** Toast helper from useToast(). */
  showToast: (message: string, variant: "success" | "error") => void;
  /** POST endpoint. */
  url: string;
  /** JSON body to send. */
  body: Record<string, unknown>;
  /** Toast message on success. */
  successMessage: string;
  /** Toast message on caught exceptions or logical-failure responses. */
  errorMessage: string;
  /** Optional reload callback, awaited before clearing the busy
   *  state so a "Pulling..." spinner doesn't disappear before the
   *  re-fetched data is on screen. */
  onSuccess?: () => Promise<void> | void;
  /** When true (default), check `data.data?.success === false` and
   *  show the error toast without throwing. Set false for endpoints
   *  that throw on error (rely on the catch path). */
  checkSuccess?: boolean;
}

export async function runSyncAction({
  setBusy,
  showToast,
  url,
  body,
  successMessage,
  errorMessage,
  onSuccess,
  checkSuccess = true,
}: RunSyncActionOptions): Promise<void> {
  setBusy(true);
  try {
    const data = await apiFetch(url, { method: "POST", body: JSON.stringify(body) });
    if (
      checkSuccess &&
      data &&
      typeof data === "object" &&
      "data" in data &&
      data.data &&
      typeof data.data === "object" &&
      "success" in data.data &&
      (data.data as { success: unknown }).success === false
    ) {
      const errMsg =
        "error" in data.data &&
        typeof (data.data as { error?: unknown }).error === "string"
          ? (data.data as { error: string }).error
          : errorMessage;
      showToast(errMsg, "error");
      return;
    }
    showToast(successMessage, "success");
    if (onSuccess) await onSuccess();
  } catch (e) {
    showToast(e instanceof Error ? e.message : errorMessage, "error");
  } finally {
    setBusy(false);
  }
}
