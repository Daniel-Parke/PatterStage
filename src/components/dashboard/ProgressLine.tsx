// ═══════════════════════════════════════════════════════════════
// ProgressLine — one row of where you are, under the pills
//
// What survives of the Command Center on the dashboard (T-0099, B5). The
// dashboard is an operations board; the charts, the mission mix and the
// trophy case are history and live on Insights. This row keeps the five
// facts an operator glances at between missions: the streak, the top agent's
// level, achievements unlocked over total, the next automation due, and the
// door to Quests. Presentational: the page hands it the stats poll it
// already makes and the agents ranked by growth.
// ═══════════════════════════════════════════════════════════════

"use client";

import Link from "next/link";
import { Bot, CalendarClock, ChevronRight, Compass, Terminal, Trophy } from "lucide-react";

import Card from "@/components/ui/Card";
import LinkButton from "@/components/ui/LinkButton";
import LoadErrorBanner from "@/components/ui/LoadErrorBanner";
import Skeleton from "@/components/ui/Skeleton";
import { StreakFlame, AgentLevelBadge } from "@/components/achievements";
import type { AgentExperienceEntry } from "@/hooks/useAgentExperience";
import type { DashboardStats } from "@/lib/stats/stats-repository";

function timeUntil(iso: string, now: number): string {
  const ms = Date.parse(`${iso.replace(" ", "T")}Z`) - now;
  if (!Number.isFinite(ms) || ms <= 0) return "now";
  const min = Math.round(ms / 60_000);
  if (min < 60) return `in ${min}m`;
  const hr = Math.round(min / 60);
  if (hr < 48) return `in ${hr}h`;
  return `in ${Math.round(hr / 24)}d`;
}

export interface ProgressLineProps {
  stats: DashboardStats | null;
  statsError: string | null;
  onRetryStats: () => void;
  topAgent: AgentExperienceEntry | null;
  /** The same 30s-refreshed reading the page uses for its windows. */
  now: number;
}

export default function ProgressLine({ stats, statsError, onRetryStats, topAgent, now }: ProgressLineProps) {
  if (!stats) {
    if (statsError) {
      return (
        <LoadErrorBanner
          compact
          error={`Couldn't read stats: ${statsError}`}
          onRetry={onRetryStats}
          className="mb-0"
        />
      );
    }
    return <Skeleton className="h-16 w-full" />;
  }

  const unlocked = stats.achievements.filter((a) => a.unlocked).length;
  const next = stats.automations.nextRun;

  return (
    <section aria-label="Progress">
      <Card padding="none" className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
      <StreakFlame current={stats.streak.current} longest={stats.streak.longest} />
      <div className="hidden h-8 w-px bg-ps-surface-raised sm:block" />
      <Link href="/agent/profiles" className="transition hover:opacity-90" title="Agent level. Open Agents">
        <AgentLevelBadge
          experience={topAgent ? topAgent.experience.level : null}
          label={topAgent ? topAgent.targetLabel : "Agent"}
        />
      </Link>
      <LinkButton
        href="/results/insights"
        variant="ghost"
        size="sm"
        icon={Trophy}
        title="Achievements unlocked. Open Insights"
        className="font-sans"
      >
        Achievements
        <span className="font-mono text-ps-text-primary">
          {unlocked}/{stats.achievements.length}
        </span>
      </LinkButton>
      <div className="flex items-center gap-2 text-body">
        <CalendarClock className="h-3.5 w-3.5 text-neon-cyan" />
        {next ? (
          <>
            <span className="text-ps-text-muted">Next automation</span>
            <span className="font-medium text-ps-text-primary">{next.name}</span>
            {next.kind === "script" ? (
              <Terminal className="h-3 w-3 text-neon-green" />
            ) : (
              <Bot className="h-3 w-3 text-neon-cyan" />
            )}
            <span className="font-mono text-neon-cyan">{timeUntil(next.at, now)}</span>
          </>
        ) : (
          <span className="text-ps-text-muted">No automation scheduled</span>
        )}
      </div>
      <LinkButton href="/quests" variant="ghost" color="purple" size="sm" icon={Compass} className="ml-auto">
        Quests
        <ChevronRight className="h-3 w-3" aria-hidden="true" />
      </LinkButton>
      </Card>
    </section>
  );
}
