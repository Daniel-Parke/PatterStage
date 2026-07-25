// ═══════════════════════════════════════════════════════════════
// Insights — interaction analytics + achievements
//
// A user-facing read-model over the analytics_events log (via /api/analytics)
// plus the derived stats (/api/stats): activity over time, a per-category
// breakdown, the level/streak/milestone strip, and the full achievement grid.
// Read-only — the unlock toast lives on the dashboard (CommandCenter), so this
// page intentionally does NOT use useAchievementUnlocks.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  BarChart3, Sparkles, Activity, CalendarRange, Rocket, Clock,
  Timer, Cpu, TrendingUp, Info,
} from "lucide-react";

import PageHeader from "@/components/layout/PageHeader";
import LoadErrorBanner from "@/components/ui/LoadErrorBanner";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import {
  AreaTrend, ActivityHeatmap, Donut, RadialActivityClock,
  DistributionHistogram, TopList, StackedAreaTrend,
} from "@/components/viz";
import { neonAlpha, type NeonColor } from "@/components/viz/colors";
import { AchievementShowcase, StreakFlame } from "@/components/achievements";
import { Stagger, StaggerItem } from "@/components/motion";
import { useStats } from "@/hooks/useStats";
import { useAnalytics, useAnalyticsTimeseries, useInsights } from "@/hooks/useAnalytics";
import { categoryForEventType } from "@/lib/analytics/categories";

const RANGES = [7, 30, 90] as const;

function compactNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}k`;
  return String(Math.round(n));
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-dark-900/60 p-4 ${className}`}>
      {children}
    </div>
  );
}

function CardTitle({ icon: Icon, hint, children }: { icon: React.ComponentType<{ className?: string }>; hint?: string; children: ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <Icon className="h-4 w-4 text-neon-cyan" />
      <h2 className="text-xs font-mono uppercase tracking-widest text-white/50">{children}</h2>
      {hint ? (
        <span title={hint} aria-label={hint} className="ml-0.5 cursor-help text-white/25 transition-colors hover:text-white/60">
          <Info className="h-3 w-3" />
        </span>
      ) : null}
    </div>
  );
}

function MetricTile({ label, value, color = "cyan" }: { label: string; value: string; color?: NeonColor }) {
  return (
    <div className="rounded-xl border border-white/10 bg-dark-900/40 p-3" style={{ boxShadow: `inset 0 0 18px ${neonAlpha(color, 5)}` }}>
      <div className="font-mono text-2xl font-bold text-white">{value}</div>
      <div className="mt-0.5 text-[11px] uppercase tracking-wider text-white/40">{label}</div>
    </div>
  );
}

