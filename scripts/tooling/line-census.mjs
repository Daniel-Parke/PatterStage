#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// line-census — the consolidation programme's referee (C0, T-0135)
//
// Counts, on the working tree, the lines and the shapes the programme is
// taking down, and holds them in a baseline that may fall and may not rise.
// The design census measures the rendered product; this measures the
// source. Both are ratchets for the same reason: "it is smaller" is a
// number or it is an adjective.
//
//   node scripts/tooling/line-census.mjs                 compare to the baseline
//   node scripts/tooling/line-census.mjs --report        list what is behind each number
//   node scripts/tooling/line-census.mjs --update-baseline
//   node scripts/tooling/line-census.mjs --allow-growth "<reason>"
//   node scripts/tooling/line-census.mjs --root <dir> --baseline <file>   (a fixture tree)
//
// The measures are named in org/plans/2026-09-consolidation.md; a new one is
// added here and to the baseline in the same commit. Comments are stripped
// before a shape is matched, so a comment that names the hook does not
// count as using it.
// ═══════════════════════════════════════════════════════════════

import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import ts from "typescript";

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};
const ROOT = (flag("--root") ?? join(dirname(fileURLToPath(import.meta.url)), "..", "..")).replace(/\\/g, "/");
const BASELINE = flag("--baseline") ?? join(ROOT, "scripts", "tooling", "line-census.baseline.json");
const report = args.includes("--report");
const update = args.includes("--update-baseline");
const allowGrowth = flag("--allow-growth");

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|css|mjs)$/.test(name)) out.push(p.replace(/\\/g, "/"));
  }
  return out;
}
const rel = (f) => f.slice(ROOT.length + 1);
const src = walk(join(ROOT, "src"));
const tests = walk(join(ROOT, "tests"));
const text = new Map([...src, ...tests].map((f) => [f, readFileSync(f, "utf8")]));
const lines = (f) => text.get(f).split("\n");
const count = (files) => files.reduce((n, f) => n + lines(f).length, 0);
/** The file without its comments, for matching a shape by its code. */
const code = (f) => text.get(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const tsFiles = (files) => files.filter((f) => /\.(ts|tsx)$/.test(f));

// A six-line window of trimmed, non-comment, non-bracket lines that appears in
// two or more files. Each covered line counts once.
function repeatedWindows(files, W = 6) {
  const seen = new Map();
  const perFile = new Map();
  const bodies = new Map();
  for (const f of files) {
    const idx = [];
    const norm = [];
    lines(f).forEach((raw, i) => {
      const l = raw.trim();
      if (l.length < 4 || /^(\/\/|\*|\/\*)/.test(l) || /^[\]\})\];,]*$/.test(l)) return;
      idx.push(i);
      norm.push(l);
    });
    for (let i = 0; i + W <= norm.length; i++) {
      const h = createHash("md5").update(norm.slice(i, i + W).join("\n")).digest("hex");
      if (!seen.has(h)) seen.set(h, new Set());
      seen.get(h).add(f);
      if (!bodies.has(h)) bodies.set(h, norm.slice(i, i + W).join(" | ").slice(0, 140));
      if (!perFile.has(f)) perFile.set(f, []);
      perFile.get(f).push([h, idx.slice(i, i + W)]);
    }
  }
  const dup = new Set([...seen].filter(([, fs]) => fs.size >= 2).map(([h]) => h));
  let covered = 0;
  const byFile = [];
  for (const [f, list] of perFile) {
    const s = new Set();
    for (const [h, ids] of list) if (dup.has(h)) ids.forEach((i) => s.add(i));
    covered += s.size;
    if (s.size) byFile.push([rel(f), s.size]);
  }
  const top = [...seen].filter(([h]) => dup.has(h)).sort((a, b) => b[1].size - a[1].size).slice(0, 10).map(([h, fs]) => `x${fs.size}: ${bodies.get(h)}`);
  return { covered, byFile: byFile.sort((a, b) => b[1] - a[1]).slice(0, 20), top };
}

