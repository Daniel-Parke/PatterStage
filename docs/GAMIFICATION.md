# Gamification — RPG/Gacha engine

Control Hub ships a **cosmetic-only** RPG/Gacha layer that rewards real agent
usage. It is purely additive: **nothing functional is ever gated** behind levels,
currency, or RNG — all power stays free and available. Stats are **derived from
real activity** (the more an agent runs and succeeds, the stronger it gets), so
the gamification is a fun mirror of how you actually use the platform.

The hub lives at **Rec Room → Arcade** (`/recroom/arcade`); a compact band on the
dashboard links into it.

## Architecture

```
src/lib/game/
  types.ts            shared types (Rarity, Cosmetic, UnitCard, PlayerState…)
  rng.ts              seeded PRNG (mulberry32 + xmur3) — reproducible pulls/battles
  content/            CONTENT-AS-DATA (new content = a data edit, no engine change)
    ranks.ts          account rank tiers
    tracks.ts         6 mastery tracks (Operative/Conductor/Archivist/…)
    quests.ts         daily + weekly quests
    achievements.ts   tiered achievements (rarity + Core/cosmetic rewards)
    cosmetics.ts      themes/frames/avatars/banners/titles/emblems/card-art
    themes.ts         palette overrides (CSS-variable themes)
    gacha.ts          pools (odds + pity)
  progression.ts      account level/rank + track levels (reuses stats/derive curve)
  evaluate.ts         pure quest + achievement evaluation
  gacha.ts            pure pull (rarity roll, pity, duplicate→shards)
  cards.ts            Agent Unit Cards (battle-ready, portable schema)
  battle/resolve.ts   SCAFFOLD: deterministic seeded battle (future arena)
  engine.ts           pure buildSnapshot(metrics, state) → GameSnapshot
  metrics.ts          measure operator + agents from real activity (reads DB)
  game-repository.ts  persistence (game_* tables + idempotent award ledger)
  game-service.ts     orchestration: reconcile awards, pull, claim, equip
```

- **Pure + tested.** progression/evaluate/gacha/cards/battle/engine are pure
  functions (seeded RNG) — see `tests/unit/game-engine.test.ts`. The service +
  repository do IO.
- **Idempotent awards.** Currency/XP/unlocks are granted exactly once via the
  `game_events` ledger (a partial unique index on `(type, ref_id)`). Reads
  reconcile by diffing derived state against the ledger, so it is restart-safe
  and never double-awards.
- **Persistence** (`010_game_tables.sql`, schema_version 10): `game_player`,
  `game_unlocks`, `game_quests`, `game_inventory`, `game_events`, `game_agent`.

## Progression

- **Account level/rank** from total work XP (missions + runs + tokens + stories)
  plus bonus XP from claimed quest/achievement rewards.
- **Mastery tracks** — Operative (missions), Conductor (automations), Archivist
  (memory), Loremaster (stories), Engineer (models), Diplomat (sessions) — each
  levels independently.
- **Attributes** (radar) derived from activity: Power, Throughput, Discipline,
  Automation, Reliability, Lore.

## Economy + Gacha

- **Cores** (earned from quests/achievements) buy **Synthesis** pulls. Rarity
  tiers Common→Mythic with configurable odds + a **pity** floor (Epic+ guaranteed
  at the threshold). Duplicates convert to **Shards**.
- **Cosmetics only** — themes (re-skin the whole app via the `ThemeProvider`),
  agent skins/frames/avatars, banners, titles, emblems, card art.

## Agent Unit Cards → the arena

Each agent profile gets a **Unit Card** with HP/ATK/DEF/SPD/INT/TEC derived from
its real performance, a class/element, abilities (from skills), and a Power
rating. The card uses a **portable `ch.unit-card/v1` schema** and the battle
resolver (`battle/resolve.ts`) is a pure, deterministic, seeded function.

This is the seam for a future **JRPG monster-arena**: PvE today (local spar in the
Arena tab) → online PvP → tournaments → a shared card database. None of that needs
re-deriving — it consumes the same card + seed. The full arena is **not built
yet**; only the card schema + resolver scaffold are.

## API

`GET /api/game` (snapshot, reconciles on read) · `POST /api/game/synthesis`
(pull) · `POST /api/game/quests/claim` · `POST /api/game/equip` ·
`POST /api/game/agents/[slug]/equip`. Client hook: `useGame` (`src/hooks/useGame.ts`).

## Adding content

Edit the relevant file under `src/lib/game/content/` — add an achievement, quest,
mastery track, gacha cosmetic, or theme as data. The engine + UI pick it up with
no code changes. Keep the **cosmetic-only invariant**: gamification modules must
never affect dispatch/config/runtime paths.
