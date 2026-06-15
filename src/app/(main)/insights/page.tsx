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

import { useMemo, type ReactNode } from "react";
import Link from "next/link";
import { BarChart3, Trophy, Flame, Sparkles, Activity, CalendarRange, Rocket } from "lucide-react";

import PageHeader from "@/components/layout/PageHeader";
import LoadErrorBanner from "@/components/ui/LoadErrorBanner";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { AreaTrend, ActivityHeatmap, Donut } from "@/components/viz";
import { neonAlpha, type NeonColor } from "@/components/viz/colors";
import { AchievementBadge, LevelBadge, StreakFlame } from "@/components/achievements";
import { useStats } from "@/hooks/useStats";
import { useAnalytics, useAnalyticsTimeseries } from "@/hooks/useAnalytics";
import type { AnalyticsEventType } from "@/lib/analytics/event-types";

// Group the 14 event types into 6 readable categories for the breakdown ring.
const CATEGORY: Record<AnalyticsEventType, { cat: string; color: NeonColor }> = {
  "mission.dispatched": { cat: "Missions", color: "cyan" },
  "mission.completed": { cat: "Missions", color: "cyan" },
  "mission.failed": { cat: "Missions", color: "cyan" },
  "story.created": { cat: "Stories", color: "purple" },
  "story.chapter_generated": { cat: "Stories", color: "purple" },
  "story.completed": { cat: "Stories", color: "purple" },
  "session.started": { cat: "Sessions", color: "green" },
  "session.closed": { cat: "Sessions", color: "green" },
  "schedule.created": { cat: "Automation", color: "orange" },
  "schedule.fired": { cat: "Automation", color: "orange" },
  "skill.toggled": { cat: "Config", color: "pink" },
  "personality.changed": { cat: "Config", color: "pink" },
  "model.configured": { cat: "Config", color: "pink" },
  "chat.message_sent": { cat: "Chat", color: "yellow" },
};

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-dark-900/60 p-4 ${className}`}>
      {children}
    </div>
  );
}

function CardTitle({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <Icon className="h-4 w-4 text-neon-cyan" />
      <h2 className="text-xs font-mono uppercase tracking-widest text-white/50">{children}</h2>
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
  const { stats, isLoading: statsLoading, error: statsError, refetch: refetchStats } = useStats();
  const { summary, error: summaryError, refetch: refetchSummary } = useAnalytics();
  const { points } = useAnalyticsTimeseries(undefined, 30);

  const totalEvents = useMemo(
    () => Object.values(summary?.totals ?? {}).reduce((a, b) => a + b, 0),
    [summary],
  );

  const segments = useMemo(() => {
    const byCat = new Map<string, { value: number; color: NeonColor }>();
    for (const [type, count] of Object.entries(summary?.totals ?? {})) {
      const meta = CATEGORY[type as AnalyticsEventType];
      if (!meta) continue;
      const prev = byCat.get(meta.cat);
      byCat.set(meta.cat, { value: (prev?.value ?? 0) + count, color: meta.color });
    }
    return [...byCat.entries()].map(([label, v]) => ({ label, value: v.value, color: v.color }));
  }, [summary]);

  const areaData = useMemo(() => points.map((p) => ({ date: p.date, completed: p.value })), [points]);

  const error = statsError ?? summaryError;
  const achievements = stats?.achievements ?? [];
  const unlocked = achievements.filter((a) => a.unlocked).length;

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        icon={BarChart3}
        title="Insights"
        subtitle="Interaction analytics & achievements"
        color="cyan"
      />

      <div className="flex-1 space-y-4 overflow-y-auto p-6">
        {error && (
          <LoadErrorBanner
            error={error}
            onRetry={() => {
              refetchStats();
              refetchSummary();
            }}
            hint="Analytics start empty and fill in as you use Control Hub."
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

            {/* ── Level / streak / headline metrics ── */}
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
                <div className="flex items-center gap-5">
                  {stats && <LevelBadge level={stats.level} color="cyan" />}
                  <div className="h-10 w-px bg-white/10" />
                  {stats && <StreakFlame current={stats.streak.current} longest={stats.streak.longest} />}
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <MetricTile label="Interactions" value={totalEvents.toLocaleString()} color="cyan" />
                  <MetricTile label="Active days (30d)" value={String(summary?.activeDays ?? 0)} color="green" />
                  <MetricTile label="Achievements" value={`${unlocked}/${achievements.length}`} color="yellow" />
                  <MetricTile label="Longest streak" value={`${stats?.streak.longest ?? 0}d`} color="orange" />
                </div>
              </div>
            </Card>

            <div className="grid gap-4 lg:grid-cols-3">
              {/* ── Activity over time ── */}
              <Card className="lg:col-span-2">
                <CardTitle icon={Activity}>Activity — last 30 days</CardTitle>
                <AreaTrend data={areaData} color="cyan" height={140} />
              </Card>

              {/* ── Category breakdown ── */}
              <Card>
                <CardTitle icon={BarChart3}>By category</CardTitle>
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

            {/* ── Run activity heatmap ── */}
            <Card>
              <CardTitle icon={CalendarRange}>Run activity — last 91 days</CardTitle>
              <ActivityHeatmap data={stats?.runActivity ?? []} color="green" />
            </Card>

            {/* ── Achievements ── */}
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-neon-yellow" />
                  <h2 className="text-xs font-mono uppercase tracking-widest text-white/50">Achievements</h2>
                </div>
                <span className="flex items-center gap-1.5 text-xs text-white/40">
                  {unlocked === achievements.length && achievements.length > 0 && (
                    <Sparkles className="h-3.5 w-3.5 text-neon-yellow" />
                  )}
                  <Flame className="h-3.5 w-3.5 text-neon-orange" />
                  {unlocked} / {achievements.length} unlocked
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9">
                {achievements.map((a) => (
                  <AchievementBadge key={a.id} achievement={a} />
                ))}
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
