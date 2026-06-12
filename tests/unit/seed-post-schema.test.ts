/**
 * Source-pattern test for the `seedPostSchema` migration in
 * `src/app/api/seed/route.ts` (session 167, List 4).
 *
 * Pins the post-migration shape so future refactors can't silently
 * drop the strict validation without an explicit test update:
 *
 *   1. `seedPostSchema` is exported from `@/lib/api-schemas`.
 *   2. `api/seed/route.ts` imports the schema (not the inline-cast form).
 *   3. The route imports `parseAndValidateJsonBody` from
 *      `@/lib/parse-json-body` (the new canonical pattern; replaces
 *      `parseJsonBody` + manual casts).
 *   4. The route does NOT use the old `as SeedTarget["target"]` /
 *      `as SeedTarget["mode"]` widening casts.
 *   5. The route does NOT import `SeedTarget` from `@/lib/seed/catalog-seed`
 *      (the type was only needed for the old casts; the new schema's
 *      `.transform()` returns its own inferred type).
 *
 * Sister test to `tests/unit/server-error-from-catch.test.ts` and
 * `tests/unit/parse-and-validate-json-body.test.ts` — all three pin
 * the parse → validate → respond shape that the Models/Config surface
 * adopted in sessions 121 + 122 + 167.
 */
import * as fs from "fs";
import * as path from "path";

import {
  seedPostSchema,
  type SeedPostBody,
} from "@/lib/api-schemas";

describe("seedPostSchema (session 167 — List 4 seed route migration)", () => {
  describe("schema shape", () => {
    it("accepts an empty body and applies defaults via the route", () => {
      // The route does `target = "all", mode = "merge"` via destructure
      // defaults — the schema's z.enum fields are all `.optional()`, so
      // an empty body passes validation and the route applies the
      // defaults. The seed-api.test.ts integration test pins this end-to-end.
      const result = seedPostSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("accepts the canonical target/mode enum values", () => {
      const result = seedPostSchema.safeParse({
        target: "root",
        mode: "replace",
      });
      expect(result.success).toBe(true);
    });

    it("rejects an unknown target value at the request-validation layer", () => {
      // Pre-refactor: `body.target as SeedTarget["target"]` was a no-op cast,
      // so a foreign value would silently reach `runCatalogSeed` and surface
      // as a less-actionable runtime error. Post-refactor: the schema
      // rejects it with a structured `details: error.flatten()` payload.
      const result = seedPostSchema.safeParse({ target: "xss" });
      expect(result.success).toBe(false);
    });

    it("rejects an unknown mode value at the request-validation layer", () => {
      const result = seedPostSchema.safeParse({ mode: "force" });
      expect(result.success).toBe(false);
    });

    it("folds the legacy `id` alias back to `templateId`", () => {
      // Pre-refactor: the route had
      //   templateId = typeof body.templateId === "string" ? body.templateId
      //              : typeof body.id === "string" ? body.id : undefined
      // Post-refactor: the schema's `.transform()` does the same fold.
      const result = seedPostSchema.safeParse({ id: "tpl-123" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.templateId).toBe("tpl-123");
        // The legacy `id` field is dropped from the inferred type — the
        // route receives `{ target?, mode?, slug?, templateId }` only.
        expect((result.data as { id?: string }).id).toBeUndefined();
      }
    });

    it("prefers the explicit templateId when both `id` and `templateId` are sent", () => {
      const result = seedPostSchema.safeParse({
        id: "legacy-id",
        templateId: "modern-id",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.templateId).toBe("modern-id");
      }
    });

    it("rejects an empty-string slug (z.string().min(1))", () => {
      const result = seedPostSchema.safeParse({ slug: "" });
      expect(result.success).toBe(false);
    });

    it("exposes a SeedPostBody type that the route can destructure", () => {
      // Compile-time check: the inferred type has the right shape.
      // The runtime check below is a no-op; the value is just there to
      // force the type into a local binding so a future schema drift
      // breaks the test.
      const sample: SeedPostBody = {
        target: "profiles",
        mode: "merge",
        slug: "bob",
        templateId: "tpl-1",
      };
      expect(sample.target).toBe("profiles");
    });
  });

  describe("route source pattern", () => {
    const routePath = path.join(
      process.cwd(),
      "src/app/api/seed/route.ts",
    );
    const routeSource = fs.readFileSync(routePath, "utf-8");

    it("api/seed/route.ts exists and is readable", () => {
      expect(routeSource.length).toBeGreaterThan(0);
    });

    it("imports seedPostSchema from @/lib/api-schemas", () => {
      expect(routeSource).toMatch(
        /import\s*\{\s*seedPostSchema\s*\}\s*from\s*["']@\/lib\/api-schemas["']/,
      );
    });

    it("imports parseAndValidateJsonBody (NOT the bare parseJsonBody)", () => {
      expect(routeSource).toMatch(
        /import\s*\{\s*parseAndValidateJsonBody\s*\}\s*from\s*["']@\/lib\/parse-json-body["']/,
      );
      // Guard against the old pattern sneaking back in.
      expect(routeSource).not.toMatch(
        /import\s*\{\s*parseJsonBody\s*\}\s*from\s*["']@\/lib\/parse-json-body["']/,
      );
    });

    it("does NOT use the old `as SeedTarget[...]` widening casts", () => {
      // The casts were the symptom — the type was needed only to type-narrow
      // the unvalidated `body.target` and `body.mode` fields. With the
      // schema in place, the destructure pulls the validated `target` and
      // `mode` directly off `parsed` and applies defaults via JS destructuring.
      // Strip block comments first so the JSDoc paragraph above (which
      // literally contains `as SeedTarget["target"]` for documentation)
      // doesn't trip the assertion.
      const codeOnly = routeSource
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      expect(codeOnly).not.toMatch(/as\s+SeedTarget\[/);
      expect(codeOnly).not.toMatch(/as\s+SeedTarget\b/);
    });

    it("does NOT import SeedTarget from @/lib/seed/catalog-seed", () => {
      // The type was only consumed by the old casts. Removing the cast
      // means the type is unused at the route layer; the inferred
      // `SeedPostBody` from the schema replaces it.
      expect(routeSource).not.toMatch(
        /import\s*\{[^}]*\bSeedTarget\b[^}]*\}\s*from\s*["']@\/lib\/seed\/catalog-seed["']/,
      );
    });

    it("destructure-defaults target and mode (preserves the pre-refactor behaviour)", () => {
      // Pre-refactor: `const target = body.target ?? "all";` etc.
      // Post-refactor: `const { target = "all", mode = "merge", ... } = parsed;`
      // Either shape passes the empty-body test in seed-api.test.ts; the
      // destructure-defaults form is preferred because it removes the `??`
      // boilerplate and lets TypeScript narrow the union directly.
      expect(routeSource).toMatch(/target\s*=\s*["']all["']/);
      expect(routeSource).toMatch(/mode\s*=\s*["']merge["']/);
    });
  });
});
