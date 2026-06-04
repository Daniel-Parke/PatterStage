// ═══════════════════════════════════════════════════════════════
// hindsight-tag-input.ts — Parse comma-separated tag strings
// ═══════════════════════════════════════════════════════════════
//
// The Hindsight modals (Add Memory, Directive create/edit, Mental
// Model create/edit) all take a free-form "Tags (comma-separated)"
// input from the user. Every handler ran the same 3-step pipeline:
//
//   1. split on ","
//   2. trim each segment
//   3. drop empty segments
//
// Three of the five sites then folded the result with
// `tags.length > 0 ? tags : undefined` so the JSON body omits the
// `tags` key when the user left the field blank (matches the
// Hindsight API contract — sending `tags: []` is silently treated
// as "no tags", but `tags: undefined` is what the rest of the
// Hindsight code path produces and keeps the wire payload tight).
//
// Five identical parses is past the Rule of Three; a sixth site in
// the same file is one copy-paste away. Extracted here so all
// Hindsight tag inputs go through one canonical parser, and so
// the parse + fold can be unit-tested in isolation (the Hindsight
// component is mounted with React Query stubs in the test suite
// and the parser is the only logic worth pinning down in detail).
//
// **Byte-equivalence audit (session-51):** every original
// call site did the splits + filters in exactly this order, so
// the produced arrays are identical (modulo leading/trailing
// whitespace trimming, which all 5 sites already did). The
// `undefined` fold is a no-op for the 2 sites that passed
// `tags` directly without the `? tags : undefined` check; the
// helper is split into two named functions so each site picks
// the variant that matches its previous behaviour exactly.

/**
 * Parse a comma-separated tag input into a clean string array.
 * Returns `[]` for empty/whitespace-only input so the caller
 * can use the array directly.
 *
 * Behaviour:
 *   ""           → []
 *   "  "         → []
 *   "foo"        → ["foo"]
 *   "foo,bar"    → ["foo", "bar"]
 *   " foo , bar" → ["foo", "bar"]
 *   "foo,,bar"   → ["foo", "bar"]  (empty segments dropped)
 *   "foo,,"      → ["foo"]
 */
export function parseTagsInput(raw: string): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * Same as `parseTagsInput` but returns `undefined` instead of `[]`
 * for empty inputs. Use this when passing the value to a JSON
 * request body where the `tags` key should be omitted entirely
 * when the user didn't enter any tags (preserves the prior
 * `tags.length > 0 ? tags : undefined` behaviour byte-for-byte).
 */
export function parseOptionalTagsInput(raw: string): string[] | undefined {
  const tags = parseTagsInput(raw);
  return tags.length > 0 ? tags : undefined;
}
