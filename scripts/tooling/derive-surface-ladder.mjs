#!/usr/bin/env node
/**
 * Derive the surface and edge ladder from target contrast (U2, T-0116).
 *
 * The four text tiers in globals.css are DERIVED rather than chosen: white at
 * 92/70/55/50 percent because those are the alphas that clear AA against the
 * painted ground, with the derivation written beside the values and
 * re-checkable by contrast-check.mjs. The surfaces were not. They were named
 * for how they look (dark-950, dark-900, dark-800) and the result, measured
 * across the running product, is that the whole ladder spans 1.00 to 1.19:1
 * against the page and the rail is invisible at 1.06:1.
 *
 * This applies the text tiers' method to surfaces. Given the painted ground and
 * a hue to travel along, it solves for the colour at each target ratio, so the
 * ladder is a consequence of a requirement rather than a preference. Change the
 * requirement and re-run; do not hand-edit the values it produced.
 *
 *   node scripts/tooling/derive-surface-ladder.mjs            # the table
 *   node scripts/tooling/derive-surface-ladder.mjs --css      # paste-able CSS
 *
 * The hue ray is taken from the existing ladder's own top rung so the new
 * surfaces sit on the line the palette already travelled: #263d54 is
 * 38:61:84, a cold blue-slate, and every rung below is a scaling of it. The
 * identity is not up for grabs here; only the spacing is.
 */

/** The page, unchanged. Everything is measured against what is actually painted. */
export const GROUND = "#040b12";

/**
 * Two rays, because a surface and a rule are not the same object.
 *
 * SURFACE is the palette's own, taken from the brightest existing rung
 * (#263d54 is 38:61:84), so the new surfaces sit on the line the palette
 * already travelled and the identity is unchanged.
 *
 * RULE is far less saturated. A 1px stroke on the surface ray, at the 3:1 WCAG
 * asks of a component boundary, comes out a mid blue that reads as a coloured
 * line rather than as an edge. Cooling and desaturating it keeps the blue cast
 * of the console without drawing a stripe round every card.
 */
export const HUE = [38, 61, 84];
export const RULE_HUE = [86, 96, 108];

/**
 * What each rung is FOR, and the ratio that follows from it.
 *
 * `panel` and `raised` are separations the eye has to resolve between two large
 * areas, where 1.45:1 is about the point a boundary reads without a rule. The
 * three edge rungs are 1px strokes, and WCAG 1.4.11 asks 3:1 of the one that
 * identifies a component. `edge` therefore has to clear 3:1 against BOTH
 * surfaces it can sit between, which is why it solves against the brighter of
 * the two rather than against the page.
 */
export const LADDER = [
  { name: "panel", against: "ground", ratio: 1.45, why: "rail, header, card: a raised region the eye must resolve from the page" },
  { name: "raised", against: "panel", ratio: 1.45, why: "dialog, popover, active row: raised again, from the panel it sits on" },
  { name: "edge", against: "panel", ratio: 3.0, ray: "rule", why: "the boundary of a CONTROL, and the shell's own seams: WCAG 1.4.11 asks 3:1 of the boundary that identifies a component" },
  { name: "edge-hairline", against: "panel", ratio: 1.6, ray: "rule", why: "a card outline and a subdivision inside one surface. A card whose fill is already 1.47:1 from the page does not also need a 3:1 stroke to be found, and drawing one round every tile reads as wireframe. Checked in a browser against the alternative before it was written down." },
  { name: "edge-emphasis", against: "panel", ratio: 4.5, ray: "rule", why: "selected, armed or focused: a boundary that has to win against a boundary" },
];

const srgb = (v) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};

export const luminance = ([r, g, b]) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);

export const contrast = (a, b) => {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

export const hexToRgb = (hex) => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

export const rgbToHex = ([r, g, b]) =>
  "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

/** The hue ray at scale `k`, clamped to the byte range. */
export const along = (hue, k) => hue.map((c) => Math.min(255, Math.max(0, Math.round(c * k))));

/**
 * The dimmest colour ON the ray that is LIGHTER than `base` and reaches
 * `target` against it.
 *
 * A search over integer colours rather than an inversion of the luminance
 * formula, because the answer has to be a colour that can actually be written
 * as a hex: solving in the continuous domain and rounding afterwards lands
 * below the target about half the time, and a ladder that misses its own
 * requirement by a rounding error is exactly what this file exists to stop.
 *
 * The lighter-than check is not pedantry. `contrast()` is order-independent, so
 * without it the search returns the first colour on the ray at all: nearly
 * black, which clears 1.45:1 against the panel by being darker than it. Every
 * rung here is meant to come FORWARD from the one it names.
 */
export function solve(base, hue, target) {
  const baseL = luminance(base);
  for (let k = 1; k <= 4000; k++) {
    const rgb = along(hue, k / 100);
    if (luminance(rgb) <= baseL) continue;
    const got = contrast(rgb, base);
    if (got >= target) return { rgb, hex: rgbToHex(rgb), ratio: got, k: k / 100 };
  }
  throw new Error(`no colour on the ray reaches ${target}:1 above ${rgbToHex(base)}`);
}

export function derive() {
  const ground = hexToRgb(GROUND);
  const out = { ground: { hex: GROUND, rgb: ground, ratio: 1 } };
  for (const rung of LADDER) {
    const base = rung.against === "ground" ? ground : out.panel.rgb;
    const solved = solve(base, rung.ray === "rule" ? RULE_HUE : HUE, rung.ratio);
    out[rung.name] = { ...solved, against: rung.against, target: rung.ratio, why: rung.why };
  }
  return out;
}

function main() {
  const table = derive();
  const ground = hexToRgb(GROUND);
  const asCss = process.argv.includes("--css");

  if (!asCss) {
    console.log(`ground ${GROUND}, hue ray ${HUE.join(":")}\n`);
    console.log(
      "rung           hex       vs        target  actual   vs ground  vs panel",
    );
    for (const rung of LADDER) {
      const r = table[rung.name];
      console.log(
        "%s %s  %s  %s  %s   %s      %s",
        rung.name.padEnd(14),
        r.hex,
        r.against.padEnd(8),
        String(r.target).padEnd(6),
        r.ratio.toFixed(3),
        contrast(r.rgb, ground).toFixed(3).padStart(6),
        contrast(r.rgb, table.panel.rgb).toFixed(3).padStart(6),
      );
    }
    console.log("\nEvery rung is the FIRST colour on the ray that reaches its target, so");
    console.log("each is the dimmest value that satisfies the requirement rather than the");
    console.log("prettiest one that happens to.");
    return;
  }

  console.log(`  --color-ps-surface-ground: ${GROUND};`);
  console.log(`  --color-ps-surface-panel: ${table.panel.hex};`);
  console.log(`  --color-ps-surface-raised: ${table.raised.hex};`);
  console.log(`  --color-ps-edge: ${table.edge.hex};`);
  console.log(`  --color-ps-edge-hairline: ${table["edge-hairline"].hex};`);
  console.log(`  --color-ps-edge-emphasis: ${table["edge-emphasis"].hex};`);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("derive-surface-ladder.mjs")) {
  main();
}
