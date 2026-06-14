// ═══════════════════════════════════════════════════════════════
// game/engine.ts — pure snapshot assembly
//
// buildSnapshot(input) is a pure function: given measured metrics + persisted
// game state, it produces everything the Arcade + dashboard band render. The
// API layer (G4) gathers metrics/state from repos, calls this, then writes any
// newly-earned rewards through the idempotent event ledger.
// ═══════════════════════════════════════════════════════════════

import { computeXp, computeLevel, computeTracks, rankForLevel } from "./progression";
import { evaluateQuests, evaluateAchievements } from "./evaluate";
import { deriveUnitCard, type AgentMetrics } from "./cards";
import { COSMETICS } from "./content/cosmetics";
import { POOLS } from "./content/gacha";
import { RARITY_ORDER } from "./types";
import type {
  ColorName,
  Rarity,
  LevelInfo,
  RankInfo,
  MasteryTrack,
  QuestProgress,
  AchievementState,
  CosmeticType,
  UnitCard,
  PlayerState,
} from "./types";

/** Flat metrics map; named keys documented, indexable for quest/achievement lookup. */
export interface GameMetrics extends Record<string, number> {
  // account XP sources
  completedMissions: number;
  completedRuns: number;
  stories: number;
  totalTokens: number;
  longestStreak: number;
  currentStreak: number;
  successRatePct: number;
  // per-track XP (precomputed)
  missionXp: number;
  automationXp: number;
  memoryXp: number;
  storyXp: number;
  modelXp: number;
  sessionXp: number;
  // quest metrics
  missionsToday: number;
  runsCompletedToday: number;
  streakAlive: number;
  missionsCompletedWeek: number;
  automationsLive: number;
  tokensWeek: number;
  // achievement metrics
  scriptsEnabled: number;
  providers: number;
  nightOwl: number;
  flawless: number;
  pulls: number;
  cosmeticsOwned: number;
}

export interface AttributeBar {
  label: string;
  value: number; // 0–100
  color: ColorName;
}

export interface CollectionStat {
  owned: number;
  total: number;
  byRarity: Record<Rarity, { owned: number; total: number }>;
}

export interface GameSnapshot {
  generatedAt: string;
  account: { level: LevelInfo; rank: RankInfo; xp: number };
  attributes: AttributeBar[];
  tracks: MasteryTrack[];
  quests: QuestProgress[];
  achievements: AchievementState[];
  currency: { cores: number; shards: number; pity: number; pityThreshold: number; pullCost: number };
  collection: CollectionStat;
  equipped: Partial<Record<CosmeticType, string>>;
  roster: UnitCard[];
}

export interface SnapshotInput {
  metrics: GameMetrics;
  player: PlayerState;
  unlockedAchievementIds: ReadonlySet<string>;
  claimedQuestIds: ReadonlySet<string>;
  ownedCosmeticIds: ReadonlySet<string>;
  agents: AgentMetrics[];
  /** Bonus account XP from claimed quest/achievement rewards (award ledger). */
  bonusXp?: number;
}

const log100 = (v: number, full: number): number =>
  Math.max(0, Math.min(100, Math.round((Math.log10(Math.max(0, v) + 1) / Math.log10(full + 1)) * 100)));

function computeAttributes(m: GameMetrics): AttributeBar[] {
  return [
    { label: "Power", value: log100(m.totalTokens, 50_000_000), color: "pink" },
    { label: "Throughput", value: log100(m.completedMissions, 2000), color: "cyan" },
    { label: "Discipline", value: Math.min(100, m.longestStreak * 3), color: "orange" },
    { label: "Automation", value: Math.min(100, m.automationsLive * 12), color: "green" },
    { label: "Reliability", value: Math.max(0, Math.min(100, m.successRatePct)), color: "purple" },
    { label: "Lore", value: Math.min(100, m.stories * 10), color: "yellow" },
  ];
}

function computeCollection(ownedIds: ReadonlySet<string>): CollectionStat {
  const byRarity = Object.fromEntries(RARITY_ORDER.map((r) => [r, { owned: 0, total: 0 }])) as CollectionStat["byRarity"];
  let owned = 0;
  for (const c of COSMETICS) {
    byRarity[c.rarity].total++;
    if (ownedIds.has(c.id)) {
      byRarity[c.rarity].owned++;
      owned++;
    }
  }
  return { owned, total: COSMETICS.length, byRarity };
}

export function buildSnapshot(input: SnapshotInput): GameSnapshot {
  const { metrics: m, player, unlockedAchievementIds, claimedQuestIds, ownedCosmeticIds, agents } = input;

  const xp =
    computeXp({
      completedMissions: m.completedMissions,
      completedRuns: m.completedRuns,
      stories: m.stories,
      totalTokens: m.totalTokens,
    }) + (input.bonusXp ?? 0);
  const level = computeLevel(xp);
  const pool = POOLS[0];

  return {
    generatedAt: new Date().toISOString(),
    account: { level, rank: rankForLevel(level.level), xp },
    attributes: computeAttributes(m),
    tracks: computeTracks(m),
    quests: evaluateQuests(m, claimedQuestIds),
    achievements: evaluateAchievements(m, unlockedAchievementIds),
    currency: {
      cores: player.cores,
      shards: player.shards,
      pity: player.pity,
      pityThreshold: pool.pity,
      pullCost: pool.costCores,
    },
    collection: computeCollection(ownedCosmeticIds),
    equipped: player.equipped,
    roster: agents.map(deriveUnitCard).sort((a, b) => b.power - a.power),
  };
}
