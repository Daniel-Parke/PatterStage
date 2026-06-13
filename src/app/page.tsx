// ═══════════════════════════════════════════════════════════════
// Dashboard - Control Hub Home (Redesigned)
// ═══════════════════════════════════════════════════════════════
// Lean operational overview. No nav cards, no fake terminals.
// One-glance situational awareness → one-click actions.

"use client";

import { useState, useEffect, useCallback, useMemo, memo as reactMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  // Dashboard icons
  Activity,
  Layers,
  ListTodo,
  Globe,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  Radio,
  Rocket,
  ChevronRight,
  ChevronDown,
  Gamepad2,
  BookOpen,
} from "lucide-react";
import { StatusDot } from "@/components/ui/Card";
import SchedulePicker from "@/components/schedule/SchedulePicker";
import CategoryAccordion from "@/components/ui/CategoryAccordion";
import {
  groupTemplatesByCategory,
  type TemplateLike,
} from "@/lib/mission-categories";
import type { MissionCategory } from "@/lib/mission-category-repository";
import TemplatePill from "@/components/ui/TemplatePill";
import { useToast } from "@/components/ui/Toast";
import type { SystemStatus, AccentColor, MonitorData, HermesProcess, MissionBrief } from "@/types/hermes";
import { timeAgo, titleCase, parseSchedule } from "@/lib/utils";
import { scheduleDisplayFromParsed } from "@/lib/schedule/parse-schedule";
import { shellHeaderBarClasses } from "@/lib/theme";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import AppPageShell from "@/components/layout/AppPageShell";
import { StatPill, StatPillSkeleton } from "@/components/dashboard/StatPill";
import { MissionStatusBadge, CronStatusBadge } from "@/components/dashboard/StatusBadge";
import { safeApiCall, safeApiCallData, toastError } from "@/lib/api-fetch";
import { runMutation } from "@/lib/run-mutation";
import { toastFromResult } from "@/lib/toast-from-result";
import { dispatchMissionAction } from "@/hooks/success-message-for-dispatch";
import { HERMES_PLATFORMS } from "@/lib/hermes-toolset-catalog";
import { isMissionActive } from "@/lib/mission-board";
import { countInWindow, ACTIVE_WINDOW_MS, RECENT_WINDOW_MS } from "@/lib/session-window";
import { computeCronJobRowCaption } from "@/lib/cron-row-helpers";
import { composeTemplateUrl, withCronJobSchedule } from "@/lib/dashboard-helpers";
import { dedupErrors } from "@/lib/dashboard-error-dedup";
import { formatModelSubtitle } from "@/lib/dashboard-model-subtitle";
import { topNTemplates } from "@/lib/dashboard-top-templates";
import { loadInitialDashboardData } from "@/lib/dashboard-initial-load";
import { useTwoStepConfirm } from "@/hooks/useTwoStepConfirm";
import { useInterval } from "@/hooks/useInterval";
import { usePolledUpdates } from "@/hooks/usePolledUpdates";

/**
 * Shape of a single template as returned by /api/templates. The dashboard
 * uses the same shape for both the API response and the local state
 * slice, so the type is exported as `TemplateListItem` and shared
 * between them (avoids the previous inline `Array<{...}>` duplication
 * at the useState declaration).
 */
