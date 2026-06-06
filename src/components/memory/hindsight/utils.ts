// ═══════════════════════════════════════════════════════════════
// Shared parsing utilities for Hindsight memory data
// ═══════════════════════════════════════════════════════════════
//
// The direct-HTTP bridge (`@/lib/hindsight-bridge`) returns plain
// JSON objects — no Python `repr()` strings to parse. The previous
// `parseMemoryContent` / `parseReflectResponse` regex parsers have
// been removed because the API no longer sends the data shape they
// expected (e.g. `text='...'` and `fact_type='observation'`). The
// MemoryTab and the reflect-result JSX now read the mapped fields
// directly off the response object. See the prior commit history
// of this file for the removed helpers.

/**
 * Coerce a string field with a default fallback. Centralises the
 * `typeof x === "string" ? x : fallback` pattern that appears
 * repeatedly in the HindsightBrowser when reading a payload field
 * that may be absent or non-string (e.g. an LLM-generated error
 * object instead of a plain string).
 *
 * The return type narrows based on the fallback: when `fallback` is
 * omitted, the result is `string | undefined`; when a fallback is
 * provided, the result is always `string` (the union with the
 * fallback is widened to `string` because `string` is assignable to
 * `string | undefined`).
 */
export function stringOr(value: unknown): string | undefined;
export function stringOr(value: unknown, fallback: string): string;
export function stringOr(value: unknown, fallback?: string): string | undefined {
  return typeof value === "string" ? value : fallback;
}

/** Badge colour for Hindsight fact_type */
export function hindsightFactTypeBadgeColor(t: string): "cyan" | "purple" | "orange" | "green" | "gray" {
  const n = t.toLowerCase();
  if (n === "observation") return "cyan";
  if (n === "world") return "purple";
  if (n === "directive") return "orange";
  if (n === "experience") return "green";
  return "gray";
}