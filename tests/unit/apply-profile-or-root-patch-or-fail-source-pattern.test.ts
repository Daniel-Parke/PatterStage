/** @jest-environment node */

/**
 * Source-pattern test for the `applyProfileOrRootPatchOrFail` /
 * `pushProfileOrRootOrFail` migration across the 5 List 3 routes:
 *
 *   1. src/app/api/personalities/route.ts            (applyProfileOrRootPatchOrFail)
 *   2. src/app/api/agent/personality/route.ts         (applyProfileOrRootPatchOrFail)
 *   3. src/app/api/skills/[name]/toggle/route.ts     (applyProfileOrRootPatchOrFail)
 *   4. src/app/api/agent/profiles/[id]/toolsets/route.ts (applyProfileOrRootPatchOrFail)
 *   5. src/app/api/agent/files/[key]/route.ts        (applyProfileOrRootPatchOrFail
 *                                                    + pushProfileOrRootOrFail)
 *
 * The pre-migration shape was the 4-line form:
 *
 *   const result = applyProfileOrRootPatch(slug, rootPatch, profilePatch);
 *   const err = toPatchResponse(result, "Failed to ...");
 *   if (err) return err;
 *   assertPatchSucceeded(result);
 *
 * (and the 3-line push-only form for the non-config branch of
 * agent/files). The migration collapsed both into 1 call + 1
 * instanceof check:
 *
 *   const result = applyProfileOrRootPatchOrFail(slug, rootPatch, profilePatch, "Failed to ...");
 *   if (result instanceof NextResponse) return result;
 *
 * The 5 call sites of the apply form + 1 call site of the push form
 * are pinned by this test so a future re-introduction of the 3-arg
 * or 4-arg form is caught before the migration debt sneaks back in.
 *
 * Why a per-surface scanner (not per-file tests):
 *   - The umbrella skill's `server-error-from-catch-source-patterns.test.ts`
 *     and `safe-api-call-data-source-pattern-list3.test.ts` are
 *     per-surface scanners. This file follows the same shape: it reads
 *     each List 3 call site and asserts the post-migration import +
 *     call shape. The 5 routes + 1 branch is small enough that a
 *     per-surface scanner is the right granularity.
 *   - If a 6th site is added, the new entry to the `MIGRATED_SITES`
 *     array below forces the author to consciously decide whether the
 *     new site uses the apply or push variant.
 *
 * @see src/lib/apply-profile-or-root-patch.ts — the helper module
 * @see tests/unit/apply-profile-or-root-patch.test.ts — the helper's
 *   unit tests (16 cases across both variants)
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..");

interface MigratedSite {
  /** Path relative to repo root. */
  file: string;
  /** "apply" or "push" — which combined helper the site uses. */
  variant: "apply" | "push";
  /**
   * Optional constraint: only assert the call shape if the
   * "expected call-text fragment" appears in the file. Sites where
   * the helper is optional (e.g. agent/files has both the apply
   * call site and the push call site) use this to scope the
   * assertion to the right branch.
   *
   * If undefined, the test asserts the call shape globally.
   */
  scopeFragment?: string;
}

const MIGRATED_SITES: readonly MigratedSite[] = [
  {
    file: "src/app/api/personalities/route.ts",
    variant: "apply",
  },
  {
    file: "src/app/api/agent/personality/route.ts",
    variant: "apply",
  },
  {
    file: "src/app/api/skills/[name]/toggle/route.ts",
    variant: "apply",
  },
  {
    file: "src/app/api/agent/profiles/[id]/toolsets/route.ts",
    variant: "apply",
  },
  {
    file: "src/app/api/agent/files/[key]/route.ts",
    variant: "apply",
    scopeFragment: "configPatch = {",
  },
  {
    file: "src/app/api/agent/files/[key]/route.ts",
    variant: "push",
    scopeFragment: "writeManagedFileContent(profileSlug, key as ManagedFileKey, content)",
  },
];