export default function InsightsPage() {
  const [days, setDays] = useState<number>(30);
  const { stats, isLoading: statsLoading, error: statsError, refetch: refetchStats } = useStats();
  const { summary, error: summaryError, refetch: refetchSummary } = useAnalytics();
  const { points } = useAnalyticsTimeseries(undefined, days);
  const { insights, error: insightsError } = useInsights(days);

  const totalEvents = useMemo(
    () => Object.values(summary?.totals ?? {}).reduce((a, b) => a + b, 0),
    [summary],
  );

  const segments = useMemo(() => {
    const byCat = new Map<string, { value: number; color: NeonColor }>();
    for (const [type, count] of Object.entries(summary?.totals ?? {})) {
      const cat = categoryForEventType(type);
      if (!cat) continue;
      const prev = byCat.get(cat.label);
      byCat.set(cat.label, { value: (prev?.value ?? 0) + count, color: cat.color });
    }
    return [...byCat.entries()].map(([label, v]) => ({ label, value: v.value, color: v.color }));
  }, [summary]);

  const areaData = useMemo(() => points.map((p) => ({ date: p.date, completed: p.value })), [points]);

  const estSpend = useMemo(
    () => (insights?.modelUsage ?? []).reduce((s, m) => s + m.costUsd, 0),
    [insights],
  );

  const error = statsError ?? summaryError ?? insightsError;
  const achievements = stats?.achievements ?? [];
  const unlocked = achievements.filter((a) => a.unlocked).length;

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        icon={BarChart3}
        title="Insights"
        subtitle="Interaction analytics & achievements"
        color="cyan"
        actions={
          <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-dark-900/60 p-0.5">
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setDays(r)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-mono transition-colors ${
                  days === r ? "bg-neon-cyan/20 text-neon-cyan" : "text-white/40 hover:text-white/70"
                }`}
              >
                {r}d
              </button>
            ))}
          </div>
        }
      />

      <div className="flex-1 space-y-4 overflow-y-auto p-6">
        {error && (
          <LoadErrorBanner
            error={error}
            onRetry={() => {
              refetchStats();
              refetchSummary();
            }}
            hint="Analytics start empty and fill in as you use PatterStage."
          />
        )}

        {!stats && statsLoading ? (
          <LoadingSpinner text="Loading insights…" />
        ) : (
          <>
            {/* ── First-run nudge (analytics start empty) ── */}
            {!error && stats && totalEvents === 0 && (
              <div className="rounded-2xl border border-neon-cyan/20 bg-dark-900/60 p-6 text-center" style={{ boxShadow: `0 0 24px ${neonAlpha("cyan", 6)}` }}>
                <Sparkles className="mx-auto h-6 w-6 text-neon-cyan" />
                <h2 className="mt-2 text-sm font-semibold text-white/85">No activity yet</h2>
                <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-white/50">
                  Dispatch a mission, write a Story Weaver chapter, or fire a schedule — your
                  interaction analytics and achievements will start filling in here.
                </p>
                <Link
                  href="/orchestration/missions"
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-neon-cyan/40 px-3 py-1.5 text-xs font-mono text-neon-cyan transition-colors hover:bg-neon-cyan/10"
                >
                  <Rocket className="h-3.5 w-3.5" /> Go to Missions
                </Link>
              </div>
            )}

            {/* ── Streak / headline metrics ──
                ADR-0004: the global operator LevelBadge is gone. A level belongs
                to a Body (an agent profile), not to the person clicking; each
                agent's level is on the Benchmarks leaderboard beside its rating. */}
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
                <div className="flex items-center gap-5">
                  {stats && <StreakFlame current={stats.streak.current} longest={stats.streak.longest} />}
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  <MetricTile label="Interactions" value={totalEvents.toLocaleString()} color="cyan" />
                  <MetricTile label={`Active days (${days}d)`} value={String(summary?.activeDays ?? 0)} color="green" />
                  <MetricTile label="Tokens" value={compactNum(stats?.runs.totalTokens ?? 0)} color="yellow" />
                  <MetricTile label="Est. spend" value={`$${estSpend.toFixed(2)}`} color="pink" />
                  <MetricTile label="Achievements" value={`${unlocked}/${achievements.length}`} color="orange" />
                </div>
              </div>
            </Card>

            <Stagger className="space-y-4">
              {/* ── Activity by category (stacked) + breakdown ── */}
              <StaggerItem>
                <div className="grid gap-4 lg:grid-cols-3">
                  <Card className="lg:col-span-2">
                    <CardTitle icon={Activity} hint="Daily volume of recorded events per category over the selected range. Colours match the legend below.">Activity by category — last {days} days</CardTitle>
                    {insights && insights.categoryDaily.some((d) => Object.values(d.values).some((v) => v > 0)) ? (
                      <>
                        <StackedAreaTrend data={insights.categoryDaily} series={insights.categorySeries} height={150} />
                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                          {insights.categorySeries.map((s) => (
                            <span key={s.key} className="flex items-center gap-1.5 text-[10px] text-white/50">
                              <span className="h-2 w-2 rounded-sm" style={{ background: neonAlpha(s.color, 90) }} />
                              {s.label}
                            </span>
                          ))}
                        </div>
                      </>
                    ) : (
                      <AreaTrend data={areaData} color="cyan" height={150} />
                    )}
                  </Card>

                  <Card>
                    <CardTitle icon={BarChart3} hint="All-time share of recorded interaction events, grouped by category.">By category (all-time)</CardTitle>
                    <div className="flex items-center gap-4">
                      <Donut segments={segments} size={120} center={totalEvents.toLocaleString()} centerSub="events" />
                      <ul className="flex-1 space-y-1.5">
                        {segments.length === 0 && (
                          <li className="text-xs text-white/40">No activity recorded yet.</li>
                        )}
                        {segments.map((s) => (
                          <li key={s.label} className="flex items-center justify-between gap-2 text-xs">
                            <span className="flex items-center gap-2 text-white/70">
                              <span className="h-2 w-2 rounded-full" style={{ background: neonAlpha(s.color, 90) }} />
                              {s.label}
                            </span>
                            <span className="font-mono text-white/50">{s.value.toLocaleString()}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </Card>
                </div>
              </StaggerItem>

              {/* ── Hour-of-day clock + run-duration distribution + success trend ── */}
              <StaggerItem>
                <div className="grid gap-4 lg:grid-cols-3">
                  <Card>
                    <CardTitle icon={Clock} hint="Which hours of the day you are most active (all-time). A longer spoke = more activity in that hour.">When you work (hour of day)</CardTitle>
                    <div className="mx-auto h-44 w-44">
                      <RadialActivityClock hours={insights?.hourOfDay ?? new Array(24).fill(0)} color="cyan" />
                    </div>
                  </Card>
                  <Card>
                    <CardTitle icon={Timer} hint="How long agent runs take, bucketed (e.g. <5s, 5–15s, …). Taller bars = more runs in that range.">Run duration</CardTitle>
                    <DistributionHistogram bins={insights?.durationBuckets ?? []} color="purple" height={150} />
                  </Card>
                  <Card>
                    <CardTitle icon={TrendingUp} hint="Completed vs failed missions per day over the selected range.">Mission success trend</CardTitle>
                    <AreaTrend data={insights?.successTrend ?? []} color="green" failColor="pink" height={150} />
                    <div className="mt-2 flex gap-3 text-[10px] text-white/50">
                      <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-neon-green" />completed</span>
                      <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-neon-pink" />failed</span>
                    </div>
                  </Card>
                </div>
              </StaggerItem>

              {/* ── Per-model spend + top missions ── */}
              <StaggerItem>
                <div className="grid gap-4 lg:grid-cols-2">
                  <Card>
                    <CardTitle icon={Cpu} hint="Total tokens used per model over the range, with estimated cost.">Tokens by model</CardTitle>
                    <TopList
                      color="orange"
                      rows={(insights?.modelUsage ?? []).map((m) => ({
                        label: m.model,
                        value: m.totalTokens,
                        sub: `$${m.costUsd.toFixed(2)}`,
                      }))}
                      format={compactNum}
                    />
                  </Card>
                  <Card>
                    <CardTitle icon={Rocket} hint="Your most-run missions over the range, by number of runs.">Top missions</CardTitle>
                    <TopList
                      color="cyan"
                      rows={(insights?.topMissions ?? []).map((m) => ({
                        label: m.name,
                        value: m.runs,
                        sub: `${compactNum(m.totalTokens)} tok`,
                      }))}
                      format={(v) => `${v} run${v === 1 ? "" : "s"}`}
                    />
                  </Card>
                </div>
              </StaggerItem>

              {/* ── Run activity heatmap ── */}
              <StaggerItem>
                <Card>
                  <div className="mb-3 flex items-center gap-2">
                    <CalendarRange className="h-4 w-4 text-neon-cyan" />
                    <h2 className="text-xs font-mono uppercase tracking-widest text-white/50">Run activity — last 91 days</h2>
                    {(() => {
                      const pts = stats?.runActivity ?? [];
                      const activeDays = pts.filter((p) => p.value > 0).length;
                      const totalRuns = pts.reduce((sum, p) => sum + p.value, 0);
                      return (
                        <span className="ml-auto text-[10px] font-mono text-white/30" title="Days with at least one run · total runs in the window">
                          {activeDays} active {activeDays === 1 ? "day" : "days"} · {totalRuns} run{totalRuns === 1 ? "" : "s"}
                        </span>
                      );
                    })()}
                  </div>
                  <ActivityHeatmap data={stats?.runActivity ?? []} color="green" />
                </Card>
              </StaggerItem>
            </Stagger>

            {/* ── Achievements (compact trophy case; expands to full grid) ── */}
            <AchievementShowcase achievements={achievements} />
          </>
        )}
      </div>
    </div>
  );
}
