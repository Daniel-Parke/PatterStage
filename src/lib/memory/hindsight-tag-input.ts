// ═══════════════════════════════════════════════════════════════
// hindsight-tag-input.ts — Parse comma-separated tag strings
// ═══════════════════════════════════════════════════════════════
//
// The Hindsight modals (Add Memory, Directive create/edit, Mental
// Model create/edit) all take a free-form "Tags (comma-separated)"
// input from the user: split on ",", trim each segment, drop the
// empty ones. `parseOptionalTagsInput` folds an empty result to
// `undefined` so the JSON body omits the `tags` key when the field
// was left blank: Hindsight treats `tags: []` as "no tags" anyway,
// and omitting the key keeps the wire payload tight.

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
 * when the user didn't enter any tags.
 */
export function parseOptionalTagsInput(raw: string): string[] | undefined {
  const tags = parseTagsInput(raw);
  return tags.length > 0 ? tags : undefined;
}
