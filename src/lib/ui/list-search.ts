// ═══════════════════════════════════════════════════════════════
// list-search.ts — generic case-insensitive substring search
// ═══════════════════════════════════════════════════════════════

/**
 * Filter `items` by a case-insensitive substring search across a set
 * of string fields. Returns the input as-is (defensive copy) when
 * `search` is empty or whitespace-only.
 *
 * The caller passes an array of `fields` — each is a getter that
 * extracts a string from an item. The item is included in the result
 * if ANY field's lowercase form contains the lowercase search term
 * OR the optional `alwaysMatch` predicate returns true.
 *
 * @param items — the list to filter.
 * @param search — the user-input search term. Empty/whitespace returns
 *                 a defensive copy of `items`.
 * @param fields — one or more getters that pull the searchable
 *                 strings out of each item. Multiple fields mean an
 *                 item passes if ANY of its fields match.
 * @param alwaysMatch — optional predicate that marks items as matching
 *                      regardless of the search term (e.g. the active
 *                      personality). Only consulted on a NON-empty
 *                      search: the empty / whitespace-only branch
 *                      returns the full list without consulting it.
 * @returns a new array of items matching the search (or alwaysMatch).
 *
 * @example
 *   filterByCaseInsensitiveSubstring(
 *     personalities,
 *     search,
 *     (p) => [p.name, p.prompt],
 *     (p) => p.name === activePersonality,
 *   );
 */
export function filterByCaseInsensitiveSubstring<T>(
  items: readonly T[],
  search: string,
  fields: ReadonlyArray<(item: T) => string | null | undefined>,
  alwaysMatch?: (item: T) => boolean,
): T[] {
  const trimmed = search.trim();
  if (!trimmed) return [...items];
  const q = trimmed.toLowerCase();
  return items.filter((item) => {
    if (alwaysMatch?.(item)) return true;
    return fields.some((getField) => {
      const value = getField(item);
      return typeof value === "string" && value.toLowerCase().includes(q);
    });
  });
}
