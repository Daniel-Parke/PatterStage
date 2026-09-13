// scripts/tooling/vendor-fonts.mjs
//
// Download the font families the app uses into src/app/fonts/ as .woff2, so
// `next build` has no build-time network dependency.
//
// WHY THIS EXISTS. The production build fetched six families from
// fonts.googleapis.com, which made the build itself network-dependent. CI carried
// a font "warmup" step and a whole-build retry to paper over the resulting flake,
// and WG-DEL-004 (ruled C, determinism first) forbids a retry on a blocking gate.
// The retry was the symptom; this is the disease.
//
// Re-run only to add or update a family. The output is committed, so a normal
// build and a normal CI run never touch the network.
//
//   node scripts/tooling/vendor-fonts.mjs
//
// A modern User-Agent is required: Google serves .ttf to unrecognised clients and
// .woff2 only to browsers that advertise support. Asking for the wrong format is
// silent, so the script asserts it got woff2.

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

// Chrome UA. Without this Google returns truetype, which is roughly twice the
// size and defeats the point of vendoring.
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const OUT = join(process.cwd(), "src", "app", "fonts");

/** family: the Google Fonts family query, exactly as the layout files request it. */
const FAMILIES = [
  { file: "Inter", query: "Inter:wght@100..900" },
  { file: "JetBrainsMono", query: "JetBrains+Mono:wght@100..800" },
  { file: "Literata", query: "Literata:wght@200..900" },
  { file: "EBGaramond", query: "EB+Garamond:wght@400..800" },
  { file: "Lora", query: "Lora:wght@400..700" },
  // Merriweather is requested at three discrete weights rather than a range, so
  // it yields three static files instead of one variable font.
  { file: "Merriweather", query: "Merriweather:wght@300;400;700" },
];

async function cssFor(query) {
  const url = `https://fonts.googleapis.com/css2?family=${query}&display=swap`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${query}: CSS fetch failed ${res.status}`);
  return res.text();
}

/**
 * The latin woff2 URLs from a Google Fonts CSS payload.
 *
 * Google groups @font-face blocks by unicode-range with a comment naming the
 * subset. We keep `latin` only: the layouts all request subsets:["latin"], and
 * pulling every subset would multiply the vendored weight for glyphs the app
 * never renders.
 */
function latinWoff2Urls(css) {
  const out = [];
  const blocks = css.split("@font-face");
  for (const block of blocks) {
    // The subset comment precedes its block, so look at what came before too.
    if (!/unicode-range/.test(block)) continue;
    const url = block.match(/url\((https:\/\/[^)]+\.woff2)\)/);
    if (!url) continue;
    // latin (not latin-ext, not cyrillic/greek/vietnamese)
    const isLatin = /U\+0000-00FF/.test(block);
    if (isLatin) out.push(url[1]);
  }
  return [...new Set(out)];
}

mkdirSync(OUT, { recursive: true });
let total = 0;
const written = [];

for (const fam of FAMILIES) {
  const css = await cssFor(fam.query);
  if (!/\.woff2/.test(css)) {
    throw new Error(`${fam.file}: Google returned no woff2 (check the User-Agent)`);
  }
  const urls = latinWoff2Urls(css);
  if (urls.length === 0) throw new Error(`${fam.file}: no latin woff2 found`);

  let i = 0;
  for (const url of urls) {
    const name = urls.length === 1 ? `${fam.file}.woff2` : `${fam.file}-${++i}.woff2`;
    const dest = join(OUT, name);
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`${name}: download failed ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(dest, buf);
    total += buf.length;
    written.push({ name, bytes: buf.length });
    console.log(`  ${name.padEnd(22)} ${(buf.length / 1024).toFixed(1)} KB`);
  }
}

console.log(`\n${written.length} file(s), ${(total / 1024).toFixed(1)} KB total, in src/app/fonts/`);
console.log("Committed on purpose: the build must not reach the network.");
if (!existsSync(join(OUT, "Inter.woff2"))) {
  console.error("Inter.woff2 missing: the layouts will not resolve.");
  process.exitCode = 1;
}