describe("applyProfileOrRootPatchOrFail / pushProfileOrRootOrFail — List 3 migration", () => {
  for (const site of MIGRATED_SITES) {
    const absPath = join(REPO_ROOT, site.file);
    const source = readFileSync(absPath, "utf-8");

    describe(`${site.file} (${site.variant})`, () => {
      it("imports the combined helper from @/lib/apply-profile-or-root-patch", () => {
        // The post-migration shape imports the combined helper. The
        // pre-migration shape imported the 3 separate names
        // (applyProfileOrRootPatch, assertPatchSucceeded, toPatchResponse).
        // The pre-migration shape is also still imported by the helper
        // itself in `apply-profile-or-root-patch.ts`, so we check by
        // relative path not the helper module.
        const importRe =
          /import\s*\{[^}]*\bapplyProfileOrRootPatchOrFail\b[^}]*\}\s*from\s*["']@\/lib\/apply-profile-or-root-patch["']/;
        const pushImportRe =
          /import\s*\{[^}]*\bpushProfileOrRootOrFail\b[^}]*\}\s*from\s*["']@\/lib\/apply-profile-or-root-patch["']/;
        const expected = site.variant === "apply" ? importRe : pushImportRe;
        expect(source).toMatch(expected);
      });

      it("does NOT import the 3 separate names (applyProfileOrRootPatch / assertPatchSucceeded / toPatchResponse)", () => {
        // The 3 separate names are now only used by the helper module
        // itself. A consumer route that imports all 3 is a regression
        // indicator — it means someone copy-pasted the pre-migration
        // shape into a new file.
        const separateNamesRe =
          /import\s*\{[^}]*\b(applyProfileOrRootPatch|assertPatchSucceeded|toPatchResponse)\b[^}]*\}\s*from\s*["']@\/lib\/apply-profile-or-root-patch["']/;
        expect(source).not.toMatch(separateNamesRe);
      });

      it("calls the combined helper with the canonical 4-arg (apply) or 2-arg (push) shape", () => {
        // For the apply variant: 4 args = (slug, rootPatch, profilePatch, fallbackError).
        // For the push variant: 2 args = (slug, fallbackError).
        // The exact arg shape is byte-locked so a future "let's pass
        // 3 args and a config object" extension is forced to consciously
        // update this test.
        const helperName =
          site.variant === "apply"
            ? "applyProfileOrRootPatchOrFail"
            : "pushProfileOrRootOrFail";
        const expectedArgCount = site.variant === "apply" ? 4 : 2;
        // If scoped, narrow the source to the relevant region to
        // avoid matching other uses of the helper name in the file.
        const scopedSource = site.scopeFragment
          ? scopeByFragment(source, site.scopeFragment)
          : source;
        const callRe = new RegExp(
          `${helperName}\\s*\\(([\\s\\S]*?)\\)`,
        );
        const callMatch = scopedSource.match(callRe);
        expect(callMatch).not.toBeNull();
        if (callMatch) {
          const args = callMatch[1];
          const collapsed = args.replace(/\s+/g, " ").trim();
          // Strip trailing comma for multi-arg calls.
          const trimmed = collapsed.replace(/,\s*$/, "");
          const argList = trimmed.split(",").map((a) => a.trim());
          expect(argList.length).toBe(expectedArgCount);
        }
      });

      it("uses `instanceof NextResponse` to discriminate the error response (not `if (err) return err`)", () => {
        // The post-migration shape uses `instanceof NextResponse` to
        // discriminate the error response. The pre-migration shape used
        // `if (err) return err` against the separate `toPatchResponse`
        // return. A re-introduction of the latter is a regression.
        const scopedSource = site.scopeFragment
          ? scopeByFragment(source, site.scopeFragment)
          : source;
        // We require AT LEAST ONE `instanceof NextResponse` check
        // near the helper call. We don't pin the exact line because
        // some sites have a 2-line gap between the call and the
        // check (e.g. blank line).
        expect(scopedSource).toMatch(/instanceof\s+NextResponse/);
        // And we forbid `if (err) return err` in the post-migration
        // region — that's the pre-migration discriminator.
        expect(scopedSource).not.toMatch(/if\s*\(\s*err\s*\)\s*return\s+err/);
      });
    });
  }
});

/**
 * Narrow a file's source to a 60-line window around the FIRST
 * occurrence of `fragment`. Used for the agent/files route which
 * has BOTH the apply call (in the `key === "config"` branch) and
 * the push call (in the else branch) — without scoping, the
 * "exactly one call" assertion would match the OTHER variant.
 */
function scopeByFragment(source: string, fragment: string): string {
  const idx = source.indexOf(fragment);
  if (idx < 0) return source;
  const start = Math.max(0, idx - 50);
  const end = Math.min(source.length, idx + fragment.length + 800);
  return source.slice(start, end);
}
