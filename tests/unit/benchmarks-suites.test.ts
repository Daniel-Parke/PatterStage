/** @jest-environment node */
// Generic guard: every registered suite's items must grade their own ideal
// answer as PASSED, so answer keys can't silently rot as suites are added.

import { SUITES } from "@/lib/benchmarks/suites";
import { gradeOutput } from "@/lib/benchmarks/score";
import type { Grader } from "@/lib/benchmarks/types";

/** Derive a known-correct answer from a grader spec (null = can't derive → skip). */
function idealAnswer(grader: Grader): string | null {
  switch (grader.kind) {
    case "exact":
      return grader.expected;
    case "numeric":
      return String(grader.expected);
    case "mcq":
      return grader.expected;
    case "contains":
      return grader.needles.join(" ");
    case "json_schema":
      return JSON.stringify(Object.fromEntries((grader.requiredKeys ?? []).map((k) => [k, 1])));
    case "regex":
    case "consistency":
      return null; // not deterministically derivable here
  }
}

describe("registered benchmark suites", () => {
  it("has at least two suites (holistic merge is exercised)", () => {
    expect(SUITES.length).toBeGreaterThanOrEqual(2);
  });

  for (const suite of SUITES) {
    describe(`${suite.key} v${suite.version}`, () => {
      it("has a stable key + semver", () => {
        expect(suite.key).toMatch(/^[a-z0-9-]+$/);
        expect(suite.version).toMatch(/^\d+\.\d+\.\d+$/);
      });

      for (const item of suite.items) {
        const ideal = idealAnswer(item.grader);
        if (ideal === null) continue;
        it(`${item.id} grades its ideal answer as passed`, () => {
          expect(gradeOutput(item.grader, ideal).passed).toBe(true);
        });
      }
    });
  }
});
