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

/**
 * The plan's target for each, as written at C0 and never moved.
 *
 * One exception, and it is not a move. Amended 2026-09-12 (T-0154, K6), under
 * operator ruling Q-015 (2026-09-12), by a session that does not implement the
 * fix: `routesWithTryCatch` reads 18 rather than 13. See the key below.
 */
const TARGET: Record<keyof typeof AT_C0, number> = {
  srcLines: 98000,
  testLines: 116000,
  srcRepeatedWindowLines: 600,
  testRepeatedWindowLines: 2500,
  /**
   * 13 until 2026-09-12; 18 from app-04a, ruled "widen the same measure"
   * (Daniel Parke, operator, 2026-09-12).
   *
   * The target the plan set was "at most 13 route bodies keep a try of their
   * own" (org/plans/2026-09-consolidation.md:71). The census counted a route
   * only when its catch called serverErrorFromCatch (line-census.mjs:96-100),
   * so eleven hand-rolled catches that log and answer 500, in six files, were
   * never counted: admin/sessions/backfill-status, memory/hindsight,
   * mission-categories, models/fallbacks (already counted through the helper),
   * sync and update. The same thirteen files plus five more is 18.
   *
   * Not one line of route code changed to make that number 18, which is why
   * this is a restatement of the same target in the widened measure's units and
   * not a goalpost moved: I2 of T-0154. The 13 stands as the historical reading
   * in AT_C8 below, where it belongs, because 13 is genuinely what C8 read.
   *
   * Nothing is loosened by it. A fourteenth route body that keeps its own try
   * is still refused — by this check at 18, by the census baseline, which holds
   * the rise from 13 to 18 with a written reason, and by
   * tests/unit/k6-the-gates-see.test.ts, which requires the census's own file
   * list to equal what an independent brace-matched probe finds, so the raised
   * number cannot absorb a new one.
   */
  routesWithTryCatch: 18,
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

type GrowthEntry = { measuredAt?: string; rise?: string; reason?: string };
type HeldBaseline = { counts: Record<string, number>; allowed?: GrowthEntry[] };

/** The census baseline as committed: the number the ratchet holds, and its growth log. */
function heldBaseline(): HeldBaseline {
  return JSON.parse(
    readFileSync(join(ROOT, "scripts", "tooling", "line-census.baseline.json"), "utf8"),
  ) as HeldBaseline;
}

/**
 * Walk one measure from `from` up to `to` through the growth log, a recorded
 * rise at a time, and report what the log cannot account for.
 *
 * A fall needs no reason — down is the direction the programme wanted — so a
 * `to` at or below `from` lands straight away. A rise is accounted for only by
 * an entry that starts where the last one ended and carries a reason, which is
 * the shape `line-census.mjs --allow-growth "<reason>"` writes.
 */
function accountForGrowth(
  log: GrowthEntry[],
  measure: string,
  from: number,
  to: number,
): { landedAt: number; unexplained: string[] } {
  const unexplained: string[] = [];
  if (to <= from) return { landedAt: to, unexplained };

  const shape = new RegExp(`^${measure} rose from (\\d+) to (\\d+)$`);
  const rises = log
    .map((entry) => ({ entry, m: shape.exec(entry.rise ?? "") }))
    .filter((r) => r.m !== null)
    .map((r) => ({
      from: Number((r.m as RegExpExecArray)[1]),
      to: Number((r.m as RegExpExecArray)[2]),
      reason: (r.entry.reason ?? "").trim(),
    }));

  let at = from;
  while (at < to) {
    const step = rises.find((r) => r.from === at);
    if (!step) {
      unexplained.push(`${measure} is held at ${to} and the growth log records no rise starting at ${at}`);
      break;
    }
    if (!step.reason) unexplained.push(`${measure} rose from ${step.from} to ${step.to} with no reason recorded`);
    at = step.to;
  }
  return { landedAt: at, unexplained };
}

describe("C8 · the programme is closed", () => {
  const now = census();
  const keys = Object.keys(AT_C0) as (keyof typeof AT_C0)[];

  /**
   * Amended 2026-09-12 (T-0154, K6), under operator ruling Q-015 (2026-09-12),
   * by a session that does not implement the fix. The case keeps its name, as
   * the ruling requires.
   *
   * What changed and why: the check was `Object.keys(now)` equals AT_C0's keys
   * exactly, which said two things at once — no measure the programme set was
   * dropped, and no measure was ever added. The first is this closed record's
   * business. The second is not: tooling-22 adds `scriptsLines`, because
   * line-census.mjs walked src and tests alone and left scripts/ — the tooling
   * that gates every batch — unmeasured by the ratchet. A closed programme's
   * oracle is not the place a later measure has to ask permission from.
   *
   * So the check is now two facts instead of one, and neither is weaker than
   * what it replaced: not one of the twelve may go missing, and any key beyond
   * them has to be on the dated list below. A measure dropped still fails here;
   * a measure added without a word still fails here. What no longer fails is a
   * measure added on the record.
   *
   * That the new key EXISTS is not asserted here — it is not this record's
   * claim. c0-the-line-census.test.ts requires the baseline to hold every
   * declared measure, and tests/unit/k6-the-gates-see.test.ts requires the
   * census to report scriptsLines and to count scripts/ exactly.
   */
  const ADDED_AFTER_THE_PROGRAMME = ["scriptsLines"];

  it("every measure the programme set is still measured", () => {
    const dropped = keys.filter((k) => !(k in now));
    expect(dropped).toEqual([]);
    const named = new Set<string>([...(keys as readonly string[]), ...ADDED_AFTER_THE_PROGRAMME]);
    const unannounced = Object.keys(now).filter((k) => !named.has(k));
    expect(unannounced).toEqual([]);
  });

  /** The eleven the ratchet still reads live. testLines is the twelfth; see below. */
  const readLive = keys.filter((k) => k !== "testLines");

  it.each(readLive)("%s did not go backwards from where C0 found it", (key) => {
    expect(now[key]).toBeLessThanOrEqual(AT_C0[key]);
  });

  /**
   * Amended 2026-09-12 (T-0149), under POLICY-closed-oracles (ruled by the
   * operator, 2026-09-12; the decision register's Q-015). The case keeps its
   * name, as the ruling requires, and stops reading a live count.
   *
   * Why this measure and none of the other eleven. Those eleven count a thing
   * the programme was taking out — try/catch route bodies, hand-rolled reads,
   * lib-root files, comment essays — and nothing a later batch legitimately
   * does puts one back, so they still read live against AT_C0 above and are all
   * comfortably inside it. testLines is not like them: every oracle this
   * repository writes is test lines, so a batch doing exactly what the process
   * demands — a new suite before the implementation, an amendment to this one —
   * raises it by construction. Read live it had already gone red at 121878
   * against C0's 121762, and each oracle after it would make it redder: a gate
   * punishing the discipline it exists to protect. Re-anchoring it to what C8
   * left is not the fix either, and would not even be a loosening — C8 read
   * 121114, which is stricter than C0's number, so the case would stay red.
   *
   * What governs testLines from here is the committed census baseline,
   * scripts/tooling/line-census.baseline.json, which already refuses an
   * unexplained rise: `node scripts/tooling/line-census.mjs` exits 1 when the
   * tree is above the held number, and a batch holds a rise only by passing
   * --allow-growth "<reason>", which writes the reason into the file beside the
   * number. That refusal is itself held by C0's own oracle, in
   * tests/unit/c0-the-line-census.test.ts ("refuses growth and accepts a fall"
   * and "a re-cut holds a rise only with a reason"). A line budget for tests
   * belongs to the programme that owns it, as a target with a burn-down, not to
   * this closed record.
   *
   * So what is left for this case is the account, and the account still bites:
   * every rise above what C8 left has to be in the growth log, each with a
   * reason, in an unbroken chain that ends exactly on the number the baseline
   * holds. Growth cannot happen silently — a number edited upward by hand, a
   * chain with a gap in it, or a rise held with a blank reason all fail here —
   * and the closed programme's own account of its lines is still recorded.
   */
  it("testLines did not go backwards from where C0 found it", () => {
    const held = heldBaseline();
    const end = held.counts.testLines;
    expect(Number.isInteger(end)).toBe(true);

    const { landedAt, unexplained } = accountForGrowth(held.allowed ?? [], "testLines", AT_C8.testLines, end);
    expect(unexplained).toEqual([]);
    expect(landedAt).toBe(end);
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