export interface TemplateListItem {
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
// ── Live Clock (isolated re-render) ───────────────────────────

const LiveClock = reactMemo(function LiveClock() {
  const [time, setTime] = useState<Date>(new Date());
  useInterval(() => setTime(new Date()), { ms: 1000 });
  return (
    <>
      <div className="text-sm font-mono text-neon-cyan" suppressHydrationWarning>
        {time.toLocaleTimeString("en-US", { hour12: false })}
      </div>
      <div className="text-xs text-white/40" suppressHydrationWarning>
        {time.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
      </div>
    </>
  );
});

// ── Cron job caption span ─────────────────────────────────────

/**
 * Tiny presentational component that renders the cron-job caption
 * produced by `computeCronJobRowCaption`. Extracted so the JSX
 * .map() can pass a single prop instead of an IIFE.
 */
function CronJobCaptionSpan({
  caption,
}: {
  caption: ReturnType<typeof computeCronJobRowCaption> | null;
}) {
  if (!caption) return null;
  return (
    <span
      className={`text-xs truncate min-w-0 flex-1 ${caption.colorClass}`}
      title={caption.text}
    >
      {caption.text}
    </span>
  );
}

export default function Dashboard() {
  const [data, setDataFields] = useState<{
    status: SystemStatus | null;
    monitor: MonitorData | null;
    processes: HermesProcess[];
    missions: MissionBrief[];
    config: Record<string, unknown> | null;
    templates: TemplateListItem[];
    categories: MissionCategory[];
  }>({
    status: null,
    monitor: null,
    processes: [],
    missions: [],
    config: null,
    templates: [],
    categories: [],
  });
  const { status, monitor, processes, missions, config, templates, categories } =
    data;

  const setData = useCallback((partial: Partial<typeof data>) => {
    setDataFields(prev => ({ ...prev, ...partial }));
  }, []);
  const [ready, setReady] = useState(false);
  const [dispatchExpanded, setDispatchExpanded] = useState(false);
  // Open-callback sibling for the dispatch panel. The "Mission Dispatch"
  // header toggles `dispatchExpanded` (line 596) and the "+N more" pill
  // (line 638) opens it from the collapsed state. Promoting the `() =>
  // setDispatchExpanded(true)` inline arrow to a named useCallback
  // follows the same open/close sibling pattern as session 116 P-7
  // (the missions page's `openCategoryManager` + `closeCategoryManager`,
  // the cron page's `openAgentCreate` / `openSystemCreate`). The deps
  // array lists `setDispatchExpanded` so the
  // `react-hooks/exhaustive-deps` rule is satisfied — the setter is a
  // stable `useState` reference so the callback is still effectively
  // constant per render cycle.
  const openDispatchPanel = useCallback(
    () => setDispatchExpanded(true),
    [setDispatchExpanded],
  );
  // Toggle sibling for the dispatch panel header. The collapsed-strip
  // header (line 536) calls `() => setDispatchExpanded(!dispatchExpanded)`
  // inline; promoting to a named useCallback mirrors the open-callback
  // promotion above (session 116 P-7 / session 118 P-7 sibling pattern).
  // The deps array lists `dispatchExpanded` so the
  // `react-hooks/exhaustive-deps` rule is satisfied — `dispatchExpanded`
  // is a fresh boolean on every state update, so the callback re-creates
  // only when the panel flips open/closed.
  const toggleDispatchPanel = useCallback(
    () => setDispatchExpanded(!dispatchExpanded),
    [dispatchExpanded],
  );
  const [errorSev, setErrorSev] = useState<"all" | "error" | "warning">("all");
  const [syncNowBusy, setSyncNowBusy] = useState(false);
  const [registryAgentModelLabel, setRegistryAgentModelLabel] = useState<string | null>(null);
  const { showToast, toastElement } = useToast();
  const router = useRouter();
  const { isArmedFor, arm, confirm } = useTwoStepConfirm({ autoDismissMs: 4000 });

  const refreshMonitor = useCallback(async () => {
    const monitor = await safeApiCallData<MonitorData>("/api/monitor", { cache: "no-store" });
    if (monitor) setData({ monitor });
  }, [setData]);

  const handleSyncNow = useCallback(
    () =>
      runMutation(showToast, {
        busy: setSyncNowBusy,
        build: () => ({}),
        path: "/api/sync",
        successMsg: "Background sync completed",
        errorMsg: "Sync failed",
        onSuccess: async () => {
          await refreshMonitor();
        },
      }),
    [refreshMonitor, showToast],
  );

  const filteredErrors = useMemo(() => {
    if (!monitor?.errors) return [];
    let filtered = monitor.errors;
    if (errorSev !== "all") {
      // Use the DB severity field — reliable, no string matching
      filtered = filtered.filter((e) => e.severity === errorSev);
    }
    // Collapse consecutive identical (source, message) pairs into a
    // single row with a "(×N)" suffix. The algorithm is in
    // dedupErrors (src/lib/dashboard-error-dedup.ts) — see that file
    // for the full rationale (gateway-reconnect errors that log the
    // same line every few minutes would otherwise dominate the
    // panel).
    return dedupErrors(filtered);
  }, [monitor, errorSev]);

  // Severity selector for the Errors panel. Each severity pill in the
  // .map() calls `() => setErrorSev(sev)` inline (line 791); promoting
  // to a named useCallback with a parameter mirrors the
  // `setSourceFilter(src)` / `setActiveLog(log.name)` / `setMissionFilter(id)`
  // sibling pattern used across the List 1 + List 2 pages. The
  // `setErrorSev` setter is stable per the `useState` contract, so the
  // callback's identity is effectively constant per render cycle.
  const selectSeverity = useCallback(
    (sev: "all" | "error" | "warning") => setErrorSev(sev),
    [setErrorSev],
  );
  // Note: useTwoStepConfirm handles its own unmount cleanup.
  // The original handler had no busy state (the row already shows
  // "Confirm?" via `isArmedFor`), so we keep the original `try/catch`
  // shape rather than adopting `runMutation` (which requires a busy
  // setter that the page does not consume).
  const handleCancelMission = useCallback(async (missionId: string, missionName: string) => {
    const doCancel = async () => {
      try {
        // Migrated from the inline `safeApiCall<{ missions: MissionBrief[] }>("/api/missions", { method: "POST", body: { action: "cancel", missionId } })` form
        // to the shared `dispatchMissionAction` helper. The pre-migration type
        // annotation was wrong — the route returns `{ mission, cancel: { accepted, processKillPending } }`,
        // NOT `{ missions: MissionBrief[] }` (that envelope belongs to the list endpoint, not the
        // cancel action). The destructure only reads `ok`/`error` so the type mismatch was
        // invisible at runtime, but it was a maintenance trap. The helper now owns the wire call
        // and the envelope type. Byte-equivalent at the call site.
        const { ok, error } = await dispatchMissionAction("cancel", { missionId });
        toastFromResult(
          showToast,
          { ok, error },
          `Cancelled "${missionName}"`,
          "Failed to cancel mission",
        );
        if (!ok) return;
        // Refresh missions
        const missions = await safeApiCallData<{ missions: MissionBrief[] }>("/api/missions");
        if (missions) setData({ missions: missions.missions || [] });
      } catch (err) {
        toastError(showToast, err, "Failed to cancel mission");
      }
    };
    if (!isArmedFor(missionId)) {
      arm(missionId);
      return;
    }
    await confirm(doCancel);
  }, [showToast, setData, isArmedFor, arm, confirm]);

  // Update cron job schedule inline
  const handleCronScheduleChange = useCallback(async (jobId: string, newSchedule: string) => {
    if (!data.monitor?.cron?.jobs) {
      showToast("Schedule update unavailable: no monitor data", "error");
      return;
    }

    const parsed = parseSchedule(newSchedule);
    // `scheduleDisplayFromParsed` (src/lib/schedule/parse-schedule.ts) handles
    // the type-narrowing concern for the discriminated `ParsedSchedule` union:
    // the `invalid` variant has no `display` field, so the call site collapses
    // to a single helper call + a raw-input fallback for the invalid case.
    // Byte-equivalent to the prior inline `parsed.kind !== "invalid" ?
    // parsed.display : newSchedule` form.
    const scheduleDisplay = scheduleDisplayFromParsed(parsed, newSchedule);

    // Optimistic local update before the API call so the UI updates immediately.
    // `data.monitor` is in the useCallback deps (line 311 below) so the
    // captured value is always fresh — equivalent to reading `prev.monitor`
    // from a React-state updater. The `setData` helper is the canonical
    // partial-state setter (defined at line 179 above); only the `useState`
    // declaration itself uses the raw dispatch setter directly.
    //
    // The optimistic update writes BOTH the canonical cron (`schedule`)
    // and the human label (`schedule_display`). The picker's onChange
    // contract is a 5-field cron expression (see SchedulePicker JSDoc
    // line 33), so `newSchedule` is the canonical form; the parsed
    // `scheduleDisplay` is the label the dashboard renders next to it.
    setData({
      monitor: withCronJobSchedule(data.monitor, jobId, newSchedule, scheduleDisplay),
    });

    try {
      const { ok, error } = await safeApiCall("/api/cron", {
        method: "PUT",
        body: { id: jobId, schedule: newSchedule },
      });
      toastFromResult(
        showToast,
        { ok, error },
        "Schedule updated",
        "Failed to update cron schedule",
      );
    } catch (err) {
      toastError(showToast, err, "Failed to update cron schedule");
    } finally {
      // Revoke optimistic update on failure; refresh on success. The
      // finally block covers all paths (success, !ok return, thrown),
      // so no inline refreshMonitor() is needed in the success/catch
      // branches above.
      void refreshMonitor();
    }
  }, [data.monitor, showToast, refreshMonitor, setData]);

  const handleRefreshProcesses = useCallback(async () => {
    const processes = await safeApiCallData<{ processes: HermesProcess[] }>("/api/agents");
    if (processes?.processes) {
      setData({ processes: processes.processes });
    }
  }, [setData]);

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    // Batch all initial fetches — single render update. The 8-endpoint
    // batched fetcher lives in `loadInitialDashboardData`
    // (src/lib/dashboard-initial-load.ts); the page is responsible
    // for the `signal.aborted` check + the React state write.
    const initialLoad = async () => {
      const { dashboardData, modelsDefaults } = await loadInitialDashboardData({ signal });

      if (!signal.aborted) {
        setRegistryAgentModelLabel(modelsDefaults?.defaults?.agent ?? null);
        setData(dashboardData);
        setReady(true);
      }
    };
    initialLoad();

    return () => {
      controller.abort();
    };
  }, [setData]);

