// ═══════════════════════════════════════════════════════════════
// stats/agent-stats.ts — per-agent performance, derived from real activity
//
// Real metrics only (no RPG/combat framing): runs, mission success, tokens,
// average run duration, plus a skills/toolsets count per profile. Read-only and
// defensive — a partially-populated DB (no runs yet) yields zeros, not errors.
// Powers the AgentPerformanceStrip on the Agents page via /api/stats.
// ═══════════════════════════════════════════════════════════════

import { createAgentSkillsCounter } from "@/lib/agents/agent-skills-count";

import {
  readAgentProfileStatsRows,
  readAgentRootStatsRow,
  readMissionStatusCountsByProfile,
  readRunProfileRows,
  type RunProfileRow,
} from "./agent-stats-repository";

export interface AgentPerformance {
  slug: string;
  name: string;
  personality?: string;
  /** Total runs dispatched under this profile, whatever became of them. */
  runs: number;
  /**
   * Runs that reached `completed`.
   *
   * Distinct from `runs` because the Experience signal is named
   * `runsCompleted` and the growth panel labels it "Runs completed", while it
   * was fed the total. `countAgentActiveDays` has always filtered on
   * completion, so the two signals disagreed about what counted (T-0081).
   */
  runsCompleted: number;
  missionsCompleted: number;
  missionsFailed: number;
  totalTokens: number;
  /** Mean wall-clock seconds for completed runs (0 if none). */
  avgDurationSec: number;
  /**
   * Active (not-disabled) skills available to the profile: the SAME number the
   * profile card renders, from the same function (T-0113).
   *
   * This used to be `COUNT(*) FROM skills` minus the length of the profile's
   * denylist, computed here. countProfileSkills stopped doing that arithmetic
   * because it counts the catalogue only, while the Skills page lists the
   * catalogue union the agent's skills tree, and the denylist it subtracted is
   * full of keys that base never held. The strip kept the old sum for twelve
   * lines of the Agents page, so "4 skills" rendered above "78 skills" for one
   * agent on one screen.
   */
  skills: number;
  /** Platform toolsets configured for the profile. */
  toolsets: number;
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
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

interface RunAgg {
  runs: number;
  completed: number;
  tokens: number;
  durSum: number;
  durCount: number;
}

/** Aggregate runs per profile (the core of an agent's performance). */
function runsByProfile(): Map<string, RunAgg> {
  const out = new Map<string, RunAgg>();
  let rows: RunProfileRow[] = [];
  try {
    rows = readRunProfileRows();
  } catch {
    return out;
  }
  for (const r of rows) {
    const key = r.profile_name && r.profile_name.trim() ? r.profile_name : "default";
    const a = out.get(key) ?? { runs: 0, completed: 0, tokens: 0, durSum: 0, durCount: 0 };
    a.runs++;
    if (r.status === "completed") a.completed++;
    a.tokens += parseTotalTokens(r.usage_json);
    if (r.status === "completed" && r.completed_at && r.submitted_at) {
      // Timestamps are ISO-8601 with a 'Z'; appending another 'Z' → NaN → no avg.
      const d = (Date.parse(r.completed_at) - Date.parse(r.submitted_at)) / 1000;
      if (Number.isFinite(d) && d >= 0 && d < 86_400) {
        a.durSum += d;
        a.durCount++;
      }
    }
    out.set(key, a);
  }
  return out;
}

function missionsByProfile(): Map<string, { completed: number; failed: number }> {
  const out = new Map<string, { completed: number; failed: number }>();
  try {
    const rows = readMissionStatusCountsByProfile();
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

/**
 * Per-agent performance for every configured profile (default + named),
 * sorted by run volume (most-active first). Agents with no activity are
 * still listed (zeros) so newly-created profiles are visible.
 */
export function getAgentPerformance(): AgentPerformance[] {
  const runsAgg = runsByProfile();
  const missionsAgg = missionsByProfile();
  // Built once for the whole population: the tree every profile counts against
  // is the same, only the denylist differs. Asks the agent module through the
  // composition root, which is where the profile cards' number comes from too,
  // and degrades to zero the way every other read here does.
  const skillsFor = createAgentSkillsCounter();
  const agents: AgentPerformance[] = [];

  const push = (slug: string, name: string, personality: string | undefined, toolsets: string | null) => {
    const r = runsAgg.get(slug) ?? { runs: 0, completed: 0, tokens: 0, durSum: 0, durCount: 0 };
    const m = missionsAgg.get(slug) ?? { completed: 0, failed: 0 };
    agents.push({
      slug,
      name,
      personality,
      runs: r.runs,
      runsCompleted: r.completed,
      missionsCompleted: m.completed,
      missionsFailed: m.failed,
      totalTokens: r.tokens,
      avgDurationSec: r.durCount > 0 ? Math.round(r.durSum / r.durCount) : 0,
      skills: skillsFor(slug),
      toolsets: jsonLen(toolsets),
    });
  };

  try {
    const root = readAgentRootStatsRow();
    if (root) {
      push("default", root.display_name || "Bob", root.personality, root.platform_toolsets);
    }
    const profiles = readAgentProfileStatsRows();
    for (const p of profiles) {
      push(p.slug, p.display_name || p.slug, p.personality, p.platform_toolsets);
    }
  } catch {
    /* profiles table missing — return whatever we have */
  }

  agents.sort((a, b) => b.runs - a.runs || a.name.localeCompare(b.name));
  return agents;
}
