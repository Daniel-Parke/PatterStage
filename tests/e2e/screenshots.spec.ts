/**
 * Documentation screenshot regeneration (opt-in).
 *
 * Captures the pages embedded in docs/README.md + README.md
 * into docs/images/*. Reuses the standard e2e harness (playwright.config.ts
 * starts the app on an isolated data dir that tests/e2e/prepare-data-dir.mjs
 * wipes before boot; the app seeds the catalog itself during boot). Seeds a few
 * draft missions first so the dashboard + board aren't empty.
 *
 * Opt-in so the normal CI e2e run doesn't rewrite committed images:
 *   npm run screenshots              # locally
 * For the hero shots, run against the data-rich Mint instance (real missions
 * / sessions / memory) once the UI polish is validated there.
 */
import { test } from "@playwright/test";
import { mkdirSync } from "fs";
import { join } from "path";

const RUN = process.env.CAPTURE_SCREENSHOTS === "1";
const OUT = join(process.cwd(), "docs", "images");

const SHOTS: Array<{ path: string; file: string }> = [
  { path: "/", file: "dashboard.png" },
  { path: "/results/insights", file: "insights.png" },
  { path: "/work/missions", file: "missions-board.png" },
  { path: "/work/chat", file: "chat.png" },
  { path: "/agent/profiles", file: "agent-profiles.png" },
  { path: "/agent/skills", file: "skills-manager.png" },
  { path: "/agent/models", file: "models-config.png" },
];

test.describe("doc screenshots", () => {
  test.skip(!RUN, "set CAPTURE_SCREENSHOTS=1 (npm run screenshots) to regenerate");

  test.beforeAll(async ({ request }) => {
    mkdirSync(OUT, { recursive: true });
    // Seed a few draft missions so the dashboard + board render with content.
    const seeds = ["Daily repo digest", "Nightly refactor sweep", "Docs proofread pass"];
    for (let i = 0; i < seeds.length; i++) {
      await request
        .post("/api/missions", {
          data: {
            action: "dispatch",
            name: seeds[i],
            instruction: `Example mission ${i + 1} — a representative task for the screenshot.`,
            dispatchMode: "save",
          },
        })
        .catch(() => undefined);
    }
  });

  for (const shot of SHOTS) {
    test(`capture ${shot.file}`, async ({ page }) => {
      await page.goto(shot.path, { waitUntil: "networkidle" });
      // Let count-up animations + the Query layer settle before capturing.
      await page.waitForTimeout(1500);
      await page.screenshot({ path: join(OUT, shot.file), fullPage: true });
    });
  }
});
