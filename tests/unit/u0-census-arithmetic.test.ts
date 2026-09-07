/**
 * U0 (T-0114): the census arithmetic, checked against numbers computed by hand
 * rather than against itself.
 *
 * Everything the overhaul claims is a count or a ratio, and a number produced
 * only by the thing it measures cannot fail in a way anyone would notice. So
 * the constants below are derived independently, from the WCAG 2.x formulae and
 * the app's own painted ground (#040b12), and two of them can be checked
 * against the reconnaissance, which measured the SAME quantities in a live
 * browser by a completely different route:
 *
 *   bare white on the ground   this file 19.78   reconnaissance 19.78
 *   ps-text-muted on the ground this file  6.26  reconnaissance  6.21 to 6.3
 *
 * If the arithmetic here is wrong, those two agreements do not happen.
 */
import {
  HEADING_ALIGNMENT_TOLERANCE_PX,
  HIT_TARGET_FLOOR_PX,
  NON_TEXT_CONTRAST_FLOOR,
  TYPE_FLOOR_PX,
  compositeOver,
  contrastRatio,
  describeRegression,
  flattenStack,
  parseRgba,
  regressions,
  relativeLuminance,
  summarise,
  type CensusCounts,
  type RawCensus,
} from "../e2e/lib/census-analysis";

const GROUND = { r: 4, g: 11, b: 18 };
const BLACK = { r: 0, g: 0, b: 0 };
const WHITE = { r: 255, g: 255, b: 255 };

describe("parseRgba reads what the browser's own colour engine serialises", () => {
  it.each([
    ["rgb(4, 11, 18)", { r: 4, g: 11, b: 18, a: 1 }],
    ["rgba(255, 255, 255, 0.55)", { r: 255, g: 255, b: 255, a: 0.55 }],
    ["rgba(0, 0, 0, 0)", { r: 0, g: 0, b: 0, a: 0 }],
    ["rgb(0 191 255 / 0.3)", { r: 0, g: 191, b: 255, a: 0.3 }],
    ["rgb(0 191 255 / 30%)", { r: 0, g: 191, b: 255, a: 0.3 }],
  ])("parses %s", (css, expected) => {
    expect(parseRgba(css)).toEqual(expected);
  });

  /**
   * The collector normalises through a canvas before it hands anything over,
   * so an unconverted value arriving here is a collector bug. Returning null
   * rather than guessing is what makes that bug visible: a guess would be
   * counted as a colour and quietly change every distinct-colour total.
   */
  it.each([
    ["an unconverted oklab", "oklab(0.192801 -0.0072 -0.0252 / 0.8)"],
    ["an unconverted color-mix", "color-mix(in srgb, var(--color-neon-cyan) 7%, transparent)"],
    ["a keyword", "transparent"],
    ["a hex", "#040b12"],
    ["nothing at all", ""],
  ])("refuses %s rather than guessing", (_name, css) => {
    expect(parseRgba(css)).toBeNull();
  });
});

describe("compositing", () => {
  it("paints a half-alpha white over black as mid grey", () => {
    expect(compositeOver({ r: 255, g: 255, b: 255, a: 0.5 }, BLACK)).toEqual({
      r: 127.5,
      g: 127.5,
      b: 127.5,
    });
  });

  it("leaves an opaque colour alone", () => {
    expect(compositeOver({ ...GROUND, a: 1 }, WHITE)).toEqual(GROUND);
  });

  it("leaves the backdrop alone at zero alpha", () => {
    expect(compositeOver({ r: 255, g: 0, b: 0, a: 0 }, GROUND)).toEqual(GROUND);
  });

  /**
   * Reachable, not defensive theatre: `parseRgba` reads whatever alpha the
   * string carries, and CSS will happily hand back `rgba(0, 0, 0, 5)` from a
   * malformed declaration. Unclamped, that returns negative channels and a
   * luminance no contrast ratio can be computed from.
   */
  it("clamps an alpha outside 0 to 1 rather than producing a colour that is not one", () => {
    expect(compositeOver({ r: 255, g: 255, b: 255, a: 5 }, GROUND)).toEqual(WHITE);
    expect(compositeOver({ r: 255, g: 255, b: 255, a: -3 }, GROUND)).toEqual(GROUND);
  });

  /**
   * Order is the whole point. The collector walks from the element OUTWARD, so
   * index 0 is nearest the element and the last entry is nearest the page;
   * painting therefore runs from the end of the array forwards. Reverse it and
   * a dark panel over a light page reads as a light panel, which is the exact
   * failure mode a surface-separation gate exists to catch.
   */
  it("paints a stack outermost-first, so index 0 ends up on top", () => {
    const nearest = { r: 0, g: 0, b: 0, a: 0.5 };
    const furthest = { r: 255, g: 255, b: 255, a: 1 };
    expect(flattenStack([nearest, furthest], BLACK)).toEqual({ r: 127.5, g: 127.5, b: 127.5 });
  });

  it("returns the base for an empty stack", () => {
    expect(flattenStack([], GROUND)).toEqual(GROUND);
  });
});

