import type { CosmeticItem } from "../types";
import { THEMES } from "./themes";

// Theme cosmetics are auto-derived from THEMES (add a theme → it's pullable).
// The default Cherenkov theme is owned by default and not a drop.
const themeCosmetics: CosmeticItem[] = THEMES.filter((t) => t.id !== "cherenkov").map((t) => ({
  id: `theme-${t.id}`,
  name: `${t.name} Theme`,
  type: "theme" as const,
  rarity: t.rarity,
  description: `Re-skin Control Hub with the ${t.name} palette.`,
  pool: "synthesis",
  data: { themeId: t.id },
}));

// Curated cosmetics. Items without a `pool` are reward-only (achievements/quests);
// the ids here must match the rewardCosmetic ids referenced in achievements.ts.
const curated: CosmeticItem[] = [
  // frames
  { id: "frame-neon", name: "Neon Frame", type: "frame", rarity: "common", description: "A clean neon edge.", pool: "synthesis" },
  { id: "frame-hex", name: "Hex Frame", type: "frame", rarity: "rare", description: "Hexagonal lattice border.", pool: "synthesis" },
  { id: "frame-prism", name: "Prism Frame", type: "frame", rarity: "epic", description: "Refractive prism border.", pool: "synthesis" },
  { id: "frame-singularity", name: "Singularity Frame", type: "frame", rarity: "mythic", description: "Event-horizon border.", pool: "synthesis" },
  { id: "frame-veteran", name: "Veteran Frame", type: "frame", rarity: "rare", description: "Earned through 100 missions." },
  { id: "frame-scriptsmith", name: "Scriptsmith Frame", type: "frame", rarity: "rare", description: "Earned by automating scripts." },
  { id: "frame-collector", name: "Collector Frame", type: "frame", rarity: "legendary", description: "Earned by owning 25 cosmetics." },
  // avatars
  { id: "avatar-bot", name: "Bot Avatar", type: "avatar", rarity: "common", description: "Classic agent face.", pool: "synthesis" },
  { id: "avatar-ghost", name: "Ghost Avatar", type: "avatar", rarity: "rare", description: "Spectral operative.", pool: "synthesis" },
  { id: "avatar-skull", name: "Skull Avatar", type: "avatar", rarity: "rare", description: "No-nonsense.", pool: "synthesis" },
  { id: "avatar-crown", name: "Crown Avatar", type: "avatar", rarity: "epic", description: "Royalty.", pool: "synthesis" },
  // banners
  { id: "banner-cherenkov", name: "Cherenkov Banner", type: "banner", rarity: "common", description: "Radiant blue sweep.", pool: "synthesis" },
  { id: "banner-grid", name: "Grid Banner", type: "banner", rarity: "rare", description: "Neon grid horizon.", pool: "synthesis" },
  { id: "banner-novelist", name: "Novelist Banner", type: "banner", rarity: "epic", description: "Earned by weaving 10 stories." },
  // titles
  { id: "title-operator", name: "“Operator”", type: "title", rarity: "common", description: "A display title.", pool: "synthesis" },
  { id: "title-nightowl", name: "“Night Owl”", type: "title", rarity: "rare", description: "A display title.", pool: "synthesis" },
  { id: "title-legend", name: "“Legend”", type: "title", rarity: "legendary", description: "A display title.", pool: "synthesis" },
  { id: "title-singularity", name: "“Singularity”", type: "title", rarity: "mythic", description: "A display title.", pool: "synthesis" },
  // emblems
  { id: "emblem-core", name: "Core Emblem", type: "emblem", rarity: "common", description: "Cherenkov core sigil.", pool: "synthesis" },
  { id: "emblem-streak", name: "Streak Emblem", type: "emblem", rarity: "epic", description: "Earned with a 30-day streak." },
  { id: "emblem-flawless", name: "Flawless Emblem", type: "emblem", rarity: "epic", description: "Earned by a flawless record." },
  // card art
  { id: "cardart-aurora", name: "Aurora Card Art", type: "cardart", rarity: "rare", description: "Aurora unit-card backdrop.", pool: "synthesis" },
  { id: "cardart-void", name: "Void Card Art", type: "cardart", rarity: "legendary", description: "Void unit-card backdrop.", pool: "synthesis" },
  { id: "cardart-tycoon", name: "Tycoon Card Art", type: "cardart", rarity: "epic", description: "Earned by burning 10M tokens." },
];

export const COSMETICS: CosmeticItem[] = [...themeCosmetics, ...curated];

const BY_ID = new Map(COSMETICS.map((c) => [c.id, c]));
export function cosmeticById(id: string): CosmeticItem | undefined {
  return BY_ID.get(id);
}
export function cosmeticsInPool(poolId: string): CosmeticItem[] {
  return COSMETICS.filter((c) => c.pool === poolId);
}
