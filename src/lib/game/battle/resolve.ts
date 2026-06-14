// ═══════════════════════════════════════════════════════════════
// game/battle/resolve.ts — SCAFFOLD for the future JRPG arena.
//
// A pure, deterministic, seeded turn resolver over the portable UnitCard schema.
// This is intentionally minimal: it proves the card stats are battle-ready and
// gives a local PvE demo. The full arena (richer abilities, elements, status
// effects) and the online PvP/tournament layer come later — they consume this
// same UnitCard + seed, so nothing here needs re-deriving when that lands.
// ═══════════════════════════════════════════════════════════════

import type { UnitCard } from "../types";
import { makeRng } from "../rng";

export interface BattleTurn {
  attacker: string;
  defender: string;
  damage: number;
  hpA: number;
  hpB: number;
}

export interface BattleResult {
  winner: "a" | "b" | "draw";
  turns: number;
  log: BattleTurn[];
}

/** HP pool scales the raw hp stat so fights last a few rounds. */
const HP_SCALE = 6;

export function simulateBattle(a: UnitCard, b: UnitCard, seed = "arena"): BattleResult {
  const rng = makeRng(`${seed}:${a.slug}-vs-${b.slug}`);
  let hpA = a.stats.hp * HP_SCALE;
  let hpB = b.stats.hp * HP_SCALE;
  const log: BattleTurn[] = [];

  const hit = (atk: UnitCard, def: UnitCard): number =>
    Math.max(1, Math.round(atk.stats.atk * (0.8 + rng() * 0.4) - def.stats.def * 0.3));

  let round = 0;
  while (hpA > 0 && hpB > 0 && round < 60) {
    round++;
    // Higher SPD strikes first each round (ties → A).
    const order: ("a" | "b")[] = a.stats.spd >= b.stats.spd ? ["a", "b"] : ["b", "a"];
    for (const side of order) {
      if (hpA <= 0 || hpB <= 0) break;
      if (side === "a") {
        const dmg = hit(a, b);
        hpB -= dmg;
        log.push({ attacker: a.name, defender: b.name, damage: dmg, hpA, hpB: Math.max(0, hpB) });
      } else {
        const dmg = hit(b, a);
        hpA -= dmg;
        log.push({ attacker: b.name, defender: a.name, damage: dmg, hpA: Math.max(0, hpA), hpB });
      }
    }
  }

  const winner: BattleResult["winner"] =
    hpA <= 0 && hpB <= 0 ? "draw" : hpA <= 0 ? "b" : hpB <= 0 ? "a" : hpA >= hpB ? "a" : "b";
  return { winner, turns: round, log };
}
