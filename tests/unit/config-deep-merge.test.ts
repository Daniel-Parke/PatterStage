/** @jest-environment node */

// Tests for `deepMerge` in `src/lib/deep-merge.ts`. This was originally
// a regression-test for a shallow-merge bug in `/api/config` PUT: the
// pre-fix test inlined a copy of the desired `deepMerge` function in
// the test file and never exercised the actual route. After the fix
// (extract `deepMerge` into a real module + wire the route to it),
// this test imports the real helper so a future refactor that
// regresses back to a shallow merge fails loudly here.

import { deepMerge } from "@/lib/deep-merge";

describe("deepMerge — config nested object merge", () => {
  it("preserves sibling keys when updating nested object", () => {
    const target = {
      max_turns: 100,
      personalities: {
        default: "Hermes",
        custom: "MyAgent",
        extra: true,
      },
    };
    const source = {
      personalities: { default: "NewHermes" },
    };

    const result = deepMerge(
      { ...target } as Record<string, unknown>,
      source,
    );

    expect((result.personalities as Record<string, unknown>).default).toBe(
      "NewHermes",
    );
    expect((result.personalities as Record<string, unknown>).custom).toBe(
      "MyAgent",
    );
    expect((result.personalities as Record<string, unknown>).extra).toBe(true);
    expect(result.max_turns).toBe(100);
  });

  it("replaces non-object values correctly", () => {
    const target = { max_turns: 100, verbose: true };
    const source = { max_turns: 200 };

    const result = deepMerge({ ...target }, source);

    expect(result.max_turns).toBe(200);
    expect(result.verbose).toBe(true);
  });

  it("replaces arrays instead of merging them", () => {
    const target = { list: ["a", "b"] };
    const source = { list: ["c"] };

    const result = deepMerge({ ...target }, source);

    expect(result.list).toEqual(["c"]);
  });

  it("handles deeply nested objects", () => {
    const target = {
      level1: {
        level2: {
          keep: "this",
          replace: "old",
        },
        sibling: "kept",
      },
    };
    const source = {
      level1: {
        level2: {
          replace: "new",
        },
      },
    };

    const result = deepMerge(
      { ...target } as Record<string, unknown>,
      source,
    );
    const l2 = (result.level1 as Record<string, unknown>)
      .level2 as Record<string, unknown>;

    expect(l2.keep).toBe("this");
    expect(l2.replace).toBe("new");
    expect((result.level1 as Record<string, unknown>).sibling).toBe("kept");
  });

  it("adds new keys from source", () => {
    const target = { existing: "value" };
    const source = { new_key: "new_value" };

    const result = deepMerge({ ...target }, source);

    expect(result.existing).toBe("value");
    expect(result.new_key).toBe("new_value");
  });

  // ── Real-world regression — the original bug shape ────────────
  // The shallow-merge form was:
  //   config[section] = { ...current, ...values };
  // which DROPS sibling keys whenever `values` contains a nested
  // object. The test below mirrors the /api/config PUT contract:
  // patch a section with a nested-object edit, and the rest of the
  // section survives. If anyone reverts to a shallow merge, this
  // test fails.
  it("PATCH preserves sibling keys on a nested object (real PUT shape)", () => {
    const existingSection = {
      max_turns: 100,
      verbose: false,
      personalities: {
        default: "Hermes",
        custom: "MyAgent",
        archived: "Old",
      },
    };
    const incomingPatch = {
      personalities: { default: "NewHermes" },
    };

    const next = deepMerge({ ...existingSection }, incomingPatch);

    expect(next.max_turns).toBe(100);
    expect(next.verbose).toBe(false);
    // The original bug: `custom` and `archived` would be undefined
    // because `{...current, ...values}` replaces the whole
    // `personalities` object with the patch.
    expect(
      (next.personalities as Record<string, unknown>).custom,
    ).toBe("MyAgent");
    expect(
      (next.personalities as Record<string, unknown>).archived,
    ).toBe("Old");
    expect(
      (next.personalities as Record<string, unknown>).default,
    ).toBe("NewHermes");
  });
});
