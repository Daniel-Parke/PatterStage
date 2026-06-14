import type { GachaPool } from "../types";

/** Gacha pools. Odds per rarity sum to 1; pity guarantees epic+ every N pulls. */
export const POOLS: GachaPool[] = [
  {
    id: "synthesis",
    name: "Standard Synthesis",
    costCores: 100,
    odds: { common: 0.6, rare: 0.28, epic: 0.09, legendary: 0.0175, mythic: 0.0025 },
    pity: 50,
  },
];

export function poolById(id: string): GachaPool | undefined {
  return POOLS.find((p) => p.id === id);
}
