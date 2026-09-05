// ═══════════════════════════════════════════════════════════════
// Dashboard - PatterStage Home, the operations board
// ═══════════════════════════════════════════════════════════════
// What is happening on this machine right now, and one click into the
// surface that answers each question in full. History (the charts, the
// mission mix, the trophy case) lives on Insights (T-0099, B5). Six pills, one
// Progress line, the dispatch strip, the live panels. No clock, no Story
// Weaver card, no hero charts.

"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ChevronRight,
  Globe,
  Layers,
  Radio,
  Timer,
  Wallet,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { timeAgo } from "@/lib/utils";
import { shellHeaderBarClasses } from "@/lib/theme";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import LoadErrorBanner from "@/components/ui/LoadErrorBanner";
import AppPageShell from "@/components/layout/AppPageShell";
import PageTitle from "@/components/layout/PageTitle";
import HelpLink from "@/components/help/HelpLink";
import { StatPill, StatPillSkeleton } from "@/components/dashboard/StatPill";
import DispatchStrip from "@/components/dashboard/DispatchStrip";
import FirstRunPanel from "@/components/dashboard/FirstRunPanel";
import ProgressLine from "@/components/dashboard/ProgressLine";
import SubsystemsPanel from "@/components/dashboard/SubsystemsPanel";
import ActiveMissionsPanel from "@/components/dashboard/ActiveMissionsPanel";
import PlatformsPanel from "@/modules/hermes/components/PlatformsPanel";
import ErrorsPanel from "@/components/dashboard/ErrorsPanel";
import ProcessesPanel from "@/components/dashboard/ProcessesPanel";
import { toastError } from "@/lib/api-fetch";
import { runMutation } from "@/lib/run-mutation";
import { toastFromResult } from "@/lib/dashboard/toast-from-result";
import { dispatchMissionAction } from "@/hooks/success-message-for-dispatch";
import { isMissionActive } from "@/lib/missions/mission-board";
import { dedupErrors } from "@/lib/dashboard/dashboard-error-dedup";
import { describeSchedulerHealth } from "@/lib/dashboard/scheduler-pill";
import { formatModelSubtitle } from "@/lib/dashboard/dashboard-model-subtitle";
import { settleFirstRunFacts, type FirstRunFacts } from "@/lib/dashboard/first-run-steps";
import { SUBSYSTEM_STATE_LABELS } from "@/lib/status-labels";
import { formatUsd } from "@/lib/spend/spend-law";
import type { SubsystemRow } from "@/lib/status/subsystems";
import type { AccentColor } from "@/types/console";
import { useTwoStepConfirm } from "@/hooks/useTwoStepConfirm";
import { useInterval } from "@/hooks/useInterval";
import { useDashboard } from "@/hooks/useDashboard";
import { useStats } from "@/hooks/useStats";
import { useAgentExperience } from "@/hooks/useAgentExperience";
import { useSpend } from "@/hooks/useSpend";
import { ConfigYamlErrorAlert } from "@/components/config/ConfigYamlErrorAlert";

const STATE_COLOR: Record<SubsystemRow["state"], AccentColor> = {
  ok: "green",
  degraded: "orange",
  down: "pink",
};

/**
 * A subsystem row as a pill: the ratified word for its state, in its colour.
 * A row that has not been read yet is "Checking…" and a check that failed is
 * "Unknown"; neither is green, because nothing on this board is green until
 * it has actually been read (T-0099, D57).
 */
