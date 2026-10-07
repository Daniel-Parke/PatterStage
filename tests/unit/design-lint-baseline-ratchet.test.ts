/**
 * The design-lint baseline ratchet (T-0025, warrant Q-008, drift finding D-14).
 *
 * --update-baseline used to write whatever the scan had just counted. Run it
 * after a regression and the baseline grew in silence, while the header said
 * "the baseline only ever shrinks" and the failure text said "do NOT run
 * --update-baseline to silence a new violation". Neither sentence was code.
 *
 * So every assertion below is paired the way the canary's are: a planted
 * regression must be REFUSED, a genuine cleanup must be ACCEPTED, and the escape
 * hatch must work with a written reason and refuse without one. A ratchet that
 * only ever says no is a broken tool, and one that only ever says yes is the
 * defect this replaced.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  ALLOW_GROWTH_FLAG,
  GROWTH_LOG_KEY,
  MIN_REASON_LENGTH,
  baselineGrowth,
  parseGrowthAllowance,
  planBaselineWrite,
  splitBaseline,
} from "../../scripts/tooling/design-lint.mjs";

/** A committed baseline, in the shape the real file uses. */
const COMMITTED = {
  "no-em-dash::docs/reference/api.md": 17,
  "no-raw-colour-in-tsx::src/components/viz/RadialActivityClock.tsx": 4,
  "sql-outside-repository::src/lib/session-sync.ts": 3,
};

const WHEN = "2026-08-23";
const REASON = "operator ruling D9: the rule was re-keyed, the debt did not move";

const allow = (reason: string) => ({ present: true, reason });

describe("design-lint ratchet: growth is detected, both kinds", () => {
  it("sees a single key going up", () => {
    const planted = { ...COMMITTED, "no-em-dash::docs/reference/api.md": 18 };
    const growth = baselineGrowth(planted, COMMITTED);
    expect(growth.grew).toBe(true);
    expect(growth.grown).toEqual([{ key: "no-em-dash::docs/reference/api.md", was: 17, now: 18 }]);
    expect(growth.totalWas).toBe(24);
    expect(growth.totalNow).toBe(25);
  });

  it("sees a violation in a file that had none, which is a key at zero", () => {
    const planted = { ...COMMITTED, "no-em-dash::docs/BRAND_NEW.md": 1 };
    const growth = baselineGrowth(planted, COMMITTED);
    expect(growth.grew).toBe(true);
    expect(growth.grown).toEqual([{ key: "no-em-dash::docs/BRAND_NEW.md", was: 0, now: 1 }]);
  });

  it("is not fooled by a total that holds while one key climbs", () => {
    // Two violations cleaned in one file, two added in another. The totals are
    // identical, so a totals-only ratchet would wave this through.
    const shuffled = {
      ...COMMITTED,
      "no-em-dash::docs/reference/api.md": 15,
      "sql-outside-repository::src/lib/session-sync.ts": 5,
    };
    const growth = baselineGrowth(shuffled, COMMITTED);
    expect(growth.totalNow).toBe(growth.totalWas);
    expect(growth.grew).toBe(true);
    expect(growth.grown).toEqual([
      { key: "sql-outside-repository::src/lib/session-sync.ts", was: 3, now: 5 },
    ]);
  });

  it("says no growth when nothing moved, and none when everything shrank", () => {
    expect(baselineGrowth(COMMITTED, COMMITTED).grew).toBe(false);
    const cleaned = { ...COMMITTED, "no-em-dash::docs/reference/api.md": 9 };
    const growth = baselineGrowth(cleaned, COMMITTED);
    expect(growth.grew).toBe(false);
    expect(growth.totalNow).toBeLessThan(growth.totalWas);
  });
});