  // ── Polling — declared as data, not as code ──────────────────────
  // Three endpoints, three independent cadences, one shared
  // `setData` merge. The `usePolledUpdates` hook (src/hooks/usePolledUpdates.ts)
  // registers one `setInterval` per entry, walks the envelope via
  // `unwrapPollPath`, and forwards the `extract` mapper's result to
  // `setData`. Returning `null` from `extract` skips the tick.
  //
  // The poll array is built inline each render but the hook stores
  // it in a ref (mirrors `useInterval`'s callback-ref pattern) so the
  // intervals are not re-armed on every parent re-render.
  usePolledUpdates<Partial<typeof data>>(setData, [
    {
      url: "/api/monitor",
      ms: 10_000,
      // /api/monitor is double-wrapped: { data: { data: MonitorData } }
      paths: ["data"],
      extract: (inner) => ({ monitor: inner as unknown as MonitorData }),
    },
    {
      url: "/api/agents",
      ms: 15_000,
      // /api/agents is single-wrapped: { data: { processes: [...] } }
      paths: [],
      extract: (inner) => ({
        processes: (inner.processes as HermesProcess[] | undefined) ?? [],
      }),
    },
    {
      url: "/api/missions",
      ms: 15_000,
      paths: [],
      extract: (inner) => ({
        missions: (inner.missions as MissionBrief[] | undefined) ?? [],
      }),
    },
  ]);

