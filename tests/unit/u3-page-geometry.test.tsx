/**
 * U3 (T-0117): one container owns the left edge.
 *
 * `AppPageShell` owns no measure, so twenty pages centre their own column in
 * one of seven widths and nine declare none at all, in eight different padding
 * rhythms. The sticky header sits at a fixed x while the body moves under it,
 * and the measured result is that on 21 of 23 routes the h1 does not share a
 * left edge with the content beneath it: by up to 289px. On /results/artifacts
 * the header bar's own bottom rule stops 180px short of both viewport edges,
 * pointing at nothing.
 *
 * The fix is structural rather than a list of corrections. The shell takes the
 * header as a PROP and renders it full-bleed, with its CONTENT inside the same
 * container as the body, so the two edges cannot disagree. A child cannot be
 * both full-bleed and contained, which is why the header stops being a child.
 *
 * `density` decides what happens inside that container and never what the
 * container is. `prose` is left-aligned rather than centred on purpose: a
 * second centred container is exactly what puts one screen's content 400px
 * from its neighbour's.
 */
import { render, screen } from "@testing-library/react";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import AppPageShell, { PAGE_MEASURE } from "@/components/layout/AppPageShell";
import { violationsIn } from "../../scripts/tooling/design-lint.mjs";

const ROOT = join(__dirname, "..", "..");

/** Every page component's source, keyed by its path under src/app. */
function pages(): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const base = join(ROOT, "src", "app");
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === "page.tsx") {
        out.push([
          full.slice(base.length + 1).split("\\").join("/"),
          readFileSync(full, "utf-8").replace(/\r\n/g, "\n"),
        ]);
      }
    }
  };
  walk(base);
  return out;
}

