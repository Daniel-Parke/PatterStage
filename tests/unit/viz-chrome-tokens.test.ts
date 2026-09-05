/** @jest-environment node */
// ═══════════════════════════════════════════════════════════════
// Chart chrome is a token, and chart text is a text tier (T-0034, finding 3).
//
// The finding as filed said "nineteen raw colours, mostly per-series chart
// colours". Reading them says otherwise, and the correction matters because it
// changes the fix: the series colours already go through a named scale
// (src/components/viz/colors.ts, `neon()` / `neonAlpha()`, resolving to the
// --color-neon-* tokens). What was left inline is the chrome around the data —
// guide rings, baselines, gauge tracks, an empty heatmap cell, the graph edge
// that is not on the live path — plus two SVG <text> fills and the two reader
// chapter-dot state maps.
//
// They are legitimate values in the wrong place, so they move into
// globals.css and the components reference them. Two of them were something
// worse than misplaced: the axis labels were painted white at 30% and 35%,
// below the `faint` tier's 50% floor, which the Tokens section calls the
// quietest thing still meant to be READ. They move onto the tier, not onto a
// new rung, because a fifth text colour below the floor is exactly what the
// four derived tiers exist to prevent.
//
// This test holds three things a reader cannot see by looking at a chart:
// the tokens exist, the components stopped carrying literals, and no chart
// paints text at an alpha the contrast gate never measured.
// ═══════════════════════════════════════════════════════════════

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const CSS = readFileSync(join(ROOT, "src/app/globals.css"), "utf-8");

/** Every custom property globals.css declares, with its value. */
function declaredTokens(): Map<string, string> {
  const found = new Map<string, string>();
  for (const m of CSS.matchAll(/^\s*(--[a-z0-9-]+):\s*([^;]+);/gm)) found.set(m[1], m[2].trim());
  return found;
}

function tsxUnder(dir: string): string[] {
  const out: string[] = [];
  (function walk(d: string) {
    for (const e of readdirSync(d)) {
      const p = join(d, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith(".tsx")) out.push(p);
    }
  })(join(ROOT, dir));
  return out;
}

/** The same literal-colour pattern design-lint's `no-raw-colour-in-tsx` uses. */
const RAW_COLOUR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(\s*\d/;

describe("the viz chrome scale", () => {
  const tokens = declaredTokens();

  it.each([
    ["--color-ps-viz-empty", "rgb(255 255 255 / 0.04)"],
    ["--color-ps-viz-guide", "rgb(255 255 255 / 0.05)"],
    ["--color-ps-viz-track", "rgb(255 255 255 / 0.06)"],
    ["--color-ps-viz-axis", "rgb(255 255 255 / 0.08)"],
    ["--color-ps-viz-inert", "rgb(255 255 255 / 0.15)"],
    ["--color-ps-viz-glyph-idle", "rgb(255 255 255 / 0.22)"],
    ["--color-ps-viz-scrim", "rgb(0 0 0 / 0.6)"],
  ])("declares %s as %s", (token, value) => {
    expect(tokens.get(token)).toBe(value);
  });

  it("records the values the tree already painted rather than repainting them", () => {
    // Every rung above is an alpha that was already inline somewhere in
    // src/components/viz, achievements or composer on 2026-08-25. Naming is
    // not migration: if a rung is ever RE-VALUED, that is a design decision
    // and it belongs in the lock-book's Tokens section, not in a refactor.
    const alphas = [...CSS.matchAll(/--color-ps-viz-[a-z-]+:\s*rgb\((?:255 255 255|0 0 0) \/ ([\d.]+)\)/g)]
      .map((m) => Number(m[1]));
    expect(alphas.length).toBeGreaterThanOrEqual(7);
    for (const a of alphas) expect(a).toBeGreaterThan(0);
  });
});

describe("the reader chapter-state scale", () => {
  const tokens = declaredTokens();

  it.each([
    "--ps-reader-chapter-done",
    "--ps-reader-chapter-writing",
    "--ps-reader-chapter-pending",
    "--ps-reader-chapter-failed",
    "--ps-reader-chapter-idle",
  ])("declares %s", (token) => {
    expect(tokens.has(token)).toBe(true);
  });

  it("mints no colour for the idle state, which is the panel rule it already was", () => {
    expect(tokens.get("--ps-reader-chapter-idle")).toBe("var(--ps-reader-rule)");
  });
});

describe("the components carry no literal colour", () => {
  const files = [
    ...tsxUnder("src/components/viz"),
    ...tsxUnder("src/components/achievements"),
    ...tsxUnder("src/components/composer"),
    ...tsxUnder("src/modules/rec-room/components"),
  ];

  it("has files to check", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it.each([
    "src/components/viz/RadialActivityClock.tsx",
    "src/components/viz/DistributionHistogram.tsx",
    "src/components/viz/ActivityHeatmap.tsx",
    "src/components/viz/Donut.tsx",
    "src/components/viz/StackedAreaTrend.tsx",
    "src/components/achievements/AchievementBadge.tsx",
    "src/components/achievements/StreakFlame.tsx",
    "src/components/composer/WorkflowCanvas.tsx",
    "src/components/composer/WorkflowRunCanvas.tsx",
    "src/modules/rec-room/components/ReaderHeader.tsx",
    "src/modules/rec-room/components/ReaderNavigation.tsx",
  ])("%s", (rel) => {
    const src = readFileSync(join(ROOT, rel), "utf-8");
    const offenders = src
      .split("\n")
      .map((line, i) => ({ line, n: i + 1 }))
      // The pragma escape design-lint honours, honoured here too.
      .filter(({ line }) => RAW_COLOUR.test(line))
      .map(({ line, n }) => `${n}: ${line.trim().slice(0, 90)}`);
    expect(offenders).toEqual([]);
  });
});

describe("no chart paints text below the measured tiers", () => {
  // The axis labels were white/30 and white/35 against a background the
  // contrast gate measures at white/50 for the quietest READABLE tier. A
  // literal alpha on an SVG fill is invisible to both gates: design-lint sees
  // a colour, not a text colour, and contrast-check only knows the four
  // --color-ps-text-* tokens. This is the only thing that looks.
  const files = tsxUnder("src/components/viz");

  it("has charts to check, so an empty walk cannot read as a pass", () => {
    // The denominator this describe never had (T-0066, closed in T-0075).
    // `expect(bad).toEqual([])` is satisfied just as well by finding nothing to
    // look at as by finding nothing wrong, and the two are indistinguishable
    // from the outside. Measured at 10.
    expect(files.length).toBeGreaterThanOrEqual(8);
  });

  it.each(["fill", "color"])("uses no bare white alpha for an SVG %s", (attr) => {
    const bad: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, "utf-8");
      for (const [i, line] of src.split("\n").entries()) {
        if (new RegExp(`${attr}=["'{]?\\s*["']?rgba?\\(`, "i").test(line)) {
          bad.push(`${f.replace(ROOT, "").replace(/\\\\/g, "/")}:${i + 1}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("points the axis labels at a tier the contrast gate measures", () => {
    const clock = readFileSync(join(ROOT, "src/components/viz/RadialActivityClock.tsx"), "utf-8");
    const histo = readFileSync(join(ROOT, "src/components/viz/DistributionHistogram.tsx"), "utf-8");
    expect(clock).toContain("var(--color-ps-text-faint)");
    expect(histo).toContain("var(--color-ps-text-faint)");
  });
});