  const modelConfig = config?.model as Record<string, unknown> | undefined;
  const diskModel = (modelConfig?.default as string) || "";
  const diskProvider = (modelConfig?.provider as string) || "";
  // Header subtitle: prefer the model written to config.yaml; fall back to
  // the registry's "default agent" (the user has set a default in the
  // Models registry but hasn't yet pushed it to config.yaml); else "-".
  // The 3-source priority ladder lives in `formatModelSubtitle`
  // (src/lib/dashboard-model-subtitle.ts) so the rule is
  // unit-testable in isolation.
  const modelSubtitle = useMemo(
    () => formatModelSubtitle(diskModel, diskProvider, registryAgentModelLabel),
    [diskModel, diskProvider, registryAgentModelLabel],
  );
  const activeProcesses = useMemo(() => processes.filter((p) => p.status === "running"), [processes]);
  const activeMissions = useMemo(
    () => missions.filter(isMissionActive),
    [missions],
  );

  // Timestamp for cron scheduling comparisons. We DO NOT compute
  // `new Date().getTime()` directly in the render body, because that
  // would make `now` a brand-new number on every render, which in
  // turn would invalidate the `cronCaptions` and `sessionWindowSubtitle`
  // `useMemo`s on every render and defeat the entire purpose of the
  // memo. Instead, hold `now` in `useState` (initialised once on mount)
  // and refresh it on a 30-second `useInterval`. The captions stay
  // stable for 30-second windows — close enough for a dashboard whose
  // monitor already polls every 10s.
  const [now, setNow] = useState(() => new Date().getTime());
  useInterval(() => setNow(new Date().getTime()), { ms: 30_000 });

