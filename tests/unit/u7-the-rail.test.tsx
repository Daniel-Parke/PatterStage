/**
 * U7 (T-0121): the rail gets a hierarchy, and loses a tier.
 *
 * U4 gave the rail a surface it can be seen against - 1.06:1 to 1.47:1, with a
 * 3:1 seam. What it still has no hierarchy INSIDE it: 63 elements share one
 * tone, so a section heading, an item label, an icon and the active row are all
 * the same weight, and "you are here" has nowhere to go. Every accent the
 * registry declares per destination is spent on one icon, one row at a time.
 *
 * Four changes, and one deletion the operator signed off.
 *
 *   HIERARCHY. Item labels sit on `secondary` rather than `muted`, so the
 *   active row can be `primary` and mean something. Icons sit BELOW their
 *   labels rather than beside them at the same weight: an icon is a landmark,
 *   not a second label.
 *
 *   "YOU ARE HERE" is an edge-anchored bar in the destination's own registry
 *   colour, not a fill. A fill is what the hover uses, so with both spent on
 *   fills there is nothing left to distinguish them; and the accent-per-domain
 *   idea is stated once per section instead of once per hovered row.
 *
 *   HIT TARGETS. Collapsed, a row is 39x22 - under the 24x24 WCAG 2.5.8 asks
 *   and SMALLER than the same row expanded, which is the wrong way round for a
 *   mode whose whole purpose is to be reachable.
 *
 *   NO FLASH. The collapse preference is read on the client, so the rail paints
 *   expanded and then snaps narrow on every hard load. It is server-rendered
 *   now, and `transition-all` narrows to `transition-[width]` so the colours do
 *   not animate on every navigation.
 *
 *   THE SUB-LINK TIER GOES (decision 8). Two links carried it - Settings, with
 *   Restore and System, and Story Weaver with four - and both destinations
 *   already carry full in-page navigation to exactly those places. It is the
 *   only part of the rail whose height is unbounded by the registry, and it is
 *   what pushes the rail past 720px at 1280x720.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { MODULES, labelFor } from "@/lib/modules/registry";

const ROOT = join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf-8").replace(/\r\n/g, "\n");

/** Lines of a source that are code rather than comment. */
const code = (source: string) =>
  source
    .split("\n")
    .filter((l) => {
      const t = l.trimStart();
      return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*") && !t.startsWith("{/*");
    })
    .join("\n");

describe("the sub-link tier is gone", () => {
  it("no registry entry declares one", () => {
    for (const mod of MODULES) {
      for (const section of mod.nav ?? []) {
        for (const link of section.links) {
          expect(link).not.toHaveProperty("subLinks");
        }
      }
    }
  });

  it.each([
    ["the registry's own type", "src/lib/modules/types.ts"],
    ["the presentation adapter", "src/components/layout/sidebar-config.ts"],
    ["the rail", "src/components/layout/Sidebar.tsx"],
  ])("nor does %s", (_what, path) => {
    expect(code(read(path))).not.toMatch(/subLinks/);
  });

  /**
   * The job that SURVIVED decision 8. `subLinks` was doing two things and only
   * one was the rail's: `labelFor` read the sub-link's label, so deleting the
   * field outright made /agent/settings/restore title itself "Settings" and
   * /recroom/story-weaver/create title itself "Story Weaver". `childRoutes`
   * keeps the naming and drops the tier.
   */
  // Amended 2026-09-07 (U12, T-0126): Story Weaver has one child route now.
  // The library is the page at /recroom/story-weaver and Characters and
  // Themes are panels on Create, so three of the six names here retired
  // with their routes.
  it.each([
    ["/agent/settings/restore", "Restore"],
    ["/agent/settings/system", "System"],
    ["/recroom/story-weaver/create", "Create"],
  ])("the registry still names %s", (href, label) => {
    expect(labelFor(href)).toBe(label);
  });

  /**
   * Both destinations already carry full in-page navigation to exactly the
   * places the tier duplicated, which is why deleting it removes a tier rather
   * than a route. The routes themselves are untouched.
   */
  it("and the three routes it still names exist", () => {
    for (const href of [
      "/agent/settings/restore",
      "/agent/settings/system",
      "/recroom/story-weaver/create",
    ]) {
      const segments = href.replace(/^\//, "").split("/");
      expect(() =>
        readFileSync(join(ROOT, "src", "app", ...segments, "page.tsx")),
      ).not.toThrow();
    }
  });
});

describe("the rail has a hierarchy", () => {
  const rail = () => code(read("src/components/layout/Sidebar.tsx"));

  /**
   * The whole point: an inactive row must not already be the quietest thing on
   * the rail, or the active one has nowhere to go. Labels move up a tier so
   * that they can.
   */
  /**
   * The ROW's own class expression, not the file. The collapse button carries
   * `hover:text-ps-text-secondary`, so a file-wide match is answered by a
   * control at the other end of the rail.
   */
  it("gives an inactive row the secondary tier, not the muted one", () => {
    const source = rail();
    const at = source.indexOf("hover:bg-ps-surface-raised hover:text-ps-text-primary");
    expect(at).toBeGreaterThan(-1);
    const rowClasses = source.slice(Math.max(0, at - 60), at + 60);
    expect(rowClasses).toContain("text-ps-text-secondary");
    expect(rowClasses).not.toContain("text-ps-text-muted");
  });

  /**
   * The bar's own shape: anchored to the row's left edge, narrow, and rounded
   * only on the side that leaves the edge. A fill alone cannot say "you are
   * here", because a fill is what hover says.
   */
  it("and marks where you are with a bar rather than only a fill", () => {
    const source = rail();
    expect(source).toMatch(/absolute left-0/);
    expect(source).toMatch(/w-\[3px\]/);
  });

  /**
   * The accent per destination is the registry's, and the rail is where it is
   * spent. Spending it on one hovered icon at a time is spending it on nothing.
   */
  /**
   * The MAP, named. `iconColorMap` also appears in this file - it is the
   * icon's - so asking whether the file mentions "a colour map" is answered by
   * the wrong one, and the bar could go grey with the assertion still green.
   */
  it("paints that bar in the destination's own registry colour", () => {
    expect(rail()).toMatch(/railAccentBarMap\[link\.color\]/);
  });
});

describe("a collapsed row is reachable", () => {
  const rail = () => code(read("src/components/layout/Sidebar.tsx"));

  /**
   * 39x22 collapsed against 24x24 (WCAG 2.5.8 at AA), and smaller than the same
   * row expanded. A mode that exists to be reachable cannot be the mode with
   * the smallest targets.
   */
  it("is at least as tall as it is when expanded", () => {
    expect(rail()).toMatch(/h-10|min-h-10|size-10/);
  });
});

describe("the rail does not flash", () => {
  it("takes its collapsed state from the server", () => {
    const layout = code(read("src/app/layout.tsx"));
    expect(layout).toMatch(/collapsed|railCollapsed/);
  });

  /**
   * `transition-all` animates colour on every navigation as well as width on
   * every toggle, so the active row fades in rather than appearing.
   */
  it("and animates its width only", () => {
    const rail = code(read("src/components/layout/Sidebar.tsx"));
    expect(rail).not.toMatch(/transition-all/);
    expect(rail).toMatch(/transition-\[width\]/);
  });
});

describe("the product is named once", () => {
  /**
   * The mobile header branded the product "PT / Hermes" while the rail's own
   * lockup says "PatterStage". One mark, one name.
   */
  it("the mobile header wears the same mark as the rail", () => {
    // The header is a function of the rail's own file since C6 (T-0143).
    const header = code(read("src/components/layout/Sidebar.tsx"));
    expect(header).toMatch(/function MobileHeader\b/);
    expect(header).not.toMatch(/Hermes/);
    expect(header).toMatch(/BrandMark/);
  });

  /**
   * The ELEMENT, not the import. `toMatch(/BrandMark/)` is answered by the
   * import line, so the rail could go back to drawing its own square with the
   * assertion still green.
   */
  it("and there is exactly one place that draws it", () => {
    // The mark is a function of the rail's file since C6 (T-0143): its one
    // importer was the rail once the mobile header moved in. Drawn there once,
    // placed twice: the rail's lockup and the mobile header's mark.
    const rail = code(read("src/components/layout/Sidebar.tsx"));
    expect(rail.match(/function BrandMark\b/g)).toHaveLength(1);
    expect(rail.match(/<BrandMark\b/g)).toHaveLength(2);
    // And nobody redraws the mark by hand: its ring is spelled once, in it.
    expect(rail.match(/animated-border/g)).toHaveLength(1);
  });
});
