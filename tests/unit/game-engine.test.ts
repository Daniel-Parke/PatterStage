/** @jest-environment node */
import { makeRng } from "@/lib/game/rng";
import { pullOnce } from "@/lib/game/gacha";
import { POOLS } from "@/lib/game/content/gacha";
import { COSMETICS } from "@/lib/game/content/cosmetics";
import { RARITY_ORDER } from "@/lib/game/types";
import { deriveUnitCard, type AgentMetrics } from "@/lib/game/cards";
import { simulateBattle } from "@/lib/game/battle/resolve";
import { buildSnapshot, type GameMetrics } from "@/lib/game/engine";
import type { PlayerState } from "@/lib/game/types";

const pool = POOLS[0];
const idx = (r: string) => RARITY_ORDER.indexOf(r as never);

describe("gacha pullOnce", () => {
  it("is deterministic for a given seed", () => {
    const a = pullOnce(pool, makeRng("seed-1"), new Set(), 0);
    const b = pullOnce(pool, makeRng("seed-1"), new Set(), 0);
    expect(a.result.item.id).toBe(b.result.item.id);
    expect(a.nextPity).toBe(b.nextPity);
  });

  it("guarantees epic-or-better at the pity threshold", () => {
    // pity = threshold-1 → next pull always epic+.
    for (const seed of ["a", "b", "c", "d", "e"]) {
      const { result } = pullOnce(pool, makeRng(seed), new Set(), pool.pity - 1);
      expect(idx(result.rarity)).toBeGreaterThanOrEqual(idx("epic"));
    }
  });

  it("resets pity on epic+ and increments otherwise", () => {
    const { result, nextPity } = pullOnce(pool, makeRng("seed-x"), new Set(), 7);
    if (idx(result.rarity) >= idx("epic")) expect(nextPity).toBe(0);
    else expect(nextPity).toBe(8);
  });

  it("converts duplicates to shards", () => {
    const ownAll = new Set(COSMETICS.map((c) => c.id));
    const { result } = pullOnce(pool, makeRng("dup"), ownAll, 0);
    expect(result.duplicate).toBe(true);
    expect(result.shards).toBeGreaterThan(0);
  });

  it("only yields items from the pool", () => {
    const poolIds = new Set(COSMETICS.filter((c) => c.pool === pool.id).map((c) => c.id));
    for (let i = 0; i < 20; i++) {
      const { result } = pullOnce(pool, makeRng(`p${i}`), new Set(), 0);
      expect(poolIds.has(result.item.id)).toBe(true);
    }
  });
});

describe("deriveUnitCard", () => {
  const weak: AgentMetrics = { slug: "rookie", name: "Rookie", runs: 0, missionsCompleted: 0, missionsFailed: 0, totalTokens: 0, avgDurationSec: 0, skills: 0, toolsets: 0 };
  const strong: AgentMetrics = { slug: "bob", name: "Bob", runs: 500, missionsCompleted: 400, missionsFailed: 5, totalTokens: 50_000_000, avgDurationSec: 20, skills: 20, toolsets: 8, contextLength: 200_000 };

  it("keeps every stat in 1..99", () => {
    for (const a of [weak, strong]) {
      const card = deriveUnitCard(a);
      for (const v of Object.values(card.stats)) {
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(99);
      }
    }
  });

  it("rewards real usage with higher power + rarity", () => {
    const w = deriveUnitCard(weak);
    const s = deriveUnitCard(strong);
    expect(s.power).toBeGreaterThan(w.power);
    expect(idx(s.rarity)).toBeGreaterThan(idx(w.rarity));
  });

  it("is deterministic + uses the portable schema", () => {
    expect(deriveUnitCard(strong)).toEqual(deriveUnitCard(strong));
    expect(deriveUnitCard(strong).schema).toBe("ch.unit-card/v1");
  });
});

describe("simulateBattle", () => {
  it("is deterministic and the much stronger card wins", () => {
    const strong = deriveUnitCard({ slug: "s", name: "S", runs: 500, missionsCompleted: 400, missionsFailed: 1, totalTokens: 50_000_000, avgDurationSec: 15, skills: 20, toolsets: 8, contextLength: 200_000 });
    const weak = deriveUnitCard({ slug: "w", name: "W", runs: 1, missionsCompleted: 0, missionsFailed: 3, totalTokens: 100, avgDurationSec: 300, skills: 0, toolsets: 0 });
    const r1 = simulateBattle(strong, weak, "t");
    const r2 = simulateBattle(strong, weak, "t");
    expect(r1.winner).toBe(r2.winner);
    expect(r1.winner).toBe("a");
    expect(r1.turns).toBeGreaterThan(0);
  });
});

describe("buildSnapshot", () => {
  const metrics = (over: Partial<GameMetrics> = {}): GameMetrics =>
    ({
      completedMissions: 0, completedRuns: 0, stories: 0, totalTokens: 0, longestStreak: 0, currentStreak: 0, successRatePct: 0,
      missionXp: 0, automationXp: 0, memoryXp: 0, storyXp: 0, modelXp: 0, sessionXp: 0,
      missionsToday: 0, runsCompletedToday: 0, streakAlive: 0, missionsCompletedWeek: 0, automationsLive: 0, tokensWeek: 0,
      scriptsEnabled: 0, providers: 0, nightOwl: 0, flawless: 0, pulls: 0, cosmeticsOwned: 0,
      ...over,
    }) as GameMetrics;

  const player: PlayerState = { cores: 300, shards: 40, pity: 5, equipped: {}, seasonId: null, lastSeenAt: null };

  it("assembles a complete snapshot", () => {
    const snap = buildSnapshot({
      metrics: metrics({ completedMissions: 120, completedRuns: 200, totalTokens: 2_000_000, longestStreak: 9, missionXp: 5000, missionsToday: 3 }),
      player,
      unlockedAchievementIds: new Set(),
      claimedQuestIds: new Set(),
      ownedCosmeticIds: new Set(["frame-neon"]),
      agents: [
        { slug: "bob", name: "Bob", runs: 200, missionsCompleted: 120, missionsFailed: 4, totalTokens: 2_000_000, avgDurationSec: 30, skills: 12, toolsets: 5 },
        { slug: "rookie", name: "Rookie", runs: 2, missionsCompleted: 1, missionsFailed: 0, totalTokens: 1000, avgDurationSec: 60, skills: 1, toolsets: 1 },
      ],
    });
    expect(snap.account.level.level).toBeGreaterThan(1);
    expect(snap.account.rank.name).toBeTruthy();
    expect(snap.tracks).toHaveLength(6);
    expect(snap.quests.length).toBeGreaterThan(0);
    expect(snap.achievements.find((a) => a.def.id === "field-agent")?.unlocked).toBe(true);
    expect(snap.collection.total).toBe(COSMETICS.length);
    expect(snap.collection.owned).toBe(1);
    expect(snap.currency.cores).toBe(300);
    // roster sorted by power desc.
    expect(snap.roster[0].slug).toBe("bob");
  });

  it("marks the daily dispatch quest complete at target", () => {
    const snap = buildSnapshot({
      metrics: metrics({ missionsToday: 3 }),
      player,
      unlockedAchievementIds: new Set(),
      claimedQuestIds: new Set(),
      ownedCosmeticIds: new Set(),
      agents: [],
    });
    expect(snap.quests.find((q) => q.def.id === "d-dispatch")?.complete).toBe(true);
  });
});
