/**
 * The phone project. Runs under the `phone` Playwright project only, whose
 * viewport is 390x844; the `chromium` project ignores this file.
 *
 * Gate 9 · containment. `main.scrollWidth <= main.clientWidth` and the
 * document no wider than the viewport, on every documented route, at 390 and
 * at 1024. The recon found the dashboard overflowing by 40px INSIDE main,
 * which no test reading document.scrollWidth could see, because main clipped
 * it. U3's shell answered the dashboard; this holds every screen.
 *
 * Then two things the phone project is the only place to prove:
 *
 * The rail between 768 and 1024. Below lg the rail used to become the drawer,
 * so a 1000px tablet, with room for the 64px icon rail the operator can
 * already ask for, got a hamburger and a full-width sheet instead. The icon
 * rail is used from md; the drawer starts below it.
 *
 * The drawer's ring. Tab inside the open drawer must land on something drawn.
 * The collapse button is inside the drawer and `hidden` on a phone, and the
 * trap used to reach it, so focus vanished and the next Tab looked like it had
 * gone behind the backdrop (T-0128). Thirty presses is more than the drawer
 * holds, so the ring wraps at least once.
 */

import { expect, test, type Page } from "@playwright/test";

import { documentedRoutes } from "../../src/lib/modules/registry";

async function expectContained(page: Page, route: string, width: number) {
  const r = await page.evaluate(() => {
    const main = document.querySelector("main");
    return {
      doc: document.documentElement.scrollWidth,
      inner: window.innerWidth,
      main: main ? main.scrollWidth : 0,
      mainClient: main ? main.clientWidth : 0,
    };
  });
  expect(r.doc, `${route} at ${width}: the page scrolls sideways`).toBeLessThanOrEqual(r.inner);
  expect(r.main, `${route} at ${width}: main overflows its own box`).toBeLessThanOrEqual(
    r.mainClient + 1,
  );
}

test.describe("containment (gate 9)", () => {
  for (const route of documentedRoutes()) {
    test(`${route} fits a phone and a tablet`, async ({ page }) => {
      test.setTimeout(90_000);
      await page.clock.setFixedTime(new Date("2026-06-01T09:30:00Z"));
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await page.getByRole("heading").first().waitFor({ timeout: 30_000 });
      await page.waitForTimeout(1_000);
      await expectContained(page, route, 390);

      await page.setViewportSize({ width: 1024, height: 768 });
      await page.waitForTimeout(500);
      await expectContained(page, route, 1024);
    });
  }
});

test.describe("the rail between 768 and 1024", () => {
  test("a tablet gets the icon rail, not the drawer", async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 800 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.getByRole("heading").first().waitFor({ timeout: 30_000 });

    const rail = page.getByTestId("app-rail");
    await expect(rail).toBeVisible();
    await expect(rail).not.toHaveAttribute("inert");
    // The server renders the expanded rail and the tablet query is read on
    // the client, so the column is 224px until React has hydrated; the first
    // gate measured it in that window. Wait for the width the query gives.
    await expect(rail).toHaveCSS("width", "64px", { timeout: 30_000 });
    const box = await rail.boundingBox();
    expect(box, "the rail has no box").not.toBeNull();
    expect(Math.round(box!.x)).toBe(0);
    expect(Math.round(box!.width)).toBe(64);
    await expect(page.getByRole("button", { name: "Open navigation" })).toBeHidden();
    // Icons only, but every row still says where it goes.
    await expect(rail.getByRole("link", { name: "Missions" })).toHaveAttribute("title", "Missions");
  });
});

test.describe("the drawer's ring", () => {
  test("Tab never leaves the open drawer for something that is not drawn", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.getByRole("heading").first().waitFor({ timeout: 30_000 });
    // The closed drawer is made inert by a client effect, so the attribute is
    // the proof that React has hydrated and the hamburger has its handler.
    await expect(page.getByTestId("app-rail")).toHaveAttribute("inert", "", { timeout: 30_000 });
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(page.getByRole("dialog", { name: "Navigation" })).toBeVisible();

    for (let i = 1; i <= 30; i++) {
      await page.keyboard.press("Tab");
      const where = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        const aside = document.querySelector("aside");
        const what = el
          ? `${el.tagName.toLowerCase()} "${el.getAttribute("aria-label") ?? el.textContent?.trim().slice(0, 24) ?? ""}"`
          : "nothing";
        return {
          inside: Boolean(el && aside && aside.contains(el)),
          drawn: Boolean(el && el.getClientRects().length > 0),
          what,
        };
      });
      expect(where.inside, `Tab ${i} left the drawer for ${where.what}`).toBe(true);
      expect(where.drawn, `Tab ${i} landed on ${where.what}, which is not drawn`).toBe(true);
    }
  });
});
