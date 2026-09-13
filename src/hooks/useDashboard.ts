// ═══════════════════════════════════════════════════════════════
// useDashboard — the home screen's reads, one per fact it shows
//
// Every read goes through useApiResource, keyed on its endpoint, so a fact the
// shell already reads (the runtime status in the rail footer, the subsystems
// row on Quests) is one request however many screens ask. This used to be six
// raw useQuery calls under dashboard-only keys PLUS a second loader that
// fetched /api/monitor, /api/agents and
// /api/missions a second time to build a "static bundle" beside the live
// queries polling the same three endpoints. Measured before T-0129: 22 API
// requests to load `/`, four endpoints fetched twice. tests/e2e/requests.spec.ts
// holds the count now.
//
// Live, on a timer:
//   • monitor      /api/monitor                every 10s
//   • processes    /api/agents                 every 15s
//   • missions     /api/missions?limit=200     every 15s
//   • subsystems   /api/status/subsystems      every 15s
//   • sessionTrend /api/analytics/timeseries…  every 60s
//
// Once (staleTime Infinity, refetched on demand):
//   • status /api/status · config /api/config · templates /api/templates
//   • categories /api/mission-categories · modelReadiness /api/models/defaults
// ═══════════════════════════════════════════════════════════════

"use client";

import { useApiResource } from "@/hooks/useApiResource";
import type { ModelReadiness } from "@/lib/models/model-readiness";
import type { SubsystemSummary } from "@/lib/status/subsystems";
import type { MissionCategory } from "@/lib/missions/mission-category-repository";
import type { SystemStatus, MonitorData, HermesProcess, MissionBrief } from "@/types/console";

/** A catalogue template as the dispatch strip shows it. */
export interface DashboardTemplate {
  id: string;
  name: string;
  icon: string;
  color: string;
  category: string;
  categoryId?: string;
  profile: string;
  description: string;
  isCustom?: boolean;
}

export interface UseDashboardResult {
  status: SystemStatus | null;
  monitor: MonitorData | null;
  processes: HermesProcess[];
  missions: MissionBrief[];
  config: Record<string, unknown> | null;
  templates: DashboardTemplate[];
  categories: MissionCategory[];
  /**
   * The product's one answer to "do I have a model?". `null` until the
   * defaults have answered.
   */
  modelReadiness: ModelReadiness | null;
  /** 14-day session-activity counts for the Sessions pill sparkline. */
  sessionTrend: number[];
  /** The subsystem health summary (T-0091), null until the first check answers. */
  subsystems: SubsystemSummary | null;
  /**
   * "Not yet" and "failed" are different answers (T-0099, D54). The monitor
   * read's last error, and whether it has answered at all: a page that only
   * sees `monitor: null` shows skeletons forever when the read fails.
   */
  monitorError: string | null;
  monitorSettled: boolean;
  subsystemsError: string | null;
  subsystemsSettled: boolean;
  /** True once the once-only reads have all answered (gates first paint). */
  ready: boolean;
  refetchMonitor: () => Promise<unknown>;
  refetchMissions: () => Promise<unknown>;
  refetchProcesses: () => Promise<unknown>;
  /** The Subsystems panel's Retry (U13, T-0127): a failed check is an error with a way back, not Checking... for ever. */
  refetchSubsystems: () => Promise<unknown>;
}

export function useDashboard(): UseDashboardResult {
  const monitor = useApiResource<MonitorData>("/api/monitor", {
    // A missing monitor is a failure, not an empty board.
    select: (p) => (p as MonitorData | null) ?? undefined,
    errorMessage: "Failed to load monitor",
    refetchInterval: 10_000,
    staleTime: 5_000,
  });
  const processes = useApiResource<HermesProcess[]>("/api/agents", {
    select: (p) => (p as { processes?: HermesProcess[] } | null)?.processes,
    fallback: [],
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
  const missions = useApiResource<MissionBrief[]>("/api/missions?limit=200", {
    select: (p) => (p as { missions?: MissionBrief[] } | null)?.missions,
    fallback: [],
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
  const subsystems = useApiResource<SubsystemSummary>("/api/status/subsystems", {
    select: (p) => (p as SubsystemSummary | null) ?? undefined,
    errorMessage: "Failed to load subsystems",
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
  const sessionTrend = useApiResource<number[]>("/api/analytics/timeseries?type=session.started&days=14", {
    select: (p) =>
      ((p as { timeseries?: { date: string; value: number }[] } | null)?.timeseries ?? []).map((x) => x.value),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  // `select` returning null (not undefined) is a known absence, not an error.
  const status = useApiResource<SystemStatus | null>("/api/status", {
    select: (p) => (p as SystemStatus | null) ?? null,
    staleTime: Infinity,
  });
  const config = useApiResource<Record<string, unknown> | null>("/api/config", {
    select: (p) => (p as Record<string, unknown> | null) ?? null,
    staleTime: Infinity,
  });
  const templates = useApiResource<DashboardTemplate[]>("/api/templates", {
    select: (p) => (p as { templates?: DashboardTemplate[] } | null)?.templates,
    fallback: [],
    staleTime: Infinity,
  });
  const categories = useApiResource<MissionCategory[]>("/api/mission-categories", {
    select: (p) => (p as { categories?: MissionCategory[] } | null)?.categories,
    fallback: [],
    staleTime: Infinity,
  });
  const defaults = useApiResource<{ modelReadiness: ModelReadiness | null }>("/api/models/defaults", {
    select: (p) => ({ modelReadiness: (p as { modelReadiness?: ModelReadiness | null } | null)?.modelReadiness ?? null }),
    staleTime: Infinity,
  });

  return {
    status: status.data,
    monitor: monitor.data,
    processes: processes.data ?? [],
    missions: missions.data ?? [],
    config: config.data,
    templates: templates.data ?? [],
    categories: categories.data ?? [],
    modelReadiness: defaults.data?.modelReadiness ?? null,
    sessionTrend: sessionTrend.data ?? [],
    subsystems: subsystems.data,
    monitorError: monitor.error,
    monitorSettled: monitor.settled,
    subsystemsError: subsystems.error,
    subsystemsSettled: subsystems.settled,
    ready: status.settled && config.settled && templates.settled && categories.settled && defaults.settled,
    refetchMonitor: () => monitor.refetch(),
    refetchMissions: () => missions.refetch(),
    refetchProcesses: () => processes.refetch(),
    refetchSubsystems: () => subsystems.refetch(),
  };
}
