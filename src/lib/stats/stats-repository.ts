// ═══════════════════════════════════════════════════════════════
// stats/stats-repository.ts — derive dashboard + gamification stats from the DB
//
// One read-only aggregate over missions / runs / sessions / schedules / cron /
// stories. Feeds the pure helpers in derive.ts. Every query is defensive so a
// partially-populated DB (fresh install, no runs yet) yields zeros, not errors.
// ═══════════════════════════════════════════════════════════════

import { db } from "@/lib/db";
import {
  computeXp,
  computeLevel,
  computeStreaks,
  evaluateAchievements,
  successRate,
  type LevelInfo,
  type Achievement,
  type RawMetrics,
} from "./derive";
import { getAgentPerformance, type AgentPerformance } from "./agent-stats";
import {
  countByType,
  maxCountInSingleDay,
  distinctProfileCount,
  distinctEventTypeCount,
  distinctActiveDays,
} from "@/lib/analytics/analytics-repository";
import type { AnalyticsEventType } from "@/lib/analytics/event-types";

interface DailyPoint {
  date: string;
  value: number;
}
interface ThroughputPoint {
  date: string;
  completed: number;
  failed: number;
}
interface NextRun {
  name: string;
  at: string;
  kind: "mission" | "script";
}

export interface DashboardStats {
  generatedAt: string;
  missions: {
    total: number;
    queued: number;
    dispatched: number;
    successful: number;
    failed: number;
    successRate: number;
  };
  runs: {
    total: number;
    active: number;
    completed: number;
    failed: number;
    cancelled: number;
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
    avgDurationSec: number;
  };
  sessions: { total: number; active: number };
  automations: {
    schedulesTotal: number;
    schedulesEnabled: number;
    scriptsTotal: number;
    scriptsEnabled: number;
    nextRun: NextRun | null;
  };
  stories: number;
  errors24h: number;
  level: LevelInfo;
  streak: { current: number; longest: number };
  achievements: Achievement[];
  agents: AgentPerformance[];
  throughput: ThroughputPoint[]; // last 30 days
  runActivity: DailyPoint[]; // last 91 days (heatmap)
  tokensByDay: DailyPoint[]; // last 30 days (sparkline)
}

function dayStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function lastNDates(n: number): string[] {
  const out: string[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    out.push(dayStr(d));
  }
  return out;
}
function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

interface UsageShape {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}
function parseTokens(raw: string | null): { input: number; output: number; total: number } {
  if (!raw) return { input: 0, output: 0, total: 0 };
  try {
    const o = JSON.parse(raw) as UsageShape;
    const input = num(o.inputTokens);
    const output = num(o.outputTokens);
    const total = num(o.totalTokens) || input + output;
    return { input, output, total };
  } catch {
    return { input: 0, output: 0, total: 0 };
  }
}

function countBy(table: string, where = ""): Record<string, number> {
  try {
    const rows = db()
      .prepare(`SELECT status, COUNT(*) AS c FROM ${table} ${where} GROUP BY status`)
      .all() as Array<{ status: string; c: number }>;
    const out: Record<string, number> = {};
    for (const r of rows) out[r.status] = r.c;
    return out;
  } catch {
    return {};
  }
}
function scalar(sql: string, ...params: unknown[]): number {
  try {
    const row = db().prepare(sql).get(...params) as { v: number } | undefined;
    return num(row?.v);
  } catch {
    return 0;
  }
}

