// ═══════════════════════════════════════════════════════════════
// stats/derive.ts — pure gamification + stats derivation
//
// No DB, no IO — all functions are deterministic so they can be unit-tested
// directly. The stats repository feeds raw counts/time-series in; the dashboard
// renders what comes out.
// ═══════════════════════════════════════════════════════════════

import { COMPLETIONIST_EVENT_TYPES, type AnalyticsEventType } from "@/lib/analytics/event-types";
// A value import, and safe: quest-defs.ts imports RawMetrics from here TYPE-only,
// and a type import erases, so the two modules never close a runtime cycle.
import { QUEST_DEFS, questsInChapter, questsMet, questsMetInChapter } from "@/lib/quests/quest-defs";

/**
 * What the store holds now: proofs that are a state rather than an action
 * (the quest evaluator of B17 reads these beside the event ledger).
 */
export interface StoreFacts {
  /** Named profiles in agent_profiles; the root agent is not one of them. */
  profiles: number;
  models: number;
  credentials: number;
  workflows: number;
  /** A memory provider the operator saved: active, enabled, and not the seeded guess (T-0077). */
  memoryConfigured: boolean;
}

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
  /** Hours (0–23, UTC) at which runs completed — for night-owl / early-bird. */
  completionHours: number[];
  // ── interaction-event-derived (analytics_events; 0 on a fresh/pre-v12 DB) ──
  dispatchedMissions: number;
  /** Busiest single day's mission dispatches — for the "blitz" badge. */
  maxMissionsInADay: number;
  chaptersGenerated: number;
  storiesCompleted: number;
  sessionsStarted: number;
  schedulesCreated: number;
  schedulesFired: number;
  skillToggles: number;
  personalityChanges: number;
  modelConfigs: number;
  chatMessages: number;
  /** Distinct agent profiles seen across events — for "polyglot". */
  distinctProfiles: number;
  /** Distinct event types ever recorded — for the breadth ladder. */
  distinctEventTypes: number;
  /** Every event type counted all-time, 0 when never recorded: the ledger (T-0098). */
  eventCounts: Partial<Record<AnalyticsEventType, number>>;
  facts: StoreFacts;
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

export type AchievementTier = "common" | "rare" | "epic" | "legendary";

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
  /** Rarity tier (curated) — drives the "rarest/most-valuable" showcase. */
  tier: AchievementTier;
  /** Points awarded on unlock, derived from tier. */
  points: number;
}

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

/**
 * Which record an achievement belongs to (ADR-0004).
 *
 * `agent` describes the Body: work it completed, capability it gained,
 * equipment it accumulated. `recroom` is creative activity in the Rec Room —
 * still worth celebrating, but it is the operator having fun, not an agent
 * learning anything, so it is counted separately and never feeds agent XP.
 */
export type AchievementScope = "agent" | "recroom";

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  target: number;
  measure: (m: RawMetrics) => number;
  /** Defaults to "agent" when omitted. */
  scope?: AchievementScope;
}

export function achievementScope(def: AchievementDef): AchievementScope {
  return def.scope ?? "agent";
}

/** Points per tier (rarer = more valuable). */
export const TIER_POINTS: Record<AchievementTier, number> = {
  common: 10,
  rare: 25,
  epic: 50,
  legendary: 100,
};

/**
 * Curated rarity per achievement id. Content-as-data: the "rarest/most-valuable"
 * showcase ranks by tier (then points, then progress). Anything not listed
 * defaults to "common" (the easy, target≈1 entry-level achievements).
 */
const ACHIEVEMENT_TIER: Record<string, AchievementTier> = {
  // Legendary — the grindiest milestones
  legend: "legendary",
  "epic-scribe": "legendary",
  marathon: "legendary",
  "cron-lord": "legendary",
  "token-tycoon": "legendary",
  centurion: "legendary",
  completionist: "legendary",
  // Epic
  veteran: "epic",
  "saga-weaver": "epic",
  wordsmith: "epic",
  "skill-architect": "epic",
  "set-and-forget": "epic",
  chatterbox: "epic",
  "token-baron": "epic",
  unstoppable: "epic",
  renaissance: "epic",
  // Rare
  "field-agent": "rare",
  dispatcher: "rare",
  blitz: "rare",
  resilient: "rare",
  novelist: "rare",
  operator: "rare",
  scriptsmith: "rare",
  clockwork: "rare",
  tinkerer: "rare",
  "model-mechanic": "rare",
  conversationalist: "rare",
  "on-a-roll": "rare",
  polyglot: "rare",
  shapeshifter: "rare",
  // The quest chains (B17): a chapter finished is worth more than any single
  // step in it, and the whole programme is the rarest thing on the board.
  "first-hour": "rare",
  "agent-shaper": "epic",
  clockmaker: "epic",
  curriculum: "legendary",
  // Common (default): first-contact, storyteller, automator, first-words,
  // night-owl, early-bird.
};

