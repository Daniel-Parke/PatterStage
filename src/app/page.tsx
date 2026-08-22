// ═══════════════════════════════════════════════════════════════
// Dashboard - PatterStage Home (Redesigned)
// ═══════════════════════════════════════════════════════════════
// Lean operational overview. No nav cards, no fake terminals.
// One-glance situational awareness → one-click actions.

"use client";

import { useState, useCallback, useMemo, memo as reactMemo } from "react";
import Link from "next/link";
import {
  // Dashboard icons
  Activity,
  Layers,
  Radio,
  ChevronRight,
  Gamepad2,
  BookOpen,
  AlertTriangle,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { timeAgo } from "@/lib/utils";
import { shellHeaderBarClasses } from "@/lib/theme";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import AppPageShell from "@/components/layout/AppPageShell";
import PageTitle from "@/components/layout/PageTitle";
import { StatPill, StatPillSkeleton } from "@/components/dashboard/StatPill";
import { Panel, PanelHeader } from "@/components/dashboard/Panel";
import CommandCenter from "@/components/dashboard/CommandCenter";
import { FadeIn } from "@/components/motion";
import DispatchStrip from "@/components/dashboard/DispatchStrip";
import ActiveMissionsPanel from "@/components/dashboard/ActiveMissionsPanel";
import PlatformsPanel from "@/modules/hermes/components/PlatformsPanel";
import ErrorsPanel from "@/components/dashboard/ErrorsPanel";
import ProcessesPanel from "@/components/dashboard/ProcessesPanel";
import { toastError } from "@/lib/api-fetch";
import { runMutation } from "@/lib/run-mutation";
import { toastFromResult } from "@/lib/toast-from-result";
import { dispatchMissionAction } from "@/hooks/success-message-for-dispatch";
import { isMissionActive } from "@/lib/missions/mission-board";
import { countInWindow, ACTIVE_WINDOW_MS, RECENT_WINDOW_MS } from "@/lib/session-window";
import { dedupErrors } from "@/lib/dashboard-error-dedup";
import { formatModelSubtitle } from "@/lib/dashboard-model-subtitle";
import { useTwoStepConfirm } from "@/hooks/useTwoStepConfirm";
import { useInterval } from "@/hooks/useInterval";
import { useDashboard } from "@/hooks/useDashboard";

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

export default function Dashboard() {
  // All dashboard data comes from the TanStack Query layer
  // (src/hooks/useDashboard.ts): three live queries (monitor 10s,
  // agents 15s, missions 15s) + one static bundle (status / config /
  // templates / categories / model defaults). `ready` gates the first
  // paint on the static bundle resolving; the `refetch*` callbacks let
  // the mutation handlers below re-pull a single surface after an
  // action instead of hand-merging into local state.
  const {
    status,
    monitor,
    processes,
    missions,
    config,
    templates,
    categories,
    registryAgentModelLabel,
    sessionTrend,
    ready,
    refetchMonitor,
    refetchMissions,
    refetchProcesses,
  } = useDashboard();

  // The dispatch panel's collapsed/expanded state + template grouping
  // now live inside <DispatchStrip/>; the page just hands it templates.
  const [errorSev, setErrorSev] = useState<"all" | "error" | "warning">("all");
  const [syncNowBusy, setSyncNowBusy] = useState(false);
  const { showToast, toastElement } = useToast();
  const { isArmedFor, arm, confirm } = useTwoStepConfirm({ autoDismissMs: 4000 });

  const handleSyncNow = useCallback(
    () =>
      runMutation(showToast, {
        busy: setSyncNowBusy,
        build: () => ({}),
        path: "/api/sync",
        successMsg: "Background sync completed",
        errorMsg: "Sync failed",
        onSuccess: async () => {
          await refetchMonitor();
        },
      }),
    [refetchMonitor, showToast],
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
        // Re-pull the missions query so the active-missions panel drops
        // the cancelled row (replaces the old manual fetch + setData).
        await refetchMissions();
      } catch (err) {
        toastError(showToast, err, "Failed to cancel mission");
      }
    };
    if (!isArmedFor(missionId)) {
      arm(missionId);
      return;
    }
    await confirm(doCancel);
  }, [showToast, refetchMissions, isArmedFor, arm, confirm]);

  const handleRefreshProcesses = useCallback(async () => {
    await refetchProcesses();
  }, [refetchProcesses]);

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

  // Timestamp for session-window comparisons. We DO NOT compute
  // `new Date().getTime()` directly in the render body, because that
  // would make `now` a brand-new number on every render, which in
  // turn would invalidate the `sessionWindowSubtitle`
  // `useMemo` on every render and defeat the entire purpose of the
  // memo. Instead, hold `now` in `useState` (initialised once on mount)
  // and refresh it on a 30-second `useInterval`. The values stay
  // stable for 30-second windows — close enough for a dashboard whose
  // monitor already polls every 10s.
  const [now, setNow] = useState(() => new Date().getTime());
  useInterval(() => setNow(new Date().getTime()), { ms: 30_000 });

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

  return (
    <AppPageShell variant="scanlines">
      <PageTitle title="Dashboard" />
      {/* Top Bar */}
      <div className={`${shellHeaderBarClasses} sticky top-0 z-30 justify-between gap-4 w-full`}>
        <div>
          {/* Agent Framework + Model details. The app/brand identity
              ("PatterStage · The Stage is Yours") lives in the far-left
              Sidebar logo — we don't repeat it here. This header names the
              active agent framework (Hermes today — the sole AgentRuntime
              implementation, see src/lib/runtime/types.ts) plus the model. */}
          <h1 className="text-xl font-bold tracking-tight flex items-baseline gap-2">
            <span className="text-neon-cyan text-glow-cyan">Hermes</span>
            <span className="hidden sm:inline text-[10px] font-normal font-mono text-white/40 uppercase tracking-wider">
              Agent Framework
            </span>
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
        {/* Malformed config.yaml — one actionable alert (ConfigSync sets the
            stat; the sync no longer spams the log). */}
        {monitor?.system?.configYamlError ? (
          <div className="flex items-start gap-3 rounded-xl border border-neon-orange/40 bg-neon-orange/10 px-4 py-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-neon-orange" />
            <div className="min-w-0 text-xs">
              <p className="font-semibold text-neon-orange">Hermes config.yaml cannot be parsed</p>
              <p className="mt-0.5 break-words font-mono text-neon-orange/70">{monitor.system.configYamlError}</p>
              <p className="mt-1 text-white/40">
                Config + profile syncs are paused until this is fixed. Edit <code className="text-white/60">~/.hermes/config.yaml</code> to correct the YAML.
              </p>
            </div>
          </div>
        ) : null}
        {/* ═══ Compact Stat Row ═══ */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 min-w-0">
          {monitor ? (
            <>
              <StatPill
                icon={Radio}
                label="Processes"
                value={activeProcesses.length > 0 ? `${activeProcesses.length} Active` : status?.soulFile ? "Idle" : "Offline"}
                color={activeProcesses.length > 0 ? "green" : status?.soulFile ? "cyan" : "pink"}
                href="/operations/agents"
              />
              <StatPill
                icon={Activity}
                label="Sessions"
                value={monitor.sessions.total.toLocaleString()}
                color="purple"
                subtitle={sessionWindowSubtitle}
                href="/sessions"
                trend={sessionTrend}
                trendColor="purple"
              />
              <StatPill
                icon={Layers}
                label={`Memory · ${monitor.memory.provider || "Not Installed"}`}
                value={monitor.memory.factCount >= 0 ? `${monitor.memory.factCount} facts` : "0 facts"}
                color="pink"
                href="/memory"
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
        <DispatchStrip templates={templates} categories={categories} />

        {/* ═══ Active Missions (renders nothing when none are active) ═══ */}
        <ActiveMissionsPanel
          missions={activeMissions}
          onCancel={handleCancelMission}
          isArmedFor={isArmedFor}
        />

        {/* ═══ Two-Panel System Monitor ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <PlatformsPanel
            monitor={monitor}
            syncNowBusy={syncNowBusy}
            onSyncNow={() => void handleSyncNow()}
          />
          <ErrorsPanel
            errors={filteredErrors}
            severity={errorSev}
            onSelectSeverity={selectSeverity}
          />
        </div>

        {/* ═══ Running Hermes Processes ═══ */}
        <ProcessesPanel
          processes={processes}
          onRefresh={() => void handleRefreshProcesses()}
        />

        {/* ═══ Rec Room ═══ */}
        <Panel accent="purple">
          <PanelHeader icon={Gamepad2} label="Rec Room" accent="purple" />
          <Link href="/recroom/story-weaver" className="flex items-center justify-center gap-3 py-4 hover:bg-white/[0.02] transition-colors">
            <BookOpen className="w-5 h-5 text-neon-purple" />
            <span className="text-sm font-mono text-white/60">Story Weaver</span>
          </Link>
        </Panel>

        {/* ═══ Command Center (operator stats + data-viz) — below the live monitor ═══ */}
        <FadeIn>
          <CommandCenter />
        </FadeIn>
      </div>
      )}
    </AppPageShell>
  );
}
