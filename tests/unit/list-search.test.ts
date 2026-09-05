/** @jest-environment node */

// Tests for `filterByCaseInsensitiveSubstring` in `src/lib/list-search.ts` —
// the generic case-insensitive substring search helper that replaces the
// 2-line inline pattern (case-insensitive `.includes()` across N fields)
// repeated in 4+ List 3 (and 6+ cross-list) call sites.
//
// Session 161 List 3 migration: 2 List 3 sites were migrated this session
// (src/app/operations/skills/page.tsx `filterBySearch`,
// src/app/operations/personalities/page.tsx inline `useMemo` filter).
// The 2 existing call sites are pinned by these tests; future regressions
// fail CI.
//
// Byte-equivalence: the helper form and the inline form produce the same
// array for every reachable input. Empty/whitespace search returns a
// defensive copy of the input. Always-match predicate (when supplied)
// short-circuits the per-field check.

import { filterByCaseInsensitiveSubstring } from "@/lib/list-search";

interface Item {
  id: number;
  name: string | null;
  description: string | null;
}

describe("filterByCaseInsensitiveSubstring — generic case-insensitive substring search", () => {
  const items: Item[] = [
    { id: 1, name: "Alpha", description: "first entry" },
    { id: 2, name: "Beta", description: "second entry" },
    { id: 3, name: "Gamma", description: "third" },
    { id: 4, name: "Delta", description: "ALPHA mentions" },
  ];

  it("returns a defensive copy of the input for an empty search", () => {
    const result = filterByCaseInsensitiveSubstring(items, "", [
      (i) => i.name,
    ]);
    expect(result).toEqual(items);
    expect(result).not.toBe(items); // defensive copy
  });

  it("returns a defensive copy of the input for a whitespace-only search", () => {
    const result = filterByCaseInsensitiveSubstring(items, "   ", [
      (i) => i.name,
    ]);
    expect(result).toEqual(items);
    expect(result).not.toBe(items);
  });

  it("matches against a single field getter (exact case)", () => {
    const result = filterByCaseInsensitiveSubstring(items, "Alpha", [
      (i) => i.name,
    ]);
    expect(result.map((i) => i.id)).toEqual([1]);
  });

  it("matches against a single field getter (different case)", () => {
    const result = filterByCaseInsensitiveSubstring(items, "alpha", [
      (i) => i.name,
    ]);
    expect(result.map((i) => i.id)).toEqual([1]);
  });

  it("matches across multiple fields (any field matches)", () => {
    const result = filterByCaseInsensitiveSubstring(items, "alpha", [
      (i) => i.name,
      (i) => i.description,
    ]);
    // "Alpha" matches name (id 1); "ALPHA mentions" matches description (id 4)
    expect(result.map((i) => i.id)).toEqual([1, 4]);
  });

  it("trims the search term before matching", () => {
    const result = filterByCaseInsensitiveSubstring(items, "  alpha  ", [
      (i) => i.name,
    ]);
    expect(result.map((i) => i.id)).toEqual([1]);
  });

  it("returns an empty array when no field matches", () => {
    const result = filterByCaseInsensitiveSubstring(items, "zzz", [
      (i) => i.name,
    ]);
    expect(result).toEqual([]);
  });

  it("treats null and undefined field values as non-matches (no throw)", () => {
    const sparse: Item[] = [
      { id: 1, name: null, description: "with null name" },
      { id: 2, name: undefined as unknown as string, description: "with undefined name" },
      { id: 3, name: "Found", description: null },
    ];
    const result = filterByCaseInsensitiveSubstring(sparse, "found", [
      (i) => i.name,
      (i) => i.description,
    ]);
    expect(result.map((i) => i.name)).toEqual(["Found"]);
  });

  it("alwaysMatch predicate short-circuits the per-field check", () => {
    const result = filterByCaseInsensitiveSubstring(
      items,
      "zzz", // would match nothing via the field getters
      [(i) => i.name],
      (i) => i.id === 2, // but id 2 is "always"
    );
    expect(result.map((i) => i.id)).toEqual([2]);
  });

  it("alwaysMatch predicate composes with the search fields (OR semantics)", () => {
    const result = filterByCaseInsensitiveSubstring(
      items,
      "alpha",
      [(i) => i.name],
      (i) => i.id === 3, // Gamma always passes too
    );
    expect(result.map((i) => i.id)).toEqual([1, 3]); // Alpha + Gamma (Delta's "ALPHA" is in description, not in fields list)
  });

  it("empty search short-circuits and returns the full list (ignores alwaysMatch)", () => {
    // Pinned contract: the helper returns the full list on empty search
    // WITHOUT consulting `alwaysMatch`. This is intentional — the
    // empty-search branch is the "no filter applied" UX, which differs
    // from "filter applied but these items always pass". A future
    // refactor that makes the empty branch pass through the filter
    // would change the behaviour of the Personalities page's
    // `(p) => p.name === activePersonality` alwaysMatch (the active
    // personality is currently shown alongside the full list on empty
    // search; making the filter run would still show all items, but a
    // future caller passing only `alwaysMatch` and no fields would
    // observe a behaviour change). Pin the short-circuit explicitly.
    const result = filterByCaseInsensitiveSubstring(
      items,
      "",
      [(i) => i.name, (i) => i.description],
      (i) => i.id === 4, // Delta "always" — should NOT be the only result on empty search
    );
    expect(result.map((i) => i.id)).toEqual([1, 2, 3, 4]);
  });

  it("whitespace-only search short-circuits the same way as empty", () => {
    // Mirror of the empty-search test — `search.trim() === ""` triggers
    // the same return-early branch.
    const result = filterByCaseInsensitiveSubstring(
      items,
      "   \t  ",
      [(i) => i.name],
      (i) => i.id === 1, // Alpha "always" — should NOT be the only result
    );
    expect(result.map((i) => i.id)).toEqual([1, 2, 3, 4]);
  });

  it("works with a single getter returned as an array literal (List 3 call site pattern)", () => {
    const result = filterByCaseInsensitiveSubstring(items, "second", [
      (i) => i.description,
    ]);
    expect(result.map((i) => i.id)).toEqual([2]);
  });

  it("preserves input order", () => {
    const result = filterByCaseInsensitiveSubstring(items, "entry", [
      (i) => i.description,
    ]);
    // matches id 1 (first entry), 2 (second entry), 4 (ALPHA mentions → no — case differs, but .includes is case-insensitive)
    // Actually "ALPHA mentions".toLowerCase().includes("entry") === false
    // So matches are id 1 and 2
    expect(result.map((i) => i.id)).toEqual([1, 2]);
  });
});
