#!/usr/bin/env node
/**
 * Contrast check for the text tiers (T-0028).
 *
 * The four --color-ps-text-* tokens in globals.css are DERIVED from the app's
 * painted background, not chosen by eye. This re-derives them and fails if any
 * tier has drifted below the WCAG AA floor it claims to clear.
 *
 * It exists because the tiers are only trustworthy while the background they
 * were measured against stays put. Someone lightening --color-dark-950 would
 * silently push every tier toward the floor, and nothing else in the repo
 * would notice.
 *
 *   node scripts/tooling/contrast-check.mjs           # gate
 *   node scripts/tooling/contrast-check.mjs --report  # show the measurements
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CSS = readFileSync(join(ROOT, "src/app/globals.css"), "utf-8");

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
console.log(`contrast: ${rows.length} text tiers pass AA (${REQUIRED}:1) against ${bgMatch[1]}.`);