function routesWithTryCatch() {
  const routes = src.filter((f) => /\/src\/app\/api\/.*\/route\.ts$/.test(f));
  const hits = routes.filter((f) => /serverErrorFromCatch\(/.test(code(f)));
  return { count: hits.length, sites: hits.reduce((n, f) => n + (code(f).match(/serverErrorFromCatch\(/g) ?? []).length, 0), files: hits.map(rel) };
}

// A read the screen rolled itself: a fetch (safeApiCall, safeApiCallData or
// apiFetch) reachable from a useEffect callback, through the file's own
// functions, because a loader is usually a useCallback the effect calls.
// Walked on the AST since C3 (T-0138): the regex before it counted three
// click handlers as reads and missed eight loaders called from effects.
const FETCHERS = new Set(["safeApiCall", "safeApiCallData", "apiFetch"]);
function effectReads(file) {
  const source = text.get(file);
  if (!/useEffect\(/.test(source)) return false;
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const fns = new Map();
  const fnOf = (init) => {
    if (!init) return null;
    if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) return init;
    const first = ts.isCallExpression(init) ? init.arguments[0] : undefined;
    return first && (ts.isArrowFunction(first) || ts.isFunctionExpression(first)) ? first : null;
  };
  const collect = (node) => {
    if (ts.isFunctionDeclaration(node) && node.name) fns.set(node.name.text, node);
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && fnOf(node.initializer)) fns.set(node.name.text, fnOf(node.initializer));
    ts.forEachChild(node, collect);
  };
  collect(sf);
  const seen = new Set();
  const reaches = (node) => {
    let hit = false;
    const go = (n) => {
      if (hit) return;
      if (ts.isCallExpression(n)) {
        const callee = n.expression;
        const name = ts.isIdentifier(callee) ? callee.text : ts.isPropertyAccessExpression(callee) ? callee.name.text : null;
        if (name && FETCHERS.has(name)) { hit = true; return; }
        if (name && fns.has(name) && !seen.has(name)) { seen.add(name); if (reaches(fns.get(name))) { hit = true; return; } }
      }
      ts.forEachChild(n, go);
    };
    go(node);
    return hit;
  };
  let found = false;
  const effects = (node) => {
    if (found) return;
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "useEffect" && node.arguments.length && reaches(node.arguments[0])) found = true;
    ts.forEachChild(node, effects);
  };
  effects(sf);
  return found;
}

