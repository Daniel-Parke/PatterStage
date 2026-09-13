/**
 * The design census (U0, T-0114): the overhaul's before-and-after, as numbers.
 *
 * The existing gates measure text contrast, icon-button names, form-control
 * names, declared colour tokens and the overlay contract. Not one of them
 * measures the four things the reconnaissance found wrong with this product:
 * that no surface has an edge, that no two pages share a geometry, that there
 * is no component library, and that there is no type scale. Those are all
 * properties of what was PAINTED, so no amount of reading source can see them.
 *
 * This spec walks every documented route in a real browser, hands the DOM to
 * the collector, runs the numbers through census-analysis, and holds the result
 * against a committed baseline that may fall but not rise. It is design-lint's
 * ratchet, applied to pixels instead of to class strings.
 *
 *   npm run census          # measure and check against the committed baseline
 *   npm run census:update   # measure and rewrite it, saying why in the commit
 *
 * Opt-in, and not for tidiness. `playwright.config.ts` sets `fullyParallel`, so
 * inside an ordinary `npm run test:e2e` this spec shares one server with twenty
 * other spec files that are creating missions, categories and conversations
 * while it reads. Measured: a census taken that way drifted by one border
 * colour, one card chrome, one shadow and three failing decorative borders,
 * while two dedicated runs agreed exactly (T-0114). A census taken during that
 * is a measurement of the suite, not of the design. It belongs in the batch
 * gate beside `npm run lint`, which is where the programme runs it.
 *
 * The route list is the registry's, like every other list in this repo, so a
 * new screen is censused the day it exists rather than the day someone
 * remembers to add it.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

import { expect, test } from "@playwright/test";

import { documentedRoutes } from "../../src/lib/modules/registry";
import {
  describeRegression,
  growthRefusal,
  parseRgba,
  regressions,
  summarise,
  type CensusCounts,
  type RawCensus,
} from "./lib/census-analysis";
import { collectCensus } from "./lib/census-collect";
import { seedDemo } from "./seed-demo.mjs";

const BASELINE = join(process.cwd(), "scripts", "tooling", "design-census.baseline.json");
const REPORT_DIR = join(process.cwd(), "tmp");
const UPDATE = process.env.UPDATE_CENSUS === "1";
/** A written reason, when a rewrite is allowed to record a number that rose. */
const ALLOW_GROWTH = process.env.CENSUS_ALLOW_GROWTH ?? "";
const DEFAULT_NOTE =
  "Measured by tests/e2e/design-census.spec.ts against the running product. " +
  "Sprawl counts may fall and never rise; contrast readings may rise and never fall. " +
  "Rewrite with UPDATE_CENSUS=1 npm run census, and say why in the commit.";
const RUN = UPDATE || process.env.RUN_CENSUS === "1";

/** Fixed, because a census taken at two widths is two censuses. */
const VIEWPORT = { width: 1440, height: 900 };

interface BaselineFile {
  /** Why these numbers are what they are, for whoever opens the file next. */
  note: string;
  viewport: { width: number; height: number };
  counts: CensusCounts;
  /** Every growth ever allowed, with the reason that bought it. */
  allowed?: Array<{ when: string; reason: string; rose: string[] }>;
}

