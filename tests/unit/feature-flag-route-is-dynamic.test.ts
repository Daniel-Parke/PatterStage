/**
 * @jest-environment node
 *
 * T-0054 — a feature-flagged route is evaluated per request, not baked in.
 *
 * `PS_COMPOSER` is a RUNTIME value. A statically generated route freezes
 * whatever the flag was when the response was first produced, and the cached
 * envelope carries that render's status with it.
 *
 * Measured on a real server before the fix: with the flag off,
 * `/work/composer` served the Next 404 PAGE with an HTTP **200**
 * (`x-nextjs-cache: HIT`, `x-nextjs-prerender: 1`), while a genuinely
 * nonexistent route returned a real 404. A person saw the right thing; a
 * monitor, a crawler, an uptime check and this repo's own documentation did
 * not. Both the walkthrough guide and the QA brief state that the route 404s.
 *
 * A source-level assertion rather than a request: exercising it properly needs
 * a built server booted twice with different environments, which is what the
 * live check did once. This holds the line cheaply afterwards.
 */

import { readFileSync } from "fs";
import { join } from "path";

const LAYOUT = join(
  __dirname, "..", "..", "src", "app", "work", "composer", "layout.tsx",
);

describe("the composer route", () => {
  const src = readFileSync(LAYOUT, "utf-8");

  it("guards on the feature flag", () => {
    expect(src).toMatch(/requireFeatureOr404\(\s*["']composer["']\s*\)/);
  });

  it("opts out of static generation, so the flag is read per request", () => {
    expect(src).toMatch(/export const dynamic\s*=\s*["']force-dynamic["']/);
  });

  it("says why, because the next person will want to delete that line", () => {
    expect(src).toMatch(/runtime|prerender|cache/i);
  });
});