export function achievementTier(id: string): AchievementTier {
  return ACHIEVEMENT_TIER[id] ?? "common";
}

export function achievementPoints(id: string): number {
  return TIER_POINTS[achievementTier(id)];
}

export const ACHIEVEMENT_DEFS: AchievementDef[] = [
  // ── Missions ──
  { id: "first-contact", name: "First Contact", description: "Complete your first mission", icon: "Rocket", color: "cyan", target: 1, measure: (m) => m.completedMissions },
  { id: "field-agent", name: "Field Agent", description: "Complete 10 missions", icon: "Target", color: "green", target: 10, measure: (m) => m.completedMissions },
  { id: "veteran", name: "Veteran", description: "Complete 100 missions", icon: "Medal", color: "purple", target: 100, measure: (m) => m.completedMissions },
  { id: "legend", name: "Legend", description: "Complete 500 missions", icon: "Crown", color: "yellow", target: 500, measure: (m) => m.completedMissions },
  { id: "dispatcher", name: "Dispatcher", description: "Dispatch 50 mission runs", icon: "Send", color: "cyan", target: 50, measure: (m) => m.dispatchedMissions },
  { id: "blitz", name: "Blitz", description: "Dispatch 5 missions in a single day", icon: "Gauge", color: "orange", target: 5, measure: (m) => m.maxMissionsInADay },
  { id: "resilient", name: "Resilient", description: "Weather 10 failed missions", icon: "ShieldCheck", color: "green", target: 10, measure: (m) => m.failedMissions },

  // ── Stories ──
  { id: "storyteller", name: "Storyteller", description: "Weave your first story", icon: "BookOpen", color: "pink", target: 1, measure: (m) => m.stories, scope: "recroom" },
  { id: "novelist", name: "Novelist", description: "Weave 10 stories", icon: "Library", color: "pink", target: 10, measure: (m) => m.stories, scope: "recroom" },
  { id: "saga-weaver", name: "Saga Weaver", description: "Complete 5 stories", icon: "BookCheck", color: "purple", target: 5, measure: (m) => m.storiesCompleted, scope: "recroom" },
  { id: "wordsmith", name: "Wordsmith", description: "Generate 25 chapters", icon: "PenLine", color: "cyan", target: 25, measure: (m) => m.chaptersGenerated, scope: "recroom" },
  { id: "epic-scribe", name: "Epic Scribe", description: "Generate 100 chapters", icon: "Feather", color: "yellow", target: 100, measure: (m) => m.chaptersGenerated, scope: "recroom" },

  // ── Sessions ──
  { id: "operator", name: "Operator", description: "Start 25 agent sessions", icon: "MessagesSquare", color: "cyan", target: 25, measure: (m) => m.sessionsStarted },
  { id: "marathon", name: "Marathon", description: "Start 250 agent sessions", icon: "Infinity", color: "purple", target: 250, measure: (m) => m.sessionsStarted },

  // ── Automation ──
  { id: "automator", name: "Automator", description: "Run a scheduled mission or script", icon: "Bot", color: "cyan", target: 1, measure: (m) => m.schedulesEnabled + m.scriptsEnabled },
  { id: "scriptsmith", name: "Scriptsmith", description: "Automate 5 scripts on a timer", icon: "Terminal", color: "green", target: 5, measure: (m) => m.scriptsEnabled },
  { id: "clockwork", name: "Clockwork", description: "Create 5 schedules", icon: "Timer", color: "cyan", target: 5, measure: (m) => m.schedulesCreated },
  { id: "set-and-forget", name: "Set & Forget", description: "Fire 50 scheduled runs", icon: "Repeat", color: "green", target: 50, measure: (m) => m.schedulesFired },
  { id: "cron-lord", name: "Cron Lord", description: "Fire 500 scheduled runs", icon: "CalendarClock", color: "yellow", target: 500, measure: (m) => m.schedulesFired },

  // ── Skills & config ──
  { id: "tinkerer", name: "Tinkerer", description: "Toggle 10 skills", icon: "ToggleRight", color: "cyan", target: 10, measure: (m) => m.skillToggles },
  { id: "skill-architect", name: "Skill Architect", description: "Toggle 50 skills", icon: "SlidersHorizontal", color: "purple", target: 50, measure: (m) => m.skillToggles },
  { id: "shapeshifter", name: "Shapeshifter", description: "Change personality 5 times", icon: "Users", color: "pink", target: 5, measure: (m) => m.personalityChanges },
  { id: "model-mechanic", name: "Model Mechanic", description: "Configure models 10 times", icon: "Cpu", color: "orange", target: 10, measure: (m) => m.modelConfigs },

  // ── Chat ──
  { id: "first-words", name: "First Words", description: "Send your first chat message", icon: "Mic", color: "cyan", target: 1, measure: (m) => m.chatMessages },
  { id: "conversationalist", name: "Conversationalist", description: "Send 100 chat messages", icon: "MessageCircle", color: "green", target: 100, measure: (m) => m.chatMessages },
  { id: "chatterbox", name: "Chatterbox", description: "Send 1,000 chat messages", icon: "Megaphone", color: "pink", target: 1000, measure: (m) => m.chatMessages },

  // ── Tokens ──
  { id: "token-baron", name: "Token Baron", description: "Burn 1M tokens", icon: "Coins", color: "yellow", target: 1_000_000, measure: (m) => m.totalTokens },
  { id: "token-tycoon", name: "Token Tycoon", description: "Burn 10M tokens", icon: "Gem", color: "pink", target: 10_000_000, measure: (m) => m.totalTokens },

  // ── Streaks ──
  { id: "on-a-roll", name: "On A Roll", description: "Maintain a 7-day streak", icon: "Flame", color: "orange", target: 7, measure: (m) => m.longestStreak },
  { id: "unstoppable", name: "Unstoppable", description: "Maintain a 30-day streak", icon: "Zap", color: "yellow", target: 30, measure: (m) => m.longestStreak },
  { id: "centurion", name: "Centurion", description: "Maintain a 100-day streak", icon: "Trophy", color: "yellow", target: 100, measure: (m) => m.longestStreak },

  // ── Time of day ──
  { id: "night-owl", name: "Night Owl", description: "Finish a run between midnight and 5am", icon: "Moon", color: "purple", target: 1, measure: (m) => (m.completionHours.some((h) => h >= 0 && h < 5) ? 1 : 0) },
  { id: "early-bird", name: "Early Bird", description: "Finish a run between 5am and 9am", icon: "Sunrise", color: "orange", target: 1, measure: (m) => (m.completionHours.some((h) => h >= 5 && h < 9) ? 1 : 0) },

  // ── Breadth ──
  { id: "polyglot", name: "Polyglot", description: "Use 3 different agent profiles", icon: "Boxes", color: "cyan", target: 3, measure: (m) => m.distinctProfiles },
  { id: "renaissance", name: "Renaissance", description: "Trigger 8 different event types", icon: "Compass", color: "green", target: 8, measure: (m) => m.distinctEventTypes },
  // Measured against the curated list, from the ledger: a type counts once it
  // has been recorded at all, a failure never counts, and a type nothing emits
  // yet is not on the list (T-0098).
  {
    id: "completionist",
    name: "Completionist",
    description: `Trigger all ${COMPLETIONIST_EVENT_TYPES.length} core event types`,
    icon: "Sparkles",
    color: "yellow",
    target: COMPLETIONIST_EVENT_TYPES.length,
    measure: (m) => COMPLETIONIST_EVENT_TYPES.filter((t) => (m.eventCounts[t] ?? 0) > 0).length,
  },

  // ── Quest chains (B17) ──
  // Each measures the quest PROOFS rather than the quest latch: this function
  // runs before the latch is read, and an achievement that depended on it would
  // be reading a value that does not exist yet. Their own high-water mark is
  // the progression ledger, exactly as it is for every achievement above.
  //
  // Each target is COUNTED from the catalogue rather than typed out: a chapter
  // that gains a step would otherwise start awarding "Finish chapter 4" to an
  // operator who had not.
  { id: "first-hour", name: "First Hour", description: "Finish chapter 1: Get running", icon: "Flag", color: "cyan", target: questsInChapter(1).length, measure: (m) => questsMetInChapter(m, 1) },
  { id: "agent-shaper", name: "Agent Shaper", description: "Finish chapter 3: Shape your agent", icon: "Wand2", color: "purple", target: questsInChapter(3).length, measure: (m) => questsMetInChapter(m, 3) },
  { id: "clockmaker", name: "Clockmaker", description: "Finish chapter 4: Automate and watch", icon: "Cog", color: "green", target: questsInChapter(4).length, measure: (m) => questsMetInChapter(m, 4) },
  // Rec Room scope, and not because finishing every quest is play: chapter 6 is
  // Rec Room, so an agent-scoped Curriculum would let a story the operator wrote
  // for fun move the Body's record. ADR-0004 decision 5 keeps those apart, and
  // `recroom` is the bucket that means "never feeds agent XP".
  { id: "curriculum", name: "Curriculum", description: "Finish every quest", icon: "GraduationCap", color: "yellow", target: QUEST_DEFS.length, measure: (m) => questsMet(m), scope: "recroom" },
];

export function evaluateAchievements(m: RawMetrics): Achievement[] {
  return ACHIEVEMENT_DEFS.map((def) => {
    const current = def.measure(m);
    const tier = achievementTier(def.id);
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
      tier,
      points: TIER_POINTS[tier],
    };
  });
}

/** Success rate over completed + failed missions (0–1; 0 when no terminal missions). */
export function successRate(completed: number, failed: number): number {
  const total = completed + failed;
  return total > 0 ? completed / total : 0;
}
