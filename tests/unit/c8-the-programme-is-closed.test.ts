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
 * What C8 read when the programme closed, taken from the plan's closing table
 * and from T-0145's verification field, which agree number for number.
 *
 * Amended 2026-09-12 (T-0146), under POLICY-closed-oracles (ruled by the
 * operator, 2026-09-12). This constant is new, and the two checks that name it
 * below used to read scripts/tooling/line-census.baseline.json live. That
 * coupling was wrong in one direction: the baseline is a ratchet that moves
 * whenever a batch adds a line for a written reason — T-0146's own oracle took
 * testLines from 121114 to 121204, with the reason in the baseline's growth log
 * — while the plan's closing section is a CLOSED record quoting the numbers as
 * they stood at C8. Read live, the two disagreed by construction: no later
 * batch could add a single test without either editing a closed record or
 * leaving this suite red. What the plan said at C8 is a fact about C8, so it is
 * frozen here the way AT_C0 and TARGET are.
 *
 * Nothing about the ratchet is given up. The per-measure check below still
 * reads the census live and still refuses any measure that goes backwards from
 * C0, the met-target check below still reads it live and still refuses a met
 * measure that regresses above its target, and the baseline itself is still
 * policed, live, by `npm run census:lines`.
 */
const AT_C8: Record<keyof typeof AT_C0, number> = {
  srcLines: 100881,
  testLines: 121114,
  srcRepeatedWindowLines: 1000,
  testRepeatedWindowLines: 4343,
  routesWithTryCatch: 13,
  handRolledReadHooks: 0,
  writeHooksWithoutMutation: 0,
  repeatedTypeShapeFiles: 2,
  oneImporterComponents: 103,
  libRootFiles: 6,
  commentEssays: 9,
  suitesMockingDbInline: 14,
};

/**
 * The measures that did not reach their target, each with the number it
 * actually read at C8. A miss belongs in the record and in the plan, not in a
 * softened target: this list is the batch's own account of what is left, and
 * the test fails if a measure missed at C8 that is not on it, or if one on it
 * turns out to have met its target after all.
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
    // Amended 2026-09-12 (T-0146), POLICY-closed-oracles: the list is what the
    // plan recorded at C8, so it is read against AT_C8 rather than against a
    // live count that a later batch moves. See AT_C8 for why. The test name is
    // unchanged, as the ruling requires.
    const missedAtC8 = keys.filter((k) => AT_C8[k] > TARGET[k]);
    expect(missedAtC8.slice().sort()).toEqual(MISSED.slice().sort());
  });

  /**
   * The plan is where an operator reads the result, so a miss that lives only
   * in a test record is a miss nobody sees. Each missed measure's key has to
   * appear in the plan's closing section with its number beside it.
   *
   * Against the numbers frozen AT C8, not a live count and not the live
   * baseline. A live count would put the plan in a loop with itself: writing
   * this test changed `testLines`, so the number the plan had just stated
   * stopped being true the moment it was checked.
   *
   * Amended 2026-09-12 (T-0146), POLICY-closed-oracles: it read the live
   * scripts/tooling/line-census.baseline.json, which has the same loop one step
   * out. The baseline is a ratchet that moves with a written reason on every
   * batch that adds a line; the plan's closing section is closed and quotes C8.
   * So this now reads AT_C8, the closed record's own numbers, and what the two
   * must agree on is the account the operator reads, not today's count. The
   * test name is unchanged, as the ruling requires. See AT_C8.
   */
  it("the plan says what missed, with the number the baseline holds", () => {
    const plan = readFileSync(join(ROOT, "org", "plans", "2026-09-consolidation.md"), "utf8");
    const closing = plan.slice(plan.indexOf("## What the programme did"));
    expect(closing.length).toBeGreaterThan(400);
    // A number written for a person carries thousands separators; 100,881 and
    // 100881 are the same number, and the plan is prose before it is data.
    const asWritten = closing.replace(/(\d),(?=\d{3}\b)/g, "$1");
    const silent = MISSED.filter((k) => !closing.includes(k) || !asWritten.includes(String(AT_C8[k])));
    expect(silent).toEqual([]);
  });

  it("and the plan is marked done rather than left open", () => {
    const plan = readFileSync(join(ROOT, "org", "plans", "2026-09-consolidation.md"), "utf8");
    expect(plan.slice(0, plan.indexOf("\n---", 4))).toMatch(/^status: done$/m);
  });
});
