// ═══════════════════════════════════════════════════════════════
// dashboard-initial-load.ts — Initial-load batch fetcher for the Dashboard
// ═══════════════════════════════════════════════════════════════
//
// The Dashboard (src/app/page.tsx) batches 8 endpoint fetches on
// mount with a single `Promise.all` so all 8 data slices land in
// one render. The fetches are:
//
//   /api/status           → SystemStatus | null
//   /api/config           → Record<string, unknown> | null
//   /api/templates        → { templates: TemplateListItem[] } | null
//   /api/mission-categories → { categories: MissionCategory[] } | null
//   /api/monitor          → MonitorData | null (cache: no-store)
//   /api/agents           → { processes: HermesProcess[] } | null
//   /api/missions         → { missions: MissionBrief[] } | null
//   /api/models/defaults  → { defaults: { agent?: string } | null } | null
//
// The original inline form was a 50-line `useEffect` + `Promise.all`
// + `setData({...})` + `setRegistryAgentModelLabel` + `setReady(true)`
// block. Extracted to a pure function so the batch-fetcher can be
// unit-tested with mocked `safeApiCallData`, and the page `useEffect`
// body shrinks to a 3-line `initialLoad` + cleanup.
//
// **Why a function (not a hook):** the helper is a single
// Promise.all over `safeApiCallData` calls. There's no React state,
// no lifecycle, no cleanup to register. The page owns the
// `useEffect` + `AbortController` cleanup, and the helper is a
// pure function it calls once. The shared `signal` is the only
// piece of state the helper reads (and it's the argument the page
// passes in).

import { safeApiCallData } from "@/lib/api-fetch";

import type { SystemStatus, MonitorData, HermesProcess, MissionBrief } from "@/types/hermes";
import type { MissionCategory } from "@/lib/mission-category-repository";

/**
 * Subset of the dashboard's template shape. The full `TemplateListItem`
 * type lives in `src/app/page.tsx`; we accept any object with the
 * fields this helper reads so the helper doesn't pull in a circular
 * dep on the page module.
 */
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

/**
 * The aggregated data the dashboard needs before its first render.
 * All fields are optional-with-default so the consumer can do
 * `data.templates ?? []` without a TS-strict null guard.
 *
 * The shape mirrors the `setData` slice in the page so the helper
 * can be called as `setData({...result})` after the Promise.all
 * resolves.
 */
export interface InitialDashboardData {
  status: SystemStatus | null;
  config: Record<string, unknown> | null;
  templates: DashboardTemplate[];
  categories: MissionCategory[];
  monitor: MonitorData | null;
  processes: HermesProcess[];
  missions: MissionBrief[];
}

/**
 * Subset of the Models-registry defaults the dashboard needs. The
 * `agent` field is the "default agent" model the registry stores
 * in the SQLite `model_defaults` table.
 */
export interface ModelsDefaults {
  agent?: string;
}

/**
 * Run the 8-endpoint batched fetch. Each `safeApiCallData` call
 * gets the same `signal` so a single `AbortController.abort()`
 * (called from the page's `useEffect` cleanup) cancels every
 * in-flight request. Returns `null` for any endpoint whose
 * `safeApiCallData` returned `null` (network error, 5xx, etc.),
 * and an empty array for any endpoint whose data is missing
 * (the `templates ?? []` defensive copy matches the pre-extraction
 * inline form byte-for-byte).
 *
 * The page's `setRegistryAgentModelLabel(defaults?.defaults?.agent ?? null)`
 * reads the `modelsDefaults` field, which is NOT merged into the
 * `setData` slice (it's stored in a separate `useState` for the
 * header subtitle).
 */
export interface InitialLoadResult {
  /** The merged slice for `setData({...result.dashboardData})`. */
  dashboardData: InitialDashboardData;
  /** The Models-registry defaults (read by the header subtitle). */
  modelsDefaults: { defaults: ModelsDefaults | null } | null;
}

/**
 * Fetch the 8 dashboard data slices in parallel. Returns a single
 * `InitialLoadResult` whose two fields map to the two
 * `useState` setters the page uses (`setData` and
 * `setRegistryAgentModelLabel`). The page is responsible for the
 * `signal.aborted` check after the Promise.all resolves (the
 * helper runs all 8 fetches unconditionally; the page decides
 * whether to commit the result based on whether the controller
 * was aborted mid-flight).
 */
export async function loadInitialDashboardData(
  options: { signal?: AbortSignal; cache?: RequestCache } = {},
): Promise<InitialLoadResult> {
  const { signal, cache } = options;

  const [
    status,
    config,
    templates,
    categories,
    monitor,
    processes,
    missions,
    defaults,
  ] = await Promise.all([
    safeApiCallData<SystemStatus>("/api/status", { signal }),
    safeApiCallData<Record<string, unknown>>("/api/config", { signal }),
    safeApiCallData<{ templates: DashboardTemplate[] }>("/api/templates", { signal }),
    safeApiCallData<{ categories: MissionCategory[] }>("/api/mission-categories", { signal }),
    safeApiCallData<MonitorData>("/api/monitor", { cache: cache ?? "no-store", signal }),
    safeApiCallData<{ processes: HermesProcess[] }>("/api/agents", { signal }),
    safeApiCallData<{ missions: MissionBrief[] }>("/api/missions", { signal }),
    safeApiCallData<{ defaults: ModelsDefaults | null }>("/api/models/defaults", { signal }),
  ]);

  return {
    dashboardData: {
      status: status ?? null,
      config: config ?? null,
      templates: templates?.templates ?? [],
      categories: categories?.categories ?? [],
      monitor: monitor ?? null,
      processes: processes?.processes ?? [],
      missions: missions?.missions ?? [],
    },
    modelsDefaults: defaults,
  };
}