test.describe("design census", () => {
  test.skip(!RUN, "set RUN_CENSUS=1 (npm run census) — see the header for why");

  // Serial: every route shares one page so the colour cache and the seeded
  // data are paid for once, and a census is a whole-product reading anyway.
  test.describe.configure({ mode: "serial" });

  test("every documented route, measured", async ({ page, request }) => {
    test.setTimeout(10 * 60 * 1000);
    await seedDemo(request);

    // The clock is fixed for the same reason the screenshots fix it: a chart
    // whose axis moves changes the element count between runs.
    await page.clock.setFixedTime(new Date("2026-06-01T09:30:00Z"));
    await page.setViewportSize(VIEWPORT);

    const routes = documentedRoutes();
    expect(routes.length).toBeGreaterThan(10);

    const raw: RawCensus[] = [];
    for (const route of routes) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      // Every screen is a client component; its heading does not exist until
      // hydration, so measuring the shell would census an empty frame.
      await page.getByRole("heading").first().waitFor({ timeout: 30_000 });
      // Count-ups, charts and the query layer settle after that. A census taken
      // mid-transition reads the skeleton's chrome, not the page's.
      await page.waitForTimeout(2_000);
      raw.push(await page.evaluate(collectCensus, route));
    }

    // The collector has no unit test: jsdom has no layout and no canvas, so
    // nothing in jest can exercise it. What holds it up instead is that a
    // collector returning nothing produces a beautiful census of nothing, and
    // these four refusals make that loud. They are anti-vacuity guards, the
    // same shape as the ones in viz-chrome-tokens and design-lint's own tests.
    for (const p of raw) {
      expect(p.text.length, `${p.route} rendered no text at all`).toBeGreaterThan(10);
      expect(p.boxes.length, `${p.route} rendered no surfaces or controls`).toBeGreaterThan(3);
      expect(parseRgba(p.pageBackground), `${p.route} page background did not normalise`).not.toBeNull();
      // Every colour that reached the record must be one the analysis can read;
      // an un-normalised oklab arriving here is a collector bug, and silently
      // dropping it is exactly the failure this census exists to prevent.
      const unreadable = [
        ...p.borders.map((b) => b.colour),
        ...p.borders.flatMap((b) => b.backdrop),
      ].filter((c) => parseRgba(c) === null);
      expect(unreadable.slice(0, 5), `${p.route} emitted colours the analysis cannot parse`).toEqual([]);
    }
    // The rail is in the shell, so it is on every route or the selector is wrong.
    expect(raw.filter((p) => p.railBackground !== null).length).toBe(raw.length);

    const counts = summarise(raw);

    // The detail is not committed: it is 25 routes of every border and box, and
    // it exists so that a regression in a scalar can be traced to the element
    // that caused it.
    mkdirSync(REPORT_DIR, { recursive: true });
    writeFileSync(
      join(REPORT_DIR, "design-census.json"),
      JSON.stringify({ viewport: VIEWPORT, counts, raw }, null, 2),
      "utf-8",
    );

    if (UPDATE) {
      const previous: BaselineFile | null = existsSync(BASELINE)
        ? (JSON.parse(readFileSync(BASELINE, "utf-8")) as BaselineFile)
        : null;
      const rose = previous ? regressions(previous.counts, counts) : [];

      // The same pawl the check path has, on the way out. The decision itself
      // lives in census-analysis, where a unit test can prove it refuses.
      const refusal = growthRefusal(previous?.counts ?? null, counts, ALLOW_GROWTH);
      if (refusal) throw new Error(refusal);

      const file: BaselineFile = {
        // The note survives a rewrite. It is where a reader learns why a number
        // moved a long way in one batch, and a template overwrote it twice
        // before anyone noticed.
        note: previous?.note ?? DEFAULT_NOTE,
        viewport: VIEWPORT,
        counts,
        ...(previous?.allowed || rose.length > 0
          ? {
              allowed: [
                ...(previous?.allowed ?? []),
                ...(rose.length > 0
                  ? [
                      {
                        when: new Date().toISOString().slice(0, 10),
                        reason: ALLOW_GROWTH.trim(),
                        rose: rose.map(describeRegression),
                      },
                    ]
                  : []),
              ],
            }
          : {}),
      };
      writeFileSync(BASELINE, `${JSON.stringify(file, null, 2)}\n`, "utf-8");
      test.info().annotations.push({ type: "census", description: JSON.stringify(counts) });
      return;
    }

    if (!existsSync(BASELINE)) {
      throw new Error(
        `No census baseline at ${BASELINE}. Take one with: UPDATE_CENSUS=1 npm run census`,
      );
    }

    const committed = JSON.parse(readFileSync(BASELINE, "utf-8")) as BaselineFile;
    expect(
      committed.viewport,
      "the baseline was taken at a different viewport, so the numbers are not comparable",
    ).toEqual(VIEWPORT);

    const moved = regressions(committed.counts, counts);
    expect(
      moved.map(describeRegression),
      "the design census moved the wrong way; see tmp/design-census.json for the elements behind each number",
    ).toEqual([]);
  });
});
