// ═══════════════════════════════════════════════════════════════
// useSchedules — TanStack Query data layer for Control Hub-owned schedules
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

  const create = useMutation({
    mutationFn: (body: CreateScheduleBody) => safeApiCall("/api/schedules", { method: "POST", body }),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => safeApiCall(`/api/schedules/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
  const toggle = useMutation({
    mutationFn: (vars: { id: string; enabled: boolean }) =>
      safeApiCall(`/api/schedules/${vars.id}`, { method: "PATCH", body: { enabled: vars.enabled } }),
    onSuccess: invalidate,
  });
  const runNow = useMutation({
    mutationFn: (id: string) =>
      safeApiCall<{ data?: { runId?: string } }>(`/api/schedules/${id}/run`, { method: "POST" }),
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
      const res = await safeApiCall<{ data?: { missions: MissionOption[] } }>("/api/missions");
      if (!res.ok) throw new Error(res.error ?? "Failed to load missions");
      return (res.data?.data?.missions ?? []).map((m) => ({ id: m.id, name: m.name }));
    },
  });
}
