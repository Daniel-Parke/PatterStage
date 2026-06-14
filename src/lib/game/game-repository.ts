// ═══════════════════════════════════════════════════════════════
// game/game-repository.ts — persistence for gamification state
//
// Reads/writes the game_* tables. All award paths funnel through the
// game_events idempotent ledger so currency/XP/unlocks are granted exactly once
// across reads and restarts. Cosmetic-only — never touches product data.
// ═══════════════════════════════════════════════════════════════

import { db, inTransaction, now } from "@/lib/db";
import type { CosmeticType, PlayerState } from "./types";

interface PlayerRow {
  cores: number;
  shards: number;
  pity: number;
  equipped_json: string;
  season_id: string | null;
  last_seen_at: string | null;
}

function parseEquipped(raw: string): Partial<Record<CosmeticType, string>> {
  try {
    return JSON.parse(raw) as Partial<Record<CosmeticType, string>>;
  } catch {
    return {};
  }
}

export function getPlayerState(): PlayerState {
  const row = db().prepare("SELECT cores, shards, pity, equipped_json, season_id, last_seen_at FROM game_player WHERE id = 1").get() as PlayerRow | undefined;
  if (!row) return { cores: 0, shards: 0, pity: 0, equipped: {}, seasonId: null, lastSeenAt: null };
  return {
    cores: row.cores,
    shards: row.shards,
    pity: row.pity,
    equipped: parseEquipped(row.equipped_json),
    seasonId: row.season_id,
    lastSeenAt: row.last_seen_at,
  };
}

export function updatePlayer(patch: {
  coresDelta?: number;
  shardsDelta?: number;
  pity?: number;
  equipped?: Partial<Record<CosmeticType, string>>;
  lastSeenAt?: string;
}): void {
  inTransaction(() => {
    if (patch.coresDelta) db().prepare("UPDATE game_player SET cores = MAX(0, cores + ?), updated_at = ? WHERE id = 1").run(patch.coresDelta, now());
    if (patch.shardsDelta) db().prepare("UPDATE game_player SET shards = MAX(0, shards + ?), updated_at = ? WHERE id = 1").run(patch.shardsDelta, now());
    if (patch.pity !== undefined) db().prepare("UPDATE game_player SET pity = ?, updated_at = ? WHERE id = 1").run(patch.pity, now());
    if (patch.equipped) db().prepare("UPDATE game_player SET equipped_json = ?, updated_at = ? WHERE id = 1").run(JSON.stringify(patch.equipped), now());
    if (patch.lastSeenAt) db().prepare("UPDATE game_player SET last_seen_at = ?, updated_at = ? WHERE id = 1").run(patch.lastSeenAt, now());
  });
}

// ── Unlocks (sticky ledger) ──────────────────────────────────

export function getUnlockedIds(kind: string): Set<string> {
  const rows = db().prepare("SELECT ref_id FROM game_unlocks WHERE kind = ?").all(kind) as { ref_id: string }[];
  return new Set(rows.map((r) => r.ref_id));
}

/** Returns true if newly recorded (false if already present). */
export function recordUnlock(kind: string, refId: string): boolean {
  const res = db().prepare("INSERT OR IGNORE INTO game_unlocks (kind, ref_id, unlocked_at) VALUES (?, ?, ?)").run(kind, refId, now());
  return res.changes > 0;
}

// ── Inventory ────────────────────────────────────────────────

export function getOwnedCosmeticIds(): Set<string> {
  const rows = db().prepare("SELECT item_id FROM game_inventory").all() as { item_id: string }[];
  return new Set(rows.map((r) => r.item_id));
}

export function getInventoryCounts(): Map<string, number> {
  const rows = db().prepare("SELECT item_id, count FROM game_inventory").all() as { item_id: string; count: number }[];
  return new Map(rows.map((r) => [r.item_id, r.count]));
}

/** Add a cosmetic; returns whether this was the first copy (vs a duplicate). */
export function addCosmetic(itemId: string): { firstTime: boolean } {
  const res = db().prepare("INSERT OR IGNORE INTO game_inventory (item_id, count, obtained_at) VALUES (?, 1, ?)").run(itemId, now());
  if (res.changes > 0) return { firstTime: true };
  db().prepare("UPDATE game_inventory SET count = count + 1 WHERE item_id = ?").run(itemId);
  return { firstTime: false };
}

