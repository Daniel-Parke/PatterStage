import type { AchievementDef } from "../types";

/**
 * Achievement catalog. `metric` keys are computed by the engine from the stats
 * aggregate. First-time completion awards Cores (and optionally a cosmetic).
 * Expand freely — purely additive data.
 */
export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "first-contact", name: "First Contact", description: "Complete your first mission", icon: "Rocket", rarity: "common", metric: "completedMissions", target: 1, rewardCores: 50 },
  { id: "field-agent", name: "Field Agent", description: "Complete 10 missions", icon: "Target", rarity: "common", metric: "completedMissions", target: 10, rewardCores: 100 },
  { id: "veteran", name: "Veteran", description: "Complete 100 missions", icon: "Medal", rarity: "rare", metric: "completedMissions", target: 100, rewardCores: 400, rewardCosmetic: "frame-veteran" },
  { id: "legend", name: "Legend", description: "Complete 1,000 missions", icon: "Crown", rarity: "legendary", metric: "completedMissions", target: 1000, rewardCores: 2000, rewardCosmetic: "theme-gold-standard" },
  { id: "on-a-roll", name: "On A Roll", description: "Reach a 7-day streak", icon: "Flame", rarity: "rare", metric: "longestStreak", target: 7, rewardCores: 200 },
  { id: "unstoppable", name: "Unstoppable", description: "Reach a 30-day streak", icon: "Zap", rarity: "epic", metric: "longestStreak", target: 30, rewardCores: 600, rewardCosmetic: "emblem-streak" },
  { id: "centurion", name: "Centurion", description: "Reach a 100-day streak", icon: "Sparkles", rarity: "mythic", metric: "longestStreak", target: 100, rewardCores: 3000, rewardCosmetic: "theme-synthwave" },
  { id: "token-baron", name: "Token Baron", description: "Burn 1M tokens", icon: "Coins", rarity: "rare", metric: "totalTokens", target: 1_000_000, rewardCores: 250 },
  { id: "token-tycoon", name: "Token Tycoon", description: "Burn 10M tokens", icon: "Gem", rarity: "epic", metric: "totalTokens", target: 10_000_000, rewardCores: 800, rewardCosmetic: "cardart-tycoon" },
  { id: "token-titan", name: "Token Titan", description: "Burn 100M tokens", icon: "Diamond", rarity: "legendary", metric: "totalTokens", target: 100_000_000, rewardCores: 2500 },
  { id: "automator", name: "Automator", description: "Run a scheduled mission or script", icon: "Bot", rarity: "common", metric: "automationsLive", target: 1, rewardCores: 60 },
  { id: "scriptsmith", name: "Scriptsmith", description: "Keep 5 scripts on a timer", icon: "Terminal", rarity: "rare", metric: "scriptsEnabled", target: 5, rewardCores: 200, rewardCosmetic: "frame-scriptsmith" },
  { id: "conductor", name: "Conductor", description: "Keep 10 automations live", icon: "Clock", rarity: "epic", metric: "automationsLive", target: 10, rewardCores: 500 },
  { id: "storyteller", name: "Storyteller", description: "Weave a story", icon: "BookOpen", rarity: "common", metric: "stories", target: 1, rewardCores: 60 },
  { id: "novelist", name: "Novelist", description: "Weave 10 stories", icon: "Library", rarity: "epic", metric: "stories", target: 10, rewardCores: 500, rewardCosmetic: "banner-novelist" },
  { id: "flawless", name: "Flawless", description: "95%+ success over 20+ missions", icon: "ShieldCheck", rarity: "epic", metric: "flawless", target: 1, rewardCores: 500, rewardCosmetic: "emblem-flawless" },
  { id: "night-owl", name: "Night Owl", description: "Finish a run between midnight and 5am", icon: "Moon", rarity: "rare", metric: "nightOwl", target: 1, rewardCores: 150 },
  { id: "polyglot", name: "Polyglot", description: "Register 5 model providers", icon: "Layers", rarity: "rare", metric: "providers", target: 5, rewardCores: 180 },
  { id: "high-roller", name: "High Roller", description: "Perform 50 syntheses", icon: "Dices", rarity: "epic", metric: "pulls", target: 50, rewardCores: 400 },
  { id: "collector", name: "Collector", description: "Own 25 cosmetics", icon: "Boxes", rarity: "legendary", metric: "cosmeticsOwned", target: 25, rewardCores: 1000, rewardCosmetic: "frame-collector" },
];
