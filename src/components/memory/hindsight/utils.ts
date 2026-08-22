// ═══════════════════════════════════════════════════════════════
// Shared parsing utilities for Hindsight memory data
// ═══════════════════════════════════════════════════════════════
//
// The direct-HTTP bridge (`@/lib/memory/hindsight-bridge`) returns plain
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

/**
 * Tailwind className for the standard Hindsight modal text `<input>`.
 *
 * 6 sites in `Modals.tsx` rendered the byte-identical className
 * `w-full bg-dark-800 border border-white/10 rounded-lg px-3 py-2
 * text-sm text-white/80 focus:border-pink-500/50 focus:outline-none`
 * (memory content tags, directive name, directive priority,
 * directive tags, model name, model tags). Extracted to a constant
 * so a future visual tweak (border colour, padding, focus ring)
 * lands in one place instead of 6.
 *
 * `as const` + `string` type annotation keeps the union literal
 * shape stable across re-exports — tailwind's JIT compiler does not
 * care that the value is a constant; it scans the source for the
 * class name strings either way. Byte-equivalent at runtime: the
 * pre-extraction inlined form and the constant-derived form produce
 * the same CSS and the same rendered `<input>`.
 */
export const HINDSIGHT_TEXT_INPUT_CLASS =
  "w-full bg-dark-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 focus:border-pink-500/50 focus:outline-none";

/**
 * Tailwind className for the standard Hindsight modal `<textarea>`.
 *
 * 3 sites in `Modals.tsx` rendered the byte-identical tail of the
 * className (the `bg-dark-800 border border-white/10 rounded-lg p-3
 * text-sm text-white/80 resize-none focus:border-pink-500/50
 * focus:outline-none` portion) — used by the memory content
 * textarea (h-32), the directive content textarea (h-28), and the
 * model source-query textarea (h-28). Each site adds its own
 * `w-full h-N` height prefix; the shared base is in the constant
 * so a future visual tweak (focus ring colour, padding) lands in
 * one place instead of 3. The call site composes the height
 * separately: `className={\`w-full h-32 ${HINDSIGHT_TEXTAREA_CLASS}\`}`.
 *
 * The textarea className is intentionally separate from
 * `HINDSIGHT_TEXT_INPUT_CLASS` — the two shapes differ by
 * `px-3 py-2` (text input) vs `p-3 resize-none` (textarea), and
 * collapsing them would require a conditional prop or a single
 * mega-string that doesn't match either pre-extraction form. Two
 * constants keeps each one byte-equivalent to its pre-extraction
 * inline string.
 */
export const HINDSIGHT_TEXTAREA_CLASS =
  "bg-dark-800 border border-white/10 rounded-lg p-3 text-sm text-white/80 resize-none focus:border-pink-500/50 focus:outline-none";

/** Badge colour for Hindsight fact_type */
export function hindsightFactTypeBadgeColor(t: string): "cyan" | "purple" | "orange" | "green" | "gray" {
  const n = t.toLowerCase();
  if (n === "observation") return "cyan";
  if (n === "world") return "purple";
  if (n === "directive") return "orange";
  if (n === "experience") return "green";
  return "gray";
}