// ── Quests ───────────────────────────────────────────────────

export interface QuestRow {
  quest_id: string;
  progress: number;
  completed_at: string | null;
  claimed_at: string | null;
}

export function getQuestRows(periodKeys: string[]): Map<string, QuestRow> {
  if (periodKeys.length === 0) return new Map();
  const ph = periodKeys.map(() => "?").join(",");
  const rows = db()
    .prepare(`SELECT quest_id, progress, completed_at, claimed_at FROM game_quests WHERE period_key IN (${ph})`)
    .all(...periodKeys) as QuestRow[];
  return new Map(rows.map((r) => [r.quest_id, r]));
}

export function upsertQuestProgress(periodKey: string, questId: string, progress: number, complete: boolean): void {
  db()
    .prepare(
      `INSERT INTO game_quests (period_key, quest_id, progress, completed_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(period_key, quest_id) DO UPDATE SET
         progress = excluded.progress,
         completed_at = COALESCE(game_quests.completed_at, excluded.completed_at)`,
    )
    .run(periodKey, questId, progress, complete ? now() : null);
}

/** Claim a completed quest; returns true if this claim is new. */
export function claimQuest(periodKey: string, questId: string): boolean {
  const res = db()
    .prepare("UPDATE game_quests SET claimed_at = ? WHERE period_key = ? AND quest_id = ? AND claimed_at IS NULL AND completed_at IS NOT NULL")
    .run(now(), periodKey, questId);
  return res.changes > 0;
}

// ── Events (idempotent award ledger + feed) ──────────────────

/** Record an event; returns true if newly inserted (refId enforces once-only). */
export function recordEvent(type: string, refId: string | null, payload: Record<string, unknown> = {}): boolean {
  const res = db()
    .prepare("INSERT OR IGNORE INTO game_events (type, ref_id, payload_json, created_at) VALUES (?, ?, ?, ?)")
    .run(type, refId, JSON.stringify(payload), now());
  return res.changes > 0;
}

export interface GameEvent {
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export function recentEvents(limit = 12): GameEvent[] {
  const rows = db().prepare("SELECT type, payload_json, created_at FROM game_events ORDER BY id DESC LIMIT ?").all(limit) as {
    type: string;
    payload_json: string;
    created_at: string;
  }[];
  return rows.map((r) => {
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(r.payload_json) as Record<string, unknown>;
    } catch {
      /* ignore */
    }
    return { type: r.type, payload, createdAt: r.created_at };
  });
}

/** Bonus account XP granted by claimed quest/achievement rewards (award ledger). */
export function getBonusXp(): number {
  try {
    const row = db()
      .prepare("SELECT COALESCE(SUM(CAST(json_extract(payload_json, '$.xp') AS INTEGER)), 0) AS v FROM game_events WHERE type = 'award'")
      .get() as { v: number } | undefined;
    return Number(row?.v ?? 0);
  } catch {
    return 0;
  }
}

// ── Agents ───────────────────────────────────────────────────

export interface AgentGameRow {
  slug: string;
  xp: number;
  equipped: Partial<Record<CosmeticType, string>>;
  favorite: boolean;
}

export function listAgentStates(): Map<string, AgentGameRow> {
  const rows = db().prepare("SELECT slug, xp, equipped_json, favorite FROM game_agent").all() as {
    slug: string;
    xp: number;
    equipped_json: string;
    favorite: number;
  }[];
  return new Map(rows.map((r) => [r.slug, { slug: r.slug, xp: r.xp, equipped: parseEquipped(r.equipped_json), favorite: r.favorite === 1 }]));
}

export function setAgentXp(slug: string, xp: number): void {
  db()
    .prepare(
      `INSERT INTO game_agent (slug, xp, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(slug) DO UPDATE SET xp = excluded.xp, updated_at = excluded.updated_at`,
    )
    .run(slug, xp, now());
}

export function setAgentEquipped(slug: string, equipped: Partial<Record<CosmeticType, string>>): void {
  db()
    .prepare(
      `INSERT INTO game_agent (slug, equipped_json, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(slug) DO UPDATE SET equipped_json = excluded.equipped_json, updated_at = excluded.updated_at`,
    )
    .run(slug, JSON.stringify(equipped), now());
}
