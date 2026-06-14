// ═══════════════════════════════════════════════════════════════
// game/metrics.ts — measure the operator + agents from real activity
//
// Reuses the dashboard stats aggregate and adds per-track XP, day/week quest
// windows, and per-agent breakdowns (the agent-card flywheel: runs + success +
// tokens + speed → stronger cards). Read-only.
// ═══════════════════════════════════════════════════════════════

import { db } from "@/lib/db";
import { getDashboardStats } from "@/lib/stats/stats-repository";
import { getOwnedCosmeticIds } from "./game-repository";
import type { GameMetrics } from "./engine";
import type { AgentMetrics } from "./cards";

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function scalar(sql: string, ...p: unknown[]): number {
  try {
    return num((db().prepare(sql).get(...p) as { v: number } | undefined)?.v);
  } catch {
    return 0;
  }
}

interface RunAgg {
  runs: number;
  completed: number;
  tokens: number;
  durSum: number;
  durCount: number;
}
function parseTotalTokens(raw: string | null): number {
  if (!raw) return 0;
  try {
    const o = JSON.parse(raw) as { inputTokens?: number; outputTokens?: number; totalTokens?: number };
    return num(o.totalTokens) || num(o.inputTokens) + num(o.outputTokens);
  } catch {
    return 0;
  }
}

/** Aggregate runs per profile (the core of an agent's card). */
function runsByProfile(): Map<string, RunAgg> {
  const out = new Map<string, RunAgg>();
  let rows: Array<{ profile_name: string | null; status: string; usage_json: string | null; submitted_at: string; completed_at: string | null }> = [];
  try {
    rows = db().prepare("SELECT profile_name, status, usage_json, submitted_at, completed_at FROM runs").all() as typeof rows;
  } catch {
    return out;
  }
  for (const r of rows) {
    const key = r.profile_name && r.profile_name.trim() ? r.profile_name : "default";
    const a = out.get(key) ?? { runs: 0, completed: 0, tokens: 0, durSum: 0, durCount: 0 };
    a.runs++;
    a.tokens += parseTotalTokens(r.usage_json);
    if (r.status === "completed") {
      a.completed++;
      if (r.completed_at && r.submitted_at) {
        const d = (Date.parse(`${r.completed_at}Z`) - Date.parse(`${r.submitted_at}Z`)) / 1000;
        if (Number.isFinite(d) && d >= 0 && d < 86_400) {
          a.durSum += d;
          a.durCount++;
        }
      }
    }
    out.set(key, a);
  }
  return out;
}

function missionsByProfile(): Map<string, { completed: number; failed: number }> {
  const out = new Map<string, { completed: number; failed: number }>();
  try {
    const rows = db()
      .prepare("SELECT COALESCE(profile_name, profile_id, 'default') AS p, status, COUNT(*) c FROM missions WHERE deleted_at IS NULL GROUP BY p, status")
      .all() as Array<{ p: string; status: string; c: number }>;
    for (const r of rows) {
      const key = r.p && r.p.trim() ? r.p : "default";
      const e = out.get(key) ?? { completed: 0, failed: 0 };
      if (r.status === "successful") e.completed += r.c;
      else if (r.status === "failed") e.failed += r.c;
      out.set(key, e);
    }
  } catch {
    /* table missing */
  }
  return out;
}

function jsonLen(raw: string | null): number {
  if (!raw) return 0;
  try {
    const v = JSON.parse(raw);
    if (Array.isArray(v)) return v.length;
    if (v && typeof v === "object") return Object.keys(v).length;
  } catch {
    /* ignore */
  }
  return 0;
}

export interface GatheredMetrics {
  metrics: GameMetrics;
  agents: AgentMetrics[];
}

