/**
 * U4 (T-0118): every region gets an edge.
 *
 * This is the batch behind the operator's headline complaint, and the complaint
 * is a SURFACE problem rather than a text one: the rail's own labels already
 * measure 6.18:1, so brightening them cannot fix "the sidebar is hard to see"
 * and would only make the type problem worse. What is wrong is that the rail
 * sits at 1.06:1 against the page beside it, every card fill sits within 1.03:1
 * of the page behind it, and every boundary in the product is one 1px rule at
 * 1.25:1 against the 3:1 WCAG 1.4.11 asks of a component boundary.
 *
 * Measured before this batch: 300 `bg-dark-*` uses across 25 spellings for what
 * the tokens name as three roles, 202 `bg-white/N`, and 435 `border-white/N`
 * across 9 undeclared alphas. U2 derived the ladder and nothing consumed it.
 * This is the consuming.
 *
 * What it deliberately does NOT do: the 346 accent-tinted borders across 71
 * spellings, and the white DOTS (`bg-white/20|25|30|40`) that are status marks
 * rather than surfaces. Both are colour-that-means-something, they are S5, and
 * they are U6. The census's controlBordersBelowThree ratchet is what keeps them
 * falling in the meantime; nothing here declares them acceptable.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { blockCommentLines, violationsIn } from "../../scripts/tooling/design-lint.mjs";

const ROOT = join(__dirname, "..", "..");
const SRC = join(ROOT, "src");

/** Every .tsx/.ts/.css under src/, keyed by its repo-relative path. */
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

/**
 * Sites of a pattern, as `path:line  text`, so a failure names them.
 *
 * Comments do not count: a comment naming a defect is not a use of it, and
 * every one of these files is commented. The leading-marker test is not enough
 * on its own, because globals.css documents both the ladder and the tiers
 * inside block comments whose interior lines carry no marker at all — which is
 * the same hole design-lint had until T-0118.
 */
function sites(pattern: RegExp, skip: (path: string) => boolean = () => false): string[] {
  const found: string[] = [];
  for (const [path, source] of sources()) {
    if (skip(path)) continue;
    const lines = source.split("\n");
    const commented = blockCommentLines(lines);
    lines.forEach((line, i) => {
      if (commented[i]) return;
      const t = line.trimStart();
      // A comment naming a defect is not a use of it. Every one of these files
      // is commented, and several comments quote the spelling they replaced.
      if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) return;
      if (pattern.test(line)) found.push(`${path}:${i + 1}  ${line.trim().slice(0, 90)}`);
    });
  }
  return found;
}

const read = (rel: string) => readFileSync(join(ROOT, rel), "utf-8").replace(/\r\n/g, "\n");

describe("the ladder is the only surface vocabulary left", () => {
  it("has sources to check, so none of this passes vacuously", () => {
    expect(sources().length).toBeGreaterThan(200);
  });

  /**
   * The declarations themselves stay: `--color-dark-*` is the primitive ramp
   * the roles are still allowed to alias, and contrast-check reads it. What
   * goes is 300 components each choosing a rung.
   */
  it("no component picks a rung off the dark ramp", () => {
    expect(sites(/\bbg-dark-\d{3}/, (p) => p === "src/app/globals.css")).toEqual([]);
  });

  it("no component tints a surface with a raw white alpha", () => {
    expect(sites(/\bbg-white\/(?:5|10|\[0\.0\d+\])\b/)).toEqual([]);
  });

  it("no component draws a boundary with a raw white alpha", () => {
    expect(sites(/\b(?:border|divide|ring)-white\/(?:\[[^\]]+\]|\d)/)).toEqual([]);
  });

  /**
   * The two rungs U2 left alive so that declaring the ladder repainted
   * nothing. `well` was an alias for dark-800, which is LIGHTER than the card
   * it sat in, so every input in the product read as a lift rather than a
   * well; `surface-hairline` was white at 10%, which is the 1.25:1 rule this
   * batch is removing.
   */
  it.each([
    ["ps-surface-well", /\bps-surface-well\b/],
    ["ps-surface-hairline", /\bps-surface-hairline\b/],
  ])("no component or stylesheet still names %s", (_name, pattern) => {
    expect(sites(pattern)).toEqual([]);
  });
});

