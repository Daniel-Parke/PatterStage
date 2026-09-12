/** @jest-environment node */
// ORACLE for T-0021 (WO-0014), part 1 of 4: the law itself.
//
// Authored BEFORE the implementation existed. Every clause below is one of the
// operator's numbered acceptance clauses, named in the test title so a later
// reader can hold the code against the ruling rather than against a guess:
//
//   (2) a budget figure is OPTIONAL and unset on a fresh install; an install
//       with no figure warns about nothing;
//   (3) when a figure IS set, the default is a WARNING, not a stop;
//   (4) a hard stop exists, is OFF by default, and only bites when the figure
//       it sits beside is breached;
//   (6) periods are calendar periods, because a person who types "40 dollars a
//       month" means the month, not the last thirty days.

import {
  SPEND_PERIODS,
  SPEND_SOURCES,
  SPEND_WARN_FRACTION,
  UNSET_SPEND_POLICY,
  evaluateSpend,
  periodStart,
  periodLabel,
  type SpendPolicy,
} from "@/lib/spend/spend-law";

function policy(over: Partial<SpendPolicy> = {}): SpendPolicy {
  return { ...UNSET_SPEND_POLICY, ...over };
}

describe("spend law: the shape of the settings", () => {
  it("offers exactly the three periods a budget can be expressed in", () => {
    expect([...SPEND_PERIODS]).toEqual(["day", "week", "month"]);
  });

  it("names the four sources the operator's row scopes spend to", () => {
    // `story` joined them in T-0108: Story Weaver drives callLLM directly, and
    // until 040 gave a runs row a spend_source its chapters were spent off the
    // books entirely (D87).
    expect([...SPEND_SOURCES]).toEqual(["agent", "composer", "research", "story"]);
  });

  // Clause 2 and clause 4, stated as data. This is the single most important
  // assertion in the file: it is what "nothing ships pre-set" means.
  it("ships unset: no figure, no stop", () => {
    expect(UNSET_SPEND_POLICY.limitUsd).toBeNull();
    expect(UNSET_SPEND_POLICY.hardStop).toBe(false);
  });
});

describe("evaluateSpend: clause 2, an install with no figure warns about nothing", () => {
  it("is 'unset' and silent no matter how much has been spent", () => {
    for (const spent of [0, 1, 500, 100_000]) {
      const v = evaluateSpend(policy(), spent);
      expect(v.state).toBe("unset");
      expect(v.fraction).toBeNull();
      expect(v.breached).toBe(false);
      expect(v.blocksUnattended).toBe(false);
      expect(v.message).toBeNull();
    }
  });

  // A stop with no figure is not a stop, it is an outage. The database refuses
  // to store the pair; the law refuses to act on it either.
  it("cannot be blocked by a hard stop that has no figure beside it", () => {
    const v = evaluateSpend(policy({ hardStop: true }), 9_999);
    expect(v.state).toBe("unset");
    expect(v.blocksUnattended).toBe(false);
  });
});

describe("evaluateSpend: clause 3, a set figure WARNS by default", () => {
  const set = policy({ limitUsd: 100, period: "month" });

  it("says nothing below the warning fraction", () => {
    const v = evaluateSpend(set, 100 * SPEND_WARN_FRACTION - 0.01);
    expect(v.state).toBe("ok");
    expect(v.message).toBeNull();
    expect(v.breached).toBe(false);
  });

  it("warns once spend reaches the warning fraction", () => {
    const v = evaluateSpend(set, 100 * SPEND_WARN_FRACTION);
    expect(v.state).toBe("approaching");
    expect(v.message).toBeTruthy();
    expect(v.breached).toBe(false);
    expect(v.blocksUnattended).toBe(false);
  });

  it("warns and reports a breach at the figure, and still does not stop anything", () => {
    const v = evaluateSpend(set, 100);
    expect(v.state).toBe("over");
    expect(v.breached).toBe(true);
    expect(v.message).toBeTruthy();
    // The whole point of clause 3: breached, warning shown, nothing blocked,
    // because the operator did not ask for a stop.
    expect(v.blocksUnattended).toBe(false);
  });

  it("reports the fraction spent so a meter can be drawn without recomputing it", () => {
    expect(evaluateSpend(set, 25).fraction).toBeCloseTo(0.25, 10);
    expect(evaluateSpend(set, 250).fraction).toBeCloseTo(2.5, 10);
  });
});

describe("evaluateSpend: clause 4, the hard stop is the user's own switch", () => {
  const armed = policy({ limitUsd: 100, hardStop: true });

  it("does not block while under the figure", () => {
    expect(evaluateSpend(armed, 99.99).blocksUnattended).toBe(false);
  });

  it("blocks unattended dispatch at and above the figure, and says why", () => {
    const v = evaluateSpend(armed, 100);
    expect(v.breached).toBe(true);
    expect(v.blocksUnattended).toBe(true);
    expect(v.message).toMatch(/stop/i);
  });
});

describe("periodStart: calendar periods, computed in UTC", () => {
  // 2026-08-23 is a Sunday. The ISO week that contains it starts Monday
  // 2026-08-17, which is the case a naive getUTCDay() implementation gets wrong.
  const sunday = "2026-08-23T14:35:12.000Z";

  it("day starts at midnight of the same day", () => {
    expect(periodStart("day", sunday)).toBe("2026-08-23 00:00:00");
  });

  it("week starts on the preceding Monday, not the preceding Sunday", () => {
    expect(periodStart("week", sunday)).toBe("2026-08-17 00:00:00");
  });

  it("month starts on the first of the calendar month", () => {
    expect(periodStart("month", sunday)).toBe("2026-08-01 00:00:00");
  });

  it("a Monday is its own week start", () => {
    expect(periodStart("week", "2026-08-17T00:00:01.000Z")).toBe("2026-08-17 00:00:00");
  });

  it("emits SQLite's own datetime format, which is what the comparison uses", () => {
    for (const p of SPEND_PERIODS) {
      expect(periodStart(p, sunday)).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    }
  });
});

describe("periodLabel", () => {
  it("labels every period", () => {
    for (const p of SPEND_PERIODS) expect(periodLabel(p)).toBeTruthy();
  });
});