export function getDashboardStats(): DashboardStats {
  // ── missions ──
  const m = countBy("missions", "WHERE deleted_at IS NULL");
  const successful = num(m.successful);
  const failed = num(m.failed);
  const missions = {
    queued: num(m.queued),
    dispatched: num(m.dispatched),
    successful,
    failed,
    total: num(m.queued) + num(m.dispatched) + successful + failed,
    successRate: successRate(successful, failed),
  };

  // ── runs (90-day window, aggregated in JS for robust token parsing) ──
  const runRows = (() => {
    try {
      return db()
        .prepare(
          `SELECT status, usage_json, submitted_at, completed_at
             FROM runs WHERE submitted_at >= datetime('now', '-91 days')`,
        )
        .all() as Array<{
        status: string;
        usage_json: string | null;
        submitted_at: string;
        completed_at: string | null;
      }>;
    } catch {
      return [];
    }
  })();

  let totalTokens = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let durSum = 0;
  let durCount = 0;
  const completedByDay = new Map<string, number>();
  const tokensByDay = new Map<string, number>();
  const activeDates = new Set<string>();
  const completionHours: number[] = [];

  for (const r of runRows) {
    const t = parseTokens(r.usage_json);
    totalTokens += t.total;
    inputTokens += t.input;
    outputTokens += t.output;
    if (r.status === "completed" && r.completed_at) {
      const day = r.completed_at.slice(0, 10);
      completedByDay.set(day, (completedByDay.get(day) ?? 0) + 1);
      tokensByDay.set(day, (tokensByDay.get(day) ?? 0) + t.total);
      activeDates.add(day);
      completionHours.push(num(r.completed_at.slice(11, 13)));
      if (r.submitted_at) {
        // Timestamps are ISO-8601 with a 'Z'; appending another 'Z' → NaN → avg 0.
        const dur = (Date.parse(r.completed_at) - Date.parse(r.submitted_at)) / 1000;
        if (Number.isFinite(dur) && dur >= 0 && dur < 86_400) {
          durSum += dur;
          durCount++;
        }
      }
    }
  }
  const runStatus = countBy("runs");
  const runs = {
    total: num(runStatus.started) + num(runStatus.completed) + num(runStatus.failed) + num(runStatus.cancelled),
    active: num(runStatus.started),
    completed: num(runStatus.completed),
    failed: num(runStatus.failed),
    cancelled: num(runStatus.cancelled),
    totalTokens,
    inputTokens,
    outputTokens,
    avgDurationSec: durCount > 0 ? Math.round(durSum / durCount) : 0,
  };

  // ── sessions ──
  const sessions = {
    total: scalar("SELECT COUNT(*) AS v FROM sessions"),
    active: scalar("SELECT COUNT(*) AS v FROM sessions WHERE status = 'active'"),
  };

  // ── automations: PatterStage schedules (recurring agent missions) ──
  // Host scripts (system crontab) are managed on the Scripts page, not counted
  // in this aggregate — the dashboard's automation signal is the CH scheduler.
  const schedulesTotal = scalar("SELECT COUNT(*) AS v FROM schedules");
  const schedulesEnabled = scalar("SELECT COUNT(*) AS v FROM schedules WHERE enabled = 1");
  const scriptsTotal = 0;
  const scriptsEnabled = 0;
  const nextRun = ((): NextRun | null => {
    try {
      const sched = db()
        .prepare(
          `SELECT name, next_run_at AS at FROM schedules
             WHERE enabled = 1 AND next_run_at IS NOT NULL AND next_run_at > datetime('now')
             ORDER BY next_run_at ASC LIMIT 1`,
        )
        .get() as { name: string; at: string } | undefined;
      return sched ? { name: sched.name || "Scheduled mission", at: sched.at, kind: "mission" } : null;
    } catch {
      return null;
    }
  })();

  const stories = scalar("SELECT COUNT(*) AS v FROM stories WHERE deleted_at IS NULL");
  const errors24h = scalar(
    "SELECT COUNT(*) AS v FROM error_log_entries WHERE ingested_at >= datetime('now', '-1 day')",
  );

  // ── mission throughput (terminal missions / day, last 30) ──
  const throughputMap = new Map<string, { completed: number; failed: number }>();
  try {
    const rows = db()
      .prepare(
        `SELECT date(updated_at) AS d, status, COUNT(*) AS c FROM missions
           WHERE deleted_at IS NULL AND status IN ('successful','failed')
             AND updated_at >= datetime('now', '-30 days')
           GROUP BY d, status`,
      )
      .all() as Array<{ d: string; status: string; c: number }>;
    for (const r of rows) {
      const e = throughputMap.get(r.d) ?? { completed: 0, failed: 0 };
      if (r.status === "successful") e.completed += r.c;
      else e.failed += r.c;
      throughputMap.set(r.d, e);
      activeDates.add(r.d);
    }
  } catch {
    // table missing — leave throughput empty
  }

  // ── interaction events (analytics_events) feed the expanded achievements ──
  // Defensive reads → 0 / [] on a fresh or pre-v12 DB, so achievements simply
  // start unlocked-at-0 rather than erroring.
  const evt = countByType();
  const evtCount = (t: AnalyticsEventType): number => evt[t] ?? 0;
  // Fold event-active days into the streak set so chat/story/skill-only days
  // (with no run completion) still keep the daily streak alive.
  for (const d of distinctActiveDays()) activeDates.add(d);

  // ── streak + level + achievements ──
  const today = dayStr(new Date());
  const streak = computeStreaks(activeDates, today);
  const raw: RawMetrics = {
    // Floor the mission-count metrics with the append-only event totals so the
    // "completed N missions" achievements are MONOTONIC — a mission that gets
    // re-dispatched flips the live table status back to 'dispatched', which would
    // otherwise un-earn first-contact/field-agent/etc. (surfaced by the
    // real-Hermes smoke). max(event, table) also keeps pre-event-log history.
    completedMissions: Math.max(evtCount("mission.completed"), successful),
    failedMissions: Math.max(evtCount("mission.failed"), failed),
    completedRuns: runs.completed,
    totalTokens,
    stories,
    schedulesEnabled,
    scriptsEnabled,
    longestStreak: streak.longest,
    currentStreak: streak.current,
    completionHours,
    // event-derived (table-fallback where the count predates the event log)
    dispatchedMissions: evtCount("mission.dispatched"),
    maxMissionsInADay: maxCountInSingleDay("mission.dispatched"),
    chaptersGenerated: evtCount("story.chapter_generated"),
    storiesCompleted: evtCount("story.completed"),
    sessionsStarted: Math.max(evtCount("session.started"), sessions.total),
    schedulesCreated: Math.max(evtCount("schedule.created"), schedulesTotal),
    schedulesFired: evtCount("schedule.fired"),
    skillToggles: evtCount("skill.toggled"),
    personalityChanges: evtCount("personality.changed"),
    modelConfigs: evtCount("model.configured"),
    chatMessages: evtCount("chat.message_sent"),
    distinctProfiles: distinctProfileCount(),
    distinctEventTypes: distinctEventTypeCount(),
  };
  const level = computeLevel(computeXp(raw));
  const achievements = evaluateAchievements(raw);

  return {
    generatedAt: new Date().toISOString(),
    missions,
    runs,
    sessions,
    automations: { schedulesTotal, schedulesEnabled, scriptsTotal, scriptsEnabled, nextRun },
    stories,
    errors24h,
    level,
    streak,
    achievements,
    agents: getAgentPerformance(),
    throughput: lastNDates(30).map((date) => ({
      date,
      completed: throughputMap.get(date)?.completed ?? 0,
      failed: throughputMap.get(date)?.failed ?? 0,
    })),
    runActivity: lastNDates(91).map((date) => ({ date, value: completedByDay.get(date) ?? 0 })),
    tokensByDay: lastNDates(30).map((date) => ({ date, value: tokensByDay.get(date) ?? 0 })),
  };
}
