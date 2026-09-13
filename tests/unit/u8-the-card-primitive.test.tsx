/**
 * U8 (T-0122): the Surface primitive learns the two things that were stopping
 * 57 files from using it - and a gate for a byte nobody can see.
 *
 * U8 BUILDS the primitive set; it does not adopt it. That is U9-U13's job, and
 * the separation is deliberate: this batch is already XL, and a 57-site JSX
 * rewrite landing in the same commit as nine new components would make one
 * unreviewable diff out of two independent failure modes. So no screen changes
 * here, and Playwright is untouched.
 *
 * What DID come out of measuring the adoption is why it cannot happen yet.
 * Fifty-seven elements outside `ui/` spell `Card`'s three classes character for
 * character, and the primitive could not have absorbed them:
 *
 *   THE RUNG. Seventeen spell `bg-ps-surface-raised` rather than
 *   `bg-ps-surface-panel`, and they are right to. A card nested inside a panel
 *   already painted at the panel rung is the same fill as its own parent, so it
 *   reads as a rule rather than a surface. `Card` had one fill, so converting
 *   those would have flattened them. `variant` carries it.
 *
 *   THE ELEMENT. Nine are a `<section>`, `<header>` or `<article>`, not a
 *   `<div>`. `Card` renders a div, so converting them would have silently
 *   deleted nine landmarks from the accessibility tree - a chrome change that
 *   quietly costs a screen-reader user the ability to navigate the page. `as`
 *   carries it, constrained to the container elements, so the conversion
 *   batches can keep an outline they would otherwise have had to abandon.
 *
 * Neither is a new decision. Both already existed in the tree, spelled by hand,
 * 57 times; this is the primitive catching up to what its callers already knew.
 *
 * ── and the byte ──────────────────────────────────────────────
 *
 * `\b` written into a patch script through a shell heredoc becomes 0x08, a real
 * backspace, and every tool here renders it invisibly. It has cost this
 * programme three debugging sessions: a design-lint regex that required a
 * backspace and so reported zero violations for the wrong reason; a codemod
 * guard that could never fire; and one that predates the programme entirely -
 * `log-line-severity.ts:25` has carried one since 2026-08-25, where it turned a
 * sentence about a word boundary into nonsense.
 *
 * In a comment it is harmless. In a regex it is a gate that passes for the
 * wrong reason, and the two are one keystroke apart. So the answer is not "be
 * careful with heredocs", it is a test: no source file holds a control
 * character that is not a tab, a newline or a carriage return. One walk of the
 * tree ends the whole class.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { render } from "@testing-library/react";

import Card from "@/components/ui/Card";

const ROOT = join(__dirname, "..", "..");

/** Source we author, by extension. Binaries and generated caches are not it. */
const TEXT = /\.(?:ts|tsx|mjs|cjs|js|jsx|css|json|md|py|sh|yml|yaml)$/;
const SKIP = new Set([
  "node_modules",
  ".next",
  "__pycache__",
  "dist",
  "build",
  "coverage",
  "playwright-report",
  "test-results",
]);

function sources(...roots: string[]): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const walk = (dir: string, rel: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (SKIP.has(entry.name)) continue;
      const full = join(dir, entry.name);
      const path = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(full, path);
      else if (TEXT.test(entry.name)) out.push([path, readFileSync(full, "utf-8")]);
    }
  };
  for (const root of roots) walk(join(ROOT, root), root);
  return out;
}

const chromeOf = (el: Element) => (el.getAttribute("class") ?? "").split(/\s+/);

