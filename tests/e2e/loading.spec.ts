/**
 * Gate 11 · loading. Every route renders its header while its data is still
 * on the way, and no route reads a confident `0` before its fetch resolves.
 *
 * The loading contract (S4, U8's PageLoading): the header always renders, the
 * body shows a skeleton the height of the content, and a count is a pending
 * mark until it is known. The recon found three screens painting `0` into a
 * subtitle or a tile before the answer arrived, and several whose header did
 * not exist until the body did, so a slow API left a blank page with no name
 * on it.
 *
 * Measured by holding every /api/ response for longer than the test waits, so
 * the page is read in the state a slow network leaves it in. The header must
 * be visible inside three seconds of the navigation committing; whatever main
 * says at that moment must not count anything.
 */

import { expect, test } from "@playwright/test";

import { documentedRoutes } from "../../src/lib/modules/registry";

const VIEWPORT = { width: 1440, height: 900 };
/** Longer than the whole test spends reading, so no API ever answers. */
const HOLD_MS = 8_000;
const HEADER_WITHIN_MS = 3_000;

/**
 * A count of nothing, stated as a fact: `0 sessions`, `0 of 12`, `(0 running`.
 * A currency (`$0.00`) or a version (`v0.9`) has no space before its zero and
 * is not matched; a table cell holding a real `0` is data, not a count, and
 * the APIs are held so no table has any.
 */
const CONFIDENT_ZERO = /(?:^|[\s(])0 [A-Za-z][^\n]{0,30}/gm;

test.describe("loading (gate 11)", () => {
  for (const route of documentedRoutes()) {
    test(`${route} names itself before its data arrives, and counts nothing`, async ({ page }) => {
      test.setTimeout(60_000);
      await page.setViewportSize(VIEWPORT);
      await page.route("**/api/**", async (held) => {
        await new Promise((r) => setTimeout(r, HOLD_MS));
        await held.continue().catch(() => undefined);
      });

      const started = Date.now();
      await page.goto(route, { waitUntil: "commit" });
      const h1 = page.getByRole("heading", { level: 1 }).first();
      await expect(h1, `${route}: no h1 while the data was still loading`).toBeVisible({
        timeout: HEADER_WITHIN_MS,
      });

      const text = await page.locator("main").first().innerText();
      // If this fires, the hold was too short for the machine and the reading
      // below would be of a resolved page, which is not what the gate measures.
      expect(Date.now() - started, "the page was read after the hold expired").toBeLessThan(HOLD_MS);

      const zeros = (text.match(CONFIDENT_ZERO) ?? []).map((s) => s.trim());
      expect(zeros, `${route}: a count reads 0 before its fetch has resolved`).toEqual([]);
    });
  }
});
