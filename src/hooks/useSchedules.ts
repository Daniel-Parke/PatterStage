// ═══════════════════════════════════════════════════════════════
// useSchedules — TanStack Query data layer for PatterStage-owned schedules
//
// Demonstrates the new client data layer: shared cache + dedup + invalidation
// over the existing safeApiCall fetcher (no ad-hoc fetch-in-useEffect). The
// query throws on error so the page can render <LoadErrorBanner/>.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { safeApiCall } from "@/lib/api-fetch";
import type { ScheduleRecord, CatchUpPolicy } from "@/lib/schedules-repository";

export interface CreateScheduleBody {
  missionId: string;
  name?: string;
  schedule: string;
  catchUpPolicy?: CatchUpPolicy;
  repeatTimes?: number | null;
  profileName?: string | null;
}

async function fetchSchedules(): Promise<ScheduleRecord[]> {
  const res = await safeApiCall<{ data?: { schedules: ScheduleRecord[] } }>("/api/schedules");
  if (!res.ok) throw new Error(res.error ?? "Failed to load schedules");
  return res.data?.data?.schedules ?? [];
}

export function useSchedules() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["schedules"], queryFn: fetchSchedules });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["schedules"] });

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
    error: query.isError ? (query.error as Error).message : null,
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
  return useQuery({
    queryKey: ["mission-options"],
    retry: 0,
    queryFn: async (): Promise<MissionOption[]> => {
      const res = await safeApiCall<{ data?: { missions: MissionOption[] } }>("/api/missions?limit=500");
      if (!res.ok) throw new Error(res.error ?? "Failed to load missions");
      return (res.data?.data?.missions ?? []).map((m) => ({ id: m.id, name: m.name }));
    },
  });
}
