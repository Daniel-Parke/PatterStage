/**
 * T-0113: the page title is legible on a narrow screen.
 *
 * Found by the release walk, which looks at every screen at 1280x720 and again
 * at 390x844. At the narrow width the heading on five screens had a bounding box
 * of 0 x 28: present in the DOM, `display: flex`, `visibility: visible`, and
 * nought pixels wide. A reader on a phone could not tell which page they were
 * on, and nothing in the suite could see it, because a jsdom render has no
 * layout and every assertion about that heading passed.
 *
 * The cause is in PageHeader: the actions on the right are `flex-shrink-0` and
 * the title group on the left is `min-w-0` with no `flex-1`. Given
 * `justify-between`, the group that may shrink shrinks all the way to zero as
 * soon as the actions are wide, so the screens with the busiest headers were
 * exactly the ones that lost their titles.
 *
 * The assertion is deliberately about the RENDERED BOX rather than about the
 * element existing: "the heading is in the document" was true throughout.
 */
import { test, expect } from "@playwright/test";

/**
 * The screens with the busiest headers, plus two controls.
 *
 * The five that failed carry a picker, a refresh and a destructive action
 * between them; sessions and the dashboard were fine and are here so a
 * regression that widened the fix into a break shows up as a failure too.
 */
const SCREENS: Array<[string, string]> = [
  ["/results/logs", "Logs"],
  ["/agent/tools", "Tools"],
  ["/agent/models", "Models"],
  // Since U12 (T-0126) the two Story Weaver headers are the library's and
  // Create's; Characters and Themes are panels on Create.
  ["/recroom/story-weaver", "Story Weaver"],
  ["/recroom/story-weaver/create", "Create"],
  ["/results/sessions", "Sessions"],
  ["/", "Dashboard"],
];

test.describe("a page title survives a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const [route, title] of SCREENS) {
    test(`${route} still shows "${title}" at 390 wide`, async ({ page }) => {
      await page.goto(route, { waitUntil: "domcontentloaded" });

      const heading = page.getByRole("heading", { level: 1 }).first();
      // Every screen is a client component, so its heading arrives with
      // hydration rather than with the document.
      await heading.waitFor({ state: "attached", timeout: 30_000 });

      const box = await heading.boundingBox();
      expect(box, `${route}: the h1 has no box at all`).not.toBeNull();

      // 40px is not a threshold anyone tuned: it is "wider than a couple of
      // characters", which is the least that could be called legible. The
      // failure this catches was zero.
      expect.soft(box!.width, `${route}: the title is ${Math.round(box!.width)}px wide`).toBeGreaterThan(40);
      expect(box!.height, `${route}: the title has no height`).toBeGreaterThan(8);

      // And it must actually be on the screen, not pushed off the side by the
      // actions it is competing with.
      expect(box!.x, `${route}: the title starts off-screen at x=${Math.round(box!.x)}`).toBeLessThan(390);
      await expect(heading).toBeVisible();
    });
  }
});