describe("contrast, against hand-computed values", () => {
  it("puts the painted ground at the luminance the token block records", () => {
    // 0.2126*0.0012141 + 0.7152*0.0033460 + 0.0722*0.0060475
    expect(relativeLuminance(GROUND)).toBeCloseTo(0.003088, 5);
  });

  it("is 21 for white on black and 1 for a colour on itself", () => {
    expect(contrastRatio(WHITE, BLACK)).toBeCloseTo(21, 6);
    expect(contrastRatio(GROUND, GROUND)).toBeCloseTo(1, 6);
  });

  it("does not care which way round the two colours are given", () => {
    expect(contrastRatio(WHITE, GROUND)).toBeCloseTo(contrastRatio(GROUND, WHITE), 6);
  });

  it("puts bare white on the ground at 19.78, the figure the walk measured", () => {
    expect(contrastRatio(WHITE, GROUND)).toBeCloseTo(19.78, 1);
  });

  it("puts ps-text-muted on the ground at 6.26, within the walk's 6.21 to 6.3", () => {
    const muted = compositeOver({ r: 255, g: 255, b: 255, a: 0.55 }, GROUND);
    expect(contrastRatio(muted, GROUND)).toBeCloseTo(6.26, 1);
  });

  /**
   * The finding the whole overhaul turns on, restated as arithmetic: the most
   * common card fill in the tree is `bg-dark-900/40`, which is #0c1520 at 40%
   * over the ground, and the most common rule is white at 10%.
   */
  it("puts today's commonest card fill at 1.03 and its rule at 1.25", () => {
    const fill = compositeOver({ r: 12, g: 21, b: 32, a: 0.4 }, GROUND);
    expect(contrastRatio(fill, GROUND)).toBeCloseTo(1.03, 1);
    const rule = compositeOver({ r: 255, g: 255, b: 255, a: 0.1 }, GROUND);
    expect(contrastRatio(rule, GROUND)).toBeCloseTo(1.25, 1);
  });

  it("and both are under the floor WCAG asks of a component boundary", () => {
    const rule = compositeOver({ r: 255, g: 255, b: 255, a: 0.1 }, GROUND);
    expect(contrastRatio(rule, GROUND)).toBeLessThan(NON_TEXT_CONTRAST_FLOOR);
  });
});

describe("the floors are the ones the standards and the project declare", () => {
  it.each([
    ["non-text contrast, WCAG 1.4.11", NON_TEXT_CONTRAST_FLOOR, 3],
    ["type, the project's own", TYPE_FLOOR_PX, 12],
    ["hit target, WCAG 2.5.8 at AA", HIT_TARGET_FLOOR_PX, 24],
    ["heading alignment", HEADING_ALIGNMENT_TOLERANCE_PX, 1],
  ])("%s", (_name, actual, expected) => {
    expect(actual).toBe(expected);
  });
});

// ── summarise ───────────────────────────────────────────────────────────────

const page = (over: Partial<RawCensus> = {}): RawCensus => ({
  route: "/",
  borders: [],
  text: [],
  boxes: [],
  geometry: { headingLeft: null, contentLeft: null, contentLeftWhat: null, contentWidth: null, overflowX: 0, route: "/", blockLefts: [] },
  pageBackground: "rgb(4, 11, 18)",
  railBackground: null,
  railDivider: null,
  ...over,
});

