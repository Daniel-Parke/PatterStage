// ═══════════════════════════════════════════════════════════════
// useSchedules — TanStack Query data layer for PatterStage-owned schedules
//
// Demonstrates the new client data layer: shared cache + dedup + invalidation
// over the existing safeApiCall fetcher (no ad-hoc fetch-in-useEffect). The
// query throws on error so the page can render <LoadErrorBanner/>.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiQueryKey, useApiResource } from "@/hooks/useApiResource";
import { safeApiCall } from "@/lib/api-fetch";
import type { ScheduleListItem, CatchUpPolicy } from "@/lib/schedules-repository";

export interface CreateScheduleBody {
  missionId: string;
  name?: string;
  schedule: string;
  catchUpPolicy?: CatchUpPolicy;
  repeatTimes?: number | null;
  profileName?: string | null;
}

// ScheduleListItem, not ScheduleRecord: the list read resolves the mission's
// name so a row can say what it fires (T-0114).

export function useSchedules() {
  const qc = useQueryClient();
  const query = useApiResource<ScheduleListItem[]>("/api/schedules", {
    select: (p) => (p as { schedules?: ScheduleListItem[] } | null)?.schedules,
    fallback: [],
    errorMessage: "Failed to load schedules",
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: apiQueryKey("/api/schedules") });

  // Every mutation throws on a failed call. Returning a failed safeApiCall
  // result as if it were a success put the failure somewhere a caller had to
  // remember to look, and three of the four callers did not: a delete, a pause
  // and a Run now could all fail in silence (T-0104, D73).
  const create = useMutation({
    mutationFn: async (body: CreateScheduleBody) => {
      const res = await safeApiCall("/api/schedules", { method: "POST", body });
      if (!res.ok) throw new Error(res.error ?? "Failed to create the schedule");
      return res;
    },
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const res = await safeApiCall(`/api/schedules/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(res.error ?? "Failed to delete the schedule");
      return res;
    },
    onSuccess: invalidate,
  });
  const toggle = useMutation({
    mutationFn: async (vars: { id: string; enabled: boolean }) => {
      const res = await safeApiCall(`/api/schedules/${vars.id}`, {
        method: "PATCH",
        body: { enabled: vars.enabled },
      });
      if (!res.ok) throw new Error(res.error ?? "Failed to update the schedule");
      return res;
    },
    onSuccess: invalidate,
  });
  const runNow = useMutation({
    mutationFn: async (id: string) => {
      const res = await safeApiCall<{ data?: { runId?: string } }>(`/api/schedules/${id}/run`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(res.error ?? "Failed to start the run");
      return res;
    },
  });

  return {
    schedules: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: () => query.refetch(),
    create,
    remove,
    toggle,
    runNow,
  };
}

export interface MissionOption {
  id: string;
  name: string;
}

/** Mission list for the schedule create form. Degrades gracefully (the page
 *  falls back to a manual id input when the agent's mission list is unavailable). */
export function useMissionOptions() {
  return useApiResource<MissionOption[]>("/api/missions?limit=500", {
    select: (p) =>
      ((p as { missions?: MissionOption[] } | null)?.missions ?? []).map((m) => ({ id: m.id, name: m.name })),
    errorMessage: "Failed to load missions",
  });
}