describe("design-lint ratchet: --update-baseline REFUSES to grow", () => {
  it("refuses a planted regression, and produces nothing to write", () => {
    const planted = { ...COMMITTED, "no-em-dash::docs/reference/api.md": 18 };
    const plan = planBaselineWrite({ counts: planted, committed: COMMITTED, when: WHEN });
    expect(plan.ok).toBe(false);
    // Nothing to write is the point: the caller has no file to hand writeFileSync.
    expect(plan.file).toBeUndefined();
    expect(plan.growth.grown).toHaveLength(1);
  });

  it("refuses a whole new violated file", () => {
    const planted = { ...COMMITTED, "no-ch-custom-properties::src/app/globals.css": 2 };
    expect(planBaselineWrite({ counts: planted, committed: COMMITTED, when: WHEN }).ok).toBe(false);
  });

  it("refuses a reason-shaped flag that carries no reason", () => {
    const planted = { ...COMMITTED, "no-em-dash::docs/reference/api.md": 18 };
    const plan = planBaselineWrite({
      counts: planted,
      committed: COMMITTED,
      allowance: { present: true, reason: "" },
      when: WHEN,
    });
    expect(plan.ok).toBe(false);
    expect(plan.file).toBeUndefined();
  });
});

describe("design-lint ratchet: a genuine cleanup is ACCEPTED", () => {
  it("writes the smaller counts and records nothing, because nothing was excused", () => {
    const cleaned = { ...COMMITTED, "no-em-dash::docs/reference/api.md": 9 };
    const plan = planBaselineWrite({ counts: cleaned, committed: COMMITTED, when: WHEN });
    expect(plan.ok).toBe(true);
    expect(plan.file).toEqual(cleaned);
    expect(plan.recorded).toBeNull();
    expect(plan.file?.[GROWTH_LOG_KEY]).toBeUndefined();
  });

  it("lets a fully cleaned file leave the baseline entirely", () => {
    const cleaned = { ...COMMITTED };
    delete (cleaned as Record<string, number>)["sql-outside-repository::src/lib/session-sync.ts"];
    const plan = planBaselineWrite({ counts: cleaned, committed: COMMITTED, when: WHEN });
    expect(plan.ok).toBe(true);
    expect(Object.keys(plan.file ?? {})).not.toContain(
      "sql-outside-repository::src/lib/session-sync.ts",
    );
  });

  it("accepts an unchanged tree, which is what the ordinary lock-in run is", () => {
    const plan = planBaselineWrite({ counts: COMMITTED, committed: COMMITTED, when: WHEN });
    expect(plan.ok).toBe(true);
    expect(plan.file).toEqual(COMMITTED);
  });
});

describe("design-lint ratchet: the escape hatch, and its price", () => {
  it("lets growth through with a written reason and records it in the baseline", () => {
    const planted = { ...COMMITTED, "no-em-dash::docs/reference/api.md": 18 };
    const plan = planBaselineWrite({
      counts: planted,
      committed: COMMITTED,
      allowance: allow(REASON),
      when: WHEN,
    });
    expect(plan.ok).toBe(true);
    expect(plan.recorded).toEqual({
      when: WHEN,
      reason: REASON,
      total: "24 -> 25",
      grew: ["no-em-dash::docs/reference/api.md: 17 -> 18"],
    });
    // The reason lives where the baseline lives, next to the number it excuses.
    expect(plan.file?.[GROWTH_LOG_KEY]).toEqual([plan.recorded]);
    expect(plan.file?.["no-em-dash::docs/reference/api.md"]).toBe(18);
  });

  it("keeps every earlier reason, so the log is a history rather than a slot", () => {
    const earlier = {
      when: "2026-08-01",
      reason: "the first one, kept to prove the log is append-only",
      total: "20 -> 24",
      grew: ["no-em-dash::docs/reference/api.md: 13 -> 17"],
    };
    const planted = { ...COMMITTED, "no-em-dash::docs/reference/api.md": 18 };
    const plan = planBaselineWrite({
      counts: planted,
      committed: COMMITTED,
      log: [earlier],
      allowance: allow(REASON),
      when: WHEN,
    });
    expect(plan.file?.[GROWTH_LOG_KEY]).toEqual([earlier, plan.recorded]);
  });

  it("carries an existing log through a shrink without inventing an entry", () => {
    const earlier = {
      when: "2026-08-01",
      reason: "the first one, kept to prove the log is append-only",
      total: "20 -> 24",
      grew: ["no-em-dash::docs/reference/api.md: 13 -> 17"],
    };
    const cleaned = { ...COMMITTED, "no-em-dash::docs/reference/api.md": 9 };
    const plan = planBaselineWrite({
      counts: cleaned,
      committed: COMMITTED,
      log: [earlier],
      when: WHEN,
    });
    expect(plan.ok).toBe(true);
    expect(plan.recorded).toBeNull();
    expect(plan.file?.[GROWTH_LOG_KEY]).toEqual([earlier]);
  });
});