describe("summarise", () => {
  it("counts the type census as shares, not as raw totals", () => {
    const counts = summarise([
      page({
        text: [
          { route: "/", size: 12, mono: true },
          { route: "/", size: 12, mono: true },
          { route: "/", size: 14, mono: false },
          { route: "/", size: 20, mono: false },
        ],
      }),
    ]);
    expect(counts.distinctFontSizes).toBe(3);
    expect(counts.twelvePxShare).toBe(0.5);
    expect(counts.monoShare).toBe(0.5);
    expect(counts.textBelowFloor).toBe(0);
  });

  it("counts anything under the type floor, whatever size it is", () => {
    const counts = summarise([
      page({ text: [{ route: "/", size: 8, mono: true }, { route: "/", size: 11, mono: true }] }),
    ]);
    expect(counts.textBelowFloor).toBe(2);
  });

  /**
   * A control border and a decorative one are counted apart because they have
   * different standards: WCAG 1.4.11 is about the boundary that identifies a
   * COMPONENT. Losing that split would let a fix to card edges hide a failure
   * on every input in the product.
   */
  it("separates a failing control boundary from a failing decorative one", () => {
    const counts = summarise([
      page({
        borders: [
          { route: "/", what: "input", colour: "rgba(255, 255, 255, 0.1)", backdrop: [], control: true },
          { route: "/", what: "card", colour: "rgba(255, 255, 255, 0.1)", backdrop: [], control: false },
          { route: "/", what: "ok", colour: "rgba(255, 255, 255, 0.6)", backdrop: [], control: true },
        ],
      }),
    ]);
    expect(counts.controlBordersBelowThree).toBe(1);
    expect(counts.decorativeBordersBelowThree).toBe(1);
    expect(counts.distinctBorderColours).toBe(2);
  });

  it("measures a border against what is actually behind it, not against the page", () => {
    // White at 30% is 2.59:1 on the ground and fails, but the same rule on a
    // bright panel passes. A gate that always compares to the page would call
    // the second one broken and send someone to "fix" a border that is fine.
    const onGround = summarise([
      page({
        borders: [
          { route: "/", what: "r", colour: "rgba(255, 255, 255, 0.3)", backdrop: [], control: true },
        ],
      }),
    ]);
    const onPanel = summarise([
      page({
        borders: [
          {
            route: "/",
            what: "r",
            colour: "rgba(255, 255, 255, 0.3)",
            backdrop: ["rgb(200, 200, 200)"],
            control: true,
          },
        ],
      }),
    ]);
    expect(onGround.controlBordersBelowThree).toBe(1);
    expect(onPanel.controlBordersBelowThree).toBe(1);
    // and a dark rule on that same bright panel is the one that reads
    const darkOnPanel = summarise([
      page({
        borders: [
          {
            route: "/",
            what: "r",
            colour: "rgba(0, 0, 0, 1)",
            backdrop: ["rgb(200, 200, 200)"],
            control: true,
          },
        ],
      }),
    ]);
    expect(darkOnPanel.controlBordersBelowThree).toBe(0);
  });

  it("counts a hit target that is short OR narrow, not only one that is both", () => {
    const box = (w: number, h: number) => ({
      route: "/",
      what: "b",
      chrome: "8px|rgb(1, 1, 1)|rgb(2, 2, 2)",
      radius: "8px",
      height: h,
      shadow: "none",
      zIndex: "auto",
      control: true,
      w,
      h,
    });
    const counts = summarise([page({ boxes: [box(100, 16), box(16, 100), box(40, 40)] })]);
    expect(counts.hitTargetsBelowTwentyFour).toBe(2);
  });

  it("counts button heights and chromes only for things a user can operate", () => {
    const counts = summarise([
      page({
        boxes: [
          { route: "/", what: "btn", chrome: "8px|a|b", radius: "8px", height: 30, shadow: "none", zIndex: "auto", control: true, w: 80, h: 30 },
          { route: "/", what: "btn", chrome: "8px|a|b", radius: "8px", height: 38, shadow: "none", zIndex: "auto", control: true, w: 80, h: 38 },
          { route: "/", what: "card", chrome: "12px|c|d", radius: "12px", height: 200, shadow: "none", zIndex: "auto", control: false, w: 400, h: 200 },
        ],
      }),
    ]);
    expect(counts.distinctButtonHeights).toBe(2);
    expect(counts.distinctButtonChromes).toBe(2);
    // every box contributes its chrome, radius and layer to the surface census
    expect(counts.distinctCardChromes).toBe(2);
    expect(counts.distinctRadii).toBe(2);
    expect(counts.distinctBoxShadows).toBe(0);
    expect(counts.distinctZLayers).toBe(0);
  });

  /**
   * The collector zeroes w/h for a control that is inline in a sentence, the
   * WCAG 2.5.8 exemption. Its box is the LINE, not the control, so it is no
   * more a button height than it is a hit target. Measured: /help's prose
   * column widened by one batch, one link in a sentence rewrapped, and the
   * button-height count rose for a 40.8px line box that is not a button.
   */
  it("does not count a link that is inline in a sentence as a button size", () => {
    const counts = summarise([
      page({
        boxes: [
          { route: "/", what: "btn", chrome: "8px|a|b", radius: "8px", height: 30, shadow: "none", zIndex: "auto", control: true, w: 80, h: 30 },
          { route: "/help", what: "a:the quest ledger", chrome: "0px|none|c", radius: "", height: 40.8, shadow: "none", zIndex: "auto", control: true, w: 0, h: 0 },
        ],
      }),
    ]);
    expect(counts.distinctButtonHeights).toBe(1);
    expect(counts.distinctButtonChromes).toBe(1);
    // Still exempt from the hit-target floor, which is where the rule started.
    expect(counts.hitTargetsBelowTwentyFour).toBe(0);
  });

  it("counts a heading as misaligned past one pixel, and keeps the worst offset", () => {
    const counts = summarise([
      page({ geometry: { route: "/a", headingLeft: 100, contentLeft: 100.5, contentLeftWhat: null, contentWidth: 800, overflowX: 0, blockLefts: [] } }),
      page({ geometry: { route: "/b", headingLeft: 281, contentLeft: 409, contentLeftWhat: null, contentWidth: 896, overflowX: 0, blockLefts: [] } }),
      page({ geometry: { route: "/c", headingLeft: 461, contentLeft: 405, contentLeftWhat: null, contentWidth: 854, overflowX: 0, blockLefts: [] } }),
    ]);
    expect(counts.routesWithMisalignedHeading).toBe(2);
    expect(counts.worstHeadingOffset).toBe(128);
    expect(counts.distinctContentWidths).toBe(3);
    // Cause 2 as one number: three headings, three different x. One container
    // means one, whatever each page then does inside it.
    expect(counts.distinctHeadingLefts).toBe(3);
  });

  it("counts a route that scrolls sideways inside main", () => {
    const counts = summarise([
      page({ geometry: { route: "/", headingLeft: null, contentLeft: null, contentLeftWhat: null, contentWidth: null, overflowX: 40, blockLefts: [] } }),
      page({ geometry: { route: "/b", headingLeft: null, contentLeft: null, contentLeftWhat: null, contentWidth: null, overflowX: 0, blockLefts: [] } }),
    ]);
    expect(counts.routesOverflowingX).toBe(1);
  });

  /**
   * The rail is one surface across every route, so the WORST reading is the
   * honest one. A rail that separates on the dashboard and disappears on
   * Missions has not been fixed.
   */
  it("takes the worst rail reading across routes, not the average", () => {
    const counts = summarise([
      page({ railBackground: "rgb(31, 44, 60)", railDivider: "rgba(255, 255, 255, 0.4)" }),
      page({ railBackground: "rgba(12, 21, 32, 0.8)", railDivider: "rgba(255, 255, 255, 0.1)" }),
    ]);
    expect(counts.railVsPageContrast).toBeCloseTo(1.06, 1);
    expect(counts.railDividerContrast).toBeCloseTo(1.25, 1);
  });

  it("reports zero rather than Infinity when no route showed a rail", () => {
    expect(summarise([page()]).railVsPageContrast).toBe(0);
    expect(summarise([page()]).railDividerContrast).toBe(0);
  });
});

