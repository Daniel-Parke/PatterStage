// Pure quest + achievement evaluation against a flat metrics map. `unlocked` /
// `claimed` carry the persisted sticky state so one-time things don't un-earn.

import { QUESTS } from "./content/quests";
import { ACHIEVEMENTS } from "./content/achievements";
import type { QuestProgress, AchievementState } from "./types";

export function evaluateQuests(
  metrics: Record<string, number>,
  claimedIds: ReadonlySet<string>,
): QuestProgress[] {
  return QUESTS.map((def) => {
    const progress = Math.max(0, metrics[def.metric] ?? 0);
    return {
      def,
      progress,
      complete: progress >= def.target,
      claimed: claimedIds.has(def.id),
    };
  });
}

export function evaluateAchievements(
  metrics: Record<string, number>,
  unlockedIds: ReadonlySet<string>,
): AchievementState[] {
  return ACHIEVEMENTS.map((def) => {
    const current = Math.max(0, metrics[def.metric] ?? 0);
    const unlocked = unlockedIds.has(def.id) || current >= def.target;
    return {
      def,
      current,
      progress: def.target > 0 ? Math.min(1, current / def.target) : 0,
      unlocked,
    };
  });
}

/** Quest/achievement ids newly satisfied but not yet recorded — what to award. */
export function newlyCompleted(
  quests: QuestProgress[],
  achievements: AchievementState[],
  recordedQuestIds: ReadonlySet<string>,
  recordedAchievementIds: ReadonlySet<string>,
): { quests: QuestProgress[]; achievements: AchievementState[] } {
  return {
    quests: quests.filter((q) => q.complete && !recordedQuestIds.has(q.def.id)),
    achievements: achievements.filter((a) => a.unlocked && !recordedAchievementIds.has(a.def.id)),
  };
}
