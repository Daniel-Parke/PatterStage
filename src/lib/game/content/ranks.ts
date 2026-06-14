import type { ColorName, RankInfo } from "../types";

/** Account rank tiers by level milestone (ascending). */
export const RANKS: { minLevel: number; name: string; color: ColorName }[] = [
  { minLevel: 1, name: "Initiate", color: "cyan" },
  { minLevel: 5, name: "Operator", color: "green" },
  { minLevel: 10, name: "Specialist", color: "green" },
  { minLevel: 16, name: "Tactician", color: "purple" },
  { minLevel: 24, name: "Architect", color: "purple" },
  { minLevel: 34, name: "Commander", color: "orange" },
  { minLevel: 46, name: "Overseer", color: "orange" },
  { minLevel: 60, name: "Mastermind", color: "pink" },
  { minLevel: 80, name: "Singularity", color: "pink" },
];

export function rankForLevel(level: number): RankInfo {
  let idx = 0;
  for (let i = 0; i < RANKS.length; i++) {
    if (level >= RANKS[i].minLevel) idx = i;
  }
  return { tier: idx + 1, name: RANKS[idx].name, color: RANKS[idx].color };
}
