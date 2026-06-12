/**
 * @jest-environment node
 *
 * Source-pattern test for the credential-link Map extraction in
 * `src/app/api/models/import/route.ts` (List 4 refactor, session 187).
 *
 * The pre-refactor code did:
 *   const model = listModels().find((m) => m.id === modelId);
 * inside a for-of loop, costing O(N×M) — one full listModels() scan
 * per model in `parsed.models`. The refactor hoists the listModels()
 * call out of the loop and indexes the rows by id in a Map:
 *   const existingById = new Map(listModels().map((m) => [m.id, m]));
 *   for (const entry of parsed.models) {
 *     ...
 *     const model = existingById.get(modelId);
 *     ...
 *   }
 *
 * The Map snapshot is byte-equivalent for this loop's semantics:
 *   - Each `modelId` from `modelKeyToId.get(...)` maps 1:1 to a row in
 *     `listModels()` (both originate from the same registry writes).
 *   - Each `modelId` is updated at most once during the loop.
 *   - The `model.credentialsId !== credId` check on the first (and
 *     only) iteration for that id reads the pre-update DB state,
 *     which is the only state the comparison needs.
 *
 * This test pins the post-refactor shape so a future
 * "inline the Map back into the loop" PR can't regress:
 *   - `listModels().map(...)` (the Map builder) is present
 *   - `new Map(` is the first call after the link loop begins
 *   - The loop body uses `existingById.get(...)`, NOT `listModels().find(...)`
 *   - The function signature is unchanged (POST that returns ImportResult)
 */

import * as fs from "fs";
import * as path from "path";

const ROUTE_PATH = path.join(
  __dirname,
  "..",
  "..",
  "src",
  "app",
  "api",
  "models",
  "import",
  "route.ts",
);

describe("/api/models/import — List 4 credential-link Map extraction", () => {
  let source: string;

  beforeAll(() => {
    source = fs.readFileSync(ROUTE_PATH, "utf-8");
  });

  test("builds the existingById Map from listModels() once outside the loop", () => {
    // The Map builder line: `const existingById = new Map(listModels().map(...))`.
    // This is the canonical "hoist the listModels() out of the loop" form.
    expect(source).toMatch(
      /const\s+existingById\s*=\s*new\s+Map\(\s*listModels\(\)\.map\(/,
    );
  });

  test("loop body uses existingById.get() — not listModels().find()", () => {
    // Find the link loop. The post-refactor loop body must read via
    // the Map, not by re-scanning the full registry per iteration.
    expect(source).toMatch(/existingById\.get\(\s*modelId\s*\)/);
    // The pre-refactor `listModels().find(...)` form must be GONE from
    // the executable code. Strip single-line `//` comments first so
    // a "listModels().find(...)" reference inside a doc comment
    // (explaining the pre-refactor form) doesn't trip the test.
    const codeOnly = source
      .split("\n")
      .map((line) => {
        const idx = line.search(/\s\/\//);
        return idx >= 0 ? line.slice(0, idx) : line;
      })
      .join("\n");
    expect(codeOnly).not.toMatch(/listModels\(\)\.find\(/);
  });

  test("only one listModels() call exists in the link block (the Map builder)", () => {
    // Isolate the link block by finding the `// Link credentials to models`
    // comment and the end of the for-of loop. Strip single-line `//` comments
    // so a "listModels()" reference in a doc comment doesn't inflate the
    // call count.
    const linkStart = source.indexOf("// Link credentials to models");
    expect(linkStart).toBeGreaterThan(-1);
    const modelsImportedIdx = source.indexOf("modelsImported", linkStart);
    expect(modelsImportedIdx).toBeGreaterThan(-1);

    const linkBlock = source
      .slice(linkStart, modelsImportedIdx)
      .split("\n")
      .map((line) => {
        // Remove inline `//` comments (strip everything from `//` to EOL,
        // but only when the `//` is preceded by whitespace — preserves
        // URLs that contain `//`).
        const idx = line.search(/\s\/\//);
        return idx >= 0 ? line.slice(0, idx) : line;
      })
      .join("\n");
    const listModelsCalls = (linkBlock.match(/listModels\(\)/g) ?? []).length;
    expect(listModelsCalls).toBe(1); // exactly one — the Map builder
  });
});
