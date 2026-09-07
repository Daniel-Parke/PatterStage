/**
 * U6 (T-0120), part three: the radius scale, and paint nobody applies.
 *
 * RADIUS. 663 `rounded-*` occurrences across 177 files, in 11 spellings
 * producing 7 rendered radii - 4, 5, 6, 8, 12, 16 and pill. Forty files paint
 * an 8px card edge on the same screen as a 12px one. The scale is three rungs
 * plus the pill, and two of the three conversions are pixel-identical:
 * `rounded-lg` (8px, 316 sites) IS `rounded-ps-md`, `rounded-xl` (12px, 111)
 * IS `rounded-ps-lg`. The two that move are `rounded-md` (6px, between the
 * rungs, no pixel-preserving answer exists) and `rounded-2xl` (16px, nine sites
 * of one identical card recipe).
 *
 * GLOW. Five `.glow-*` classes, `.text-glow-purple`, `.ps-electrified` and
 * `.animate-pulse-glow` have ZERO call sites between them. `.text-glow-cyan`
 * has exactly one - the word "Yours" in the rail's brand lockup - and is the
 * trap: it looks like the other seven and is not.
 *
 * And a live accessibility defect the survey turned up on the way. The
 * `prefers-reduced-motion` guard names `.animate-pulse-glow`, which nothing
 * uses. The class that IS used is `.pulse-glow`, on the dashboard's ONLINE dot
 * and on every StatusDot in the product, and it is not in the guard at all - so
 * an operator who asked their OS for reduced motion gets a dot pulsing forever
 * on the front door. WCAG 2.3.3. Deleting the unused name without adding the
 * used one would leave the guard naming nothing at all.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { blockCommentLines } from "../../scripts/tooling/design-lint.mjs";

const ROOT = join(__dirname, "..", "..");
const SRC = join(ROOT, "src");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf-8").replace(/\r\n/g, "\n");

function sources(): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(tsx?|css)$/.test(entry.name)) {
        out.push([
          `src/${full.slice(SRC.length + 1).split("\\").join("/")}`,
          readFileSync(full, "utf-8").replace(/\r\n/g, "\n"),
        ]);
      }
    }
  };
  walk(SRC);
  return out;
}

function sites(pattern: RegExp, skip: (p: string) => boolean = () => false): string[] {
  const found: string[] = [];
  for (const [path, source] of sources()) {
    if (skip(path)) continue;
    const lines = source.split("\n");
    const commented = blockCommentLines(lines);
    lines.forEach((line, i) => {
      if (commented[i]) return;
      const t = line.trimStart();
      if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) return;
      if (pattern.test(line)) found.push(`${path}:${i + 1}  ${line.trim().slice(0, 80)}`);
    });
  }
  return found;
}

describe("three radii and a pill", () => {
  it("has sources to check, so none of this passes vacuously", () => {
    expect(sources().length).toBeGreaterThan(200);
  });

  /**
   * Every Tailwind spelling, including the side-specific ones: a sheet that
   * rounds only its top and a rail that rounds only its left are still radius
   * decisions, and the mapping has to keep the side.
   */
  it("no component picks a radius off Tailwind's own scale", () => {
    expect(
      sites(
        /(?<![\w-])rounded(?:-[trblse]{1,2})?-(?:none|sm|md|lg|xl|[2-9]xl)(?![\w-])/,
        (p) => p === "src/app/globals.css",
      ),
    ).toEqual([]);
  });

  it("and none reaches for an arbitrary corner instead", () => {
    expect(sites(/(?<![\w-])rounded(?:-[trblse]{1,2})?-\[/)).toEqual([]);
  });

  it.each(["rounded-ps-sm", "rounded-ps-md", "rounded-ps-lg"])("%s has call sites", (rung) => {
    expect(sites(new RegExp(`(?<![\\w-])${rung}(?![\\w-])`)).length).toBeGreaterThan(0);
  });

  /**
   * The pill is not a fourth rung to be converted away: 68 sites are status
   * dots, avatars and chips, and a pill is a shape rather than a size.
   */
  it("leaves the pill alone", () => {
    expect(sites(/(?<![\w-])rounded-full(?![\w-])/).length).toBeGreaterThan(40);
  });
});

describe("paint nobody applies", () => {
  const css = () => read("src/app/globals.css");

  it.each([
    ".glow-cyan",
    ".glow-purple",
    ".glow-green",
    ".glow-pink",
    ".glow-orange",
    ".text-glow-purple",
    ".ps-electrified",
    ".animate-pulse-glow",
  ])("%s is gone, because nothing used it", (cls) => {
    expect(css()).not.toContain(`${cls} {`);
    expect(css()).not.toContain(`${cls},`);
  });

  it.each(["ch-pulse-glow", "ps-electrify"])("and its keyframes go with it: %s", (name) => {
    expect(css()).not.toContain(`@keyframes ${name}`);
  });

  /**
   * The trap. `.text-glow-cyan` looks exactly like the seven above and has one
   * call site: the word "Yours" in the rail's brand lockup, which is the
   * product's own name.
   */
  it("keeps .text-glow-cyan, which has a call site", () => {
    expect(css()).toContain(".text-glow-cyan");
    expect(read("src/components/layout/Sidebar.tsx")).toContain("text-glow-cyan");
  });
});

describe("the reduced-motion guard names what actually animates", () => {
  /**
   * The guard's SELECTORS, with its comments stripped. The comment inside it
   * explains the fix by naming the class that was wrong, and a whole-block
   * `not.toContain` is answered by the explanation rather than by the code —
   * which is the fourth time in this programme that a comment about a defect
   * has been read as the defect.
   */
  const guard = () => {
    const css = read("src/app/globals.css");
    const at = css.indexOf("@media (prefers-reduced-motion: reduce)");
    expect(at).toBeGreaterThan(-1);
    const block = css.slice(at, css.indexOf("}", css.indexOf("{", at) + 1) + 200);
    return block.replace(/\/\*[\s\S]*?\*\//g, "");
  };

  /**
   * The defect this fixes. `.pulse-glow` is on the dashboard's ONLINE dot and
   * on every StatusDot in the product; the guard named `.animate-pulse-glow`,
   * which nothing uses. An operator who asked their OS for reduced motion got a
   * dot pulsing forever on the front door.
   */
  it("guards .pulse-glow, which is the one the product uses", () => {
    expect(guard()).toContain(".pulse-glow");
  });

  it("and names nothing that no longer exists", () => {
    const g = guard();
    expect(g).not.toContain(".animate-pulse-glow");
    expect(g).not.toContain(".ps-electrified");
  });
});
