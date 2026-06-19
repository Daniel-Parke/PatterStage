"use client";

// ═══════════════════════════════════════════════════════════════
// CommandCenter — gamified operational hero for the dashboard.
//
// Self-contained: pulls /api/stats via useStats and renders level/streak,
// animated vitals, mission throughput, mission mix, a run-activity heatmap,
// and an achievements shelf. Drops into the dashboard as <CommandCenter />.
// ═══════════════════════════════════════════════════════════════

import { useCallback, type ReactNode } from "react";
import Link from "next/link";
import {
  Activity,
  CheckCircle2,
  Coins,
  Trophy,
  Clock3,
  Bot,
  Terminal,
  TrendingUp,
  Award,
  CalendarClock,
} from "lucide-react";
import { useStats } from "@/hooks/useStats";
import { useLeaderboard } from "@/hooks/useBenchmarks";
import { useCountUp } from "@/hooks/useCountUp";
import { AreaTrend, ActivityHeatmap, Donut, Sparkline, ProgressRing } from "@/components/viz";
import { neon, neonAlpha, type NeonColor } from "@/components/viz/colors";
import { LevelBadge, StreakFlame, AchievementShowcase, AgentRatingBadge } from "@/components/achievements";
import { useToast } from "@/components/ui/Toast";
import { useAchievementUnlocks } from "@/hooks/useAchievementUnlocks";
import type { Achievement } from "@/lib/stats/derive";

function fmtNum(n: number): string {
  return Math.round(n).toLocaleString();
}
function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(Math.round(n));
}
function timeUntil(iso: string): string {
  const ms = Date.parse(`${iso.replace(" ", "T")}Z`) - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return "now";
  const min = Math.round(ms / 60_000);
  if (min < 60) return `in ${min}m`;
  const hr = Math.round(min / 60);
  if (hr < 48) return `in ${hr}h`;
  return `in ${Math.round(hr / 24)}d`;
}

function Card({ children, className = "", accent }: { children: ReactNode; className?: string; accent?: NeonColor }) {
  return (
    <div
      className={`animate-float-in rounded-2xl border border-white/10 bg-dark-900/60 p-4 ${className}`}
      style={accent ? { boxShadow: `0 0 24px ${neonAlpha(accent, 7)}` } : undefined}
    >
      {children}
    </div>
  );
}

function CardHeader({ icon: Icon, label, color = "cyan", right }: { icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; label: string; color?: NeonColor; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5" style={{ color: neon(color) }} />
        <span className="font-mono text-xs uppercase tracking-wider text-white/50">{label}</span>
      </div>
      {right}
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  color,
  suffix = "",
  tokens = false,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  value: number;
  color: NeonColor;
  suffix?: string;
  tokens?: boolean;
}) {
  const n = useCountUp(value);
  const display = tokens ? fmtTokens(n) : fmtNum(n);
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5" style={{ boxShadow: `inset 0 0 16px ${neonAlpha(color, 5)}` }}>
      <div className="flex items-center gap-1.5">
        <Icon className="h-3 w-3" style={{ color: neon(color) }} />
        <span className="text-[10px] uppercase tracking-wider text-white/40">{label}</span>
      </div>
      <div className="mt-1 font-mono text-2xl font-bold leading-none text-white">
        {display}
        {suffix && <span className="ml-0.5 text-sm font-normal text-white/40">{suffix}</span>}
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <section className="space-y-4">
      <div className="animate-shimmer h-28 rounded-2xl border border-white/10 bg-dark-900/60" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="animate-shimmer h-44 rounded-2xl border border-white/10 bg-dark-900/60 lg:col-span-2" />
        <div className="animate-shimmer h-44 rounded-2xl border border-white/10 bg-dark-900/60" />
      </div>
    </section>
  );
}

