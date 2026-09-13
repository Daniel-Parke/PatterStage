#!/usr/bin/env node
/**
 * Contrast check for the text tiers and the surface ladder (T-0028, T-0116).
 *
 * The --color-ps-text-* tokens in globals.css are DERIVED from the app's
 * painted background, not chosen by eye. This re-derives them and fails if any
 * tier has drifted below the WCAG AA floor it claims to clear.
 *
 * It exists because the tiers are only trustworthy while the background they
 * were measured against stays put. Someone lightening --color-dark-950 would
 * silently push every tier toward the floor, and nothing else in the repo
 * would notice.
 *
 * The idea was right and the scope was too small. It only ever looked at TEXT,
 * so the surfaces those tiers sit on drifted to within 1.19:1 of one another
 * and no gate saw it: the rail measured 1.06:1 against the page beside it and
 * every rule in the product was a 1.25:1 hairline, against the 3:1 WCAG 1.4.11
 * asks of a boundary that identifies a component. The ladder is checked here
 * now, by the same method and with the same refusal to lower a requirement.
 *
 *   node scripts/tooling/contrast-check.mjs           # gate
 *   node scripts/tooling/contrast-check.mjs --report  # show the measurements
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

// `--css <path>` so a test can point this at a fixture. Without it the ladder
// half has no oracle at all: the script reads one fixed file and exits, and
// nothing can ask it what it does when a rung is too dim (T-0116).
const cssFlag = process.argv.indexOf("--css");
const CSS_PATH = cssFlag >= 0 ? process.argv[cssFlag + 1] : join(ROOT, "src/app/globals.css");
const CSS = readFileSync(CSS_PATH, "utf-8");

/** AA needs 4.5:1 for normal text. Every tier is meant to clear it. */
const REQUIRED = 4.5;

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const srgb = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const lum = (c) => 0.2126 * srgb(c[0]) + 0.7152 * srgb(c[1]) + 0.0722 * srgb(c[2]);
const ratio = (a, b) => { const [hi, lo] = lum(a) > lum(b) ? [lum(a), lum(b)] : [lum(b), lum(a)]; return (hi + 0.05) / (lo + 0.05); };
const over = (alpha, bg) => bg.map((c) => 255 * alpha + c * (1 - alpha));

const bgMatch = CSS.match(/--color-dark-950:\s*(#[0-9a-fA-F]{6})/);
if (!bgMatch) { console.error("contrast: could not find --color-dark-950 in globals.css"); process.exit(1); }
const bg = hex(bgMatch[1]);

const tiers = [...CSS.matchAll(/--color-ps-text-([a-z]+):\s*rgb\(255 255 255 \/ ([\d.]+)\)/g)]
  .map((m) => ({ name: m[1], alpha: Number(m[2]) }));

if (tiers.length === 0) { console.error("contrast: no --color-ps-text-* tiers found in globals.css"); process.exit(1); }

const rows = tiers.map((t) => ({ ...t, ratio: ratio(over(t.alpha, bg), bg) }));
const failed = rows.filter((r) => r.ratio < REQUIRED);

if (process.argv.includes("--report") || failed.length) {
  console.log(`contrast: text tiers against ${bgMatch[1]} (AA normal text needs ${REQUIRED}:1)`);
  for (const r of rows) {
    console.log(`  ${r.name.padEnd(10)} white/${String(Math.round(r.alpha * 100)).padStart(3)}%  ${r.ratio.toFixed(2)}:1  ${r.ratio >= REQUIRED ? "pass" : "FAIL"}`);
  }
}
if (failed.length) {
  console.error(`\ncontrast: ${failed.length} tier(s) below AA. Either raise the tier or darken the background.`);
  console.error("Do not lower the requirement: these tiers are what the whole UI reads through.");
  process.exit(1);
}

// ── The surface ladder ──────────────────────────────────────────────────────
//
// Each rung names the surface it must separate from and the ratio it owes it.
// The numbers are not opinions: 1.45 is where two large areas begin to read as
// two areas, and 3.0 is WCAG 1.4.11 for the boundary that identifies a
// component. `hairline` is deliberately lower because it is a subdivision
// INSIDE one surface rather than a boundary between two, and `emphasis` higher
// because it has to win against a boundary.
//
// scripts/tooling/derive-surface-ladder.mjs SOLVES for these values. This
// re-measures whatever is in the file, so an edit that looks nicer and reads
// worse fails here rather than shipping.
const LADDER = [
  { token: "ps-surface-panel", against: "ps-surface-ground", need: 1.45, what: "rail, header, card" },
  { token: "ps-surface-raised", against: "ps-surface-panel", need: 1.45, what: "dialog, popover, active row" },
  { token: "ps-edge", against: "ps-surface-panel", need: 3.0, what: "control boundary, shell seam" },
  { token: "ps-edge-hairline", against: "ps-surface-panel", need: 1.6, what: "card outline, rule inside a surface" },
  { token: "ps-edge-emphasis", against: "ps-surface-panel", need: 4.5, what: "selected, armed, focused" },
];

/** A token's value, following one level of `var()` so an alias still measures. */
function colourOf(name) {
  const m = CSS.match(new RegExp(`--color-${name}:\\s*([^;]+);`));
  if (!m) return null;
  const value = m[1].trim();
  const alias = value.match(/^var\(--color-([a-z0-9-]+)\)$/);
  if (alias) return colourOf(alias[1]);
  return /^#[0-9a-fA-F]{6}$/.test(value) ? hex(value) : null;
}

const ladderRows = LADDER.map((rung) => {
  const fg = colourOf(rung.token);
  const bgc = colourOf(rung.against);
  return { ...rung, fg, bgc, ratio: fg && bgc ? ratio(fg, bgc) : null };
});

const missing = ladderRows.filter((r) => r.ratio === null);
if (missing.length) {
  console.error(`contrast: ${missing.length} ladder rung(s) are not a hex this can measure:`);
  for (const r of missing) console.error(`  --color-${r.token} against --color-${r.against}`);
  console.error("A rung written as a keyword, an oklab() or a nested alias cannot be checked,");
  console.error("and a rung nothing checks is how the ladder got to 1.06:1 in the first place.");
  process.exit(1);
}

const ladderFailed = ladderRows.filter((r) => r.ratio < r.need);

if (process.argv.includes("--report") || ladderFailed.length) {
  console.log("contrast: the surface ladder");
  for (const r of ladderRows) {
    console.log(
      `  ${r.token.padEnd(18)} vs ${r.against.padEnd(18)} ${r.ratio.toFixed(2)}:1  needs ${String(r.need).padEnd(4)}  ${r.ratio >= r.need ? "pass" : "FAIL"}  ${r.what}`,
    );
  }
}

if (ladderFailed.length) {
  console.error(`\ncontrast: ${ladderFailed.length} ladder rung(s) below the separation they owe.`);
  console.error("Re-run scripts/tooling/derive-surface-ladder.mjs and take its answer.");
  console.error("Do not lower a requirement here: the flat ladder is the defect this measures.");
  process.exit(1);
}

console.log(`contrast: ${rows.length} text tiers pass AA (${REQUIRED}:1) against ${bgMatch[1]}, and ${ladderRows.length} ladder rungs hold their separation.`);
