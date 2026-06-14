// ═══════════════════════════════════════════════════════════════
// game/types.ts — shared gamification types
//
// The engine speaks in colour NAMES (matching the neon design tokens) so it
// stays decoupled from the UI; components resolve names to CSS via
// components/viz/colors. Gamification is purely cosmetic — nothing here gates
// any product functionality.
// ═══════════════════════════════════════════════════════════════

export type ColorName = "cyan" | "purple" | "pink" | "green" | "orange" | "yellow";

export type Rarity = "common" | "rare" | "epic" | "legendary" | "mythic";

export const RARITY_ORDER: Rarity[] = ["common", "rare", "epic", "legendary", "mythic"];

export const RARITY_COLOR: Record<Rarity, ColorName> = {
  common: "cyan",
  rare: "green",
  epic: "purple",
  legendary: "orange",
  mythic: "pink",
};

/** Shards awarded when a pulled cosmetic is a duplicate (already owned). */
export const RARITY_SHARDS: Record<Rarity, number> = {
  common: 5,
  rare: 15,
  epic: 50,
  legendary: 150,
  mythic: 500,
};

// ── Progression ──────────────────────────────────────────────

export interface LevelInfo {
  level: number;
  title: string;
  xp: number;
  xpIntoLevel: number;
  xpForLevel: number;
  progress: number;
}

export interface RankInfo {
  tier: number;
  name: string;
  color: ColorName;
}

export interface MasteryTrack {
  id: string;
  name: string;
  icon: string;
  color: ColorName;
  xp: number;
  level: LevelInfo;
}

// ── Quests ───────────────────────────────────────────────────

export type QuestPeriod = "daily" | "weekly";

export interface QuestDef {
  id: string;
  name: string;
  description: string;
  /** Key into the engine's measured metrics (see engine.ts). */
  metric: string;
  target: number;
  period: QuestPeriod;
  rewardCores: number;
  rewardXp: number;
  icon: string;
}

export interface QuestProgress {
  def: QuestDef;
  progress: number;
  complete: boolean;
  claimed: boolean;
}

// ── Achievements ─────────────────────────────────────────────

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: Rarity;
  metric: string;
  target: number;
  rewardCores: number;
  /** Optional cosmetic id unlocked on first completion. */
  rewardCosmetic?: string;
}

export interface AchievementState {
  def: AchievementDef;
  current: number;
  progress: number;
  unlocked: boolean;
}

// ── Cosmetics ────────────────────────────────────────────────

export type CosmeticType = "theme" | "frame" | "avatar" | "banner" | "title" | "emblem" | "cardart";

export interface CosmeticItem {
  id: string;
  name: string;
  type: CosmeticType;
  rarity: Rarity;
  description: string;
  /** Which gacha pool drops this (omit = not pullable; quest/achievement only). */
  pool?: string;
  /** Type-specific payload (e.g. theme variable overrides). */
  data?: Record<string, string>;
}

export interface OwnedCosmetic {
  item: CosmeticItem;
  count: number;
  equipped: boolean;
}

// ── Gacha ────────────────────────────────────────────────────

export interface GachaPool {
  id: string;
  name: string;
  costCores: number;
  /** Drop odds per rarity (should sum to 1). */
  odds: Partial<Record<Rarity, number>>;
  /** Guaranteed epic-or-better at this pity count. */
  pity: number;
}

export interface PullResult {
  item: CosmeticItem;
  rarity: Rarity;
  duplicate: boolean;
  shards: number;
  /** True when the pity guarantee forced the rarity floor. */
  pityTriggered: boolean;
}

// ── Agent Unit Cards (battle-ready, portable) ────────────────

export interface UnitStats {
  hp: number;
  atk: number;
  def: number;
  spd: number;
  int: number;
  tec: number;
}

/** Portable card schema — the export seam for future online PvP/tournaments. */
export interface UnitCard {
  schema: "ch.unit-card/v1";
  slug: string;
  name: string;
  className: string;
  element: ColorName;
  level: number;
  rarity: Rarity;
  stats: UnitStats;
  /** Aggregate combat rating. */
  power: number;
  abilities: string[];
  /** Source metrics the stats were derived from (for transparency/debug). */
  source: {
    runs: number;
    missionsCompleted: number;
    successRate: number;
    totalTokens: number;
    avgDurationSec: number;
    skills: number;
    toolsets: number;
  };
}

// ── Player + snapshot ────────────────────────────────────────

export interface PlayerState {
  cores: number;
  shards: number;
  pity: number;
  equipped: Partial<Record<CosmeticType, string>>;
  seasonId: string | null;
  lastSeenAt: string | null;
}