  // Per-job caption map: priority-ordered ladder extracted to
  // computeCronJobRowCaption (src/lib/cron-row-helpers.ts) so the
  // rules are unit-testable in isolation. The map lets the JSX
  // .map() do a single lookup per row instead of recomputing.
  const cronCaptions = useMemo(() => {
    const map = new Map<string, ReturnType<typeof computeCronJobRowCaption>>();
    for (const job of monitor?.cron.jobs ?? []) {
      map.set(job.id, computeCronJobRowCaption(job, now));
    }
    return map;
  }, [monitor?.cron.jobs, now]);

  // Sessions stat-pill subtitle: "N active · M last 7d" derived from
  // the 5 most recent sessions exposed by /api/monitor. The full
  // window math lives in countInWindow (src/lib/session-window.ts) so
  // it's unit-testable without rendering the dashboard.
  const sessionWindowSubtitle = useMemo(() => {
    const recent = monitor?.sessions.recent ?? [];
    const active = countInWindow(recent, ACTIVE_WINDOW_MS, now);
    const last7d = countInWindow(recent, RECENT_WINDOW_MS, now);
    return `${active} active · ${last7d} last 7d`;
  }, [monitor?.sessions.recent, now]);

  // Group templates by category for the dispatch section
  const templateGroups = useMemo(
    () =>
      groupTemplatesByCategory(
        templates as TemplateLike[],
        categories,
      ),
    [templates, categories],
  );

  // Cap the collapsed template strip to 12 entries (the "Mission
  // Dispatch" strip's first-paint width). The cap + custom-first /
  // alphabetical sort lives in `topNTemplates`
  // (src/lib/dashboard-top-templates.ts).
  const collapsedTemplateStrip = useMemo(() => topNTemplates(templates), [templates]);

