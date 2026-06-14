/** @jest-environment jsdom */

// Source-pattern test for the session 215 (List 4) `FallbackConfigPanel`
// field-update handler consolidation. Pins the post-extraction shape:
//
// 1. `buildConfigPatch` module-level helper exists in
//    `src/components/models/FallbackConfigPanel.tsx` and takes
//    `(config: FallbackConfig, patch: Partial<FallbackConfig>)`.
// 2. The 3 inline `{ ...config, <field>: <value> }` spreads in the
//    page-local `handleRetriesChange` / `handleRestorationChange` /
//    `handleNotificationChange` are GONE — the bodies now call
//    `updateField({...})` instead.
// 3. The `updateField` page-local helper exists and forwards
//    `buildConfigPatch(config, patch)` to `onUpdate`.
// 4. The `handleRetriesChange` retains its `parseInt + isNaN + range`
//    guard prelude (the guard is the variant-specific bit; only the
//    spread is consolidated).
//
// Anti-migration guards: the surrounding JSX (input/select controls,
// labels, the `<button>` Sync / Import buttons, the saveStatus banner)
// stays byte-equivalent — the refactor is a render-method body swap
// only.

import { readFileSync } from "fs";
import { join } from "path";

const SOURCE_PATH = join(
  process.cwd(),
  "src/components/models/FallbackConfigPanel.tsx",
);

function readSource(): string {
  return readFileSync(SOURCE_PATH, "utf-8");
}

