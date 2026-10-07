/**
 * Gate 10 · motion. Under `prefers-reduced-motion: reduce`, nothing runs on
 * any documented route except a spinner.
 *
 * The reconnaissance counted 28 animations still running under reduce, the
 * logo's flame on every screen among them, because the reduce block was an
 * allowlist of the seven names its author knew (WCAG 2.3.3). U14 inverts it
 * to deny-by-default; this gate is what stops the next keyframe from quietly
 * joining the running set. `document.getAnimations()` is the browser's own
 * account of what is moving, so a CSS rule that halts an animation without
 * actually halting it is caught here rather than believed.
 *
 * The allowlist is the spinner, which says "still working" and is the one
 * animation in the product that carries information rather than decoration.
 */

import { expect, test } from "@playwright/test";

import { documentedRoutes } from "../../src/lib/modules/registry";

const VIEWPORT = { width: 1440, height: 900 };
const ALLOWED = ["spin", "spin-slow"];

test.describe("motion under reduce (gate 10)", () => {
  for (const route of documentedRoutes()) {
    test(`${route} runs nothing but a spinner`, async ({ page }) => {
      test.setTimeout(90_000);
      await page.setViewportSize(VIEWPORT);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await page.getByRole("heading").first().waitFor({ timeout: 30_000 });
      // Long enough for every entrance animation to have ended if it is going
      // to, and for anything infinite to still be running.
      await page.waitForTimeout(1_500);

      const running = await page.evaluate((allowed: string[]) => {
        const names: string[] = [];
        for (const a of document.getAnimations()) {
          if (a.playState !== "running") continue;
          // Motion, not bookkeeping. The reduce rule leaves every transition
          // and one-shot animation at 0.01ms, and a sample can land inside the
          // frame one of those is triggered in (the first gate caught two
          // colour transitions that way on Profiles). What counts is anything
          // still set to move: a duration a human could see, or a repeat.
          const timing = a.effect?.getComputedTiming();
          const duration = typeof timing?.duration === "number" ? timing.duration : Number.POSITIVE_INFINITY;
          const repeats = timing?.iterations === Number.POSITIVE_INFINITY;
          if (duration <= 20 && !repeats) continue;
          const e = a as unknown as { animationName?: string; transitionProperty?: string };
          const name =
            e.animationName ??
            (e.transitionProperty ? `transition:${e.transitionProperty}` : a.constructor.name);
          if (allowed.includes(name)) continue;
          const target = (a.effect as KeyframeEffect | null)?.target as Element | null;
          const tag = target ? target.tagName.toLowerCase() : "?";
          const cls = target ? (target.getAttribute("class") ?? "").split(/\s+/).slice(0, 3).join(".") : "";
          names.push(`${name} on ${tag}${cls ? `.${cls}` : ""}`);
        }
        return names;
      }, ALLOWED);

      expect(running, `${route}: animations running under reduced motion`).toEqual([]);
    });
  }
});
