/** @jest-environment node */

/**
 * Source-pattern test for the `closeCreate` 4-setter callback in
 * src/app/operations/agents/page.tsx (session 101, List 3).
 *
 * The 4-setter pair
 *
 *   setShowCreate(false);
 *   setCreateName("");
 *   setCreateDescription("");
 *   setCreateCloneFrom("default");
 *
 * was duplicated at 2 call sites — the New Agent Profile modal's
 * `onClose` (X-button / overlay click) and the `handleCreate`
 * success path (`onSuccess` after the POST resolves). The refactor
 * extracts them into a `closeCreate` `useCallback` so the 2 sites
 * stay in lockstep if a future "clear profile-suggestion cache" or
 * "reset clone-from default" reset is added.
 *
 * This is the same A3 page-local modal setter-pair pattern that
 * sessions 98 (`closeComposer` in useMissionsPage) and 100
 * (`closeAgentModal` / `closeSystemModal` in cron/page) established
 * — see `references/session-100-list2-cron-modal-setter-pair.md`
 * for the pattern rationale.
 *
 * The test also locks the discriminated-SOFT-close invariant: the
 * modal's Cancel button uses `() => setShowCreate(false)` (a 1-setter
 * SOFT close that preserves user in-flight form input) and is NOT
 * migrated to the helper. Migrating it would break the
 * HARD-vs-SOFT lifecycle distinction (a real anti-A3 — see
 * session 100's "What was audited and rejected" section).
 *
 * Source-pattern based (rather than React-rendered) for the same
 * reason as `close-composer-setter-pair.test.ts`: locks the helper
 * shape without coupling to React's `useCallback` behaviour.
 */
import { readFileSync } from "fs";
import { join } from "path";

const agentsPagePath = join(
  __dirname,
  "..",
  "..",
  "src",
  "app",
  "operations",
  "agents",
  "page.tsx",
);

describe("closeCreate 4-setter callback (agents page)", () => {
  const pageSource = readFileSync(agentsPagePath, "utf-8");

  it("declares closeCreate as a useCallback that calls all 4 setters in the right order", () => {
    // Lock the helper body — all 4 setters, in this exact order:
    // showCreate → createName → createDescription → createCloneFrom
    expect(pageSource).toMatch(
      /const\s+closeCreate\s*=\s*useCallback\(\s*\(\s*\)\s*=>\s*\{[\s\S]*?setShowCreate\(false\)[\s\S]*?setCreateName\(""\)[\s\S]*?setCreateDescription\(""\)[\s\S]*?setCreateCloneFrom\("default"\)[\s\S]*?\},\s*\[\s*\]\s*\)/,
    );
  });

  it("uses empty deps array (useState setters are stable)", () => {
    // Extract the closeCreate declaration and assert the deps array is empty.
    const match = pageSource.match(
      /const\s+closeCreate\s*=\s*useCallback\(\s*\(\s*\)\s*=>\s*\{[\s\S]*?\},\s*(\[[^\]]*\])\s*\)/,
    );
    expect(match).not.toBeNull();
    expect(match![1].trim()).toBe("[]");
  });

  it("replaces the 2 inline 4-setter sites (modal onClose + handleCreate success)", () => {
    // The refactor consolidates 2 inline 4-setter sites into `closeCreate`.
    // Count both call sites: 1 invocation (`closeCreate()`) + 1 prop reference
    // (`onClose={closeCreate}`).
    const invocationCount = (pageSource.match(/closeCreate\(\)/g) || []).length;
    const propReferenceCount = (pageSource.match(/onClose=\{closeCreate\}/g) || []).length;
    expect(invocationCount).toBe(1); // handleCreate onSuccess
    expect(propReferenceCount).toBe(1); // modal onClose prop
  });

  it("modal onClose uses the callback (not the inline 4-setter form)", () => {
    // The modal's `onClose` prop should reference the callback directly,
    // not the inline `() => { setShowCreate(false); ... }` form.
    expect(pageSource).toMatch(/onClose=\{closeCreate\}/);
    expect(pageSource).not.toMatch(
      /onClose=\{\s*\(\)\s*=>\s*\{\s*setShowCreate\(false\)\s*;[\s\S]*?setCreateCloneFrom\("default"\)/,
    );
  });

  it("preserves the discriminated SOFT close on the Cancel button (1-setter only)", () => {
    // The Cancel button at line 492 is a deliberate SOFT close —
    // 1 setter only (`setShowCreate(false)`), no form clear. This
    // preserves the user's in-flight form input if they cancel by
    // accident. Migrating it to `closeCreate()` would break the
    // HARD-vs-SOFT lifecycle distinction. Lock the discriminator.
    expect(pageSource).toMatch(/onClick=\{\(\) => setShowCreate\(false\)\}>Cancel<\/Button>/);
  });
});
