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
/**
 * The idle ceiling is arithmetic, not a round number. The board polls the
 * monitor every 10s (3 in the window), agents, missions and subsystems every
 * 15s (2 each), stats every 20s (1 or 2), spend every 30s (1) and the session
 * trend every 60s (0 or 1): eleven to thirteen, and the phase of each timer
 * against the window's edges adds one or two. Fifteen holds that; a new poll
 * on the board raises it on purpose, here, with its interval.
 */
const IDLE_CEILING = 15;
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
