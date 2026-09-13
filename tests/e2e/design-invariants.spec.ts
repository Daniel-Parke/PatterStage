/**
 * The design invariants (U4, T-0118): thresholds, on every documented route.
 *
 * The census beside this file counts things and ratchets them down. This one
 * asserts properties that are already true and must stay true, which is a
 * different job and runs in the ordinary suite rather than opt-in: a count can
 * drift by one when twenty other spec files are writing to the same server,
 * which is why the census is serial and alone, but a threshold cannot. A
 * boundary either reaches 3:1 against what is behind it or it does not.
 *
 * One test per route, so Playwright's workers share the walk out rather than
 * one test walking 23 pages in series.
 *
 * WHAT IS AND IS NOT MEASURED HERE. Achromatic boundaries only: white, grey,
 * black. The product also draws 346 accent-tinted borders across 71 spellings,
 * which are colour that MEANS something (armed, selected, failed) and are the
 * status ladder's job in U6. They are not exempted from anything: the census's
 * controlBordersBelowThree counts every one of them and may only fall. What
 * would be dishonest is asserting a 3:1 floor here while quietly skipping the
 * half of the product that does not meet it, so the split is stated rather
 * than hidden in a filter.
 */
import { expect, test } from "@playwright/test";

import { documentedRoutes } from "../../src/lib/modules/registry";
import {
  NON_TEXT_CONTRAST_FLOOR,
  compositeOver,
  contrastRatio,
  flattenStack,
  parseRgba,
} from "./lib/census-analysis";
import { collectCensus } from "./lib/census-collect";

/** Fixed, because a reading taken at two widths is two readings. */
const VIEWPORT = { width: 1440, height: 900 };

/**
 * The floor for a boundary that only subdivides one surface. A card whose fill
 * already sits 1.47:1 off the page does not also need a 3:1 stroke, and drawing
 * one round every tile reads as wireframe; what it does need is to be visible
 * at all, which 1.25:1 was not.
 */
const HAIRLINE_FLOOR = 1.55;

/** The panel rung's separation from the page behind it. */
const SURFACE_FLOOR = 1.4;

/**
 * Is this a grey? Accent-tinted boundaries are U6's, and are counted rather
 * than asserted.
 *
 * By SATURATION, not by channel spread. The house greys are deliberately cool
 * (T-0116: on the surface ray a 3:1 stroke comes out a blue line rather than an
 * edge, so the rules travel a less saturated one), and #474f59 has an 18-point
 * spread. A spread threshold tight enough to exclude an accent excluded the
 * ladder's own rungs, so this test skipped the forty control borders wearing
 * the hairline at 2.3:1 — the exact thing it exists to catch.
 */
function achromatic(c: { r: number; g: number; b: number }): boolean {
  const max = Math.max(c.r, c.g, c.b);
  const min = Math.min(c.r, c.g, c.b);
  return max === 0 || (max - min) / max <= 0.35;
}

test.describe("design invariants", () => {
  for (const route of documentedRoutes()) {
    test(`${route} holds its surfaces apart and its edges visible`, async ({ page }) => {
      test.setTimeout(90_000);
      await page.clock.setFixedTime(new Date("2026-06-01T09:30:00Z"));
      await page.setViewportSize(VIEWPORT);
      await page.goto(route, { waitUntil: "domcontentloaded" });
      // Every screen is a client component: its heading does not exist until
      // hydration, so measuring sooner measures an empty frame.
      await page.getByRole("heading").first().waitFor({ timeout: 30_000 });

      // Anti-vacuity, and the wait. Without it every assertion below passes
      // beautifully against an empty array; as a fixed pause it fired on the
      // dashboard mid-skeleton under parallel workers, which is a slow page
      // rather than a blank one. Polling says the same thing and waits for the
      // answer: a route that really paints nothing still fails here.
      let census!: Awaited<ReturnType<typeof collectCensus>>;
      await expect
        .poll(
          async () => {
            census = await page.evaluate(collectCensus, route);
            return census.borders.length;
          },
          { timeout: 30_000, message: `${route} rendered no boundaries at all` },
        )
        .toBeGreaterThan(5);
      const page_ = parseRgba(census.pageBackground);
      expect(page_, `${route} page background did not normalise`).not.toBeNull();
      const ground = compositeOver(page_!, { r: 0, g: 0, b: 0 });

      // ── the rail, which is the complaint this batch answers ──────────────
      const rail = census.railBackground ? parseRgba(census.railBackground) : null;
      expect(rail, `${route} has no rail; the shell renders one on every route`).not.toBeNull();
      const railFill = compositeOver(rail!, ground);
      expect(
        contrastRatio(railFill, ground),
        `${route}: the rail does not separate from the page beside it`,
      ).toBeGreaterThanOrEqual(SURFACE_FLOOR);

      const divider = census.railDivider ? parseRgba(census.railDivider) : null;
      expect(divider, `${route} rail draws no divider`).not.toBeNull();
      expect(
        contrastRatio(compositeOver(divider!, railFill), railFill),
        `${route}: the rail's divider is not a visible seam`,
      ).toBeGreaterThanOrEqual(NON_TEXT_CONTRAST_FLOOR);

      // ── every achromatic boundary in the page ────────────────────────────
      const failures: string[] = [];
      for (const border of census.borders) {
        const colour = parseRgba(border.colour);
        if (!colour || !achromatic(colour)) continue;
        const backdrop = border.backdrop.map(parseRgba).filter(Boolean) as Array<{
          r: number;
          g: number;
          b: number;
          a: number;
        }>;
        const behind = flattenStack(backdrop, ground);
        const ratio = contrastRatio(compositeOver(colour, behind), behind);
        const floor = border.control ? NON_TEXT_CONTRAST_FLOOR : HAIRLINE_FLOOR;
        if (ratio < floor) {
          failures.push(
            `${border.what} — ${ratio.toFixed(2)}:1 against ${JSON.stringify(behind)}, wanted ${floor}`,
          );
        }
      }
      expect(
        failures.slice(0, 8),
        `${route}: ${failures.length} achromatic boundaries below their floor`,
      ).toEqual([]);
    });
  }
});
