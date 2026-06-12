/**
 * @jest-environment node
 *
 * Source-pattern test for the `config-cache` module extraction in
 * `src/app/api/config/route.ts` (List 4 refactor, session 187).
 *
 * The pre-refactor route had `readCachedConfig` + `invalidateConfigCache`
 * inline at the top of the file, with the cache key strings
 * "config.cached_json" and "config.cached_at" repeated 4× across
 * the read + write + invalidate blocks. The refactor moved the
 * logic into `src/lib/config-cache.ts` and replaced the inline
 * functions with imports.
 *
 * This test pins the post-extraction shape so a future
 * "inline the cache back into the route" PR can't regress:
 *   - Route imports `readCachedConfig` and `invalidateConfigCache` from `@/lib/config-cache`
 *   - Route does NOT import `db()` or `yaml` or `readFileSync` /
 *     `existsSync` (the cache module owns those dependencies)
 *   - The 2 cache key string literals are NOT in the route anymore
 *     (they live in the module as `CACHE_KEY_JSON` / `CACHE_KEY_AT`)
 *
 * The companion test `tests/unit/config-cache.test.ts` locks the
 * runtime behaviour of the helper module itself. This test locks
 * the structural shape of the route (which dependencies it owns
 * vs. which it delegates to the module).
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
  "config",
  "route.ts",
);

describe("/api/config — List 4 config-cache module extraction (session 187)", () => {
  let source: string;

  beforeAll(() => {
    source = fs.readFileSync(ROUTE_PATH, "utf-8");
  });

  test("imports readCachedConfig + invalidateConfigCache from @/lib/config-cache", () => {
    expect(source).toMatch(
      /import\s*\{[^}]*\breadCachedConfig\b[^}]*\}\s*from\s*["']@\/lib\/config-cache["']/,
    );
    expect(source).toMatch(
      /import\s*\{[^}]*\binvalidateConfigCache\b[^}]*\}\s*from\s*["']@\/lib\/config-cache["']/,
    );
  });

  test("does NOT import yaml, readFileSync, or existsSync (delegated to the cache module)", () => {
    // The route still imports writeFileSync (for the PUT branch), but
    // it should NOT need to import the cache's read-side dependencies.
    // A future "inline the cache back into the route" PR would re-introduce
    // these imports — this test catches the regression.
    const importLines = source
      .split("\n")
      .filter((line) => /^\s*import\b/.test(line));

    const joined = importLines.join("\n");
    expect(joined).not.toMatch(/from\s+["']js-yaml["']/);
    expect(joined).not.toMatch(/\breadFileSync\b/);
    expect(joined).not.toMatch(/\bexistsSync\b/);
    expect(joined).not.toMatch(/\bdb\(\)/);
  });

  test("the cache key strings live in the module, not the route", () => {
    // The 2 cache key string literals ("config.cached_json",
    // "config.cached_at") were repeated 4× in the pre-refactor route.
    // Post-refactor, the route should have 0 references to them
    // (the module owns the constants).
    expect(source).not.toMatch(/["']config\.cached_json["']/);
    expect(source).not.toMatch(/["']config\.cached_at["']/);
  });
});
