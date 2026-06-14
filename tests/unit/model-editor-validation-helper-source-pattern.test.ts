/** @jest-environment node */

/**
 * Source-pattern test for the session-212 ModelEditor.tsx
 * `validateModelForm` + `parseOptionalStringField` file-local helper
 * extraction. Locks the post-refactor shape of the `handleSubmit`
 * pre-flight so a future "tidy up the validation" PR can't:
 *   - re-introduce inline `if (!X.trim()) return setError(Y)` checks
 *     (the canonical pattern is now the pure-helper call + single
 *     guard; the 3 error strings live in `validateModelForm` only)
 *   - move the `validateModelForm` helper out of the file
 *     (it's intentionally file-local — the validation is specific to
 *     ModelEditor's FormState shape; promoting it to a shared module
 *     would force a generic Record-based signature that loses
 *     type-safety for the 3 string fields and the `apiKey` create-mode
 *     gate)
 *   - re-introduce the inline `form.X.trim() === "" ? null : form.X.trim()`
 *     pattern (the canonical pattern is the `parseOptionalStringField`
 *     helper; the 2 use sites in `handleSubmit` reuse it)
 *
 * Why source-pattern instead of rendering the component:
 *   - ModelEditor is a 350+ line client component with a 9-key
 *     FormState, a credential-creation sub-flow, a provider-change
 *     cascading-reset, and a finally-block saving-state discipline.
 *     A render harness would dwarf the 2 invariant assertions.
 *   - The "validateModelForm + parseOptionalStringField" presence +
 *     the handleSubmit pre-flight shape are the byte-level contract.
 *
 * What this test does NOT lock:
 *   - The exact error string text (the 3 messages can be edited
 *     without breaking this test, as long as the call site still
 *     uses the helper)
 *   - The exact set of fields the helper validates (a future
 *     "validate the baseUrl" extension can be added inside the
 *     helper; this test would only break if the helper is deleted)
 *   - The onSaved() callback's behavior (tested in the parent's
 *     useModelsPage test suite)
 *   - The credentialLabel auto-fill side-effect (still lives in
 *     handleSubmit between the validation guard and the saving
 *     state transition)
 */
import * as fs from "node:fs";
import * as path from "node:path";

const COMPONENT_PATH = path.resolve(
  __dirname,
  "../../src/components/models/ModelEditor.tsx",
);

/**
 * Extract the body of the `handleSubmit = async () => { ... }`
 * function. Uses brace counting (not regex) so the captured body is
 * always the full function, regardless of nested braces in
 * try/catch/finally, ternaries, object literals, or arrow functions
 * inside. Returns the captured body string (without the surrounding
 * `const handleSubmit = ...` and outer braces) for downstream regex
 * assertions.
 */
function extractHandleSubmitBody(source: string): string {
  const startMatch = source.match(/const\s+handleSubmit\s*=\s*async\s*\(\s*\)\s*=>\s*\{/);
  if (!startMatch) return "";
  const startIdx = startMatch.index! + startMatch[0].length;
  // Walk forward, counting braces. The first `{` (the function's
  // opening brace) is already consumed by the match above; the next
  // `{` we see is the first nested one. Walk until depth returns to 0
  // (i.e. we've seen one more `}` than `{` from the walk start).
  let depth = 1;
  let endIdx = startIdx;
  for (let i = startIdx; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) {
        endIdx = i;
        break;
      }
    }
  }
  return source.slice(startIdx, endIdx);
}

