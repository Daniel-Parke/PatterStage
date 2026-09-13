// ═══════════════════════════════════════════════════════════════
// db/parse-json.ts — shared defensive parsers for SQLite-stored values
//
// Repositories persist JSON blobs (config/summary/string arrays) and
// booleans-as-integers in TEXT/INTEGER columns. Reading them back wants
// the same "parse, but never throw into a route on a malformed/partial
// row" discipline. These helpers centralise that so each repository
// stops re-declaring its own `parseX`/`toBool` (was duplicated across
// benchmarks-repository, catalog-template-repository, profile-config-builder).
// ═══════════════════════════════════════════════════════════════

/** JSON.parse with a typed cast. Returns null on missing or malformed input. */
export function parseJson<T>(raw: string | null | undefined): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Parse a JSON string array, filtering to strings. Returns [] on
 * missing/malformed input (mirrors the prior `parseJsonArray` in
 * catalog-template-repository / profile-config-builder).
 */
export function parseStringArrayOrEmpty(raw: string | null | undefined): string[] {
  const v = parseJson<unknown>(raw);
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

/** SQLite integer flag (0/1) → boolean. Returns null for null/undefined. */
export function parseBool(v: number | null | undefined): boolean | null {
  return v === null || v === undefined ? null : v === 1;
}