  return (
    <AppPageShell variant="scanlines">
      {/* Top Bar */}
      <div className={`${shellHeaderBarClasses} sticky top-0 z-30 justify-between gap-4 w-full`}>
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            <span className="text-neon-cyan text-glow-cyan">CONTROL</span>{" "}
            <span className="text-white/70">HUB</span>
          </h1>
          <p className="text-xs text-white/40 font-mono">{modelSubtitle}</p>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <LiveClock />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-neon-green pulse-glow" />
            <span className="text-xs text-white/60 font-mono">ONLINE</span>
          </div>
        </div>
      </div>
      {toastElement}

      {!ready ? (
        <div className="flex items-center justify-center min-h-[60vh]">
          <LoadingSpinner text="Loading dashboard..." />
        </div>
      ) : (
        <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* ═══ Compact Stat Row ═══ */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 min-w-0">
          {monitor ? (
            <>
              <StatPill
                icon={Radio}
                label="Processes"
                value={activeProcesses.length > 0 ? `${activeProcesses.length} Active` : status?.soulFile ? "Idle" : "Offline"}
                color={activeProcesses.length > 0 ? "green" : status?.soulFile ? "cyan" : "pink"}
              />
              <StatPill
                icon={ListTodo}
                label="Cron Jobs"
                value={`${monitor.cron.active} Active`}
                color="orange"
              />
              <StatPill
                icon={Activity}
                label="Sessions"
                value={monitor.sessions.total.toLocaleString()}
                color="purple"
                subtitle={sessionWindowSubtitle}
              />
              <StatPill
                icon={Layers}
                label={`Memory · ${monitor.memory.provider || "Not Installed"}`}
                value={monitor.memory.factCount >= 0 ? `${monitor.memory.factCount} facts` : "0 facts"}
                color="pink"
              />
            </>
          ) : (
            <>
              <StatPillSkeleton />
              <StatPillSkeleton />
              <StatPillSkeleton />
              <StatPillSkeleton />
            </>
          )}
        </div>

        {/* ═══ Handoff / continuation ═══ */}
        <div className="rounded-xl border border-white/10 bg-dark-900/40 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-mono text-white/40 uppercase tracking-wider">
              Continue work
            </div>
            <div className="text-sm text-white/80 mt-1">
              {monitor?.sessions?.recent?.[0] ? (
                <>
                  Latest session {timeAgo(monitor.sessions.recent[0].modified)}{" "}
                  <Link
                    href={"/sessions/" + monitor.sessions.recent[0].id}
                    className="text-neon-cyan hover:underline font-mono text-xs"
                  >
                    open transcript
                  </Link>
                </>
              ) : (
                "No sessions yet — run a mission or use Hermes chat."
              )}
            </div>
          </div>
          <Link
            href="/sessions"
            className="text-xs font-mono text-neon-purple hover:underline inline-flex items-center gap-1"
          >
            Session browser <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        {/* ═══ Mission Dispatch Quick Launch ═══ */}
        <div className="rounded-xl border border-neon-cyan/20 bg-dark-900/50 overflow-hidden">
          <button
            onClick={toggleDispatchPanel}
            className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.02] transition-colors"
          >
            <div className="flex items-center gap-2">
              <Rocket className="w-4 h-4 text-neon-cyan" />
              <span className="text-sm font-mono text-white/80">Mission Dispatch</span>
              <span className="text-[10px] font-mono text-white/25">({templates.length})</span>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/orchestration/missions"
                onClick={(e) => e.stopPropagation()}
                className="text-[10px] font-mono text-neon-cyan hover:underline flex items-center gap-1"
              >
                full control <ChevronRight className="w-3 h-3" />
              </Link>
              {dispatchExpanded ? (
                <ChevronDown className="w-4 h-4 text-white/20" />
              ) : (
                <ChevronRight className="w-4 h-4 text-white/20" />
              )}
            </div>
          </button>

          {/* Collapsed: horizontal pill strip */}
          {!dispatchExpanded && (
            <div className="px-4 pb-3 flex flex-wrap gap-1.5">
              {collapsedTemplateStrip.map((t) => (
                <TemplatePill
                  key={t.id}
                  t={t}
                  onSelect={() => router.push(composeTemplateUrl(t.id))}
                />
              ))}
              {templates.length > 12 && (
                <button
                  onClick={openDispatchPanel}
                  className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-mono text-white/30 hover:text-neon-cyan transition-colors"
                >
                  +{templates.length - 12} more
                </button>
              )}
            </div>
          )}

          {/* Expanded: grouped by category, all compact pills */}
          {dispatchExpanded && (
            <div className="px-4 pb-4 space-y-3">
              {templateGroups.map((group) => (
                <CategoryAccordion
                  key={group.categoryId ?? "__none__"}
                  name={group.label}
                  count={group.items.length}
                  color={group.color as AccentColor}
                  expandable={group.items.length > 6}
                  defaultOpen={true}
                >
                  <div className="flex flex-wrap gap-1.5">
                    {group.items.map((t) => (
                      <TemplatePill
                        key={t.id}
                        t={t}
                        onSelect={() => router.push(composeTemplateUrl(t.id))}
                      />
                    ))}
                  </div>
                </CategoryAccordion>
              ))}
            </div>
          )}
        </div>

        {/* ═══ Active Missions ═══ */}
        {activeMissions.length > 0 && (
          <div className="rounded-xl border border-neon-cyan/20 bg-dark-900/50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-dark-800/50">
              <div className="flex items-center gap-2">
                <Rocket className="w-3.5 h-3.5 text-neon-cyan" />
                <span className="text-xs font-mono text-white/60">Active Missions</span>
                <span className="text-[10px] font-mono text-white/25">
                  ({activeMissions.length})
                </span>
              </div>
              <Link href="/orchestration/missions" className="text-[10px] font-mono text-neon-cyan hover:underline flex items-center gap-1">
                all missions <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="divide-y divide-white/5">
              {activeMissions
                .map((m) => (
                  <div key={m.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <StatusDot
                        status={m.status === "dispatched" ? "online" : "warning"}
                        pulse={m.status === "dispatched"}
                      />
                      <Link href="/orchestration/missions" className="text-xs text-white/80 truncate hover:text-neon-cyan transition-colors">{m.name}</Link>
                      <span className="text-[10px] font-mono text-white/30 capitalize">{m.dispatchMode}</span>
                      {m.latestSession ? (
                        <Link
                          href={`/sessions/${m.latestSession.id}`}
                          className="text-[10px] font-mono text-white/25 hover:text-neon-cyan transition-colors"
                          title="View session"
                        >
                          {m.latestSession.id.slice(-20)}
                        </Link>
                      ) : m.cronJobId && m.status === "dispatched" ? (
                        <span className="text-[10px] font-mono text-white/15 italic">
                          Session loading...
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <MissionStatusBadge status={m.status} />
                      <span className="text-[10px] font-mono text-white/25">{timeAgo(m.createdAt)}</span>
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleCancelMission(m.id, m.name); }}
                        className={`text-[10px] font-mono transition-colors px-1.5 py-0.5 rounded ${
                          isArmedFor(m.id)
                            ? "bg-red-500/20 text-red-400"
                            : "text-white/20 hover:text-red-400 hover:bg-red-500/10"
                        }`}
                        title="Cancel mission"
                      >
                        {isArmedFor(m.id) ? "Confirm?" : "Cancel"}
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ═══ Three-Panel System Monitor ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Cron Jobs Panel */}
          <div className="rounded-xl border border-neon-orange/20 bg-dark-900/50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-dark-800/50">
              <div className="flex items-center gap-2">
                <ListTodo className="w-3.5 h-3.5 text-neon-orange" />
                <span className="text-xs font-mono text-white/60">Cron Jobs</span>
              </div>
              <Link href="/orchestration/cron" className="text-[10px] font-mono text-neon-orange hover:underline">
                manage →
              </Link>
            </div>
            <div className="divide-y divide-white/5">
              {monitor?.cron.jobs.length === 0 && (
                <div className="px-4 py-6 text-center text-xs text-white/30">No cron jobs</div>
              )}
              {monitor?.cron.jobs.map((job) => (
                <div key={job.id} className="px-4 py-2.5 flex items-center justify-between gap-3 min-w-0">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-white/80 truncate">{job.name}</div>
                    <div className="flex items-center gap-2 mt-0.5 min-w-0">
                      <div className="flex-shrink-0">
                        <SchedulePicker
                          value={job.schedule}
                          onChange={(v) => handleCronScheduleChange(job.id, v)}
                          compact
                        />
                      </div>
                      {job.enabled && (
                        <CronJobCaptionSpan
                          caption={cronCaptions.get(job.id) ?? null}
                        />
                      )}
                    </div>
                  </div>
                  <CronStatusBadge state={job.state} enabled={job.enabled} />
                </div>
              ))}
            </div>
          </div>

          {/* Platforms Panel */}
          <div className="rounded-xl border border-neon-cyan/20 bg-dark-900/50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-dark-800/50">
              <div className="flex items-center gap-2">
                <Globe className="w-3.5 h-3.5 text-neon-cyan" />
                <span className="text-xs font-mono text-white/60">Platforms</span>
              </div>
            </div>
            <div
              className="px-4 py-3 space-y-2"
              title="Token present in Hermes .env; gateway must be running for live messaging."
            >
              {HERMES_PLATFORMS.map((p) => {
                const configured = monitor?.gateway.platforms[p.id] ?? false;
                return (
                  <div key={p.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <StatusDot status={configured ? "online" : "idle"} pulse={configured} />
                      <span className="text-xs text-white/70 capitalize">{p.id}</span>
                    </div>
                    <span className={`text-[10px] font-mono ${configured ? "text-neon-green" : "text-white/25"}`}>
                      {configured ? "Configured" : "Not configured"}
                    </span>
                  </div>
                );
              })}
              {monitor && monitor.gateway.connectedCount === 0 && (
                <div className="text-[10px] text-white/30 text-center py-2">No platforms configured</div>
              )}
            </div>
            <div className="px-4 py-2 border-t border-white/10 flex items-center justify-between gap-2">
              <div className="text-[10px] text-white/30 font-mono flex items-center gap-2 min-w-0">
                <RefreshCw className="w-3 h-3 shrink-0" />
                {monitor?.sync.lastRun ? (
                  <>
                    Sync: {timeAgo(monitor.sync.lastRun)}
                    {monitor.sync.allSuccessful ? (
                      <span className="text-neon-green">✓</span>
                    ) : (
                      <span className="text-red-400">✗</span>
                    )}
                  </>
                ) : (
                  <span>Background sync idle</span>
                )}
              </div>
              <button
                type="button"
                disabled={syncNowBusy}
                onClick={() => void handleSyncNow()}
                className="shrink-0 px-2 py-1 text-[10px] font-mono rounded border border-neon-cyan/30 text-neon-cyan/80 hover:bg-neon-cyan/10 disabled:opacity-50"
              >
                {syncNowBusy ? "Syncing…" : "Sync now"}
              </button>
            </div>
          </div>

          {/* Errors Panel */}
          <div className="rounded-xl border border-red-500/20 bg-dark-900/50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-dark-800/50">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                <span className="text-xs font-mono text-white/60">Errors</span>
              </div>
              <div className="flex items-center gap-1">
                {(["all", "error", "warning"] as const).map((sev) => (
                  <button
                    key={sev}
                    onClick={() => selectSeverity(sev)}
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded transition-colors ${
                      errorSev === sev ? "bg-red-500/20 text-red-400" : "text-white/30 hover:text-white/60"
                    }`}
                  >
                    {titleCase(sev)}
                  </button>
                ))}
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {filteredErrors.length === 0 && (
                <div className="px-4 py-6 text-center">
                  <CheckCircle2 className="w-5 h-5 text-neon-green mx-auto mb-1" />
                  <div className="text-xs text-neon-green">No recent errors</div>
                </div>
              )}
              {filteredErrors.map((err) => (
                <div key={`${err.source}-${err.message}`} className="px-4 py-2 border-b border-white/5 last:border-0">
                  <div className="text-[10px] text-red-400/80 font-mono truncate">{err.message}</div>
                  <div className="text-[10px] text-white/20 font-mono mt-0.5">
                    {err.source} {err.timestamp && `· ${err.timestamp}`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* ═══ Running Hermes Processes ═══ */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-mono text-white/40 uppercase tracking-widest flex items-center gap-2">
              <Radio className="w-3 h-3 text-neon-purple" />
              Running Hermes Processes
              <span className="text-[10px] text-white/25 ml-1">({activeProcesses.length} Active)</span>
            </h2>
            <RefreshCw
              className="w-3 h-3 text-white/20 hover:text-white/50 cursor-pointer"
              onClick={() => { void handleRefreshProcesses(); }}
            />
          </div>
          {processes.length === 0 ? (
            <div className="rounded-xl border border-neon-purple/20 bg-dark-900/50 p-6 text-center">
              <Radio className="w-8 h-8 text-white/20 mx-auto mb-2" />
              <div className="text-xs text-white/30">No Active Processes Detected</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {processes.map((proc) => (
                <div key={proc.id} className="rounded-xl border border-neon-purple/20 bg-dark-900/50 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Radio className={`w-4 h-4 ${proc.status === "running" ? "text-neon-green pulse-glow" : "text-white/30"}`} />
                      <span className="text-sm text-white/90 font-medium truncate">{proc.name}</span>
                    </div>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                      proc.status === "running" ? "bg-neon-green/10 text-neon-green" : "bg-white/5 text-white/30"
                    }`}>
                      {titleCase(proc.status)}
                    </span>
                  </div>
                  <div className="space-y-1 text-[10px] font-mono text-white/40">
                    <div className="flex justify-between">
                      <span>Type</span>
                      <span className="text-white/60 capitalize">{proc.type}</span>
                    </div>
                    {proc.model !== "unknown" && proc.model !== "gateway" && (
                      <div className="flex justify-between">
                        <span>Model</span>
                        <span className="text-white/60">{proc.model}</span>
                      </div>
                    )}
                    {proc.turns > 0 && (
                      <div className="flex justify-between">
                        <span>Turns</span>
                        <span className="text-white/60">{proc.turns}</span>
                      </div>
                    )}
                    {proc.lastActivity && (
                      <div className="flex justify-between">
                        <span>Last activity</span>
                        <span className="text-white/60">{timeAgo(proc.lastActivity)}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ═══ Rec Room ═══ */}
        <div className="rounded-xl border border-purple-500/20 bg-dark-900/50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-dark-800/50">
            <div className="flex items-center gap-2">
              <Gamepad2 className="w-3.5 h-3.5 text-neon-purple" />
              <span className="text-xs font-mono text-white/60">Rec Room</span>
            </div>
          </div>
          <Link href="/recroom/story-weaver" className="flex items-center justify-center gap-3 py-4 hover:bg-white/[0.02] transition-colors">
            <BookOpen className="w-5 h-5 text-neon-purple" />
            <span className="text-sm font-mono text-white/60">Story Weaver</span>
          </Link>
        </div>
      </div>
      )}
    </AppPageShell>
  );
}