function subsystemPill(
  row: SubsystemRow | null,
  answered: boolean,
  checkError: string | null,
): { value: string; color: AccentColor } {
  if (row) return { value: SUBSYSTEM_STATE_LABELS[row.state], color: STATE_COLOR[row.state] };
  if (!answered && !checkError) return { value: "Checking…", color: "cyan" };
  return { value: "Unknown", color: "orange" };
}

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
    subsystems,
    ready,
    monitorError,
    monitorSettled,
    subsystemsError,
    subsystemsSettled,
    refetchMonitor,
    refetchMissions,
    refetchProcesses,
  } = useDashboard();
  // The Progress line reads the stats poll the shell already makes, the
  // agents ranked by growth, and this month's spend for the Spend pill.
  const { stats, error: statsError, refetch: refetchStats } = useStats();
  const { entries: agentsByGrowth } = useAgentExperience();
  const { spend } = useSpend();

  // The dispatch panel's collapsed/expanded state + template grouping
  // now live inside <DispatchStrip/>; the page just hands it templates.
  const [errorSev, setErrorSev] = useState<"all" | "error" | "warning">("all");
  const [syncNowBusy, setSyncNowBusy] = useState(false);
  const { showToast, toastElement } = useToast();
  const { isArmedFor, arm, confirm: confirmArmed } = useTwoStepConfirm({ autoDismissMs: 4000 });

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
    // dedupErrors (src/lib/dashboard/dashboard-error-dedup.ts) — see that file
    // for the full rationale (gateway-reconnect errors that log the
    // same line every few minutes would otherwise dominate the
    // panel).
    return dedupErrors(filtered);
  }, [monitor, errorSev]);

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
        // The route returns `{ mission, cancel: { accepted, processKillPending } }`;
        // dispatchMissionAction owns the wire call and the envelope type.
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
    await confirmArmed(doCancel);
  }, [showToast, refetchMissions, isArmedFor, arm, confirmArmed]);

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
  // (src/lib/dashboard/dashboard-model-subtitle.ts) so the rule is
  // unit-testable in isolation.
  const modelSubtitle = useMemo(
    () => formatModelSubtitle(diskModel, diskProvider, registryAgentModelLabel),
    [diskModel, diskProvider, registryAgentModelLabel],
  );
  // Is there actually an agent behind this control plane? `framework.available`
  // is the adapter's own answer (the DB-owned registry probes the install), and
  // `undefined` means the monitor could not tell — which is not the same as
  // "absent", so only an explicit `false` counts as not configured.
  const agentName = monitor?.framework?.name ?? "Hermes";
  const agentConfigured = monitor?.framework?.available !== false;

  const gatewayRow = subsystems?.subsystems.find((s) => s.id === "gateway") ?? null;
  const memoryRow = subsystems?.subsystems.find((s) => s.id === "memory") ?? null;
  const gatewayReachable = gatewayRow?.state === "ok";
  // The checklist waits for both reads before it speaks, and a gateway that
  // has answered once stays reachable for it: the headline used to change
  // its story twice while loading and flip on a blip (T-0099, D57).
  const readingsSettled = monitorSettled && subsystemsSettled;
  const rawFirstRunFacts = useMemo<FirstRunFacts>(
    () => ({
      frameworkName: agentName,
      frameworkAvailable: agentConfigured,
      gatewayReachable,
      gatewayUrl: gatewayRow?.url ?? null,
      modelConfigured: Boolean(diskModel || registryAgentModelLabel),
      sessionCount: monitor?.sessions.total ?? 0,
      missionCount: missions.length,
    }),
    [agentName, agentConfigured, gatewayReachable, gatewayRow?.url, diskModel, registryAgentModelLabel, monitor?.sessions.total, missions.length],
  );
  // The previous reading is state, settled during render the way React
  // documents for "information from previous renders": one guarded setState,
  // no ref read in render, no effect lag on the first paint.
  const [latched, setLatched] = useState<{ raw: FirstRunFacts; settled: FirstRunFacts } | null>(null);
  if (!latched || latched.raw !== rawFirstRunFacts) {
    setLatched({ raw: rawFirstRunFacts, settled: settleFirstRunFacts(latched?.settled ?? null, rawFirstRunFacts) });
  }
  const firstRunFacts = latched?.settled ?? rawFirstRunFacts;

  const activeProcesses = useMemo(() => processes.filter((p) => p.status === "running"), [processes]);
  const activeMissions = useMemo(
    () => missions.filter(isMissionActive),
    [missions],
  );

  // Timestamp for the scheduler pill's tick age and the Progress line's
  // "next automation". Held in state and refreshed every 30 seconds rather
  // than read in the render body, so the memos below stay stable between
  // ticks; the monitor already polls every 10s.
  const [now, setNow] = useState(() => new Date().getTime());
  useInterval(() => setNow(new Date().getTime()), { ms: 30_000 });

  // The background scheduler's heartbeat, which the console previously threw
  // away: a stalled loop is why a schedule did not fire and why a dispatched
  // mission never resolves.
  const schedulerPill = useMemo(
    () => describeSchedulerHealth(monitor?.scheduler, now),
    [monitor?.scheduler, now],
  );

  const gatewayPill = subsystemPill(gatewayRow, subsystemsSettled, subsystemsError);
  const memoryPill = subsystemPill(memoryRow, subsystemsSettled, subsystemsError);
  const monthSpend = spend?.periods.find((p) => p.period === "month") ?? null;
  const errorCount = monitor?.errors.length ?? 0;

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
            {/* The framework's name from the frameworks row, not a literal (T-0097, D56). */}
            <span className="text-neon-cyan text-glow-cyan">{agentName}</span>
            <span className="hidden sm:inline text-xs font-normal font-mono text-ps-text-muted uppercase tracking-wider">
              Agent Framework
            </span>
          </h1>
          <p className="text-xs text-ps-text-muted font-mono">{modelSubtitle}</p>
        </div>
        {/* The dashboard paints its own header bar instead of rendering
            PageHeader, so it is the one screen that has to hang the ? itself.
            Leaving it off would put the guide on every screen but the first
            one an operator ever sees. */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* The badge used to be a hardcoded green ONLINE, sitting directly
              under the agent-framework heading. On an install with no agent it
              claimed the agent was up. It now reports what the monitor actually
              found. */}
          {agentConfigured ? (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-neon-green pulse-glow" />
              <span className="text-xs text-ps-text-secondary font-mono">ONLINE</span>
            </div>
          ) : (
            gatewayReachable ? (
              <div className="flex items-center gap-2" title={`${agentName} runs through the gateway at ${gatewayRow?.url ?? "the configured address"}`}>
                <div className="w-2 h-2 rounded-full bg-neon-cyan" />
                <span className="text-xs text-neon-cyan font-mono">REMOTE</span>
              </div>
            ) : (
            <div className="flex items-center gap-2" title={`${agentName} is not installed on this machine`}>
              <div className="w-2 h-2 rounded-full bg-neon-orange" />
              <span className="text-xs text-neon-orange font-mono">NOT INSTALLED</span>
            </div>
            )
          )}
          <HelpLink />
        </div>
      </div>
      {toastElement}

      {!ready ? (
        <div className="flex items-center justify-center min-h-[60vh]">
          <LoadingSpinner text="Loading dashboard..." />
        </div>
      ) : (
        <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* First run: an empty install gets a checklist before it gets widgets.
            Renders nothing once there is an agent and any activity, and
            nothing at all until both reads it depends on have answered. */}
        {readingsSettled && <FirstRunPanel facts={firstRunFacts} />}
        {/* Malformed config.yaml — one actionable alert (ConfigSync sets the
            stat; the sync no longer spams the log). */}
        {monitor?.system?.configYamlError ? (
          <ConfigYamlErrorAlert message={monitor.system.configYamlError} />
        ) : null}
        {/* Is each thing this product depends on up, and why not (T-0091). */}
        <SubsystemsPanel subsystems={subsystems?.subsystems ?? null} checkedAt={subsystems?.checkedAt ?? null} />

        {/* ═══ Six pills: gateway, memory, scheduler, spend, processes, errors ═══
            Three states for the monitor they hang off: not yet (skeletons),
            failed (an alert with Retry, never skeletons forever), here. */}
        {monitor ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 min-w-0">
            <StatPill
              icon={Globe}
              label="Gateway"
              value={gatewayPill.value}
              color={gatewayPill.color}
              subtitle={gatewayRow?.url ?? gatewayRow?.reason ?? (subsystemsError ? "check failed" : undefined)}
              href="/agent/settings/system"
            />
            <StatPill
              icon={Layers}
              label="Memory"
              value={memoryPill.value}
              color={memoryPill.color}
              subtitle={`${Math.max(0, monitor.memory.factCount)} facts · ${monitor.memory.provider || "no provider"}`}
              href="/agent/memory"
            />
            <StatPill
              icon={Timer}
              label="Scheduler"
              value={schedulerPill.value}
              color={schedulerPill.color}
              subtitle={schedulerPill.subtitle}
              href="/agent/settings/system"
            />
            <StatPill
              icon={Wallet}
              label="Spend"
              value={monthSpend ? formatUsd(monthSpend.totalUsd) : "—"}
              color="yellow"
              subtitle="this month"
              href="/results/insights"
            />
            <StatPill
              icon={Radio}
              label="Processes"
              value={activeProcesses.length > 0 ? `${activeProcesses.length} Active` : status?.soulFile ? "Idle" : "Offline"}
              color={activeProcesses.length > 0 ? "green" : status?.soulFile ? "cyan" : "pink"}
              href="/agent/profiles"
            />
            <StatPill
              icon={AlertTriangle}
              label="Errors"
              value={String(errorCount)}
              color={errorCount > 0 ? "pink" : "green"}
              subtitle={errorCount === 1 ? "recent error" : "recent errors"}
              href="/results/logs"
            />
          </div>
        ) : monitorError ? (
          <LoadErrorBanner
            error={`Couldn't read monitor data: ${monitorError}`}
            onRetry={() => void refetchMonitor()}
            hint="The pills read from /api/monitor. Nothing here is shown until it answers."
            className="mb-0"
          />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 min-w-0">
            <StatPillSkeleton />
            <StatPillSkeleton />
            <StatPillSkeleton />
            <StatPillSkeleton />
            <StatPillSkeleton />
            <StatPillSkeleton />
          </div>
        )}

        {/* ═══ Progress: streak, level, achievements, next automation, Quests ═══ */}
        <ProgressLine
          stats={stats ?? null}
          statsError={statsError}
          onRetryStats={() => void refetchStats()}
          topAgent={agentsByGrowth[0] ?? null}
          now={now}
        />

        {/* ═══ Handoff / continuation ═══ */}
        <div className="rounded-xl border border-white/10 bg-dark-900/40 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-mono text-ps-text-muted uppercase tracking-wider">
              Continue work
            </div>
            <div className="text-sm text-ps-text-primary mt-1">
              {monitor?.sessions?.recent?.[0] ? (
                <>
                  Latest session {timeAgo(monitor.sessions.recent[0].modified)}{" "}
                  <Link
                    href={"/results/sessions/" + monitor.sessions.recent[0].id}
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
            href="/results/sessions"
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
      </div>
      )}
    </AppPageShell>
  );
}
