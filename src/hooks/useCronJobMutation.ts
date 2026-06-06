// ═══════════════════════════════════════════════════════════════
// useCronJobMutation — Shared toggle/delete/pauseAll handlers
// ═══════════════════════════════════════════════════════════════
//
// useCronJobs and useSystemCronJobs each have their own (id: string) =>
// Promise<void> handlers for toggle / delete / pauseAll. The bodies are
// 90% identical: a safeApiCall, a toast, a loadJobs() refetch. They differ
// in three places:
//   - the endpoint path
//   - the PUT body shape (action-vs-enabled)
//   - the toast text (especially for toggle and pauseAll)
//
// This hook absorbs the duplicated body and lets each caller pass a small
// config object describing the per-hook differences.
//
// Byte-equivalence audit (per session-51):
//   - `handleToggle` always calls `refetch()` after the toast, regardless
//     of ok/error outcome. The useSystemCronJobs pre-refactor version only
//     called loadJobs() inside the `if (ok)` branch — that was a silent
//     bug (UI would not refresh on failure). New behaviour matches the
//     useCronJobs pre-refactor contract.
//   - `handlePauseAll` always calls `refetch()` in the finally block, also
//     matching the agent pre-refactor contract (and the system pre-refactor
//     contract which also did `loadJobs()` after the toast in both
//     branches).
//   - pauseAllBusy state is owned by this hook; useCronJobs exposes it
//     through the public return value, useSystemCronJobs omits it (the
//     page only reads `agent.pauseAllBusy`).

import { useCallback, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { safeApiCall } from "@/lib/api-fetch";
import { toastFromResult } from "@/lib/toast-from-result";

export interface CronJobLike {
  id: string;
  enabled: boolean;
}

export interface PauseAllConfig {
  /** Success toast text. May use a `{count}` placeholder to interpolate the API's `pausedCount`. */
  success: string;
  /** Fallback error text shown when the API response has no `error` field. */
  errorFallback: string;
  /** Optional: interpolate `{count}` with the response's `pausedCount` field. */
  showCount?: boolean;
}

export interface CronJobMutationConfig<TJob extends CronJobLike> {
  /** API endpoint, e.g. `"/api/cron"` or `"/api/cron/hardware"`. */
  endpoint: string;
  /** Fetch the current job record for a given id (for toggle semantic). */
  findJob: (id: string) => TJob | undefined;
  /** Build the PUT body when toggling. Receives the new desired enabled. */
  buildToggleBody: (
    job: TJob,
    nextEnabled: boolean,
  ) => Record<string, unknown>;
  /** Return the success message for a toggle, given the new enabled. */
  toggleSuccess: (nextEnabled: boolean) => string;
  /** Fallback error message for toggle when API returns no error string. */
  toggleErrorFallback: (nextEnabled: boolean) => string;
  /** Success message for delete. */
  deleteSuccess: string;
  /** Fallback error message for delete. */
  deleteErrorFallback: string;
  /** Pause-all toast configuration. */
  pauseAll: PauseAllConfig;
  /** Refetch callback (e.g. `loadJobs` from `useApiData`). */
  refetch: () => void;
}

export interface CronJobMutationResult {
  handleToggle: (id: string) => Promise<void>;
  handleDelete: (id: string) => Promise<void>;
  handlePauseAll: () => Promise<void>;
  /** True while a pauseAll request is in flight. */
  pauseAllBusy: boolean;
}

export function useCronJobMutation<TJob extends CronJobLike>(
  config: CronJobMutationConfig<TJob>,
): CronJobMutationResult {
  const { showToast } = useToast();
  const [pauseAllBusy, setPauseAllBusy] = useState(false);
  const pauseAllActiveRef = useRef(false);

  const handleToggle = useCallback(
    async (id: string) => {
      const job = config.findJob(id);
      if (!job) return;
      const nextEnabled = !job.enabled;
      const result = await safeApiCall(config.endpoint, {
        method: "PUT",
        body: { id, ...config.buildToggleBody(job, nextEnabled) },
      });
      toastFromResult(
        showToast,
        result,
        config.toggleSuccess(nextEnabled),
        config.toggleErrorFallback(nextEnabled),
      );
      config.refetch();
    },
    [config, showToast],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      const result = await safeApiCall(`${config.endpoint}?id=${id}`, {
        method: "DELETE",
      });
      toastFromResult(
        showToast,
        result,
        config.deleteSuccess,
        config.deleteErrorFallback,
      );
      config.refetch();
    },
    [config, showToast],
  );

  const handlePauseAll = useCallback(async (): Promise<void> => {
    if (pauseAllActiveRef.current) return;
    pauseAllActiveRef.current = true;
    setPauseAllBusy(true);
    try {
      // The endpoint returns `{ data: { pausedCount: number } }`.
      // `safeApiCall<T>` does NOT unwrap — `data` is the full body —
      // so the type is the envelope shape and the inner count is read
      // via `result.data?.data?.pausedCount` (two indirections).
      const result = await safeApiCall<{ data?: { pausedCount?: number } }>(
        config.endpoint,
        { method: "POST", body: { action: "pauseAll" } },
      );
      if (result.ok) {
        const msg = config.pauseAll.showCount
          ? config.pauseAll.success.replace(
              "{count}",
              String(result.data?.data?.pausedCount ?? 0),
            )
          : config.pauseAll.success;
        showToast(msg);
      } else {
        toastFromResult(
          showToast,
          result,
          config.pauseAll.success,
          config.pauseAll.errorFallback,
        );
      }
    } finally {
      pauseAllActiveRef.current = false;
      setPauseAllBusy(false);
      config.refetch();
    }
  }, [config, showToast]);

  return {
    handleToggle,
    handleDelete,
    handlePauseAll,
    pauseAllBusy,
  };
}