describe("FallbackConfigPanel field-update handler consolidation", () => {
  it("declares a module-level `buildConfigPatch` helper that takes (config, patch)", () => {
    const source = readSource();
    // The helper is module-level (not nested inside the component)
    // and has the canonical signature
    //   function buildConfigPatch(
    //     config: FallbackConfig,
    //     patch: Partial<FallbackConfig>,
    //   ): FallbackConfig { ... }
    // The TypeScript formatter wraps the long type after `,` so the
    // regex must tolerate a newline + indent between the `>` (close of
    // `Partial<...>`) and the `)` (close of the param list).
    const helperMatch = source.match(
      /function\s+buildConfigPatch\s*\([\s\S]*?patch:\s*Partial<FallbackConfig>[\s\S]*?\)\s*:\s*FallbackConfig\s*\{/,
    );
    expect(helperMatch).not.toBeNull();
  });

  it("`buildConfigPatch` body is a single `{ ...config, ...patch }` spread", () => {
    const source = readSource();
    // Slice from the helper declaration to the closing `}` of its body
    // (the helper has only 1 return statement, so the closing brace is
    // the next `}` after the spread).
    const start = source.indexOf("function buildConfigPatch(");
    expect(start).toBeGreaterThan(-1);
    const slice = source.slice(start);
    // The body should be `return { ...config, ...patch };` — no other
    // logic (this is a pure spread helper, not a hook).
    expect(slice).toMatch(
      /function\s+buildConfigPatch[\s\S]*?return\s*\{\s*\.\.\.config\s*,\s*\.\.\.patch\s*\}\s*;/,
    );
  });

  it("declares a page-local `updateField` helper that calls `buildConfigPatch` then `onUpdate`", () => {
    const source = readSource();
    // `updateField` is a page-local arrow function declared after the
    // component's destructure. It must forward the merged config to
    // `onUpdate`. The TS formatter may wrap the long arrow body onto
    // its own line; tolerate any whitespace between `=>` and `onUpdate(...)`.
    expect(source).toMatch(
      /const\s+updateField\s*=\s*\(\s*patch:\s*Partial<FallbackConfig>\s*\)\s*=>\s*onUpdate\(buildConfigPatch\(config,\s*patch\)\)/,
    );
  });

  it("`handleRetriesChange` no longer spreads `{ ...config, ... }` inline — it calls `updateField`", () => {
    const source = readSource();
    // Slice the handleRetriesChange body: starts at the declaration,
    // ends at the next `};` at the same nesting.
    const start = source.indexOf("const handleRetriesChange");
    expect(start).toBeGreaterThan(-1);
    const body = source.slice(start, start + 400);
    // Anti-pattern: inline `{ ...config, apiMaxRetries: num }` spread
    expect(body).not.toMatch(/\{\s*\.\.\.config\s*,\s*apiMaxRetries:/);
    // Positive: the `updateField` call
    expect(body).toMatch(/updateField\(\s*\{\s*apiMaxRetries:\s*num\s*\}\s*\)/);
  });

  it("`handleRestorationChange` is a single-line arrow that calls `updateField`", () => {
    const source = readSource();
    // The pre-refactor form was a block-bodied arrow that spread inline.
    // Post-refactor it's a single-line arrow that calls the helper.
    const match = source.match(
      /const\s+handleRestorationChange\s*=\s*\(\s*restorePrimary:\s*boolean\s*\)\s*=>\s*updateField\(\s*\{\s*restorePrimaryOnFallback:\s*restorePrimary\s*\}\s*\)/,
    );
    expect(match).not.toBeNull();
    // Anti-pattern: the inline spread form must be gone
    expect(source).not.toMatch(
      /onUpdate\(\s*\{\s*\.\.\.config\s*,\s*restorePrimaryOnFallback:/,
    );
  });

  it("`handleNotificationChange` is a single-line arrow that calls `updateField`", () => {
    const source = readSource();
    const match = source.match(
      /const\s+handleNotificationChange\s*=\s*\(\s*enabled:\s*boolean\s*\)\s*=>\s*updateField\(\s*\{\s*fallbackNotification:\s*enabled\s*\}\s*\)/,
    );
    expect(match).not.toBeNull();
    // Anti-pattern: the inline spread form must be gone
    expect(source).not.toMatch(
      /onUpdate\(\s*\{\s*\.\.\.config\s*,\s*fallbackNotification:/,
    );
  });

  it("preserves the `parseInt + isNaN + range` guard prelude in `handleRetriesChange`", () => {
    const source = readSource();
    const start = source.indexOf("const handleRetriesChange");
    const body = source.slice(start, start + 400);
    // The guard is the variant-specific bit (retries is a number with
    // a range check; the other 2 are booleans with no prelude). The
    // refactor must keep it byte-equivalent.
    expect(body).toMatch(/parseInt\(value,\s*10\)/);
    expect(body).toMatch(/isNaN\(num\)/);
    expect(body).toMatch(/num\s*>=\s*0/);
  });

  it("does not call `onUpdate` directly from the 3 handlers anymore", () => {
    // Final invariant: every `onUpdate(...)` CALL in the source is
    // mediated through `updateField` (or through `buildConfigPatch`).
    // The 3 pre-refactor direct-call sites are gone. The JSDoc also
    // contains the literal string `onUpdate(...)` (3 occurrences in
    // the buildConfigPatch + updateField docblocks), but those are
    // not real calls — strip the `/* ... */` block comments first.
    const source = readSource();
    const codeOnly = source
      .replace(/\/\*[\s\S]*?\*\//g, "") // strip block comments
      .replace(/^\s*\/\/.*$/gm, ""); // strip line comments
    // The `onUpdate` prop is still referenced in the component
    // destructure (`{ onUpdate, ... }`) and in the `updateField`
    // helper's body. After stripping comments, exactly 2 `onUpdate(`
    // CALLS remain: one in `updateField`'s body (the merged spread)
    // and one in the `buildConfigPatch` helper's JSDoc... no, after
    // stripping comments only the `updateField` call survives.
    // Count `onUpdate(` not preceded by an identifier char (i.e.
    // it's a function call, not a type reference).
    const onUpdateCalls = codeOnly.match(/\bonUpdate\s*\(/g) ?? [];
    expect(onUpdateCalls.length).toBe(1);
  });
});