describe("design-lint ratchet: what counts as a written reason", () => {
  it("reads both spellings of the flag", () => {
    expect(parseGrowthAllowance(["--update-baseline", ALLOW_GROWTH_FLAG, REASON])).toEqual({
      present: true,
      reason: REASON,
    });
    expect(parseGrowthAllowance(["--update-baseline", `${ALLOW_GROWTH_FLAG}=${REASON}`])).toEqual({
      present: true,
      reason: REASON,
    });
  });

  it("is absent when the flag is absent", () => {
    expect(parseGrowthAllowance(["--update-baseline"])).toEqual({ present: false, reason: "" });
  });

  it("refuses the flag with no reason after it", () => {
    const parsed = parseGrowthAllowance(["--update-baseline", ALLOW_GROWTH_FLAG]);
    expect(parsed.reason).toBe("");
    expect(parsed.problem).toContain("written reason");
  });

  it("refuses a reason that is whitespace, or the next flag mistaken for one", () => {
    expect(parseGrowthAllowance([ALLOW_GROWTH_FLAG, "   "]).reason).toBe("");
    expect(parseGrowthAllowance([ALLOW_GROWTH_FLAG, "--update-baseline"]).problem).toBeDefined();
  });

  it("refuses a keystroke", () => {
    const parsed = parseGrowthAllowance([ALLOW_GROWTH_FLAG, "ok"]);
    expect(parsed.reason).toBe("");
    expect(parsed.problem).toContain(String(MIN_REASON_LENGTH));
    expect("ok".length).toBeLessThan(MIN_REASON_LENGTH);
  });
});

describe("design-lint ratchet: the growth log stays out of the counts", () => {
  it("hides the log key from the gate, which would otherwise read it as a violation", () => {
    const onDisk = { [GROWTH_LOG_KEY]: [{ when: WHEN, reason: REASON, total: "1 -> 2", grew: [] }], ...COMMITTED };
    const { counts, log } = splitBaseline(onDisk);
    expect(counts).toEqual(COMMITTED);
    expect(Object.keys(counts)).not.toContain(GROWTH_LOG_KEY);
    expect(log).toHaveLength(1);
  });

  it("survives a baseline with no log, and one that is missing entirely", () => {
    expect(splitBaseline(COMMITTED)).toEqual({ counts: COMMITTED, log: [] });
    expect(splitBaseline({})).toEqual({ counts: {}, log: [] });
    expect(splitBaseline(undefined)).toEqual({ counts: {}, log: [] });
  });

  it("uses a key no violation can ever collide with", () => {
    // Violation keys are always `rule::path`.
    expect(GROWTH_LOG_KEY).not.toContain("::");
  });
});

describe("design-lint ratchet: the write cannot be reached around the plan", () => {
  const source = readFileSync(
    join(__dirname, "..", "..", "scripts", "tooling", "design-lint.mjs"),
    "utf-8",
  );

  it("writes the baseline from exactly one place, and that place is the plan", () => {
    const writes = source.match(/writeFileSync\(BASELINE_PATH/g) ?? [];
    expect(writes).toHaveLength(1);
    expect(source).toMatch(/writeFileSync\(BASELINE_PATH, JSON\.stringify\(plan\.file/);
  });

  it("refuses before it writes, rather than writing and reporting", () => {
    const refusal = source.indexOf("if (!plan.ok)");
    const write = source.indexOf("writeFileSync(BASELINE_PATH");
    expect(refusal).toBeGreaterThan(-1);
    expect(refusal).toBeLessThan(write);
  });
});