describe("the rail is a surface with one edge", () => {
  const sidebar = () => read("src/components/layout/Sidebar.tsx");
  const layout = () => read("src/app/layout.tsx");

  /**
   * The <aside>'s OWN opening tag. Asking the whole file whether it contains
   * "bg-ps-surface-panel" is answered by the logo mark, which paints on the
   * same rung — so the rail could go back to the page's ground and the
   * assertion would still pass.
   */
  const railTag = () => {
    const source = sidebar();
    // The ELEMENT, not the file's own comment about it ("One <aside>. On a
    // desktop it is the rail…"), and not the first `>` after it either: the
    // tag carries `React.RefObject<HTMLElement | null>` and a template literal
    // with braces in it. Depth-aware, like every other tag scan in this repo.
    const at = source.search(/<aside\s*\n/);
    expect(at).toBeGreaterThan(-1);
    let depth = 0;
    let inStr: string | null = null;
    for (let i = at; i < source.length; i++) {
      const c = source[i];
      if (inStr) {
        if (c === inStr && source[i - 1] !== "\\") inStr = null;
      } else if (c === '"' || c === "'" || c === "`") inStr = c;
      else if (c === "{" || c === "<") depth += 1;
      else if (c === "}") depth -= 1;
      else if (c === ">") {
        depth -= 1;
        if (depth === 0) return source.slice(at, i + 1);
      }
    }
    throw new Error("the rail's opening tag does not close");
  };

  /** A whole class, not a prefix: `border-ps-edge-hairline` contains `border-ps-edge`. */
  const wears = (tag: string, cls: string) =>
    new RegExp(`(?:^|[\\s\`"'{])${cls}(?![\\w-])`).test(tag);

  it("paints itself on the panel rung, at both breakpoints", () => {
    expect(wears(railTag(), "bg-ps-surface-panel")).toBe(true);
    // Not one surface on a phone and another on a desktop: it measured
    // 1.02:1 against the page at one breakpoint and 1.10:1 at the other.
    expect(sidebar()).not.toMatch(/lg:bg-/);
  });

  it("draws exactly one divider, and it is the shell seam", () => {
    const tag = railTag();
    expect(wears(tag, "border-r")).toBe(true);
    // `edge`, not `hairline`. A shell seam is a boundary between two regions,
    // which is what WCAG 1.4.11's 3:1 is about; the hairline is a card outline
    // at 1.63:1 and reads as nothing across a whole screen height.
    expect(wears(tag, "border-ps-edge")).toBe(true);
    expect(tag).not.toContain("border-ps-edge-hairline");
    // The wrapper drew a second one at layout.tsx:107, so the seam was two
    // stacked 1px rules at 1.25:1 apiece pretending to be one.
    expect(layout()).not.toMatch(/border-r/);
  });

  /**
   * A backdrop filter behind an opaque surface blurs nothing and costs a
   * compositing layer on every scroll. It was doing that on the rail because
   * the rail used to be translucent.
   */
  it("stops blurring what is behind an opaque surface", () => {
    expect(sidebar()).not.toContain("backdrop-blur");
  });
});

describe("the code mirror names the same rungs the CSS does", () => {
  const theme = () => read("src/lib/ui/theme.ts");

  it.each([
    ["ground", "bg-ps-surface-ground"],
    ["panel", "bg-ps-surface-panel"],
    ["raised", "bg-ps-surface-raised"],
    ["inset", "bg-ps-surface-inset"],
    ["edge", "border-ps-edge"],
    ["hairline", "border-ps-edge-hairline"],
    ["emphasis", "border-ps-edge-emphasis"],
  ])("carries %s", (_role, utility) => {
    expect(theme()).toContain(utility);
  });

  /**
   * `well` and `hairline` were the old map's names for rungs that no longer
   * exist. Leaving them would leave two vocabularies and a rule that says
   * which one is right, which is how there came to be 25 spellings.
   */
  it("and does not carry the two the ladder replaced", () => {
    expect(theme()).not.toMatch(/\bwell:/);
    expect(theme()).not.toMatch(/border-ps-surface-hairline/);
  });
});