describe("ModelEditor validateModelForm + parseOptionalStringField helper extraction", () => {
  const source = fs.readFileSync(COMPONENT_PATH, "utf-8");

  describe("validateModelForm file-local helper", () => {
    it("declares a top-level validateModelForm function", () => {
      // The return type annotation may break across lines on long
      // signatures (`): string | null` on a new line). Use a
      // multi-line regex that matches the function header + the
      // type annotation regardless of break.
      expect(source).toMatch(
        /function\s+validateModelForm\s*\(\s*form\s*:\s*FormState[\s\S]*?string\s*\|\s*null\s*\{/,
      );
    });

    it("returns the 3 expected error messages + null happy path", () => {
      // The 3 error strings + the explicit `return null` happy path
      // are the contract — the canonical validation surface that
      // handleSubmit gates on. A regression that drops one of these
      // (or returns undefined for the happy path) breaks the
      // `validationError ? setError : continue` check at the call
      // site.
      expect(source).toMatch(/return "Name is required"/);
      expect(source).toMatch(/return "Model ID is required"/);
      expect(source).toMatch(
        /return "API key is required when creating a new credential"/,
      );
      expect(source).toMatch(/^\s*return null;\s*$/m);
    });
  });

  describe("parseOptionalStringField file-local helper", () => {
    it("declares a top-level parseOptionalStringField function", () => {
      // Same multi-line regex pattern as `validateModelForm` above —
      // the return type may break across lines.
      expect(source).toMatch(
        /function\s+parseOptionalStringField\s*\(\s*raw\s*:\s*string[\s\S]*?string\s*\|\s*number\s*\|\s*null\s*\{/,
      );
    });

    it("returns null for empty input", () => {
      // The empty-input branch is the `parseOptionalStringField`
      // discriminator: `raw.trim() === ""` is the "user left the
      // field blank" path, which the API receives as `null` for
      // both baseUrl and contextLength. A regression that returns
      // `""` instead of `null` would break the optional-field
      // contract with the API (the PUT body would carry `baseUrl: ""`
      // instead of `baseUrl: null`).
      expect(source).toMatch(
        /const\s+trimmed\s*=\s*raw\.trim\(\);\s*return\s+trimmed\s*===\s*""\s*\?\s*null\s*:\s*parse\(trimmed\)/,
      );
    });
  });

  describe("handleSubmit pre-flight uses the helpers (no inline duplicate)", () => {
    it("calls validateModelForm + single guard (no inline if (!X) return setError)", () => {
      // The pre-refactor form was 4 sequential
      // `if (!X) return setError(Y)` lines. Post-refactor: a single
      // `validateModelForm(...)` call + a `if (validationError) { setError(...); return }`
      // guard. Any re-introduction of inline field-validation
      // inside handleSubmit breaks this assertion.
      // Strip block + line comments so JSDoc prose that mentions
      // the pre-refactor pattern doesn't trigger a false positive
      // on the negative assertion (the post-extraction JSDoc
      // above the helper call documents the old shape as
      // "4 sequential `if (!X) return setError(Y)` checks").
      const stripComments = (text: string): string =>
        text
          .replace(/\/\*[\s\S]*?\*\//g, "/* */")
          .replace(/^\s*\/\/.*$/gm, "");
      const body = stripComments(extractHandleSubmitBody(source));
      expect(body).toMatch(/validateModelForm\s*\(\s*form\s*,\s*isEdit\s*,\s*usingExisting\s*\)/);
      // The handleSubmit body must NOT contain the inline
      // `if (!form.name.trim()) return setError(...)` shape — that's
      // the pre-refactor pattern the helper replaces.
      expect(body).not.toMatch(/if\s*\(\s*!\s*form\.name\.trim\(\)\s*\)\s*return\s+setError/);
      expect(body).not.toMatch(/if\s*\(\s*!\s*form\.modelId\.trim\(\)\s*\)\s*return\s+setError/);
    });

    it("uses parseOptionalStringField for baseUrl + contextLength (no inline ternary)", () => {
      // The pre-refactor form had two inline `form.X.trim() === "" ? null : <expr>`
      // patterns. Post-refactor: both call `parseOptionalStringField`.
      // A regression that re-introduces the inline ternary for either
      // field breaks this assertion.
      // The 2 use sites may break the argument list across multiple
      // lines (e.g. `parseOptionalStringField(\n  form.contextLength,\n  Number,\n)`),
      // so the regex uses [\s\S] to allow the 2nd use site's line breaks.
      const stripComments = (text: string): string =>
        text
          .replace(/\/\*[\s\S]*?\*\//g, "/* */")
          .replace(/^\s*\/\/.*$/gm, "");
      const body = stripComments(extractHandleSubmitBody(source));
      // baseUrl use site — single-line, `(t) => t` identity
      expect(body).toMatch(/parseOptionalStringField\s*\(\s*form\.baseUrl\s*,\s*\(t\)\s*=>\s*t\s*\)/);
      // contextLength use site — the assignment is
      // `const contextLength = parseOptionalStringField(\n  form.contextLength,\n  Number,\n) as number | null;`
      // so the call is preceded by `= ` and breaks the argument list
      // across multiple lines with a `,` after `Number` (not a `)`
      // — `Number` is the 2nd positional argument, not the call
      // closer). The regex anchors on the call signature, allowing
      // any non-`)` content between `Number` and the closing `)`.
      expect(body).toMatch(
        /=\s*parseOptionalStringField\s*\(\s*form\.contextLength\s*,[\s\S]*?Number[\s\S]*?\)/,
      );
      // No re-introduced inline ternary
      expect(body).not.toMatch(/form\.baseUrl\.trim\(\)\s*===\s*""\s*\?\s*null/);
      expect(body).not.toMatch(/form\.contextLength\.trim\(\)\s*===\s*""\s*\?\s*null/);
    });
  });
});
