#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// copy-lint.mjs — the copy law, measured
//
// docs/contributing/copy.md says which register each surface speaks and what may never
// appear in user copy: the venture's governance ids. The review found an ADR
// reference on the Agents page ("Capability measurement is not implemented;
// see ADR-0004"), work-group ids in tooltips and task ids in toasts. A person
// who installed the product cannot open ADR-0004; the sentence is for the
// maintainer and it is on the user's screen.
//
// REPORT MODE, for now. `--report` (npm run lint:copy) prints the debt per
// file and exits 0. `--check` exits 1 on any hit and joins `npm run lint`
// once the sweep in B18 has cleared the tree, so the rule does not land red
// and get deleted. Dependency-free, line-oriented, per WG-WEB-013: it looks
// for the ids inside JSX text and string literals, and skips comment and
// import lines, where the ids are the maintainer's business.
// ═══════════════════════════════════════════════════════════════

import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative, sep } from "path";
import { fileURLToPath } from "url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const SCAN_DIRS = ["src/app", "src/components", "src/modules"];

/** The governance ids that are never user copy. */
const GOVERNANCE_ID = /\b(?:ADR-\d{4}|WG-[A-Z]+-\d{3}|T-\d{4}|RUL-[A-Z]+-\d{3})\b/;

const rel = (p) => relative(ROOT, p).split(sep).join("/");

/**
 * The lines of one file that carry a governance id in copy.
 *
 * @returns {{ line: number, text: string }[]}
 */
export function findCopyDebt(path, lines) {
  const hits = [];
  if (!(path.endsWith(".tsx") || path.endsWith(".ts"))) return hits;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const t = raw.trimStart();
    if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) continue;
    if (/^import\s/.test(t)) continue;
    if (!GOVERNANCE_ID.test(raw)) continue;
    hits.push({ line: i + 1, text: raw.trim().slice(0, 120) });
  }
  return hits;
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith(".tsx") || entry.endsWith(".ts")) out.push(full);
  }
  return out;
}

export function scanTree() {
  const files = SCAN_DIRS.flatMap((d) => walk(join(ROOT, d)));
  const byFile = new Map();
  for (const abs of files) {
    const path = rel(abs);
    const hits = findCopyDebt(path, readFileSync(abs, "utf-8").split(/\r?\n/));
    if (hits.length) byFile.set(path, hits);
  }
  return { filesScanned: files.length, byFile };
}

/**
 * The exit code, from the mode and the count: `--report` is always 0, and
 * `--check` is 1 on any hit. A walk that found too few files is 2 in either
 * mode, because a scan of nothing passes everything.
 */
export function decide(mode, total, filesScanned) {
  if (filesScanned < 100) return 2;
  if (mode === "--check" && total > 0) return 1;
  return 0;
}

function main(argv) {
  const mode = argv[0] ?? "--report";
  const { filesScanned, byFile } = scanTree();
  const total = [...byFile.values()].reduce((n, h) => n + h.length, 0);
  const code = decide(mode, total, filesScanned);
  if (code === 2) {
    console.error(`copy-lint: scanned only ${filesScanned} files, which is too few to be a real walk.`);
    return code;
  }
  console.log(`copy-lint: ${total} governance reference${total === 1 ? "" : "s"} in user copy across ${byFile.size} of ${filesScanned} files.`);
  for (const [path, hits] of [...byFile.entries()].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${path}: ${hits.length}`);
    for (const h of hits.slice(0, 3)) console.log(`    :${h.line}  ${h.text}`);
  }
  if (code === 1) {
    console.error("\ncopy-lint: user copy carries a governance id. See docs/contributing/copy.md.");
  }
  return code;
}

const invokedDirectly =
  process.argv[1] && process.argv[1].split(sep).join("/").endsWith("copy-lint.mjs");
if (invokedDirectly) {
  process.exit(main(process.argv.slice(2)));
}
