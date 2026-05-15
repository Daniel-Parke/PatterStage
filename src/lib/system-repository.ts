// ═══════════════════════════════════════════════════════════════
// system-repository.ts — Key-value system stat management
//
// Wraps the `meta` table for reading/writing system-level
// key-value pairs. Used by the sync sources to cache computed
// stats (memory fact count, skills count, etc.) so API routes
// read from the DB instead of performing filesystem operations.
// ═══════════════════════════════════════════════════════════════

import { db } from "./db";

// ── Read ─────────────────────────────────────────────────────

/** Get a single system stat from the `meta` table. Returns null if unset. */
export function getSystemStat(key: string): string | null {
  const row = db()
    .prepare("SELECT value FROM meta WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

// ── Write ────────────────────────────────────────────────────

/** Set a single system stat in the `meta` table. Upserts if key exists. */
export function setSystemStat(key: string, value: string): void {
  db()
    .prepare("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)")
    .run(key, value);
}

// ── Batch ────────────────────────────────────────────────────

/** Get multiple system stats at once. Returns a map of key → value. */
export function getMultipleStats(keys: string[]): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  for (const key of keys) {
    result[key] = getSystemStat(key);
  }
  return result;
}

/** Set multiple system stats in a single transaction. */
export function setMultipleStats(entries: Record<string, string>): void {
  const database = db();
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

/** Set a numeric system stat. */
export function setSystemStatNumber(key: string, value: number): void {
  setSystemStat(key, String(value));
}

// ── Boolean helpers ──────────────────────────────────────────

/** Get a system stat as a boolean. Returns `defaultVal` if unset. */
export function getSystemStatBoolean(key: string, defaultVal = false): boolean {
  const val = getSystemStat(key);
  if (val === null) return defaultVal;
  return val === "true" || val === "1";
}

/** Set a boolean system stat. */
export function setSystemStatBoolean(key: string, value: boolean): void {
  setSystemStat(key, value ? "true" : "false");
}
