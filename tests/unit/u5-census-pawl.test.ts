/**
 * The census baseline's pawl on the way OUT (U5, T-0119).
 *
 * `npm run census` has always refused a reading that moved the wrong way.
 * `npm run census:update` overwrote the file with whatever it had just
 * measured: no comparison, no reason, and the `allowed` field the baseline's
 * own type declares had never once been written. design-lint settled that
 * argument in its own words, and the words are in its source: "the baseline is
 * the ratchet pawl, and a pawl you can wind backwards with a flag is
 * decorative."
 *
 * The decision is here rather than in the spec because the spec is Playwright
 * and jest cannot run it, so a mutation sweep could not have told anyone if it
 * stopped refusing.
 */
import {
  MIN_GROWTH_REASON,
  growthRefusal,
  type CensusCounts,
} from "../e2e/lib/census-analysis";

const counts = (over: Partial<CensusCounts> = {}): CensusCounts => ({
  routes: 23,
  distinctFontSizes: 5,
  twelvePxShare: 0.45,
  monoShare: 0.45,
  textBelowFloor: 0,
  distinctBorderColours: 6,
  distinctCardChromes: 4,
  distinctButtonHeights: 3,
  distinctButtonChromes: 8,
  distinctRadii: 4,
  distinctBoxShadows: 4,
  distinctZLayers: 7,
  controlBordersBelowThree: 0,
  decorativeBordersBelowThree: 0,
  hitTargetsBelowTwentyFour: 0,
  routesWithMisalignedHeading: 0,
  worstHeadingOffset: 0,
  distinctContentWidths: 1,
  distinctHeadingLefts: 1,
  routesWithSplitBlocks: 0,
  worstBlockLeftSpread: 0,
  routesOverflowingX: 0,
  railVsPageContrast: 1.47,
  railDividerContrast: 4.4,
  ...over,
});

describe("a baseline rewrite is refused when a number rose", () => {
  it("says nothing when nothing moved", () => {
    expect(growthRefusal(counts(), counts(), "")).toBeNull();
  });

  it("says nothing when a sprawl count falls and a contrast reading rises", () => {
    expect(
      growthRefusal(counts(), counts({ distinctRadii: 3, railVsPageContrast: 1.6 }), ""),
    ).toBeNull();
  });

  it("refuses a sprawl count that rose, and names it", () => {
    const refusal = growthRefusal(counts(), counts({ distinctRadii: 9 }), "");
    expect(refusal).toContain("refusing to write a census baseline that GROWS");
    expect(refusal).toContain("distinctRadii rose from 4 to 9");
    // And it says how to proceed, because a refusal with no next step is a
    // wall rather than a gate.
    expect(refusal).toContain("CENSUS_ALLOW_GROWTH");
  });

  it("refuses a contrast reading that FELL, which is the same defect upside down", () => {
    const refusal = growthRefusal(counts(), counts({ railVsPageContrast: 1.05 }), "");
    expect(refusal).toContain("railVsPageContrast");
  });

  it("takes a written reason", () => {
    expect(
      growthRefusal(counts(), counts({ distinctRadii: 9 }), "the radius codemod lands in U6"),
    ).toBeNull();
  });

  /**
   * A reason has to BE one. design-lint asks the same, for the same reason: a
   * one-word escape is an escape, and it becomes the thing everyone types.
   */
  it("refuses a reason that is a word", () => {
    expect(growthRefusal(counts(), counts({ distinctRadii: 9 }), "wip")).toContain(
      "must be a reason, not a word",
    );
    expect(MIN_GROWTH_REASON).toBeGreaterThan(8);
  });

  /**
   * The first baseline is not a growth. Without this the very first
   * `census:update` on a fresh checkout would refuse itself.
   */
  it("allows the first baseline there has ever been", () => {
    expect(growthRefusal(null, counts(), "")).toBeNull();
  });
});