/** Lines of a source that are code rather than comment. */
const codeLines = (source: string): string[] =>
  source.split("\n").filter((l) => {
    const t = l.trimStart();
    return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*") && !t.startsWith("{/*");
  });

describe("the shell owns the measure", () => {
  it("puts the header's content and the body in the same container", () => {
    const { container } = render(
      <AppPageShell header={<h1>Missions</h1>}>
        <p>body</p>
      </AppPageShell>,
    );
    const measured = [...container.querySelectorAll("[data-ps-container]")];
    expect(measured).toHaveLength(2);
    const [headerBox, bodyBox] = measured;
    // The same MEASURE, verbatim: the same max-width and the same horizontal
    // padding, which between them are what decide a left edge. Not the same
    // whole class string, because a pane's container also has to fill the
    // remaining height and the header's must not become a column.
    expect(headerBox.className).toContain(PAGE_MEASURE);
    expect(bodyBox.className).toContain(PAGE_MEASURE);
    expect(headerBox.contains(screen.getByRole("heading"))).toBe(true);
    expect(bodyBox.textContent).toContain("body");
  });

  it("names one measure and it is the page's", () => {
    const { container } = render(<AppPageShell header={<h1>x</h1>}>b</AppPageShell>);
    for (const box of container.querySelectorAll("[data-ps-container]")) {
      expect(box.className).toContain("max-w-ps-page");
      expect(box.className).toContain("mx-auto");
    }
  });

  it("leaves the header BAR full-bleed, outside that container", () => {
    const { container } = render(<AppPageShell header={<h1>x</h1>}>b</AppPageShell>);
    const bar = container.querySelector("header");
    expect(bar).not.toBeNull();
    expect(bar!.querySelector("[data-ps-container]")).not.toBeNull();
    // The bar itself must not be measured, or its rule stops short of the
    // viewport edge, which is what /results/artifacts does today.
    expect(bar!.hasAttribute("data-ps-container")).toBe(false);
    expect(bar!.className).not.toContain("max-w-");
    // And no gutter of its own. The container inside it already pads; a bar
    // that pads as well indents the header's words past the body's by a whole
    // gutter on every screen, which is this batch's defect at a smaller size.
    // It carried px-6 until T-0117 for exactly that reason.
    expect(bar!.className).not.toMatch(/(?:^|[\s:])p[xl]-/);
  });

  it("renders no header bar at all when a page has no header", () => {
    const { container } = render(<AppPageShell>b</AppPageShell>);
    expect(container.querySelector("header")).toBeNull();
    expect(container.querySelectorAll("[data-ps-container]")).toHaveLength(1);
  });

  it("keeps the shell's own background and grid", () => {
    const { container } = render(<AppPageShell>b</AppPageShell>);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("min-h-screen");
    expect(root.className).toContain("grid-bg");
  });
});

describe("density decides what is inside the container, never what it is", () => {
  const shell = (density?: "board" | "prose" | "pane") =>
    render(
      <AppPageShell header={<h1>x</h1>} density={density}>
        <p>body</p>
      </AppPageShell>,
    ).container;

  it.each(["board", "prose", "pane"] as const)("marks the body as %s", (density) => {
    expect(shell(density).querySelector(`[data-ps-density='${density}']`)).not.toBeNull();
  });

  it("defaults to board, because most of this product is a board", () => {
    expect(shell().querySelector("[data-ps-density='board']")).not.toBeNull();
  });

  /**
   * The whole point of the density prop. Whatever it does, the CONTAINER is the
   * same one the header used, so the left edge cannot move between screens.
   */
  it.each(["board", "prose", "pane"] as const)(
    "leaves the measure alone at %s, so the left edge never moves",
    (density) => {
      const boxes = [...shell(density).querySelectorAll("[data-ps-container]")];
      expect(boxes).toHaveLength(2);
      for (const box of boxes) expect(box.className).toContain(PAGE_MEASURE);
      // And no second width anywhere on the container itself: two max-widths on
      // one element are resolved by the order the rules happen to sit in the
      // emitted stylesheet, which no call site can see.
      for (const box of boxes) {
        expect(box.className.match(/\bmax-w-[\w-]+/g)).toEqual(["max-w-ps-page"]);
      }
    },
  );

  it("gives prose a narrower column that is LEFT aligned, not centred", () => {
    const col = shell("prose").querySelector("[data-ps-density='prose']") as HTMLElement;
    expect(col.className).toContain("max-w-ps-prose");
    // Centring it is the defect, not the fix: a second centred container is
    // what moves one screen's content 400px from its neighbour's.
    expect(col.className).not.toContain("mx-auto");
  });

  it("gives a pane no padding, so a split view can reach the edges", () => {
    const pane = shell("pane").querySelector("[data-ps-density='pane']") as HTMLElement;
    expect(pane.className).not.toMatch(/\bp[xy]?-\d/);
    const board = shell("board").querySelector("[data-ps-density='board']") as HTMLElement;
    expect(board.className).toMatch(/\bpy-/);
  });
});

describe("and no page owns a measure of its own", () => {
  it("has pages to check, so none of this passes vacuously", () => {
    expect(pages().length).toBeGreaterThan(25);
  });

  /**
   * Not "no page may ever cap a width". Capping a paragraph at a reading
   * measure is something this programme asks for, and centring a 12px icon in
   * an empty state is not a layout decision. What a page may not own is a
   * container at the PAGE's own scale: seven of those across twenty pages are
   * what produced eight left gutters and eight content widths at 1920.
   */
  const PAGE_SCALE = /\bmax-w-(?:4xl|5xl|6xl|7xl|screen-[\w-]+|ps-[\w-]+)\b/;

  it("no page declares a container at the page's own scale", () => {
    const offenders = pages()
      .filter(([, source]) => codeLines(source).some((l) => PAGE_SCALE.test(l)))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });

  /**
   * Every page goes through the shell, including the two that did not: the
   * dashboard wrote its own header bar and was the only screen with no
   * <header> element at all, and the composer was the only page of 29 not on
   * AppPageShell.
   */
  it("every page renders through AppPageShell", () => {
    const offenders = pages()
      .filter(([path]) => !path.startsWith("help/"))
      .filter(([, source]) => !source.includes("AppPageShell"))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });

  /**
   * The bar's CHROME, not the <header> tag. The dashboard painted its own bar
   * with shellHeaderBarClasses inside a plain <div>, so a tag ban misses the
   * only real offender; and /quests renders a <header> that is a banner for
   * the quest list, inside <main>, which is not a landmark and not a bar.
   * shellHeaderBarClasses now belongs to AppPageShell and to nothing else.
   */
  it("and hands it a header rather than writing its own bar", () => {
    const offenders = pages()
      .filter(([, source]) => source.includes("shellHeaderBarClasses"))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });

  /**
   * PageHeader is the header's CONTENT now. If it still rendered the <header>
   * element there would be two, and the inner one would be measured, which is
   * the defect this batch removes.
   */
  it("and PageHeader no longer renders a bar of its own", () => {
    const source = readFileSync(
      join(ROOT, "src", "components", "layout", "PageHeader.tsx"),
      "utf-8",
    );
    expect(codeLines(source).some((l) => /<header[\s>]/.test(l))).toBe(false);
  });
});

/**
 * The gate that keeps this true after the batch. U2 registered
 * one-container-per-page as "any max-w- on a page"; that also banned holding a
 * paragraph to a reading measure, which the programme asks for, and centring a
 * 12px icon in an empty state, which is not a layout decision. It names the
 * page's own scale now, so the cases that matter most are the ones it must
 * LEAVE ALONE: a rule that fires on the replacement as well as the original is
 * a rule nobody can satisfy.
 */
describe("the rule that holds this names a container, not every cap", () => {
  const trips = (line: string): string[] =>
    [...violationsIn("src/app/work/missions/page.tsx", [line]).keys()].map(
      (k) => k.split("::")[0],
    );
  const fires = (line: string) => trips(line).includes("one-container-per-page");

  it.each([
    ['className="max-w-7xl mx-auto px-6 py-6"', "the dashboard's own column"],
    ['className="max-w-screen-xl mx-auto w-full px-6"', "missions' own column"],
    ['className="max-w-4xl mx-auto px-6 py-8 flex-1 w-full"', "the rec room's"],
    ['className="mx-auto w-full max-w-ps-page px-6"', "the shell's measure, on a page"],
  ])("refuses %s", (line) => {
    expect(fires(line as string)).toBe(true);
  });

  it.each([
    ['<p className="prose max-w-3xl text-sm">', "a paragraph at a reading measure"],
    ['<div className="relative max-w-md">', "a search field"],
    ['<div className="max-w-ps-prose">', "the house prose measure, which is the answer"],
    ['<img className="max-w-full" />', "an image told not to overflow its box"],
  ])("allows %s", (line) => {
    expect(fires(line as string)).toBe(false);
  });
});
