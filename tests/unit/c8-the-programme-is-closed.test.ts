/**
 * C8 · The programme is closed.
 *
 * The consolidation programme set twelve numbers at C0 and a target for each.
 * This reads the census as it stands against those targets, and refuses two
 * things: a target quietly restated to match what was achieved, and a miss
 * left out of the plan. Every measure that missed is named here with its
 * number, and the plan's own table has to say so too.
 *
 * A batch's own corrections live in its row in org/plans/2026-09-consolidation.md;
 * this is the programme's arithmetic, in one place, held by a test rather than
 * by a paragraph.
 */

import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");

/** What C0 measured, from the first baseline it committed (4c5d37c9). */
const AT_C0 = {
  srcLines: 107123,
  testLines: 121762,
  srcRepeatedWindowLines: 1416,
  testRepeatedWindowLines: 6028,
  routesWithTryCatch: 82,
  handRolledReadHooks: 5,
  writeHooksWithoutMutation: 4,
  repeatedTypeShapeFiles: 23,
  oneImporterComponents: 130,
  libRootFiles: 71,
  commentEssays: 107,
  suitesMockingDbInline: 100,
} as const;

/** The plan's target for each, as written at C0 and never moved. */
const TARGET: Record<keyof typeof AT_C0, number> = {
  srcLines: 98000,
  testLines: 116000,
  srcRepeatedWindowLines: 600,
  testRepeatedWindowLines: 2500,
  routesWithTryCatch: 13,
  handRolledReadHooks: 0,
  writeHooksWithoutMutation: 0,
  repeatedTypeShapeFiles: 3,
  oneImporterComponents: 95,
  libRootFiles: 12,
  commentEssays: 60,
  suitesMockingDbInline: 20,
};

/**
 * The measures that did not reach their target, each with the number it
 * actually reads. A miss belongs in the record and in the plan, not in a
 * softened target: this list is the batch's own account of what is left, and
 * the test fails if a measure misses that is not on it, or if one on it turns
 * out to have met its target after all.
 */
const MISSED: (keyof typeof AT_C0)[] = [
  "srcLines",
  "testLines",
  "srcRepeatedWindowLines",
  "testRepeatedWindowLines",
  "oneImporterComponents",
];

function census(): Record<string, number> {
  const out = execFileSync(process.execPath, [join(ROOT, "scripts", "tooling", "line-census.mjs"), "--report"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return (JSON.parse(out) as { counts: Record<string, number> }).counts;
}

describe("C8 · the programme is closed", () => {
  const now = census();
  const keys = Object.keys(AT_C0) as (keyof typeof AT_C0)[];

  it("every measure the programme set is still measured", () => {
    expect(Object.keys(now).sort()).toEqual(keys.slice().sort());
  });

  it.each(keys)("%s did not go backwards from where C0 found it", (key) => {
    expect(now[key]).toBeLessThanOrEqual(AT_C0[key]);
  });

  it("the measures that met their target, met it", () => {
    const met = keys.filter((k) => !MISSED.includes(k));
    const broken = met.filter((k) => now[k] > TARGET[k]).map((k) => `${k}: ${now[k]} > ${TARGET[k]}`);
    expect(broken).toEqual([]);
  });

  it("the measures on the missed list really did miss, so the list cannot flatter", () => {
    const notActuallyMissed = MISSED.filter((k) => now[k] <= TARGET[k]).map((k) => `${k}: ${now[k]} <= ${TARGET[k]}`);
    expect(notActuallyMissed).toEqual([]);
  });

  /**
   * The plan is where an operator reads the result, so a miss that lives only
   * in a test record is a miss nobody sees. Each missed measure's key has to
   * appear in the plan's closing section with its number beside it.
   */
  it("the plan says what missed, with the number", () => {
    const plan = readFileSync(join(ROOT, "org", "plans", "2026-09-consolidation.md"), "utf8");
    const closing = plan.slice(plan.indexOf("## What the programme did"));
    expect(closing.length).toBeGreaterThan(400);
    const silent = MISSED.filter((k) => !closing.includes(k) || !closing.includes(String(now[k])));
    expect(silent).toEqual([]);
  });

  it("and the plan is marked done rather than left open", () => {
    const plan = readFileSync(join(ROOT, "org", "plans", "2026-09-consolidation.md"), "utf8");
    expect(plan.slice(0, plan.indexOf("\n---", 4))).toMatch(/^status: done$/m);
  });
});
