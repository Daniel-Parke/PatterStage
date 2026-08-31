// ═══════════════════════════════════════════════════════════════
// system-repository.ts — the `meta` table
//
// The ONE repository for `meta`. Three unrelated features keep rows in
// it and each used to prepare its own statements: the sync sources'
// computed stats (memory fact count, uptime, config presence), the
// config cache's JSON blob and timestamp, and the background
// scheduler's ownership lease. Three writers to one table meant three
// versions of "how do you upsert a meta row", and they did not agree.
//
// They still do not agree, and that is on purpose: INSERT OR REPLACE
// and INSERT ... ON CONFLICT DO UPDATE differ in what happens to the
// row (replace deletes and reinserts, so the rowid moves). Both forms
// are kept, named for what they do, rather than merged into one and
// hoping nothing depended on the difference.
//
// Nothing here swallows. The config cache treats every failure as a
// miss and the scheduler treats every failure as "no lease info", and
// those are policies about the caller, not about the table.
// ═══════════════════════════════════════════════════════════════

import { getDb } from "./db";

// ── Read ─────────────────────────────────────────────────────

/** Get a single system stat from the `meta` table. Returns null if unset. */
export function getSystemStat(key: string): string | null {
  const row = getDb()
    .prepare("SELECT value FROM meta WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

/** Read two `meta` keys in one query. Missing keys are simply absent from the result. */
export function getMetaPair(keyA: string, keyB: string): Array<{ key: string; value: string }> {
  return getDb()
    .prepare(
      `SELECT key, value FROM meta WHERE key IN (?, ?)`,
    )
    .all(keyA, keyB) as { key: string; value: string }[];
}

// ── Write ────────────────────────────────────────────────────

/** Set a single system stat in the `meta` table. Upserts if key exists. */
export function setSystemStat(key: string, value: string): void {
  getDb()
    .prepare("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)")
    .run(key, value);
}

/**
 * Upsert one `meta` row in place, keeping the existing row.
 *
 * Distinct from setSystemStat's INSERT OR REPLACE, which deletes and
 * reinserts. The scheduler lease uses this form and the difference is
 * not cosmetic, so the two are separate functions rather than one.
 */
export function upsertMetaValue(key: string, value: string): void {
  getDb()
    .prepare(
      "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .run(key, value);
}

/** Delete two `meta` keys (the config cache invalidates its blob and timestamp together). */
export function deleteMetaPair(keyA: string, keyB: string): void {
  getDb()
    .prepare(`DELETE FROM meta WHERE key IN (?, ?)`)
    .run(keyA, keyB);
}

// ── Batch ────────────────────────────────────────────────────

/** Set multiple system stats in a single transaction. */
export function setMultipleStats(entries: Record<string, string>): void {
  const database = getDb();
  const stmt = database.prepare(
    "INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)"
  );
  const tx = database.transaction(() => {
    for (const [key, value] of Object.entries(entries)) {
      stmt.run(key, value);
    }
  });
  tx();
}

// ── Numeric helpers ──────────────────────────────────────────

/** Get a system stat as a number. Returns `defaultVal` if unset or NaN. */
export function getSystemStatNumber(key: string, defaultVal = 0): number {
  const val = getSystemStat(key);
  if (val === null) return defaultVal;
  const n = parseInt(val, 10);
  return isNaN(n) ? defaultVal : n;
}

// The boolean pair went with its only key. `setSystemStatBoolean` had exactly
// one caller -- MemorySync writing `memory.available`, which nothing read
// (T-0081) -- and there has never been a getSystemStatBoolean to pair with it.
// Callers that want a boolean compare the string, as `config.present` does.
