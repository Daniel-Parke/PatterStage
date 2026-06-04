/**
 * @jest-environment node
 *
 * Source-pattern test for the session-103 ModelEditor.tsx
 * `setSaving(false)` in `finally` block refactor.
 *
 * Locks the shape of the handleSubmit catch/finally structure so
 * a future "tidy up the saving state" PR can't accidentally:
 *   - re-introduce the missing-finally bug (the success path
 *     relied on the parent unmounting the modal to hide the
 *     spinner; if the parent ever defers unmount OR the modal
 *     is reused for a 2nd edit without remount, the saving
 *     spinner would stay stuck on the success path)
 *   - duplicate the `setSaving(false)` call in the success
 *     branch AND the catch branch (the canonical pattern is
 *     "set in success, set in catch, set in finally" — never
 *     duplicate in success and catch)
 *   - remove the `setErrorFromCaught` from the catch block
 *     (it's the only call site of setError from the
 *     handleSubmit path)
 *
 * Why source-pattern instead of rendering the component:
 *   - ModelEditor is a 321-line client component with a 9-key
 *     FormState, a credential-creation sub-flow, and a
 *     provider-change cascading-reset. A render harness would
 *     dwarf the invariant.
 *   - The "catch { setErrorFromCaught } finally { setSaving(false) }"
 *     shape is the byte-level contract.
 *
 * What this test does NOT lock:
 *   - The exact error fallback text ("Save failed")
 *   - The exact HTTP method discriminator (PUT vs POST)
 *   - The order of operations inside the try block
 *   - The onSaved() callback's behavior (tested in the parent's
 *     useModelsPage test suite)
 *
 * If the modal is restructured (e.g. split into ModelEditor +
 * ModelEditorFooter), the file path and shape-string assertions
 * will need to be updated — the test's failure will then force
 * the refactor author to consciously decide whether the new
 * shape preserves the catch+finally invariant.
 */

import * as fs from "node:fs";
import * as path from "node:path";

const COMPONENT_PATH = path.resolve(
  __dirname,
  "../../src/components/models/ModelEditor.tsx",
);

describe("ModelEditor handleSubmit catch/finally shape (session 103)", () => {
  const source = fs.readFileSync(COMPONENT_PATH, "utf8");

  it("wraps the setErrorFromCaught call in a catch block", () => {
    // The setErrorFromCaught call must be inside a `} catch (err) { ... }`
    // block. This is the canonical "unwrapped error → setError" pattern
    // (promoted in session 91 across 9 sites).
    expect(source).toMatch(
      /}\s*catch\s*\(\s*err\s*\)\s*\{[\s\S]*?setErrorFromCaught\(\s*setError\s*,\s*err\s*,\s*["']Save failed["']\s*\)[\s\S]*?\}/,
    );
  });

  it("wraps the setSaving(false) call in a finally block (NOT in the catch block)", () => {
    // The session-103 fix moves `setSaving(false)` from the catch
    // block into a finally block, so it fires on BOTH success and
    // failure. The test locks BOTH invariants:
    //   1. There IS a `} finally { ... setSaving(false) ... }` block
    //   2. The catch block does NOT contain `setSaving(false)` (the
    //      old bug shape — the setSaving was only reset on failure)
    expect(source).toMatch(
      /}\s*finally\s*\{[\s\S]*?setSaving\(\s*false\s*\)[\s\S]*?\}/,
    );

    // The catch block must NOT contain setSaving(false). Strip
    // comments first, then find the catch block body and assert
    // it doesn't include the setSaving line.
    const codeOnly = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .map((l) => l.replace(/\/\/.*$/, ""))
      .join("\n");

    const catchStart = codeOnly.indexOf("} catch (err) {");
    expect(catchStart).toBeGreaterThan(-1);
    const finallyStart = codeOnly.indexOf("} finally {", catchStart);
    expect(finallyStart).toBeGreaterThan(catchStart);
    const catchBody = codeOnly.slice(catchStart, finallyStart);
    expect(catchBody).not.toMatch(/setSaving\(\s*false\s*\)/);
  });

  it("calls onSaved() on the success path BEFORE the finally block", () => {
    // The success path must call `onSaved()` (which is the parent's
    // hook to close the modal + reload data + show success toast)
    // INSIDE the try block, BEFORE the finally block. The finally
    // block fires regardless of success/failure.
    //
    // We extract the order: try ... onSaved() ... catch ... finally
    const tryStart = source.indexOf("setSaving(true);");
    expect(tryStart).toBeGreaterThan(-1);
    const onSavedAt = source.indexOf("onSaved();", tryStart);
    expect(onSavedAt).toBeGreaterThan(tryStart);
    const catchAt = source.indexOf("} catch (err) {", onSavedAt);
    expect(catchAt).toBeGreaterThan(onSavedAt);
    const finallyAt = source.indexOf("} finally {", catchAt);
    expect(finallyAt).toBeGreaterThan(catchAt);

    // Ordering invariants locked:
    //   setSaving(true) < onSaved() < catch < finally
  });

  it("does not duplicate setSaving(false) outside the finally block", () => {
    // The "single source of truth" invariant: setSaving(false) must
    // appear EXACTLY ONCE in the file (inside the finally block).
    // If a future PR adds it to a success branch (the most common
    // mistake), this test fails.
    const codeOnly = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .map((l) => l.replace(/\/\/.*$/, ""))
      .join("\n");
    const setSavingFalseMatches =
      codeOnly.match(/setSaving\(\s*false\s*\)/g) ?? [];
    expect(setSavingFalseMatches.length).toBe(1);
  });
});
