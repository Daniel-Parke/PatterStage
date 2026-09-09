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
 *
 * Then the three things the UI review of 2026-09-08 found the containment
 * gate could not see, because nothing overflowed: the words were crushed
 * inside main (T-0131).
 *
 * The title's room. On every route at 390 the h1's box is at least 12rem
 * wide and the subtitle runs to three lines at most. Chat, Scripts and Skills
 * rendered "(" and "Scr…" with the subtitle one word per line, because the
 * header's actions took the title's row.
 *
 * The split panes. Chat, Logs, Composer and Research are one shape: a list
 * that chooses and the thing chosen. At 390 the list is behind a button that
 * opens it as a sheet, and the main pane has the width; Chat's composer is
 * wide enough to type in.
 *
 * A banner's sentence. Below sm the action wraps under the sentence, so the
 * sentence keeps at least three fifths of the banner and the button sits on
 * its own row beneath it.
 */

import { expect, test, type Page } from "@playwright/test";

import { documentedRoutes } from "../../src/lib/modules/registry";

const READY = { timeout: 30_000 } as const;

/** 12rem, the floor the header describes for its title group. */
const TITLE_FLOOR = 192;
/**
 * Three lines of text-body (21px leading) and a little rounding. The subtitle
 * was text-micro (16px) until U18 moved prose out of mono (T-0132).
 */
const SUBTITLE_CEILING = 66;

async function expectTitleRoom(page: Page, route: string) {
  const r = await page.evaluate(() => {
    const h1 = document.querySelector("main h1");
    if (!h1) return null;
    const box = h1.getBoundingClientRect();
    const next = h1.nextElementSibling;
    const subtitle = next && next.tagName === "P" ? next.getBoundingClientRect() : null;
    return {
      width: box.width,
      text: h1.textContent?.trim() ?? "",
      subtitleHeight: subtitle ? subtitle.height : 0,
      subtitleText: next && next.tagName === "P" ? next.textContent?.trim().slice(0, 60) : "",
    };
  });
  expect(r, `${route}: no h1 inside main`).not.toBeNull();
  expect(r!.width, `${route} at 390: the h1 "${r!.text}" has ${Math.round(r!.width)}px`).toBeGreaterThanOrEqual(
    TITLE_FLOOR,
  );
  expect(
    r!.subtitleHeight,
    `${route} at 390: the subtitle "${r!.subtitleText}" is ${Math.round(r!.subtitleHeight)}px tall`,
  ).toBeLessThanOrEqual(SUBTITLE_CEILING);
}

/**
 * Every role=alert on the page keeps three fifths of its width for its
 * words. The text block is the alert's child that carries the most text.
 */
async function expectAlertsReadable(page: Page, route: string) {
  const alerts = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[role="alert"]')).map((alert) => {
      const kids = Array.from(alert.children) as HTMLElement[];
      const text = kids
        .filter((k) => (k.textContent ?? "").trim().length > 0 && k.tagName !== "BUTTON")
        .sort((a, b) => (b.textContent ?? "").length - (a.textContent ?? "").length)[0];
      const button = alert.querySelector("button");
      const a = alert.getBoundingClientRect();
      const t = text ? text.getBoundingClientRect() : null;
      const b = button ? button.getBoundingClientRect() : null;
      return {
        alert: a.width,
        text: t ? t.width : 0,
        textBottom: t ? t.bottom : 0,
        buttonTop: b ? b.top : null,
        words: (alert.textContent ?? "").trim().slice(0, 50),
      };
    }),
  );
  for (const a of alerts) {
    if (a.alert === 0) continue;
    expect(
      a.text / a.alert,
      `${route} at 390: the alert "${a.words}" gives its words ${Math.round(a.text)}px of ${Math.round(a.alert)}px`,
    ).toBeGreaterThanOrEqual(0.6);
    if (a.buttonTop !== null) {
      expect(a.buttonTop, `${route} at 390: the alert's button sits beside its words, not under them`).toBeGreaterThanOrEqual(
        a.textBottom - 1,
      );
    }
  }
}

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
      await expectTitleRoom(page, route);
      await expectAlertsReadable(page, route);

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

const SPLIT_PANES: Array<{ route: string; label: RegExp }> = [
  { route: "/work/chat", label: /^Conversations/ },
  { route: "/results/logs", label: /^Log files/ },
  { route: "/work/composer", label: /^Runs/ },
  { route: "/work/research", label: /^Runs/ },
];

test.describe("the split panes", () => {
  for (const { route, label } of SPLIT_PANES) {
    test(`${route} puts its list behind a button and gives the pane the width`, async ({ page }) => {
      test.setTimeout(90_000);
      await page.clock.setFixedTime(new Date("2026-06-01T09:30:00Z"));
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await page.getByRole("heading").first().waitFor(READY);

      // The button appears once React has read the viewport, so waiting for
      // it is also waiting for hydration.
      const opener = page.getByRole("button", { name: label });
      await expect(opener).toBeVisible(READY);

      const widths = await page.evaluate(() => {
        const main = document.querySelector("main");
        const pane = document.querySelector('[data-ps-split="main"]');
        return {
          main: main ? main.clientWidth : 0,
          pane: pane ? pane.getBoundingClientRect().width : 0,
        };
      });
      expect(widths.pane, `${route} at 390: the main pane is ${Math.round(widths.pane)}px of ${widths.main}px`).toBeGreaterThanOrEqual(
        widths.main * 0.85,
      );

      await opener.click();
      const sheet = page.getByRole("dialog", { name: label });
      await expect(sheet).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(sheet).toBeHidden();
    });
  }

  test("/work/chat: the composer is wide enough to type in", async ({ page }) => {
    await page.goto("/work/chat", { waitUntil: "domcontentloaded" });
    await page.getByRole("heading").first().waitFor(READY);
    const composer = page.getByRole("textbox", { name: "Message" });
    await expect(composer).toBeVisible(READY);
    const box = await composer.boundingBox();
    expect(box, "the composer has no box").not.toBeNull();
    // 390 less the shell's 32px gutter, the pane's 32px padding, the 36px
    // send button and the 8px gap is 282: the box is as wide as the row can
    // make it. The floor is set under that so a regression to the 240px
    // column (which left about 60px) fails and rounding does not.
    expect(Math.round(box!.width)).toBeGreaterThanOrEqual(270);
  });
});

test.describe("a banner's sentence comes first", () => {
  test("/results/artifacts with its read broken: the words keep the width and Retry sits under them", async ({ page }) => {
    await page.route("**/api/artifacts*", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "the database is locked" }),
      }),
    );
    await page.goto("/results/artifacts", { waitUntil: "domcontentloaded" });
    const banner = page.getByRole("alert").filter({ has: page.getByRole("button", { name: /retry/i }) });
    await expect(banner.first()).toBeVisible(READY);
    await expectAlertsReadable(page, "/results/artifacts");
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
