// Pure gacha pull. Seeded RNG → reproducible/testable; pity guarantees epic+ at
// the pool threshold; duplicates convert to shards. Each pull consumes 2 RNG
// draws (rarity, then item).

import { RARITY_ORDER, RARITY_SHARDS, type Rarity, type GachaPool, type PullResult } from "./types";
import { cosmeticsInPool } from "./content/cosmetics";

function rollRarity(pool: GachaPool, rng: () => number, pity: number): { rarity: Rarity; pityTriggered: boolean } {
  const atPity = pity + 1 >= pool.pity;
  const r = rng();
  let acc = 0;
  let chosen: Rarity = "common";
  for (const rar of RARITY_ORDER) {
    acc += pool.odds[rar] ?? 0;
    if (r < acc) {
      chosen = rar;
      return atPity && RARITY_ORDER.indexOf(chosen) < RARITY_ORDER.indexOf("epic")
        ? { rarity: "epic", pityTriggered: true }
        : { rarity: chosen, pityTriggered: false };
    }
  }
  // Rounding fallthrough → highest configured rarity.
  return { rarity: chosen, pityTriggered: false };
}

const EPIC_IDX = RARITY_ORDER.indexOf("epic");

/** Resolve one pull. Returns the result + the new pity counter. */
export function pullOnce(
  pool: GachaPool,
  rng: () => number,
  ownedIds: ReadonlySet<string>,
  pity: number,
): { result: PullResult; nextPity: number } {
  const { rarity, pityTriggered } = rollRarity(pool, rng, pity);
  const all = cosmeticsInPool(pool.id);
  const candidates = all.filter((c) => c.rarity === rarity);
  const list = candidates.length > 0 ? candidates : all;
  const item = list[Math.floor(rng() * list.length)] ?? list[0];

  const duplicate = ownedIds.has(item.id);
  const shards = duplicate ? RARITY_SHARDS[item.rarity] : 0;
  const hitEpicPlus = RARITY_ORDER.indexOf(item.rarity) >= EPIC_IDX;
  const nextPity = hitEpicPlus ? 0 : pity + 1;

  return {
    result: { item, rarity: item.rarity, duplicate, shards, pityTriggered },
    nextPity,
  };
}
