// Agent Unit Cards — RPG stat cards derived from an agent profile's REAL
// performance (the more it runs + succeeds, the stronger the card). Pure +
// deterministic. The UnitCard shape is the portable schema for a future online
// arena / PvP / tournaments — keep it self-contained and serialisable.

import { computeLevel } from "./progression";
import type { ColorName, Rarity, UnitCard, UnitStats } from "./types";
import { RARITY_ORDER } from "./types";

export interface AgentMetrics {
  slug: string;
  name: string;
  personality?: string;
  runs: number;
  missionsCompleted: number;
  missionsFailed: number;
  totalTokens: number;
  avgDurationSec: number;
  skills: number;
  toolsets: number;
  contextLength?: number;
}

const clamp = (v: number): number => Math.max(1, Math.min(99, Math.round(v)));

function rarityFromPower(power: number): Rarity {
  if (power >= 430) return "mythic";
  if (power >= 320) return "legendary";
  if (power >= 220) return "epic";
  if (power >= 130) return "rare";
  return "common";
}

const STAT_CLASS: Record<keyof UnitStats, { className: string; element: ColorName }> = {
  hp: { className: "Bulwark", element: "green" },
  atk: { className: "Striker", element: "pink" },
  def: { className: "Sentinel", element: "cyan" },
  spd: { className: "Phantom", element: "orange" },
  int: { className: "Sage", element: "purple" },
  tec: { className: "Artificer", element: "yellow" },
};

function dominantStat(stats: UnitStats): keyof UnitStats {
  return (Object.keys(stats) as (keyof UnitStats)[]).reduce((a, b) => (stats[b] > stats[a] ? b : a));
}

function abilitiesFor(a: AgentMetrics, stats: UnitStats): string[] {
  const out: string[] = [];
  if (stats.atk >= 60) out.push("Token Barrage");
  if (stats.def >= 60) out.push("Failsafe Ward");
  if (stats.spd >= 60) out.push("Rapid Dispatch");
  if (stats.int >= 60) out.push("Deep Reasoning");
  if (stats.tec >= 50) out.push("Toolset Overdrive");
  if (a.skills >= 10) out.push("Skill Cascade");
  return out.length ? out.slice(0, 4) : ["Basic Run"];
}

export function deriveUnitCard(a: AgentMetrics): UnitCard {
  const terminal = a.missionsCompleted + a.missionsFailed;
  const successRate = terminal > 0 ? a.missionsCompleted / terminal : 0;

  const stats: UnitStats = {
    hp: clamp(12 + Math.sqrt(Math.max(0, a.runs)) * 6),
    atk: clamp(10 + Math.log10(a.totalTokens + 1) * 12),
    def: clamp(10 + successRate * 70),
    spd: clamp(a.avgDurationSec > 0 ? 92 - Math.min(82, a.avgDurationSec / 3) : 28),
    int: clamp(18 + a.skills * 3 + (a.contextLength ? Math.log2(Math.max(2, a.contextLength / 1000)) * 4 : 0)),
    tec: clamp(14 + a.toolsets * 5 + a.skills * 2),
  };
  const power = stats.hp + stats.atk + stats.def + stats.spd + stats.int + stats.tec;
  const xp = a.missionsCompleted * 100 + a.runs * 25 + Math.floor(a.totalTokens / 1000);
  const dom = dominantStat(stats);

  return {
    schema: "ch.unit-card/v1",
    slug: a.slug,
    name: a.name,
    className: STAT_CLASS[dom].className,
    element: STAT_CLASS[dom].element,
    level: computeLevel(xp).level,
    rarity: rarityFromPower(power),
    stats,
    power,
    abilities: abilitiesFor(a, stats),
    source: {
      runs: a.runs,
      missionsCompleted: a.missionsCompleted,
      successRate,
      totalTokens: a.totalTokens,
      avgDurationSec: a.avgDurationSec,
      skills: a.skills,
      toolsets: a.toolsets,
    },
  };
}

export { RARITY_ORDER };
