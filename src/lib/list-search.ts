// ═══════════════════════════════════════════════════════════════
// list-search.ts — generic case-insensitive substring search
// ═══════════════════════════════════════════════════════════════
//
// A 4-line predicate that appears in 4+ List 3 (and 6+ cross-list)
// call sites:
//
//   const q = search.toLowerCase();
//   items.filter(item => item.name.toLowerCase().includes(q) ||
//                        item.description.toLowerCase().includes(q));
//
// Sites in scope for the session-161 List 3 pick:
//   - src/app/operations/skills/page.tsx:56-63 (filterBySearch)
//   - src/app/operations/personalities/page.tsx:331-340 (inline useMemo)
//
// The helper is a list-3 replacement for the inline
// `.filter().toLowerCase().includes()` pattern. It centralises the
// empty-search pass-through + the per-search `toLowerCase()` call, and
// the caller passes a list of field-getters that map each item to the
// string fields that should be searched.
//
// Cross-list migration (session 150 P-2): sites outside List 3
// (`src/hooks/useMissionsPage.ts`, `src/app/(main)/logs/page.tsx`,
// `src/components/missions/CategoryCombobox.tsx`,
// `src/components/ui/ToolsetSelector.tsx`,
// `src/components/ui/SkillSelector.tsx`,
// `src/app/orchestration/cron/page.tsx`) are NOT migrated this
// session — each cross-list site needs its own per-list sister-test +
// per-list session. Defer to a future pick of the relevant list.

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
 * @param alwaysMatch — optional predicate that, when supplied, marks
 *                      items as matching regardless of the search
 *                      term. Used for "always show the active item
 *                      even when it doesn't match the search" UX
 *                      (e.g. the active personality in the
 *                      Personalities page). The predicate is only
 *                      consulted on a NON-empty search — the empty /
 *                      whitespace-only search branch returns the full
 *                      list (defensive copy) without consulting
 *                      `alwaysMatch`. Pinned by the
 *                      "empty search short-circuits and returns the
 *                      full list (ignores alwaysMatch)" test in
 *                      `tests/unit/list-search.test.ts`.
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
