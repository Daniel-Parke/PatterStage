// ═══════════════════════════════════════════════════════════════
// Dashboard - PatterStage Home, the operations board
// ═══════════════════════════════════════════════════════════════
// What is happening on this machine right now, and one click into the
// surface that answers each question in full. History (the charts, the
// mission mix, the trophy case) lives on Insights (T-0099, B5). Three pills,
// one Progress line, the dispatch strip, the live panels. No clock, no Story
// Weaver card, no hero charts.
//
// Three pills, not six, since U13 (T-0127): Gateway and Memory were said as a
// pill AND as a Subsystems row that carried the reason the pill could not;
// Errors was said as a pill and as a panel. Each fact is said once, where it
// is best said, and the row is the three facts nothing else here carries.

"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { ChevronRight, Radio, Timer, Wallet, Zap } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { timeAgo } from "@/lib/utils";
import Card from "@/components/ui/Card";
import LinkButton from "@/components/ui/LinkButton";
import LoadErrorBanner from "@/components/ui/LoadErrorBanner";
import PageLoading from "@/components/ui/PageLoading";
import AppPageShell from "@/components/layout/AppPageShell";
import PageHeader from "@/components/layout/PageHeader";
import { StatPill, StatPillSkeleton } from "@/components/dashboard/StatPill";
import DispatchStrip from "@/components/dashboard/DispatchStrip";
import NextQuestCard from "@/components/dashboard/NextQuestCard";
import ProgressLine from "@/components/dashboard/ProgressLine";
import SubsystemsPanel from "@/components/dashboard/SubsystemsPanel";
import ActiveMissionsPanel from "@/components/dashboard/ActiveMissionsPanel";
import PlatformsPanel from "@/modules/hermes/components/PlatformsPanel";
import ErrorsPanel from "@/components/dashboard/ErrorsPanel";
import ProcessesPanel from "@/components/dashboard/ProcessesPanel";
import { runWrite } from "@/lib/api-write";
import { dispatchMission } from "@/hooks/success-message-for-dispatch";
import { isMissionActive } from "@/lib/missions/mission-board";
import { dedupErrors } from "@/lib/dashboard/dashboard-error-dedup";
import { describeSchedulerHealth } from "@/lib/dashboard/scheduler-pill";
import { settleFirstRunFacts, type FirstRunFacts } from "@/lib/dashboard/first-run-steps";
import { formatUsd } from "@/lib/spend/spend-law";
import { SUBSYSTEM_STATE_LABELS, statusTone } from "@/lib/status-labels";
import { statusToneClasses } from "@/lib/theme";
import { useTwoStepConfirm } from "@/hooks/useTwoStepConfirm";
import { useInterval } from "@/hooks/useInterval";
import { useDashboard } from "@/hooks/useDashboard";
import { useOperatorPrefs } from "@/hooks/useOperatorPrefs";
import { useQuestHost } from "@/hooks/useQuestHost";
import { useStats } from "@/hooks/useStats";
import { useAgentExperience } from "@/hooks/useAgentExperience";
import { useSpend } from "@/hooks/useSpend";
import { ConfigYamlErrorAlert } from "@/components/config/ConfigYamlErrorAlert";

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
    // `config` is deliberately not destructured. The header used to read
    // config.yaml's model fields here and decide for itself what they meant;
    // that verdict is resolved once on the server now and arrives as
    // `modelReadiness`. The batch still carries `config` for whatever reads it
    // next; this screen no longer needs it.
    templates,
    categories,
    modelReadiness,
    subsystems,
    ready,
    monitorError,
    monitorSettled,
    subsystemsError,
    subsystemsSettled,
    refetchMonitor,
    refetchMissions,
    refetchProcesses,
    refetchSubsystems,
  } = useDashboard();
  // The Progress line reads the stats poll the shell already makes, the
  // agents ranked by growth, and this month's spend for the Spend pill.
  const { stats, error: statsError, refetch: refetchStats } = useStats();
  const { entries: agentsByGrowth } = useAgentExperience();
  const { spend } = useSpend();
  // The Start here card: which quest is next comes off the stats poll above,
  // what this host can attempt from the three status reads, and whether the
  // operator has put the guide away from their own preferences.
  const questHost = useQuestHost();
  const { prefs, setPref } = useOperatorPrefs();
  const guideHidden = prefs["guide.hidden"] === true;
  const hideGuide = useCallback(() => setPref("guide.hidden", true), [setPref]);

  // The dispatch panel's collapsed/expanded state + template grouping
  // now live inside <DispatchStrip/>; the page just hands it templates.
  const [errorSev, setErrorSev] = useState<"all" | "error" | "warning">("all");
  const [syncNowBusy, setSyncNowBusy] = useState(false);
  const { showToast, toastElement } = useToast();
  const { isArmedFor, arm, confirm: confirmArmed } = useTwoStepConfirm({ autoDismissMs: 4000 });

  const handleSyncNow = useCallback(
    () =>
      runWrite({
        setBusy: setSyncNowBusy,
        showToast,
        url: "/api/sync",
        body: {},
        successMessage: "Background sync completed",
        errorMessage: "Sync failed",
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
  // The row already shows "Confirm?" through `isArmedFor`, so the cancel
  // carries no busy state of its own; the missions query is re-pulled so the
  // active-missions panel drops the cancelled row.
  const handleCancelMission = useCallback(async (missionId: string, missionName: string) => {
    const doCancel = async () => {
      await dispatchMission("cancel", { missionId }, {
        showToast,
        successMessage: `Cancelled "${missionName}"`,
        errorMessage: "Failed to cancel mission",
      });
      await refetchMissions();
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

  // Header subtitle: the label from the one readiness answer the server
  // resolved. The ladder that used to live here (config file, then the models
  // registry, then a dash) is that answer's own rule now, so the dashboard,
  // chat and the Models page all say the same thing about the same install
  // instead of each combining the same two facts differently.
  const modelSubtitle = modelReadiness?.label ?? "-";
  // Is there actually an agent behind this control plane? `framework.available`
  // is the adapter's own answer (the DB-owned registry probes the install), and
  // `undefined` means the monitor could not tell — which is not the same as
  // "absent", so only an explicit `false` counts as not configured.
  const agentName = monitor?.framework?.name ?? "Hermes";
  const agentConfigured = monitor?.framework?.available !== false;

  const gatewayRow = subsystems?.subsystems.find((s) => s.id === "gateway") ?? null;
  const gatewayReachable = gatewayRow?.state === "ok";
  // The Start here card waits for both reads before it speaks, and the
  // header's agent badge reads a gateway that has answered ONCE as reachable:
  // the story used to change twice while loading and flip on a single failed
  // probe (T-0099, D57). The Subsystems panel is deliberately not latched — it
  // reports the check that was actually just made, "Checking…" and a failed
  // check included, which is the other half of the same ruling.
  const readingsSettled = monitorSettled && subsystemsSettled;
  const rawFirstRunFacts = useMemo<FirstRunFacts>(
    () => ({
      frameworkName: agentName,
      frameworkAvailable: agentConfigured,
      gatewayReachable,
      gatewayUrl: gatewayRow?.url ?? null,
      modelConfigured: modelReadiness?.ready === true,
      sessionCount: monitor?.sessions.total ?? 0,
      missionCount: missions.length,
    }),
    [agentName, agentConfigured, gatewayReachable, gatewayRow?.url, modelReadiness, monitor?.sessions.total, missions.length],
  );
  // The previous reading is state, settled during render the way React
  // documents for "information from previous renders": one guarded setState,
  // no ref read in render, no effect lag on the first paint.
  const [latched, setLatched] = useState<{ raw: FirstRunFacts; settled: FirstRunFacts } | null>(null);
  if (!latched || latched.raw !== rawFirstRunFacts) {
    setLatched({ raw: rawFirstRunFacts, settled: settleFirstRunFacts(latched?.settled ?? null, rawFirstRunFacts) });
  }
  const settledFacts = latched?.settled ?? rawFirstRunFacts;
  const gatewaySettledReachable = settledFacts.gatewayReachable === true;
  // The badge's word and tone are the Subsystems row's own, so the header
  // cannot say ONLINE beside a row that says Not running (T-0132).
  const gatewayWord = gatewayRow ? SUBSYSTEM_STATE_LABELS[gatewayRow.state] : null;
  const gatewayToneClasses = gatewayWord ? statusToneClasses[statusTone(gatewayWord)] : null;

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

  const monthSpend = spend?.periods.find((p) => p.period === "month") ?? null;
  const errorCount = monitor?.errors.length ?? 0;

  return (
    <AppPageShell
      variant="scanlines"
      header={
        <PageHeader
          icon={Zap}
          // No title prop: the registry row that draws the rail entry is what
          // names the h1, so the two cannot drift (T-0097, D55). It used to read
          // "Hermes AGENT FRAMEWORK", which names the dependency rather than the
          // place, on the one screen that painted its own bar. The app's own
          // identity ("PatterStage · The Stage is Yours") lives in the far-left
          // Sidebar logo; we do not repeat it here.
          subtitle={`${agentName} · ${modelSubtitle}`}
          color="cyan"
          actions={
            /* The badge used to be a hardcoded green ONLINE, sitting directly
               under the agent-framework heading. On an install with no agent it
               claimed the agent was up. It then reported what the monitor found:
               ONLINE for PatterStage's own server, which nobody doubts, beside a
               Subsystems row reading "Gateway · Not running" (the review of
               2026-09-08). A fact is said once, where it is best said (T-0127):
               the badge carries the gateway row's own word and tone, with the
               row's reason as its tooltip, so the two cannot disagree; a blip
               shows in both places for one poll, consistently. NOT INSTALLED
               stays for the install with no agent and no reachable gateway,
               which is the first run's fact and is read from the settled facts
               so one failed probe cannot claim the agent is absent (D57,
               T-0132). */
            !agentConfigured && !gatewaySettledReachable ? (
              <div className="flex items-center gap-2" title={`${agentName} is not installed on this machine`}>
                <div className="w-2 h-2 rounded-full bg-neon-orange" />
                <span className="text-micro text-neon-orange font-mono">NOT INSTALLED</span>
              </div>
            ) : gatewayRow && gatewayWord && gatewayToneClasses ? (
              <div className="flex items-center gap-2" title={gatewayRow.reason}>
                <div className={`w-2 h-2 rounded-full ${gatewayToneClasses.dot}`} />
                <span className={`text-micro font-mono ${gatewayToneClasses.text}`}>Gateway · {gatewayWord}</span>
              </div>
            ) : null
          }
        />
      }
    >
      {toastElement}

      {/* The loading contract (T-0122): the header is drawn above, and the body
          holds its shape as a skeleton rather than a spinner in a void. */}
      {!ready ? (
        <PageLoading label="Loading the dashboard" rows={5} rowClassName="h-24" />
      ) : (
        <div className="space-y-6">
        {/* Start here: the next quest, before the widgets. Renders nothing once
            every quest is done or the operator has hidden the guide, and
            nothing at all until both reads it depends on have answered — a
            card that speaks before the monitor and the subsystems have settled
            is D57 again (T-0099). */}
        {readingsSettled && (
          <NextQuestCard
            quests={stats?.quests}
            host={questHost}
            hidden={guideHidden}
            onHide={hideGuide}
          />
        )}
        {/* Malformed config.yaml — one actionable alert (ConfigSync sets the
            stat; the sync no longer spams the log). */}
        {monitor?.system?.configYamlError ? (
          <ConfigYamlErrorAlert message={monitor.system.configYamlError} />
        ) : null}
        {/* Is each thing this product depends on up, and why not (T-0091). */}
        <SubsystemsPanel
          subsystems={subsystems?.subsystems ?? null}
          checkedAt={subsystems?.checkedAt ?? null}
          error={subsystemsSettled ? subsystemsError : null}
          onRetry={() => void refetchSubsystems()}
        />

        {/* ═══ Three pills: scheduler, spend, processes ═══
            The facts the Subsystems panel above and the Errors panel below do
            not carry. Three states for the monitor they hang off: not yet
            (skeletons), failed (an alert with Retry, never skeletons forever),
            here. At three across, the subtext has room; at six it clipped. */}
        {monitor ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 min-w-0">
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
              subtitle={activeProcesses.length > 0 ? "running now" : "nothing running"}
              href="/agent/profiles"
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 min-w-0">
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
        <Card as="section" padding="none" className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <div className="text-micro font-mono text-ps-text-muted uppercase tracking-wider">
              Continue work
            </div>
            <div className="text-body text-ps-text-primary mt-1">
              {monitor?.sessions?.recent?.[0] ? (
                <>
                  Latest session {timeAgo(monitor.sessions.recent[0].modified)}{" "}
                  <Link
                    href={"/results/sessions/" + monitor.sessions.recent[0].id}
                    className="text-neon-cyan hover:underline font-mono text-micro"
                  >
                    open transcript
                  </Link>
                </>
              ) : (
                "No sessions yet — run a mission or use Hermes chat."
              )}
            </div>
          </div>
          <LinkButton href="/results/sessions" variant="ghost" color="purple" size="sm">
            Session browser
            <ChevronRight className="h-3 w-3" aria-hidden="true" />
          </LinkButton>
        </Card>

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
            count={errorCount}
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