describe("Card carries the rung it sits on", () => {
  it("paints the panel rung by default", () => {
    const { container } = render(<Card>body</Card>);
    expect(chromeOf(container.firstElementChild!)).toContain("bg-ps-surface-panel");
  });

  it("paints the raised rung when a card sits inside another surface", () => {
    const { container } = render(<Card variant="raised">body</Card>);
    const chrome = chromeOf(container.firstElementChild!);
    expect(chrome).toContain("bg-ps-surface-raised");
    expect(chrome).not.toContain("bg-ps-surface-panel");
  });

  /**
   * The whole reason to have a primitive: the rung is the ONLY thing `variant`
   * moves. A radius or an edge that changed with it would be two cards again.
   */
  it("keeps one radius and one edge on both rungs", () => {
    for (const variant of ["panel", "raised"] as const) {
      const { container } = render(<Card variant={variant}>body</Card>);
      const chrome = chromeOf(container.firstElementChild!);
      expect(chrome).toContain("rounded-ps-lg");
      expect(chrome).toContain("border");
      expect(chrome).toContain("border-ps-edge-hairline");
    }
  });
});

describe("Card keeps the element its caller was using", () => {
  it("is a div by default, as it always was", () => {
    const { container } = render(<Card>body</Card>);
    expect(container.firstElementChild!.tagName).toBe("DIV");
  });

  it.each([
    ["section", "SECTION"],
    ["header", "HEADER"],
    ["article", "ARTICLE"],
    ["aside", "ASIDE"],
  ])("renders a real <%s> so the landmark survives", (as, tag) => {
    const { container } = render(<Card as={as as "section"}>body</Card>);
    expect(container.firstElementChild!.tagName).toBe(tag);
  });

  /** The chrome is the chrome whatever the element is; that is the point. */
  it("paints the same chrome whichever element it is", () => {
    const div = render(<Card>body</Card>).container.firstElementChild!;
    const section = render(<Card as="section">body</Card>).container.firstElementChild!;
    expect(chromeOf(section)).toEqual(chromeOf(div));
  });

  /**
   * A primitive that cannot be identified cannot be adopted. The first screen
   * converted onto Card (U9's Automation view, T-0123) needed to name its rows,
   * and Card typed its props exactly - so `data-testid` was silently dropped
   * and the only way to keep one was to keep the div.
   */
  it("carries an id and a test id through to the element", () => {
    const { container } = render(
      <Card id="row-1" data-testid="automation-row-s1">
        body
      </Card>,
    );
    const el = container.firstElementChild!;
    expect(el.getAttribute("id")).toBe("row-1");
    expect(el.getAttribute("data-testid")).toBe("automation-row-s1");
  });

  /**
   * The glow slot is the other half of the primitive, and it renders through a
   * different component. An `as` that only worked without a glow would be a
   * capability with a hole in it, which is how the sites being absorbed get
   * split back into two treatments.
   */
  it("keeps the element when it is also glowing", () => {
    const { container } = render(
      <Card as="section" glow="cyan">
        body
      </Card>,
    );
    expect(container.firstElementChild!.tagName).toBe("SECTION");
    expect(chromeOf(container.firstElementChild!)).toContain("glow-surface");
  });
});

describe("no source file carries an invisible byte", () => {
  // Tab, newline and carriage return are the only control characters a source
  // file has any business holding. Everything else in C0, plus DEL, is either
  // a heredoc accident or something worse.
  const CONTROL = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/;

  it("finds none in src, scripts or tests", () => {
    const offenders: string[] = [];
    for (const [path, source] of sources("src", "scripts", "tests")) {
      source.split("\n").forEach((line, i) => {
        const hit = CONTROL.exec(line);
        if (hit) {
          offenders.push(
            `${path}:${i + 1} holds 0x${hit[0].charCodeAt(0).toString(16).padStart(2, "0")}`,
          );
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  /** Anti-vacuity: the walk must be reading a real tree, and the test must trip. */
  it("is looking at a real tree, and would trip", () => {
    expect(sources("src").length).toBeGreaterThan(300);
    expect(CONTROL.test("ended in \b, so it could never match")).toBe(true);
    expect(CONTROL.test("ended in `\\b`, so it could never match")).toBe(false);
  });
});
