// scripts/tooling/check-doc-links.mjs
//
// Every relative link in docs/ must point at a file that exists.
//
// The 2026-07 review found docs naming a component that had been deleted and CSS
// variables that never existed, and agents followed them. A stale link is worse
// than a missing one: it reads as verified. This session moved 30 files into
// src/modules/hermes/ and deleted a whole subsystem, which broke a batch of them
// at once and is exactly when this needs to be mechanical rather than remembered.
//
//   node scripts/tooling/check-doc-links.mjs          # gate (runs in npm run lint)
//
// Checks relative markdown links and reference-style targets. Skips absolute
// URLs, anchors, and mailto. A link with a #fragment is checked up to the '#'.

import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { join, dirname, resolve, relative, sep } from "path";
import { fileURLToPath } from "url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const DOCS = join(ROOT, "docs");
const rel = (p) => relative(ROOT, p).split(sep).join("/");

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith(".md")) out.push(full);
  }
  return out;
}

// [text](target) and [text]: target
const INLINE = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const REFERENCE = /^\s*\[[^\]]+\]:\s*(\S+)/gm;

const broken = [];

for (const file of walk(DOCS)) {
  const src = readFileSync(file, "utf-8");
  const lines = src.split(/\r?\n/);

  for (const re of [INLINE, REFERENCE]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(src)) !== null) {
      const target = m[1];
      if (/^(https?:|mailto:|#|<)/.test(target)) continue;

      const path = decodeURIComponent(target.split("#")[0]);
      if (!path) continue;

      const abs = resolve(dirname(file), path);
      if (existsSync(abs)) continue;

      const upto = src.slice(0, m.index);
      const line = upto.split("\n").length;
      broken.push({ file: rel(file), line, target, text: lines[line - 1]?.trim().slice(0, 100) });
    }
  }
}

if (broken.length > 0) {
  console.error(`doc-links: ${broken.length} broken link(s)\n`);
  for (const b of broken) {
    console.error(`  ${b.file}:${b.line}  ->  ${b.target}`);
    console.error(`    ${b.text}`);
  }
  console.error(
    "\nA stale link reads as verified, which is worse than no link at all.\n" +
      "Point it at the file's new home, or delete the reference.",
  );
  process.exit(1);
}

console.log("doc-links: every relative link in docs/ resolves");
