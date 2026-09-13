import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test, expect } from "@playwright/test";

// B16 (contract 4.2): the ? key is the same control as the ? in the header,
// and this is the only place that proves a real browser delivers the keystroke
// to the listener. The unit oracle pins the href and the three refusals; it
// cannot pin that Shift+/ arrives as `key: "?"` on document, which is the one
// thing between a working shortcut and a dead one.
//
// The expected destination is READ from the built manifest rather than written
// down. A guide that gets renamed or re-sectioned must move this test's target
// with it; a hard-coded slug would instead go red for the corpus's reason and
// be "fixed" by editing the expectation.

const SCREEN = "/work/missions";

function guideFor(screen: string): string {
  const path = join(process.cwd(), "public", "help", "manifest.json");
  let raw: string;
  try {
    raw = readFileSync(path, "utf-8");
  } catch {
    throw new Error(
      `No help corpus at ${path}. It is generated at prebuild; run \`npm run docs:build\`.`,
    );
  }
  const manifest = JSON.parse(raw) as {
    pages?: Array<{ slug?: string; section?: string; screen?: string }>;
  };
  const guide = (manifest.pages ?? []).find(
    (p) => p.screen === screen && p.section === "guides" && typeof p.slug === "string",
  );
  if (!guide?.slug) throw new Error(`No guide in the manifest names the screen ${screen}.`);
  return guide.slug;
}

test.describe("the ? on a header opens that screen's guide", () => {
  test("pressing ? on Missions lands on the Missions guide", async ({ page }) => {
    const slug = guideFor(SCREEN);

    await page.goto(SCREEN, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("ps-app-shell")).toBeVisible();

    // Wait for the page's OWN header before looking for the control inside it.
    // Under parallel workers on a cold production start, a client screen can
    // take longer to appear than the 5s an assertion waits, and the failure
    // then reads as "the ? is missing" rather than "the page had not rendered
    // yet".
    await expect(page.getByRole("heading", { level: 1, name: "Missions" })).toBeVisible({
      timeout: 30_000,
    });

    // The control and the key must agree, so read the href first: if this is
    // /help the manifest never reached the client and the keystroke below
    // would "pass" by landing somewhere else entirely.
    const control = page.getByTestId("help-link");
    await expect(control).toHaveAttribute("href", `/help/${slug}`);

    // Nothing focused, so the keystroke is a press and not typing. The page
    // may have put the caret in a filter box on load.
    await page.evaluate(() => {
      const active = document.activeElement;
      if (active instanceof HTMLElement) active.blur();
    });
    // Press until it lands, rather than once. The h1 above is NOT proof of
    // hydration: since T-0117 the missions loading branch renders the same
    // header as the loaded one, so the heading is in the server HTML and
    // arrives before the keydown listener does. One press into an
    // un-hydrated page is a 30s timeout that says nothing about the shortcut.
    // This is stricter, not looser: the shortcut still has to work, and within
    // the same budget.
    await expect(async () => {
      await page.keyboard.press("?");
      await page.waitForURL(`**/help/${slug}`, { timeout: 2_000 });
    }).toPass({ timeout: 25_000 });
    await expect(page.getByTestId("ps-app-shell")).toBeVisible();
  });
});