/**
 * design-lint skips a comment by its leading marker, which is the house style
 * in .ts and .tsx and is not CSS at all: a block comment's interior lines carry
 * no marker. globals.css documents this very ladder as a table of hexes inside
 * one, so nine rows of the derivation counted as raw colour and the rule that
 * polices colour sprawl was reporting its own file's prose about it.
 *
 * Both sides are asserted. A mask that is too greedy blinds every code-only
 * rule at once and looks exactly like a clean codebase.
 */
describe("the linter can read a block comment", () => {
  it("calls the interior of one comment, marker or no marker", () => {
    const lines = [
      "  --color-ps-edge: #6c7887;",
      "/* the ladder, derived:",
      "   panel      #1e3042   ground   1.466",
      "   edge       #6c7887   panel    3.003",
      "*/",
      "  box-shadow: 0 0 5px rgb(34 211 238 / 0.6);",
    ];
    // The OPENING line is not in this mask's job: it starts with `/*` and the
    // runner's leading-marker check already skips it. What no marker check can
    // see is lines 2 and 3, and the line that closes.
    expect(blockCommentLines(lines)).toEqual([false, false, true, true, true, false]);
  });

  it("does not call code a comment because a comment shares its line", () => {
    const lines = [
      "  color: #fff; /* the brand white */",
      "  background: rgb(1 2 3);",
    ];
    expect(blockCommentLines(lines)).toEqual([false, false]);
  });

  it("closes on the line that closes, not the one after", () => {
    expect(blockCommentLines(["/* a */", "  color: #fff;"])).toEqual([false, false]);
  });

  /**
   * The point of the whole thing, on the real file: the ladder's own table of
   * hexes is documentation and the rule is silent about it, while a raw colour
   * in a declaration is still caught.
   */
  it("so globals.css can document a hex without violating a rule about hexes", () => {
    const css = readFileSync(join(ROOT, "src", "app", "globals.css"), "utf-8")
      .replace(/\r\n/g, "\n")
      .split("\n");
    const ids = [...violationsIn("src/app/globals.css", css).keys()].map((k) => k.split("::")[0]);
    expect(ids).not.toContain("no-raw-colour-in-css");

    const planted = [...css, "  .thing { box-shadow: 0 0 5px rgb(34 211 238 / 0.6); }"];
    const after = [...violationsIn("src/app/globals.css", planted).keys()].map(
      (k) => k.split("::")[0],
    );
    expect(after).toContain("no-raw-colour-in-css");
  });
});

/**
 * The strings that decide what every control in the product looks like, none of
 * which a tag-scoped pass or a class-per-element assertion can see. The live
 * gate measures them on the screen; this is what a mutation sweep can reach,
 * and the sweep is what proves an assertion can fail.
 */
describe("the shared control bases wear the control rung", () => {
  it.each([
    ["the text input base", "src/lib/ui/theme.ts", "baseInputStyles"],
    ["the field primitive's base", "src/components/ui/field/Input.tsx", "BASE"],
    // The path moved in U8 (T-0122): Button's chrome was extracted so
    // IconButton wears the same one and the two cannot drift. The assertion is
    // unchanged and still reads the string that decides the control's edge -
    // it is now one file further along.
    ["the secondary button", "src/components/ui/button-chrome.ts", "bg-ps-surface-raised"],
  ])("%s carries edge, not hairline", (_what, path, near) => {
    const source = read(path);
    const at = source.indexOf(near);
    expect(at).toBeGreaterThan(-1);
    // The declaration and the two lines that follow it: these are one string
    // each, wrapped, and the class always sits within them.
    const window = source.slice(at, at + 600);
    expect(window).toContain("border-ps-edge");
    expect(window).not.toContain("border border-ps-edge-hairline");
  });
});
