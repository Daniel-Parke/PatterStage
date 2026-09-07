/**
 * U8 (T-0122), part one: the console has one focus ring, and it paints.
 *
 * `globals.css` declares it once, in `@layer base`: a 2px `--color-neon-cyan`
 * outline at 2px offset, on `:focus-visible` so a mouse click does not draw it.
 * It is the strongest indicator in the product and 55 controls suppress it.
 *
 * The shape is always the same: `outline-none` beside a `focus:border-<accent>`.
 * `no-bare-outline-none` exists to catch exactly this and accepts the border as
 * a replacement, so all 55 pass the gate today. They should not. A border
 * COLOUR CHANGE is not a focus ring:
 *
 *   - it fires on `:focus`, not `:focus-visible`, so it paints on a mouse click
 *     too, which is the thing `:focus-visible` exists to stop;
 *   - it is a 1px edge where the ring is 2px with an offset, so on a filled
 *     control it is almost invisible;
 *   - measured in U6, 47 of the 56 sampled were below 3:1 against their own
 *     backdrop, and the nine that passed did so only because of what happened
 *     to be behind them. WCAG 2.4.7 asks for a visible indicator, and 1.4.11
 *     asks 3:1 of it.
 *
 * So the pair goes, both halves, and the rule stops accepting the substitute.
 * A control that genuinely replaces the ring with a RING (`focus:ring-*`) still
 * may: three do, and they are untouched.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { RULES, violationsIn, blockCommentLines } from "../../scripts/tooling/design-lint.mjs";

const ROOT = join(__dirname, "..", "..");
const SRC = join(ROOT, "src");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf-8").replace(/\r\n/g, "\n");

function sources(): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name)) {
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

function sites(pattern: RegExp): string[] {
  const found: string[] = [];
  for (const [path, source] of sources()) {
    const lines = source.split("\n");
    const commented = blockCommentLines(lines);
    lines.forEach((line, i) => {
      if (commented[i]) return;
      const t = line.trimStart();
      if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) return;
      if (pattern.test(line)) found.push(`${path}:${i + 1}  ${line.trim().slice(0, 76)}`);
    });
  }
  return found;
}

describe("the ring is declared once and nothing suppresses it", () => {
  it("is still declared, so none of this passes vacuously", () => {
    const css = read("src/app/globals.css");
    expect(css).toMatch(/:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--color-neon-cyan\)/);
  });

  /**
   * The pragma survives for a control that genuinely needs no ring around its
   * whole box, which the shell's `<main>` is: it takes programmatic focus from
   * the skip link and the first control inside it paints its own. That one is
   * excused in the file, with its reason, which is what the pragma is for.
   */
  it("no control removes the outline without putting a RING back", () => {
    const offenders: string[] = [];
    for (const [path, source] of sources()) {
      const found = violationsIn(path, source.split("\n"));
      for (const key of found.keys()) {
        if (key.startsWith("no-bare-outline-none::")) {
          offenders.push(`${path}  ${found.get(key)![0].text.slice(0, 66)}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("and no control substitutes a border colour for one", () => {
    expect(sites(/focus(?:-within)?:border-/)).toEqual([]);
  });
});

describe("the rule stops accepting a border as a ring", () => {
  const trips = (line: string) =>
    [...violationsIn("src/components/x.tsx", [line]).keys()].map((k) => k.split("::")[0]);

  it("has the rule at all", () => {
    expect(RULES.map((r: { id: string }) => r.id)).toContain("no-bare-outline-none");
  });

  it.each([
    ["a bare one", '<input className="outline-none" />'],
    ["one with a border colour change", '<input className="outline-none focus:border-neon-cyan/50" />'],
    ["one with a focus:outline-none, which is the same thing twice", '<input className="outline-none focus:outline-none" />'],
  ])("refuses %s", (_what, line) => {
    expect(trips(line)).toContain("no-bare-outline-none");
  });

  /**
   * The half that matters: a control that puts a real ring back is still
   * allowed to take the outline off, and so is a line that never removed it.
   */
  it.each([
    ["a ring", '<input className="outline-none focus:ring-2 focus:ring-neon-cyan" />'],
    ["a shadow ring", '<input className="outline-none focus-visible:shadow-[0_0_0_2px_var(--color-neon-cyan)]" />'],
    ["an ordinary control", '<input className="rounded-ps-md border border-ps-edge px-3" />'],
  ])("and allows %s", (_what, line) => {
    expect(trips(line)).not.toContain("no-bare-outline-none");
  });
});
