// ═══════════════════════════════════════════════════════════════
// stats/derive.ts — pure gamification + stats derivation
//
// No DB, no IO — all functions are deterministic so they can be unit-tested
// directly. The stats repository feeds raw counts/time-series in; the dashboard
// renders what comes out.
// ═══════════════════════════════════════════════════════════════

/** Raw metrics the repository measures from the DB. */
export interface RawMetrics {
  completedMissions: number;
  failedMissions: number;
  completedRuns: number;
  totalTokens: number;
  stories: number;
  schedulesEnabled: number;
  scriptsEnabled: number;
  longestStreak: number;
  currentStreak: number;
  /** Hours (0–23, local) at which runs completed — for the "night owl" badge. */
  completionHours: number[];
}

export interface LevelInfo {
  level: number;
  title: string;
  xp: number;
  /** XP accumulated within the current level. */
  xpIntoLevel: number;
  /** XP span of the current level (xpIntoLevel / xpForLevel = progress). */
  xpForLevel: number;
  /** 0–1 progress toward the next level. */
  progress: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  unlocked: boolean;
  progress: number; // 0–1
  current: number;
  target: number;
}

/** XP awarded per unit of work. Tuned so a few real missions move the needle. */
export const XP = {
  perCompletedMission: 100,
  perCompletedRun: 25,
  perStory: 150,
  perThousandTokens: 1,
} as const;

const LEVEL_TITLES = [
  "Initiate",
  "Operator",
  "Handler",
  "Orchestrator",
  "Architect",
  "Tactician",
  "Commander",
  "Overseer",
  "Mastermind",
  "Singularity",
] as const;

/** Total XP from raw work counts. */
export function computeXp(m: Pick<RawMetrics, "completedMissions" | "completedRuns" | "stories" | "totalTokens">): number {
  return Math.round(
    m.completedMissions * XP.perCompletedMission +
      m.completedRuns * XP.perCompletedRun +
      m.stories * XP.perStory +
      (m.totalTokens / 1000) * XP.perThousandTokens,
  );
}

/**
 * Triangular level curve: level L starts at cumulative XP 50·L·(L−1), so each
 * level costs 100·L more than the last (gentle early, steeper later).
 */
function xpAtLevelStart(level: number): number {
  return 50 * level * (level - 1);
}

export function computeLevel(xp: number): LevelInfo {
  const safeXp = Math.max(0, Math.floor(xp));
  let level = 1;
  while (xpAtLevelStart(level + 1) <= safeXp) level++;
  const start = xpAtLevelStart(level);
  const next = xpAtLevelStart(level + 1);
  const xpForLevel = next - start;
  const xpIntoLevel = safeXp - start;
  const title = LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)];
  return {
    level,
    title,
    xp: safeXp,
    xpIntoLevel,
    xpForLevel,
    progress: xpForLevel > 0 ? xpIntoLevel / xpForLevel : 0,
  };
}

/**
 * Current + longest daily streak from a set of active dates (YYYY-MM-DD).
 * The current streak counts back from today (a streak stays alive if the most
 * recent activity was today or yesterday, so an early-morning check doesn't
 * read the streak as already broken).
 */
export function computeStreaks(
  activeDates: Iterable<string>,
  today: string,
): { current: number; longest: number } {
  const set = new Set(activeDates);
  if (set.size === 0) return { current: 0, longest: 0 };

  const dayMs = 86_400_000;
  const toMs = (d: string) => Date.parse(`${d}T00:00:00Z`);
  const fromMs = (ms: number) => new Date(ms).toISOString().slice(0, 10);

  // Longest run of consecutive days anywhere in the set.
  const sorted = [...set].sort();
  let longest = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (toMs(sorted[i]) - toMs(sorted[i - 1]) === dayMs) {
      run++;
      longest = Math.max(longest, run);
    } else {
      run = 1;
    }
  }

  // Current streak: walk back from today (allowing yesterday as the anchor).
  const todayMs = toMs(today);
  let anchor: number | null = null;
  if (set.has(today)) anchor = todayMs;
  else if (set.has(fromMs(todayMs - dayMs))) anchor = todayMs - dayMs;

  let current = 0;
  if (anchor !== null) {
    let cursor = anchor;
    while (set.has(fromMs(cursor))) {
      current++;
      cursor -= dayMs;
    }
  }

  return { current, longest: Math.max(longest, current) };
}

const ACHIEVEMENT_DEFS: Array<{
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  target: number;
  measure: (m: RawMetrics) => number;
}> = [
  { id: "first-contact", name: "First Contact", description: "Complete your first mission", icon: "Rocket", color: "cyan", target: 1, measure: (m) => m.completedMissions },
  { id: "field-agent", name: "Field Agent", description: "Complete 10 missions", icon: "Target", color: "green", target: 10, measure: (m) => m.completedMissions },
  { id: "veteran", name: "Veteran", description: "Complete 100 missions", icon: "Medal", color: "purple", target: 100, measure: (m) => m.completedMissions },
  { id: "on-a-roll", name: "On A Roll", description: "Maintain a 7-day streak", icon: "Flame", color: "orange", target: 7, measure: (m) => m.longestStreak },
  { id: "unstoppable", name: "Unstoppable", description: "Maintain a 30-day streak", icon: "Zap", color: "yellow", target: 30, measure: (m) => m.longestStreak },
  { id: "token-baron", name: "Token Baron", description: "Burn 1M tokens", icon: "Coins", color: "yellow", target: 1_000_000, measure: (m) => m.totalTokens },
  { id: "token-tycoon", name: "Token Tycoon", description: "Burn 10M tokens", icon: "Gem", color: "pink", target: 10_000_000, measure: (m) => m.totalTokens },
  { id: "automator", name: "Automator", description: "Run a scheduled mission or script", icon: "Bot", color: "cyan", target: 1, measure: (m) => m.schedulesEnabled + m.scriptsEnabled },
  { id: "scriptsmith", name: "Scriptsmith", description: "Automate 5 scripts on a timer", icon: "Terminal", color: "green", target: 5, measure: (m) => m.scriptsEnabled },
  { id: "storyteller", name: "Storyteller", description: "Weave a story", icon: "BookOpen", color: "pink", target: 1, measure: (m) => m.stories },
  { id: "night-owl", name: "Night Owl", description: "Finish a run between midnight and 5am", icon: "Moon", color: "purple", target: 1, measure: (m) => (m.completionHours.some((h) => h >= 0 && h < 5) ? 1 : 0) },
];

export function evaluateAchievements(m: RawMetrics): Achievement[] {
  return ACHIEVEMENT_DEFS.map((def) => {
    const current = def.measure(m);
    return {
      id: def.id,
      name: def.name,
      description: def.description,
      icon: def.icon,
      color: def.color,
      current,
      target: def.target,
      unlocked: current >= def.target,
      progress: def.target > 0 ? Math.min(1, current / def.target) : 0,
    };
  });
}

/** Success rate over completed + failed missions (0–1; 0 when no terminal missions). */
export function successRate(completed: number, failed: number): number {
  const total = completed + failed;
  return total > 0 ? completed / total : 0;
}
