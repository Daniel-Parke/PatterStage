/**
 * Gate 8 · hit targets. No interactive element under 24x24 on any documented
 * route, at the census viewport.
 *
 * The census has counted these since U0 (hitTargetsBelowTwentyFour, 127 at the
 * start of the programme, 40 at the end of U13) and ratcheted the number down.
 * A ratchet allows what it inherited; this gate allows nothing. It reads the
 * same collector, so a target the census exempts is exempt here too, and the
 * exemptions are WCAG 2.5.8's own: a control inline in a sentence, a skip link
 * that exists only for the keyboard and is a 1px clip until focused, and a
 * stretched link whose real target is the row it covers.
 *
 * Every route is its own test so the list of offenders is per screen.
 */

import { expect, test } from "@playwright/test";

import { documentedRoutes } from "../../src/lib/modules/registry";
import { collectCensus } from "./lib/census-collect";

const VIEWPORT = { width: 1440, height: 900 };
const FLOOR_PX = 24;

test.describe("hit targets (gate 8)", () => {
  for (const route of documentedRoutes()) {
    test(`${route} offers no target under ${FLOOR_PX}x${FLOOR_PX}`, async ({ page }) => {
      test.setTimeout(90_000);
      await page.clock.setFixedTime(new Date("2026-06-01T09:30:00Z"));
      await page.setViewportSize(VIEWPORT);
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await page.getByRole("heading").first().waitFor({ timeout: 30_000 });
      await page.waitForTimeout(1_500);

      const census = await page.evaluate(collectCensus, route);
      const small = census.boxes
        .filter((b) => b.control && b.w > 0 && b.h > 0 && (b.w < FLOOR_PX || b.h < FLOOR_PX))
        .map((b) => `${b.what} ${b.w}x${b.h}`);
      expect(small, `${route}: targets under the ${FLOOR_PX}px floor`).toEqual([]);
    });
  }
});
