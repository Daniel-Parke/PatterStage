import type { QuestDef } from "../types";

/**
 * Daily + weekly quests. `metric` keys are computed by the engine from the stats
 * aggregate (see engine.ts `questMetrics`). Rewards are Cores + account XP.
 */
export const QUESTS: QuestDef[] = [
  // ── daily ──
  { id: "d-dispatch", name: "On Duty", description: "Dispatch 3 missions today", metric: "missionsToday", target: 3, period: "daily", rewardCores: 50, rewardXp: 60, icon: "Rocket" },
  { id: "d-complete", name: "Closer", description: "Complete a run today", metric: "runsCompletedToday", target: 1, period: "daily", rewardCores: 30, rewardXp: 40, icon: "CheckCircle2" },
  { id: "d-streak", name: "Keep the Flame", description: "Keep your daily streak alive", metric: "streakAlive", target: 1, period: "daily", rewardCores: 25, rewardXp: 30, icon: "Flame" },
  // ── weekly ──
  { id: "w-missions", name: "Operation Week", description: "Complete 15 missions this week", metric: "missionsCompletedWeek", target: 15, period: "weekly", rewardCores: 220, rewardXp: 320, icon: "Target" },
  { id: "w-automate", name: "Set It & Forget It", description: "Keep 3 automations live", metric: "automationsLive", target: 3, period: "weekly", rewardCores: 160, rewardXp: 200, icon: "Bot" },
  { id: "w-tokens", name: "Burn Rate", description: "Burn 500k tokens this week", metric: "tokensWeek", target: 500_000, period: "weekly", rewardCores: 180, rewardXp: 240, icon: "Coins" },
];

/** ISO period keys so progress + claims reset on the right cadence. */
export function dailyKey(d: Date = new Date()): string {
  return `D-${d.toISOString().slice(0, 10)}`;
}
export function weeklyKey(d: Date = new Date()): string {
  // ISO week number.
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week =
    1 + Math.round(((date.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `W-${date.getUTCFullYear()}-${String(week).padStart(2, "0")}`;
}

export function periodKey(period: "daily" | "weekly", d: Date = new Date()): string {
  return period === "daily" ? dailyKey(d) : weeklyKey(d);
}