export function gatherGameMetrics(): GatheredMetrics {
  const s = getDashboardStats();
  const last = <T extends { value?: number; completed?: number }>(arr: T[], n: number, key: "value" | "completed"): number =>
    arr.slice(-n).reduce((acc, p) => acc + num((p as Record<string, number>)[key]), 0);

  const providers = scalar("SELECT COUNT(DISTINCT provider) AS v FROM models");
  const totalSkills = scalar("SELECT COUNT(*) AS v FROM skills");
  const pulls = scalar("SELECT COUNT(*) AS v FROM game_events WHERE type = 'pull'");
  const nightOwlRuns = scalar(
    "SELECT COUNT(*) AS v FROM runs WHERE status='completed' AND completed_at IS NOT NULL AND CAST(strftime('%H', completed_at) AS INTEGER) < 5",
  );
  const cosmeticsOwned = getOwnedCosmeticIds().size;

  const automationsLive = s.automations.schedulesEnabled + s.automations.scriptsEnabled;
  const successRatePct = Math.round(s.missions.successRate * 100);

  const metrics: GameMetrics = {
    completedMissions: s.missions.successful,
    completedRuns: s.runs.completed,
    stories: s.stories,
    totalTokens: s.runs.totalTokens,
    longestStreak: s.streak.longest,
    currentStreak: s.streak.current,
    successRatePct,
    // per-track XP
    missionXp: s.missions.successful * 100 + s.runs.completed * 25,
    automationXp: automationsLive * 250 + s.automations.scriptsTotal * 50,
    memoryXp: scalar("SELECT CAST(value AS INTEGER) AS v FROM meta WHERE key='memory.fact_count'") * 20,
    storyXp: s.stories * 150,
    modelXp: scalar("SELECT COUNT(*) AS v FROM models") * 40 + providers * 80,
    sessionXp: s.sessions.total * 15,
    // quest windows
    missionsToday: last(s.throughput, 1, "completed"),
    runsCompletedToday: last(s.runActivity, 1, "value"),
    streakAlive: s.streak.current > 0 ? 1 : 0,
    missionsCompletedWeek: last(s.throughput, 7, "completed"),
    automationsLive,
    tokensWeek: last(s.tokensByDay, 7, "value"),
    // achievement metrics
    scriptsEnabled: s.automations.scriptsEnabled,
    providers,
    nightOwl: nightOwlRuns > 0 ? 1 : 0,
    flawless: s.missions.successRate >= 0.95 && s.missions.successful >= 20 ? 1 : 0,
    pulls,
    cosmeticsOwned,
  };

  // ── Agent roster ──
  const runsAgg = runsByProfile();
  const missionsAgg = missionsByProfile();
  const agents: AgentMetrics[] = [];
  const pushAgent = (slug: string, name: string, personality: string | undefined, skills: number, toolsets: number) => {
    const r = runsAgg.get(slug) ?? { runs: 0, completed: 0, tokens: 0, durSum: 0, durCount: 0 };
    const m = missionsAgg.get(slug) ?? { completed: 0, failed: 0 };
    agents.push({
      slug,
      name,
      personality,
      runs: r.runs,
      missionsCompleted: m.completed,
      missionsFailed: m.failed,
      totalTokens: r.tokens,
      avgDurationSec: r.durCount > 0 ? Math.round(r.durSum / r.durCount) : 0,
      skills,
      toolsets,
    });
  };

  try {
    const root = db().prepare("SELECT display_name, personality, disabled_skills, platform_toolsets FROM agent_root WHERE id = 1").get() as
      | { display_name: string; personality: string; disabled_skills: string; platform_toolsets: string }
      | undefined;
    if (root) {
      pushAgent("default", root.display_name || "Bob", root.personality, Math.max(0, totalSkills - jsonLen(root.disabled_skills)), jsonLen(root.platform_toolsets));
    }
    const profiles = db().prepare("SELECT slug, display_name, personality, disabled_skills, platform_toolsets FROM agent_profiles").all() as Array<{
      slug: string;
      display_name: string;
      personality: string;
      disabled_skills: string;
      platform_toolsets: string;
    }>;
    for (const p of profiles) {
      pushAgent(p.slug, p.display_name || p.slug, p.personality, Math.max(0, totalSkills - jsonLen(p.disabled_skills)), jsonLen(p.platform_toolsets));
    }
  } catch {
    /* profiles table missing */
  }

  return { metrics, agents };
}
