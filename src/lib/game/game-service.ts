// ═══════════════════════════════════════════════════════════════
// game/game-service.ts — orchestration (metrics → engine → awards)
//
// loadGameSnapshot() gathers metrics, reconciles newly-earned achievements +
// quest progress through the idempotent game_events ledger (award exactly once),
// then assembles the snapshot. Pulls/claims/equips mutate persisted state.
// Cosmetic-only; never touches product data.
// ═══════════════════════════════════════════════════════════════

import { gatherGameMetrics } from "./metrics";
import * as repo from "./game-repository";
import { buildSnapshot, type GameSnapshot } from "./engine";
import { evaluateAchievements, evaluateQuests } from "./evaluate";
import { QUESTS, periodKey } from "./content/quests";
import { cosmeticById } from "./content/cosmetics";
import { POOLS } from "./content/gacha";
import { pullOnce } from "./gacha";
import { makeRng, randomSeed } from "./rng";
import type { CosmeticType, PullResult } from "./types";

export interface GameView {
  snapshot: GameSnapshot;
  events: repo.GameEvent[];
  unlockedNow: { id: string; name: string; rarity: string }[];
}

export function loadGameSnapshot(): GameView {
  const { metrics, agents } = gatherGameMetrics();
  const unlockedIds = repo.getUnlockedIds("achievement");
  const unlockedNow: { id: string; name: string; rarity: string }[] = [];

  // Reconcile achievements — award once via the ledger.
  for (const a of evaluateAchievements(metrics, unlockedIds)) {
    if (!a.unlocked || unlockedIds.has(a.def.id)) continue;
    if (repo.recordUnlock("achievement", a.def.id)) {
      if (repo.recordEvent("award", `ach:${a.def.id}`, { cores: a.def.rewardCores, xp: 0, kind: "achievement", id: a.def.id, name: a.def.name, rarity: a.def.rarity })) {
        repo.updatePlayer({ coresDelta: a.def.rewardCores });
        if (a.def.rewardCosmetic) repo.addCosmetic(a.def.rewardCosmetic);
      }
      unlockedIds.add(a.def.id);
      unlockedNow.push({ id: a.def.id, name: a.def.name, rarity: a.def.rarity });
    }
  }

  // Persist quest progress (claims are explicit).
  const dailyK = periodKey("daily");
  const weeklyK = periodKey("weekly");
  const rows = repo.getQuestRows([dailyK, weeklyK]);
  const claimedIds = new Set([...rows.values()].filter((r) => r.claimed_at).map((r) => r.quest_id));
  for (const q of evaluateQuests(metrics, claimedIds)) {
    repo.upsertQuestProgress(q.def.period === "daily" ? dailyK : weeklyK, q.def.id, q.progress, q.complete);
  }

  // Track per-agent xp (roster persistence; cards still derive live).
  for (const a of agents) {
    repo.setAgentXp(a.slug, a.missionsCompleted * 100 + a.runs * 25 + Math.floor(a.totalTokens / 1000));
  }
  repo.updatePlayer({ lastSeenAt: new Date().toISOString() });

  const snapshot = buildSnapshot({
    metrics,
    player: repo.getPlayerState(),
    unlockedAchievementIds: unlockedIds,
    claimedQuestIds: claimedIds,
    ownedCosmeticIds: repo.getOwnedCosmeticIds(),
    agents,
    bonusXp: repo.getBonusXp(),
  });
  return { snapshot, events: repo.recentEvents(12), unlockedNow };
}

export function claimQuestReward(questId: string): { ok: boolean; error?: string; cores?: number; xp?: number } {
  const def = QUESTS.find((q) => q.id === questId);
  if (!def) return { ok: false, error: "Unknown quest" };
  const pk = periodKey(def.period);
  const { metrics } = gatherGameMetrics();
  const progress = Math.max(0, metrics[def.metric] ?? 0);
  const complete = progress >= def.target;
  repo.upsertQuestProgress(pk, def.id, progress, complete);
  if (!complete) return { ok: false, error: "Not complete yet" };
  if (!repo.claimQuest(pk, def.id)) return { ok: false, error: "Already claimed" };
  if (repo.recordEvent("award", `quest:${pk}:${def.id}`, { cores: def.rewardCores, xp: def.rewardXp, kind: "quest", id: def.id, name: def.name })) {
    repo.updatePlayer({ coresDelta: def.rewardCores });
  }
  return { ok: true, cores: def.rewardCores, xp: def.rewardXp };
}

export function synthesisPull(): { ok: boolean; error?: string; result?: PullResult; cores?: number } {
  const pool = POOLS[0];
  const player = repo.getPlayerState();
  if (player.cores < pool.costCores) return { ok: false, error: "Not enough Cores" };

  const { result, nextPity } = pullOnce(pool, makeRng(randomSeed()), repo.getOwnedCosmeticIds(), player.pity);
  const { firstTime } = repo.addCosmetic(result.item.id);
  const duplicate = !firstTime;
  const shards = duplicate ? result.shards : 0;
  repo.updatePlayer({ coresDelta: -pool.costCores, pity: nextPity, shardsDelta: shards });
  repo.recordEvent("pull", null, { item: result.item.id, name: result.item.name, rarity: result.rarity, duplicate });

  return { ok: true, result: { ...result, duplicate, shards }, cores: player.cores - pool.costCores };
}

export function equipCosmetic(type: CosmeticType, itemId: string): { ok: boolean; error?: string } {
  const equipped = { ...repo.getPlayerState().equipped };
  if (!itemId) {
    delete equipped[type];
    repo.updatePlayer({ equipped });
    return { ok: true };
  }
  const item = cosmeticById(itemId);
  if (!item || item.type !== type) return { ok: false, error: "Invalid item for slot" };
  if (!repo.getOwnedCosmeticIds().has(itemId)) return { ok: false, error: "Not owned" };
  equipped[type] = itemId;
  repo.updatePlayer({ equipped });
  return { ok: true };
}

export function equipAgentCosmetic(slug: string, type: CosmeticType, itemId: string): { ok: boolean; error?: string } {
  const current = { ...(repo.listAgentStates().get(slug)?.equipped ?? {}) };
  if (!itemId) {
    delete current[type];
    repo.setAgentEquipped(slug, current);
    return { ok: true };
  }
  const item = cosmeticById(itemId);
  if (!item || item.type !== type) return { ok: false, error: "Invalid item for slot" };
  if (!repo.getOwnedCosmeticIds().has(itemId)) return { ok: false, error: "Not owned" };
  current[type] = itemId;
  repo.setAgentEquipped(slug, current);
  return { ok: true };
}