function handRolledReads() {
  const files = tsFiles(src).filter((f) => !/\/src\/app\/api\//.test(f) && !/\/src\/hooks\/useApiResource\.ts$/.test(f) && !/\/src\/lib\//.test(f));
  const hits = files.filter(effectReads);
  return { count: hits.length, files: hits.map(rel) };
}

// The named hooks write through runWrite (or its mission shorthand) and say
// nothing about a failure themselves; a toastError of their own is the old
// try/catch/finally around the call.
function writesWithoutMutation() {
  const named = ["useModelActions", "useMissionDispatch", "useMissionTemplateActions", "useModelFallbackChain"];
  const hits = named.filter((n) => {
    const f = src.find((p) => p.endsWith(`/src/hooks/${n}.ts`));
    if (!f) return true;
    const t = code(f);
    return !/\b(runWrite|dispatchMission)\s*(<[^(]*>)?\(/.test(t) || /toastError\(/.test(t);
  });
  return { count: hits.length, files: hits };
}

function repeatedTypeShapes() {
  const shapes = {
    // Three lines, because a template also carries optional toolsets and a
    // patch's updates carry the same names nullable; the draft is the one
    // with optional goals and a plain string modelId under them.
    missionDraftFields: /suggestedToolsets\?: string\[\];\s*\n\s*goals\?: string\[\];\s*\n\s*modelId\?: string;/,
    modelRow: /contextLength: number \| null;/,
    syncSourceFailure: /syncedCount: 0,\s*\n\s*error: String\(err\)/,
  };
  const out = {};
  for (const [name, re] of Object.entries(shapes)) {
    const files = tsFiles(src).filter((f) => re.test(code(f)));
    out[name] = { count: files.length, files: files.map(rel) };
  }
  return out;
}

function oneImporterComponents() {
  const comps = src.filter((f) => f.includes("/src/components/") && f.endsWith(".tsx"));
  const rows = [];
  for (const c of comps) {
    // An index file is imported by its directory's name (C6 corrected this:
    // motion/index.tsx read as one importer, db/backup's "./index", when it has two).
    const stem = c.replace(/\.tsx$/, "").replace(/\/index$/, "");
    const alias = stem.replace(/.*\/src\//, "@/");
    const base = stem.split("/").pop();
    let n = 0;
    for (const f of tsFiles(src)) {
      if (f === c) continue;
      const t = text.get(f);
      if (t.includes(`"${alias}"`) || t.includes(`"${alias}/index"`) || new RegExp(`from "\\.{1,2}/[^"]*\\b${base}(?:/index)?"`).test(t)) n += 1;
    }
    if (n === 1) rows.push([rel(c), lines(c).length]);
  }
  return { count: rows.length, total: comps.length, files: rows.sort((a, b) => a[1] - b[1]) };
}

function libRootFiles() {
  const files = src.filter((f) => /\/src\/lib\/[^/]+\.ts$/.test(f));
  return { count: files.length, files: files.map(rel) };
}

function commentEssays() {
  const rows = [];
  for (const f of tsFiles(src)) {
    const ls = lines(f);
    if (ls.length < 60) continue;
    const c = ls.filter((l) => /^\s*(\/\/|\*|\/\*)/.test(l)).length;
    if (c / ls.length >= 0.4) rows.push([rel(f), ls.length, c]);
  }
  return { count: rows.length, files: rows.sort((a, b) => b[2] - a[2]) };
}

// A suite that mocks the db through a factory (dbMock for a stub,
// dbSingletonMock for the in-memory double) is not counted; C0 named only the
// first and counted the thirty-eight suites already on the second (T-0141).
function inlineDbMocks() {
  const files = tests.filter((f) => /\.test\.(ts|tsx)$/.test(f) && /jest\.mock\("@\/lib\/db"/.test(text.get(f)) && !/\bdb(Singleton)?Mock\(/.test(text.get(f)));
  return { count: files.length, files: files.map(rel) };
}

const srcDup = repeatedWindows(tsFiles(src));
const testDup = repeatedWindows(tsFiles(tests));
const routes = routesWithTryCatch();
const reads = handRolledReads();
const writes = writesWithoutMutation();
const shapes = repeatedTypeShapes();
const one = oneImporterComponents();
const root = libRootFiles();
const essays = commentEssays();
const dbMocks = inlineDbMocks();

const counts = {
  srcLines: count(src),
  testLines: count(tests),
  srcRepeatedWindowLines: srcDup.covered,
  testRepeatedWindowLines: testDup.covered,
  routesWithTryCatch: routes.count,
  handRolledReadHooks: reads.count,
  writeHooksWithoutMutation: writes.count,
  repeatedTypeShapeFiles: Object.values(shapes).reduce((n, s) => n + s.count, 0),
  oneImporterComponents: one.count,
  libRootFiles: root.count,
  commentEssays: essays.count,
  suitesMockingDbInline: dbMocks.count,
};

if (report) {
  console.log(JSON.stringify({ counts, srcDup, testDup, routes, reads, writes, shapes, oneImporter: one, libRoot: root, essays, dbMocks }, null, 1));
  process.exit(0);
}

const previous = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, "utf8")) : null;
const base = previous?.counts ?? null;
const rose = [];
const fell = [];
if (base) {
  for (const [k, v] of Object.entries(counts)) {
    if (!(k in base)) continue;
    if (v > base[k]) rose.push(`${k} rose from ${base[k]} to ${v}`);
    if (v < base[k]) fell.push(`${k} fell from ${base[k]} to ${v}`);
  }
  for (const k of Object.keys(base)) if (!(k in counts)) rose.push(`${k} is in the baseline and no longer measured`);
}

if (update) {
  // A re-cut holds a fall. A rise is held only with a reason, and the reason
  // is written into the baseline beside the number it excuses, so the file
  // itself says why a measure went up (a source batch adding its oracle
  // suite is the usual one).
  if (rose.length && !allowGrowth) {
    console.error("line-census: --update-baseline would hold a rise: " + rose.join("; ") + '. Pass --allow-growth "<reason>" to hold it with the reason recorded.');
    process.exit(1);
  }
  const allowed = [...(previous?.allowed ?? []), ...rose.map((r) => ({ measuredAt: new Date().toISOString().slice(0, 10), rise: r, reason: allowGrowth }))];
  writeFileSync(BASELINE, JSON.stringify({ measuredAt: new Date().toISOString().slice(0, 10), counts, allowed }, null, 2) + "\n");
  console.log(`line-census: baseline written: ${JSON.stringify(counts)}${rose.length ? ` (held ${rose.length} rise(s): ${allowGrowth})` : ""}`);
  process.exit(0);
}

if (!base) {
  console.error("line-census: no baseline; run with --update-baseline");
  process.exit(2);
}
if (fell.length) console.log("line-census: " + fell.join("; ") + " (run --update-baseline to hold it)");
if (rose.length && !allowGrowth) {
  console.error("line-census: the tree moved the wrong way: " + rose.join("; ") + ". Run with --report to see what is behind each number, or --allow-growth \"<reason>\".");
  process.exit(1);
}
if (rose.length) console.log(`line-census: growth allowed (${allowGrowth}): ${rose.join("; ")}`);
console.log(`line-census: ${Object.keys(counts).length} measures held (src ${counts.srcLines}, tests ${counts.testLines}).`);
