/**
 * The paint half of the bloom tier (T-0024). jsdom evaluates no media queries
 * and computes no pseudo-elements, so the guards that matter most here cannot
 * be asserted by rendering. They are asserted by reading the stylesheet.
 *
 * That is not a proxy for the real thing, and it is worth being straight about
 * which claim each test makes: these hold the SHAPE of the rule, which is what
 * a later refactor would break silently. Whether the radial actually lands
 * where the cursor is was checked in a browser, not here.
 *
 * The one that is not negotiable is the reduced-motion block. A field that
 * ignores the preference is an accessibility defect, and the field IS the
 * motion, so the guard removes the pseudo-element outright rather than slowing
 * it down.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const GLOBALS = join(__dirname, "..", "..", "src", "app", "globals.css");
const css = readFileSync(GLOBALS, "utf-8").replace(/\r\n/g, "\n");

/** The text of the `@media (...)` block whose condition contains `needle`. */
function mediaBlock(needle: string): string {
  const start = css.indexOf(`@media ${needle}`);
  if (start === -1) throw new Error(`no @media block matching "${needle}"`);
  let depth = 0;
  for (let i = css.indexOf("{", start); i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    else if (css[i] === "}") {
      depth -= 1;
      if (depth === 0) return css.slice(start, i + 1);
    }
  }
  throw new Error(`unterminated @media block matching "${needle}"`);
}

describe("the [data-bloom] paint rule", () => {
  const fine = mediaBlock("(hover: hover) and (pointer: fine)");

  it("paints only inside the fine-pointer guard", () => {
    // If the ::after escaped the guard, a touch device would get a container
    // lit by a tap with no pointer to unlight it.
    expect(fine).toContain("[data-bloom]::after");
    const outside = css.replace(fine, "");
    const stillPainting = /\[data-bloom\](?:="tight")?::after\s*\{[^}]*background:/.test(outside);
    expect(stillPainting).toBe(false);
  });

  it("removes the pseudo-element entirely under prefers-reduced-motion", () => {
    const reduce = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)", css.indexOf(fine)));
    expect(reduce).toContain("[data-bloom]::after");
    expect(reduce).toMatch(/\[data-bloom\]::after\s*\{\s*display:\s*none;\s*\}/);
  });

  it("positions the container so the field has something to be inset against", () => {
    expect(fine).toMatch(/\[data-bloom\]\s*\{\s*position:\s*relative;\s*\}/);
  });

  it("never eats a pointer event", () => {
    expect(fine).toContain("pointer-events: none");
  });

  it("follows the cursor through --bx/--by and dims to nothing without --bloom", () => {
    expect(fine).toContain("var(--bx, 50%) var(--by, 50%)");
    // The defaults are what an untouched container renders at: opacity 0, so a
    // console nobody is pointing at is dim. That is the acceptance sentence.
    expect(fine).toContain("opacity: var(--bloom, 0)");
  });

  it("carries the tight variant for small targets", () => {
    expect(fine).toContain('[data-bloom="tight"]::after');
    expect(fine).toContain("200px circle");
    expect(fine).toContain("90px circle");
  });

  it("mints no new colour token: the field is the existing Cherenkov colour", () => {
    const mixes = fine.match(/color-mix\([^)]*\)[^)]*\)/g) ?? [];
    expect(mixes.length).toBe(2);
    for (const mix of mixes) expect(mix).toContain("var(--color-cherenkov-100)");
    // That token is one this repo already had, not one this task added, and it
    // is the same colour the task named: #33ddff IS 51, 221, 255.
    expect(css).toContain("--color-cherenkov-100: #33ddff;");
    // Assert the CHANNELS, not the punctuation. Those channels were written as
    // a comma list until 2026-08-24, when all six mirrors moved to
    // space-separated form so the eighteen rgb(var(...) / a) rules that consume
    // them would stop being dropped as invalid CSS. The colour is what this
    // assertion is about; the separator is not.
    expect(css).toMatch(/--ps-rgb-cherenkov-glow:\s*51[ ,]\s*221[ ,]\s*255;/);
  });

  /**
   * The one that caught a real defect, and the reason the rule above does NOT
   * spell the colour as the --ps-rgb-cherenkov-glow triplet the task named.
   *
   * That token HELD a comma list, "51, 221, 255", when this rule was written.
   * rgb(var(token) / a) expanded to rgb(51, 221, 255 / 0.07), which mixes a
   * comma list with a slash alpha
   * and is invalid, so the declaration is dropped and the bloom paints nothing
   * at all. Writing the legacy rgba(var(token), a) does not rescue it either:
   * Lightning CSS normalises that to the slash form during minification, so it
   * arrives in the browser just as dead. Verified against a production build,
   * not reasoned about.
   *
   * A signature animated piece that ships as a no-op would pass every
   * text-matching assertion anyone would think to write about it. This is the
   * assertion that would not have passed.
   */
  it("never spells the colour as a triplet token this pipeline cannot compute", () => {
    expect(fine).not.toMatch(/var\(--ps-rgb-[a-z-]+\)/);
  });

  it("stays below the alpha this console reserves for live state", () => {
    // docs/contributing/design-tokens.md reserves pulse-glow / glow-surface for live and
    // active state; glow-surface sits at 0.15. Bloom has to read as ambient or
    // "glow means running" stops being true. In a color-mix against
    // transparent, the percentage IS the alpha.
    const pcts = (fine.match(/var\(--color-cherenkov-100\)\s*([\d.]+)%/g) ?? []).map((m) =>
      Number(m.match(/([\d.]+)%/)![1]),
    );
    expect(pcts.length).toBe(2);
    for (const pct of pcts) expect(pct / 100).toBeLessThan(0.15);
  });
});
