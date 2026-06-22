// ═══════════════════════════════════════════════════════════════
// useDashboard — TanStack Query data layer for the PatterStage home
// ═══════════════════════════════════════════════════════════════
//
// Replaces the dashboard's legacy data plumbing (the one-shot
// `loadInitialDashboardData` batch + the 3-endpoint `usePolledUpdates`
// poller) with the standard query pattern used by `useSchedules` /
// `useStats`: a `useQuery` per live surface with its own
// `refetchInterval`, plus one static-bundle query for the data that
// only needs to load once.
//
// Three live queries (the data the dashboard re-reads on a timer):
//   • monitor   /api/monitor   every 10s   (single `{ data }` unwrap)
//   • processes /api/agents    every 15s
//   • missions  /api/missions  every 15s
//
// One static query (loaded once on mount, refreshed on demand):
//   • status / config / templates / categories / modelsDefaults
//     via the existing `loadInitialDashboardData` batch fetcher.
//
// ── Latent bug this migration fixes ──────────────────────────────
// The old `usePolledUpdates` poll declared `/api/monitor` as
// double-wrapped (`paths: ["data"]`), but the route returns a single
// `{ data: MonitorData }` envelope. `unwrapPollPath` walked one level
// too deep and returned `null` on every tick, so the monitor poll was
// a silent no-op — the monitor panels (stat pills, Platforms, Errors)
// only ever showed the snapshot from the initial mount load and never
// refreshed live. This hook fetches `/api/monitor` with the same
// single unwrap `loadInitialDashboardData` already used (known-good),
// so monitor now actually refreshes every 10s.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useQuery } from "@tanstack/react-query";

import { safeApiCall, safeApiCallData } from "@/lib/api-fetch";
import {
  loadInitialDashboardData,
  type DashboardTemplate,
} from "@/lib/dashboard-initial-load";
import type { MissionCategory } from "@/lib/mission-category-repository";
import type {
  SystemStatus,
  MonitorData,
  HermesProcess,
  MissionBrief,
} from "@/types/hermes";

// ── Live fetchers (throw on hard failure so Query keeps last-good) ──
//
// Throwing (rather than returning a default) means a transient network
// error keeps the previous successful payload visible — matching the
// old poll's "skip the tick, keep last value" behaviour rather than
// blanking the panel.

async function fetchMonitor(): Promise<MonitorData> {
  const monitor = await safeApiCallData<MonitorData>("/api/monitor", { cache: "no-store" });
  if (!monitor) throw new Error("Failed to load monitor");
  return monitor;
}

async function fetchProcesses(): Promise<HermesProcess[]> {
  const res = await safeApiCall<{ data?: { processes: HermesProcess[] } }>("/api/agents");
  if (!res.ok) throw new Error(res.error ?? "Failed to load processes");
  return res.data?.data?.processes ?? [];
}

async function fetchMissions(): Promise<MissionBrief[]> {
  const res = await safeApiCall<{ data?: { missions: MissionBrief[] } }>("/api/missions");
  if (!res.ok) throw new Error(res.error ?? "Failed to load missions");
  return res.data?.data?.missions ?? [];
}

/** A 14-day session-activity series for the Sessions stat-pill sparkline. */
async function fetchSessionTrend(): Promise<number[]> {
  const data = await safeApiCallData<{ timeseries: { date: string; value: number }[] }>(
    "/api/analytics/timeseries?type=session.started&days=14",
  );
  return (data?.timeseries ?? []).map((p) => p.value);
}

// ── Static bundle (status / config / templates / categories / defaults) ──
//
// The non-live slices load once. We reuse the existing batch fetcher
// and ignore its monitor/processes/missions fields — those are owned
// by the live queries above. The static query has no refetchInterval
// (templates/categories/config only change on user action elsewhere),
// preserving the old "loaded once at mount" behaviour.

interface DashboardStatic {
  status: SystemStatus | null;
  config: Record<string, unknown> | null;
  templates: DashboardTemplate[];
  categories: MissionCategory[];
  registryAgentModelLabel: string | null;
}

async function fetchStatic(): Promise<DashboardStatic> {
  const { dashboardData, modelsDefaults } = await loadInitialDashboardData();
  return {
    status: dashboardData.status,
    config: dashboardData.config,
    templates: dashboardData.templates,
    categories: dashboardData.categories,
    // Prefer the RESOLVED model name; never fall back to the raw uuid in
    // `defaults.agent` (that's what showed "af00a9df-…" in the subtitle).
    registryAgentModelLabel: modelsDefaults?.agentModelLabel ?? null,
  };
}

// ── Public hook ──────────────────────────────────────────────────

export interface UseDashboardResult {
  status: SystemStatus | null;
  monitor: MonitorData | null;
  processes: HermesProcess[];
  missions: MissionBrief[];
  config: Record<string, unknown> | null;
  templates: DashboardTemplate[];
  categories: MissionCategory[];
  registryAgentModelLabel: string | null;
  /** 14-day session-activity counts for the Sessions pill sparkline. */
  sessionTrend: number[];
  /** True once the static bundle has resolved (gates first paint). */
  ready: boolean;
  refetchMonitor: () => Promise<unknown>;
  refetchMissions: () => Promise<unknown>;
  refetchProcesses: () => Promise<unknown>;
}

export function useDashboard(): UseDashboardResult {
  const monitorQuery = useQuery({
    queryKey: ["dashboard", "monitor"],
    queryFn: fetchMonitor,
    refetchInterval: 10_000,
    staleTime: 5_000,
  });
  const processesQuery = useQuery({
    queryKey: ["dashboard", "agents"],
    queryFn: fetchProcesses,
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
  const missionsQuery = useQuery({
    queryKey: ["dashboard", "missions"],
    queryFn: fetchMissions,
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
  const staticQuery = useQuery({
    queryKey: ["dashboard", "static"],
    queryFn: fetchStatic,
    staleTime: Infinity,
  });
  const sessionTrendQuery = useQuery({
    queryKey: ["dashboard", "session-trend"],
    queryFn: fetchSessionTrend,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  return {
    status: staticQuery.data?.status ?? null,
    monitor: monitorQuery.data ?? null,
    processes: processesQuery.data ?? [],
    missions: missionsQuery.data ?? [],
    config: staticQuery.data?.config ?? null,
    templates: staticQuery.data?.templates ?? [],
    categories: staticQuery.data?.categories ?? [],
    registryAgentModelLabel: staticQuery.data?.registryAgentModelLabel ?? null,
    sessionTrend: sessionTrendQuery.data ?? [],
    ready: !staticQuery.isLoading,
    refetchMonitor: () => monitorQuery.refetch(),
    refetchMissions: () => missionsQuery.refetch(),
    refetchProcesses: () => processesQuery.refetch(),
  };
}