// ── the ratchet ─────────────────────────────────────────────────────────────

const counts = (over: Partial<CensusCounts> = {}): CensusCounts => ({
  routes: 23,
  distinctFontSizes: 8,
  twelvePxShare: 0.7,
  monoShare: 0.62,
  textBelowFloor: 9,
  distinctBorderColours: 31,
  distinctCardChromes: 47,
  distinctButtonHeights: 20,
  distinctButtonChromes: 59,
  distinctRadii: 7,
  distinctBoxShadows: 26,
  distinctZLayers: 13,
  controlBordersBelowThree: 296,
  decorativeBordersBelowThree: 659,
  hitTargetsBelowTwentyFour: 127,
  routesWithMisalignedHeading: 24,
  worstHeadingOffset: 289,
  distinctContentWidths: 7,
  distinctHeadingLefts: 7,
  routesWithSplitBlocks: 0,
  worstBlockLeftSpread: 0,
  routesOverflowingX: 1,
  railVsPageContrast: 1.06,
  railDividerContrast: 1.25,
  ...over,
});

describe("the census ratchets, the way design-lint's baseline does", () => {
  it("is silent when nothing moved", () => {
    expect(regressions(counts(), counts())).toEqual([]);
  });

  it("is silent when a sprawl measure falls and a contrast measure rises", () => {
    expect(
      regressions(counts(), counts({ distinctCardChromes: 4, railVsPageContrast: 1.5 })),
    ).toEqual([]);
  });

  it("catches a sprawl measure that grew", () => {
    const found = regressions(counts(), counts({ distinctButtonHeights: 21 }));
    expect(found).toEqual([
      { key: "distinctButtonHeights", was: 20, now: 21, lowerIsBetter: true },
    ]);
    expect(describeRegression(found[0])).toBe("distinctButtonHeights rose from 20 to 21");
  });

  /**
   * The direction is per-measure and getting it wrong is silent. A rail whose
   * separation FELL is a regression even though the number went down, and a
   * one-directional ratchet would wave it through.
   */
  it("catches a contrast measure that fell", () => {
    const found = regressions(counts({ railVsPageContrast: 1.5 }), counts({ railVsPageContrast: 1.2 }));
    expect(found).toEqual([
      { key: "railVsPageContrast", was: 1.5, now: 1.2, lowerIsBetter: false },
    ]);
    expect(describeRegression(found[0])).toBe("railVsPageContrast fell from 1.5 to 1.2");
  });

  /**
   * Both directions, and the second is the one that matters. This programme
   * DELETES routes: the Rec Room merge takes twenty-three to twenty. Asserting
   * only that adding one is fine left the exemption untested, and the sweep's
   * mutant survived on exactly that gap.
   */
  it.each([
    ["adding one", 24],
    ["deleting three, as the Rec Room merge will", 20],
  ])("does not treat %s as a regression", (_name, routes) => {
    expect(regressions(counts(), counts({ routes }))).toEqual([]);
  });

  it("reports every measure that moved the wrong way, not just the first", () => {
    const found = regressions(
      counts(),
      counts({ distinctRadii: 9, hitTargetsBelowTwentyFour: 200, railDividerContrast: 1.1 }),
    );
    expect(found.map((r) => r.key).sort()).toEqual([
      "distinctRadii",
      "hitTargetsBelowTwentyFour",
      "railDividerContrast",
    ]);
  });

  it("honours a tolerance when one is given, in both directions", () => {
    expect(regressions(counts(), counts({ distinctRadii: 8 }), 1)).toEqual([]);
    expect(regressions(counts(), counts({ distinctRadii: 9 }), 1)).toHaveLength(1);
    expect(regressions(counts(), counts({ railVsPageContrast: 1.0 }), 0.1)).toEqual([]);
  });
});
