/**
 * @jest-environment node
 *
 * Source-pattern pin for the session 193 (List 4)
 * `ConfigModelSection` interface consolidation between
 * `src/lib/hermes-import.ts` (the canonical source) and
 * `src/app/api/models/[id]/diff/route.ts` (the consumer that
 * previously redeclared the same 4-field interface).
 *
 * Pre-session, both files declared the interface locally with
 * identical shape:
 *   { default?, provider?, base_url?, context_length? }
 *
 * The diff endpoint used the local declaration for the
 * `readHermesModelSection()` return type. Post-session, the
 * interface is exported from `hermes-import.ts` and imported
 * as a `type` into the diff route. The pre-session diff route
 * had `interface ConfigModelSection { ... }` as a `declare`
 * block; the post-session diff route has only `import type
 * { ConfigModelSection } from "@/lib/hermes-import"`.
 *
 * This test reads both files as text and asserts the post-
 * migration shape:
 *  - `hermes-import.ts` exports the interface (1 export site)
 *  - `hermes-import.ts` still uses it internally for the
 *    `HermesYamlConfig.model?` field
 *  - `models/[id]/diff/route.ts` imports the type (1 import site)
 *  - `models/[id]/diff/route.ts` no longer declares the
 *    interface locally (0 `interface ConfigModelSection` blocks)
 *  - The 4-field shape is preserved in the canonical declaration
 *    (snake_case keys, optional fields)
 */
import { readFileSync } from "fs";
import { join } from "path";

describe("ConfigModelSection interface consolidation (session 193, List 4)", () => {
  const importSource = readFileSync(
    join(process.cwd(), "src/lib/hermes-import.ts"),
    "utf-8",
  );
  const diffSource = readFileSync(
    join(process.cwd(), "src/app/api/models/[id]/diff/route.ts"),
    "utf-8",
  );

  it("hermes-import.ts exports the ConfigModelSection interface (1 export)", () => {
    const matches = importSource.match(
      /export\s+interface\s+ConfigModelSection\b/g,
    ) ?? [];
    expect(matches).toHaveLength(1);
  });

  it("hermes-import.ts preserves the 4-field shape (default, provider, base_url, context_length)", () => {
    // Locate the interface block and check the 4 field lines.
    const blockMatch = importSource.match(
      /export\s+interface\s+ConfigModelSection\s*\{[\s\S]*?\n\s*\}/,
    );
    expect(blockMatch).not.toBeNull();
    const block = blockMatch![0];
    expect(block).toMatch(/default\?:\s*string/);
    expect(block).toMatch(/provider\?:\s*string/);
    expect(block).toMatch(/base_url\?:\s*string/);
    expect(block).toMatch(/context_length\?:\s*number/);
  });

  it("hermes-import.ts still uses ConfigModelSection for HermesYamlConfig.model?", () => {
    // The `HermesYamlConfig` shape (declared nearby) references
    // `ConfigModelSection` as the type of the `model?` field.
    // If the export was a rename-only and the internal
    // reference was lost, this test catches the regression.
    expect(importSource).toMatch(
      /interface\s+HermesYamlConfig[\s\S]*?model\?:\s*ConfigModelSection/,
    );
  });

  it("models/[id]/diff/route.ts imports ConfigModelSection from hermes-import (1 import)", () => {
    const matches = diffSource.match(
      /import\s+type\s*\{\s*ConfigModelSection\s*\}\s*from\s*["']@\/lib\/hermes-import["']/g,
    ) ?? [];
    expect(matches).toHaveLength(1);
  });

  it("models/[id]/diff/route.ts no longer declares ConfigModelSection locally (0 declarations)", () => {
    // The pre-session source had a 6-line `interface
    // ConfigModelSection { ... }` block; the post-session
    // source removes it entirely.
    const matches = diffSource.match(
      /interface\s+ConfigModelSection\b/g,
    ) ?? [];
    expect(matches).toHaveLength(0);
  });

  it("models/[id]/diff/route.ts still uses ConfigModelSection as the return type of readHermesModelSection", () => {
    // The local helper `readHermesModelSection(): ConfigModelSection | null`
    // must still type its return value from the imported alias.
    expect(diffSource).toMatch(
      /function\s+readHermesModelSection\s*\(\s*\)\s*:\s*ConfigModelSection\s*\|\s*null/,
    );
  });
});
