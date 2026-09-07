/**
 * The dashboard asks each question once.
 *
 * Measured before U15 on the running product: 22 API requests to load `/`,
 * four endpoints fetched twice (/api/status/runtime, /api/monitor,
 * /api/agents, /api/status/subsystems), because the same endpoint was cached
 * under two keys, or fetched by a second loader beside the live query. Eleven
 * more in thirty idle seconds.
 *
 * U15 keys every read on its endpoint, so a duplicate cannot happen by
 * construction, and this holds it: no API path is requested twice during
 * load, the load stays under a ceiling, and the idle poll stays under its
 * own. The ceilings are what the board needs today plus a little; a new
 * fact on the board raises them on purpose, in this file, with the reason.
 */

import { expect, test } from "@playwright/test";

const LOAD_CEILING = 18;
const IDLE_CEILING = 12;
const IDLE_MS = 30_000;

test.describe("the dashboard asks each question once", () => {
  test("no endpoint twice on load, and the idle poll stays under its ceiling", async ({ page }) => {
    test.setTimeout(120_000);
    const load: string[] = [];
    const idle: string[] = [];
    let phase = load;
    page.on("request", (r) => {
      const u = new URL(r.url());
      if (u.pathname.startsWith("/api/")) phase.push(u.pathname + u.search);
    });

    await page.goto("/", { waitUntil: "networkidle" });
    await page.waitForTimeout(1_500);

    const counts = new Map<string, number>();
    for (const k of load) counts.set(k, (counts.get(k) ?? 0) + 1);
    const twice = [...counts.entries()].filter(([, n]) => n > 1).map(([k, n]) => `${n}x ${k}`);
    expect(twice, "endpoints requested more than once during load").toEqual([]);
    expect(load.length, `API requests on load: ${[...counts.keys()].join(", ")}`).toBeLessThanOrEqual(LOAD_CEILING);

    phase = idle;
    await page.waitForTimeout(IDLE_MS);
    expect(idle.length, `API requests in ${IDLE_MS / 1000}s idle: ${idle.join(", ")}`).toBeLessThanOrEqual(IDLE_CEILING);
  });
});