export default function CommandCenter() {
  const { stats, isLoading } = useStats();
  // Agent Rating axis (distinct from operator XP): show the top-rated agent.
  const { entries: leaderboard } = useLeaderboard();
  const topAgent = leaderboard[0] ?? null;
  // The dashboard is always-on, so CommandCenter is the SOLE owner of the
  // achievement-unlock toast (the Insights grid renders read-only). First poll
  // seeds silently; each id fires once.
  const { showToast, toastElement } = useToast();
  useAchievementUnlocks(
    stats?.achievements,
    useCallback(
      (a: Achievement) => showToast(`🏆 Achievement unlocked — ${a.name}`, "success"),
      [showToast],
    ),
  );

  if (!stats) {
    return isLoading ? <Skeleton /> : null;
  }

  const { missions, runs, level, streak, throughput, runActivity, tokensByDay, achievements, automations } = stats;
  const successPct = Math.round(missions.successRate * 100);
  const throughputTotal = throughput.reduce((s, p) => s + p.completed, 0);
  const next = automations.nextRun;

  return (
    <section className="space-y-4">
      {toastElement}
      {/* ── Hero ── */}
      <Card accent="cyan" className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full blur-3xl"
          style={{ background: neonAlpha("cyan", 8) }}
        />
        <div className="relative flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
          <div className="flex items-center gap-5">
            <LevelBadge level={level} color="cyan" />
            <div className="h-10 w-px bg-white/10" />
            <StreakFlame current={streak.current} longest={streak.longest} />
            <div className="hidden h-10 w-px bg-white/10 lg:block" />
            <Link href="/benchmarks" className="hidden transition hover:opacity-90 lg:block" title="Agent Level + Rating — open Benchmarks">
              <AgentRatingBadge
                rating={topAgent?.rating ?? null}
                experience={topAgent?.experience ? { level: topAgent.experience.level.level, title: topAgent.experience.level.title } : null}
                label={topAgent ? topAgent.targetLabel : "Agent"}
              />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile icon={Activity} label="Active Runs" value={runs.active} color="green" />
            <StatTile icon={CheckCircle2} label="Missions" value={missions.successful} color="cyan" />
            <StatTile icon={Trophy} label="Success" value={successPct} suffix="%" color="purple" />
            <StatTile icon={Coins} label="Tokens" value={runs.totalTokens} color="yellow" tokens />
          </div>
        </div>
        {next && (
          <div className="relative mt-3 flex items-center gap-2 border-t border-white/5 pt-3 text-xs">
            <CalendarClock className="h-3.5 w-3.5 text-neon-cyan" />
            <span className="text-white/50">Next automation</span>
            <span className="font-medium text-white/80">{next.name}</span>
            {next.kind === "script" ? (
              <Terminal className="h-3 w-3 text-neon-green" />
            ) : (
              <Bot className="h-3 w-3 text-neon-cyan" />
            )}
            <span className="ml-auto font-mono text-neon-cyan">{timeUntil(next.at)}</span>
          </div>
        )}
      </Card>

      {/* ── Throughput + Mission mix ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" accent="cyan">
          <CardHeader
            icon={TrendingUp}
            label="Mission throughput · 30d"
            right={
              <span className="font-mono text-sm text-white/70">
                {throughputTotal} <span className="text-xs text-white/40">completed</span>
              </span>
            }
          />
          <AreaTrend data={throughput} color="cyan" failColor="pink" height={110} />
          <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3">
            <div className="flex items-center gap-2 text-[11px] text-white/40">
              <Coins className="h-3 w-3 text-neon-yellow" /> Token usage · 30d
            </div>
            <Sparkline data={tokensByDay.map((d) => d.value)} color="yellow" width={160} height={28} />
          </div>
        </Card>

        <Card accent="purple">
          <CardHeader icon={Award} label="Mission mix" />
          <div className="flex items-center gap-4">
            <Donut
              size={120}
              thickness={14}
              segments={[
                { label: "Successful", value: missions.successful, color: "green" },
                { label: "Failed", value: missions.failed, color: "pink" },
                { label: "Dispatched", value: missions.dispatched, color: "yellow" },
                { label: "Queued", value: missions.queued, color: "cyan" },
              ]}
              center={missions.total}
              centerSub="missions"
            />
            <div className="space-y-1.5 text-xs">
              {[
                { label: "Successful", value: missions.successful, color: "green" as NeonColor },
                { label: "Failed", value: missions.failed, color: "pink" as NeonColor },
                { label: "Dispatched", value: missions.dispatched, color: "yellow" as NeonColor },
                { label: "Queued", value: missions.queued, color: "cyan" as NeonColor },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: neon(s.color), boxShadow: `0 0 6px ${neonAlpha(s.color, 60)}` }} />
                  <span className="text-white/50">{s.label}</span>
                  <span className="ml-auto font-mono text-white/80">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* ── Activity heatmap + vitals ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" accent="green">
          <CardHeader icon={Activity} label="Run activity · 13 weeks" right={<span className="font-mono text-xs text-white/40">{runs.completed} runs</span>} />
          <ActivityHeatmap data={runActivity} color="green" />
        </Card>
        <Card accent="cyan">
          <CardHeader icon={Clock3} label="Vitals" />
          <div className="flex items-center justify-around">
            <ProgressRing value={missions.successRate} color="green" size={86} thickness={8} label={<span className="text-sm">{successPct}%</span>} sublabel="success" />
            <ProgressRing
              value={runs.total > 0 ? runs.active / Math.max(runs.active, 10) : 0}
              color="cyan"
              size={86}
              thickness={8}
              label={<span className="text-sm">{runs.active}</span>}
              sublabel="active"
            />
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3 text-[11px] text-white/40">
            <span>avg run {runs.avgDurationSec > 0 ? `${runs.avgDurationSec}s` : "—"}</span>
            <span>{automations.schedulesEnabled + automations.scriptsEnabled} automations live</span>
          </div>
        </Card>
      </div>

      {/* ── Achievements (compact trophy case; expands to full grid) ── */}
      <AchievementShowcase achievements={achievements} />
    </section>
  );
}
