#!/usr/bin/env node
/**
 * Output canary (T-0009, source row WO-0008).
 *
 * Purpose: make it possible to PROVE that a large file move is output-neutral,
 * instead of asserting it. Phase 3 (domain folders) and Phase 4 (god-file
 * splits) both move a lot of code, and WG-ARCH-006 will not accept "I checked
 * it by eye". This script produces a small set of digests over what the
 * repository actually EMITS, chosen so that a pure file move cannot change
 * them and a behaviour change cannot avoid changing them.
 *
 * Why not just hash .next/
 * ------------------------
 * Because that answer is useless. Turbopack names chunks by content, and the
 * content of a chunk includes module identifiers derived from module paths, so
 * moving one file renames a dozen chunks. A naive hash of the build directory
 * calls every move non-neutral and therefore proves nothing. Every surface
 * below is deliberately blind to where a module lives and sensitive to what it
 * does.
 *
 * Surfaces
 * --------
 *   httpSurface         The URL contract: every app-router page and API route,
 *                       its URL, its exported HTTP methods and its route
 *                       segment config. Derived from src/app/, which is the
 *                       only place in the tree where a file path IS the output.
 *                       Blind to anything under src/lib/.
 *
 *   appConfig           next.config.ts, normalised. Carries the redirects, so
 *                       it is part of the URL contract.
 *
 *   seedPack            `npm run seed-pack` exit status and stdout, plus the
 *                       content of every file in data/seed/ keyed by its path
 *                       inside the pack. The pack's internal layout is its
 *                       contract, so keying by that path is correct here.
 *
 *   generatedArtefacts  The checked-in generated outputs: the JSON Schemas
 *                       emitted from Zod, the SQL migrations and the SQL
 *                       seeds. Keyed by kind plus file name, never by
 *                       directory, so relocating the directory is neutral and
 *                       editing a migration is not.
 *
 *   moduleGraph         The behaviour digest, and the surface with real teeth.
 *                       Every source file under src/ is normalised (whitespace
 *                       collapsed, internal module specifiers reduced to a bare
 *                       module name) and hashed. The surface is the SORTED
 *                       MULTISET of those hashes with the paths thrown away.
 *                       Move a file: its own hash is unchanged, its importers'
 *                       specifiers normalise to the same bare name, so the
 *                       multiset is identical. Change one line of code: that
 *                       file's hash changes and the multiset changes with it.
 *
 *   prerender           Present only when .next/ exists. The build's route list
 *                       and the normalised HTML of every prerendered route,
 *                       with build id, chunk URLs, inline scripts and CSS
 *                       module hashes removed. This is the rendered output,
 *                       the strongest evidence available, and it is the reason
 *                       the canary is worth running after a build.
 *
 * Deliberate bias: the canary is over-sensitive, never under-sensitive. It
 * fires on a comment-only edit. That is the safe direction. A canary that can
 * miss a change is worthless; a canary that occasionally says "look again" is
 * merely mildly annoying.
 *
 * Modes
 * -----
 *   node scripts/tooling/output-canary.mjs                  print the report
 *   node scripts/tooling/output-canary.mjs --out F          also write it to F
 *   node scripts/tooling/output-canary.mjs --check          compare the stable
 *                                                           surfaces against
 *                                                           the committed
 *                                                           golden (CI gate)
 *   node scripts/tooling/output-canary.mjs --write-golden   re-bless the golden
 *   node scripts/tooling/output-canary.mjs --assert F       compare EVERY
 *                                                           shared surface
 *                                                           against a report
 *                                                           captured earlier
 *                                                           (the move-neutrality
 *                                                           proof)
 *   node scripts/tooling/output-canary.mjs --assert-move-neutral origin/dev
 *                                                           every commit in the
 *                                                           range whose subject
 *                                                           says [move] must be
 *                                                           output-neutral (CI)
 *   --no-prerender    skip the build-dependent surface even if .next/ exists
 *
 * See docs/contributing/output-canary.md for the workflow and for what to do when the
 * canary legitimately changes.
 */

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const GOLDEN_PATH = join(HERE, "output-canary.golden.json");

/** Surfaces held against the committed golden. Low noise, high contract value. */
export const GOLDEN_SURFACES = ["appConfig", "generatedArtefacts", "httpSurface", "seedPack"];

const CANARY_VERSION = 1;

/* ------------------------------------------------------------------ utils */

function sha256(input) {
  return createHash("sha256").update(input).digest("hex");
}

function toPosix(p) {
  return p.split("\\").join("/");
}

/** Recursive file walk. Returns absolute paths, unsorted. */
function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
}

function readText(file) {
  return readFileSync(file, "utf-8").replace(/^\uFEFF/, "").split("\r\n").join("\n");
}

/**
 * Digest a checked-in file by its CONTENT, not its bytes.
 *
 * The golden is blessed on a maintainer's machine and checked on a CI runner,
 * so anything that differs between the two is not part of the output contract.
 * Line endings are exactly that: git hands a Windows checkout CRLF and a Linux
 * runner LF, so hashing raw bytes made the golden unmatchable off the machine
 * that wrote it. That is how this shipped red the first time.
 *
 * A file with a NUL byte is treated as binary and hashed as bytes, because
 * rewriting CRLF inside binary content would corrupt the very thing being
 * pinned. Every file the canary hashes today is text (sql, md, yaml, json).
 */
function hashFileContent(file) {
  const buf = readFileSync(file);
  if (buf.includes(0)) return sha256(buf);
  return sha256(buf.toString("utf-8").replace(/^\uFEFF/, "").split("\r\n").join("\n"));
}

/* --------------------------------------------------- module normalisation */

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
const STRIPPABLE_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".css",
  ".sql",
  ".md",
];

/**
 * Reduce a module specifier to something a file move cannot change.
 *
 * Project-internal specifiers become the bare module name: "./foo",
 * "../../lib/foo", "@/lib/missions/foo" and "@/lib/foo" all collapse to
 * <mod:foo>. A move rewrites the directories in front of the name and leaves
 * the name alone, which is exactly the part kept.
 *
 * Repointing an import at a DIFFERENT module changes the name, so that is
 * still caught. The residual blind spot is two same-named modules in different
 * directories swapping places; see docs/contributing/output-canary.md.
 *
 * Package specifiers are kept verbatim: swapping "zod" for "yup" is a
 * behaviour change and must show up.
 */
export function normaliseSpecifier(spec) {
  const internal = spec.startsWith(".") || spec.startsWith("@/") || spec.startsWith("~/");
  if (!internal) return spec;
  let name = spec.split("/").filter(Boolean).pop() ?? "";
  for (const ext of STRIPPABLE_EXTENSIONS) {
    if (name.endsWith(ext)) {
      name = name.slice(0, -ext.length);
      break;
    }
  }
  if (name === "" || name === "." || name === "..") name = "index";
  return `<mod:${name}>`;
}

const SPECIFIER_PATTERNS = [
  /(from )(["'])([^"'\n]*)\2/g,
  /(import\()(["'])([^"'\n]*)\2/g,
  /(require\()(["'])([^"'\n]*)\2/g,
  /(import )(["'])([^"'\n]*)\2/g,
];

/**
 * Normalise one source file into its move-invariant form.
 *
 * Whitespace is collapsed first, on purpose: a mechanical import update grows
 * the specifier, the formatter re-wraps the import onto three lines, and a
 * line-sensitive digest would report that reflow as a behaviour change. It is
 * not one.
 *
 * Comments are NOT stripped. Stripping them without a real parser corrupts any
 * file containing "//" inside a string, and a corrupted digest can go quiet in
 * the wrong direction. Keeping them only ever produces a false alarm.
 */
export function normaliseModuleSource(source) {
  let text = source.replace(/^\uFEFF/, "").split("\r\n").join("\n");
  text = text.replace(/\s+/g, " ").trim();
  // Trailing commas, for the same reason as the whitespace collapse. When a
  // longer import path pushes an import over the print width the formatter
  // wraps it AND adds a trailing comma, so `{ bump }` becomes `{ bump, }`.
  // That is the formatter reacting to the move, not a behaviour change.
  text = text.replace(/, *([)\]}])/g, " $1");
  for (const pattern of SPECIFIER_PATTERNS) {
    text = text.replace(pattern, (_m, lead, quote, spec) => `${lead}${quote}${normaliseSpecifier(spec)}${quote}`);
  }
  return text;
}

/* ------------------------------------------------------------- httpSurface */

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
const SEGMENT_CONFIG_KEYS = [
  "dynamic",
  "dynamicParams",
  "revalidate",
  "fetchCache",
  "runtime",
  "preferredRegion",
  "maxDuration",
];

const SPECIAL_FILES = {
  page: "page",
  route: "route",
  layout: "layout",
  template: "template",
  default: "default",
  loading: "loading",
  error: "error",
  "global-error": "global-error",
  "not-found": "not-found",
  forbidden: "forbidden",
  unauthorized: "unauthorized",
};

/** URL for a directory under src/app. Route groups "(x)" disappear, as Next.js drops them. */
function urlForDir(relDir) {
  const segments = toPosix(relDir)
    .split("/")
    .filter(Boolean)
    .filter((s) => !(s.startsWith("(") && s.endsWith(")")));
  return `/${segments.join("/")}`.replace(/\/+$/, "") || "/";
}

/**
 * HTTP methods a route module exports.
 *
 * Three spellings are recognised on purpose. Phase 4 splits four API route
 * handlers, and the natural result of a split is `export { GET } from
 * "./handlers"`. A parser that only knew `export async function GET` would
 * call that split a removed endpoint.
 */
export function exportedHttpMethods(source) {
  const found = new Set();
  const flat = source.replace(/\s+/g, " ");
  for (const method of HTTP_METHODS) {
    const declared = new RegExp(`export (?:async )?function \\*?${method}\\b`);
    const assigned = new RegExp(`export (?:const|let|var) ${method}\\b`);
    if (declared.test(flat) || assigned.test(flat)) found.add(method);
  }
  for (const match of flat.matchAll(/export \{([^}]*)\}/g)) {
    for (const part of match[1].split(",")) {
      const name = part.trim().split(/ as /)[1] ?? part.trim();
      if (HTTP_METHODS.includes(name.trim())) found.add(name.trim());
    }
  }
  // The fourth spelling, `export * from "./handlers"`, names no method here:
  // the methods live in the file being re-exported. Reading through it would
  // need a resolver this dependency-free script does not have, so the star is
  // recorded as itself. A split that moves GET behind a star still changes this
  // surface, which is the property that matters; what it cannot do is tell you
  // WHICH methods survived, so a reviewer is told to look rather than trust.
  for (const match of flat.matchAll(/export \* from ["']([^"']+)["']/g)) {
    found.add(`*from:${normaliseSpecifier(match[1])}`);
  }
  return [...found].sort();
}

/**
 * Route segment config (`export const dynamic = "force-dynamic"` and friends).
 *
 * This feeds `httpSurface`, which IS held against the golden, so a miss here is
 * silent under-reporting rather than a noisy failure. The first version of this
 * regex could never match a semicolon-terminated declaration, which is the way
 * everyone actually writes one; it went unnoticed because no route in `src/app`
 * uses segment config today and the function was neither exported nor tested.
 * It is both now, with paired tests, because a surface nothing exercises is a
 * surface nobody can trust.
 */
export function segmentConfig(source) {
  const flat = source.replace(/\s+/g, " ");
  const out = [];
  for (const key of SEGMENT_CONFIG_KEYS) {
    // Stop at a semicolon or end of line, then trim. Terminated and
    // unterminated declarations both land on the same normalised value.
    const m = flat.match(new RegExp(`export const ${key}\\s*=\\s*([^;]+)`));
    if (m) out.push(`${key}=${m[1].trim()}`);
  }
  return out;
}

function httpSurfaceLines() {
  const appDir = join(ROOT, "src", "app");
  const lines = [];
  for (const file of walk(appDir)) {
    const rel = toPosix(relative(appDir, file));
    const name = basename(file);
    const dot = name.lastIndexOf(".");
    if (dot < 0) continue;
    const stem = name.slice(0, dot);
    const ext = name.slice(dot);
    if (!SOURCE_EXTENSIONS.includes(ext)) continue;
    const kind = SPECIAL_FILES[stem];
    if (!kind) continue;
    const url = urlForDir(dirname(rel) === "." ? "" : dirname(rel));
    if (kind === "route") {
      const source = readText(file);
      const methods = exportedHttpMethods(source);
      const config = segmentConfig(source);
      lines.push(`route ${url} [${methods.join(",")}]${config.length ? ` {${config.join(",")}}` : ""}`);
    } else {
      const config = segmentConfig(readText(file));
      lines.push(`${kind} ${url}${config.length ? ` {${config.join(",")}}` : ""}`);
    }
  }
  return lines.sort();
}

/* ---------------------------------------------------------------- surfaces */

function surfaceHttp() {
  const lines = httpSurfaceLines();
  return { hash: sha256(lines.join("\n")), detail: { entries: lines.length, lines } };
}

function surfaceAppConfig() {
  const candidates = ["next.config.ts", "next.config.mjs", "next.config.js"];
  const lines = [];
  for (const name of candidates) {
    const file = join(ROOT, name);
    if (!existsSync(file)) continue;
    lines.push(`${name} ${sha256(normaliseModuleSource(readText(file)))}`);
  }
  return { hash: sha256(lines.join("\n")), detail: { lines } };
}

function surfaceSeedPack() {
  const script = join(ROOT, "scripts", "tooling", "generate-seed-pack.mjs");
  const lines = [];
  if (existsSync(script)) {
    const run = spawnSync(process.execPath, [script], { cwd: ROOT, encoding: "utf-8" });
    lines.push(`seed-pack exit=${run.status}`);
    lines.push(`seed-pack stdout=${(run.stdout ?? "").trim()}`);
    lines.push(`seed-pack stderr=${(run.stderr ?? "").trim()}`);
  } else {
    lines.push("seed-pack exit=missing");
  }
  const seedRoot = join(ROOT, "data", "seed");
  for (const file of walk(seedRoot)) {
    const rel = toPosix(relative(seedRoot, file));
    lines.push(`pack:${rel} ${hashFileContent(file)}`);
  }
  const sorted = [lines[0], lines[1], lines[2], ...lines.slice(3).sort()];
  return { hash: sha256(sorted.join("\n")), detail: { files: lines.length - 3, lines: sorted } };
}

function surfaceGeneratedArtefacts() {
  const groups = [
    ["schema-json", join(ROOT, "src", "lib", "schema", "json")],
    ["migration", join(ROOT, "src", "lib", "db", "migrations")],
    ["db-seed", join(ROOT, "src", "lib", "db", "seeds")],
  ];
  const lines = [];
  for (const [kind, dir] of groups) {
    for (const file of walk(dir)) {
      lines.push(`${kind}:${basename(file)} ${hashFileContent(file)}`);
    }
  }
  lines.sort();
  return { hash: sha256(lines.join("\n")), detail: { entries: lines.length, lines } };
}

/**
 * The move-invariance rule, as one pure function so it can be tested in both
 * directions without touching the repository.
 *
 * `entries` is [{ path, source }]. Paths are used for nothing except the
 * caller's diagnostics: the hash is over the SORTED MULTISET of normalised
 * source digests, so where a module sits is unobservable and what it contains
 * is not.
 */
export function moduleMultisetHash(entries) {
  const digests = entries.map((e) => sha256(normaliseModuleSource(e.source))).sort();
  return sha256(digests.join("\n"));
}

function surfaceModuleGraph() {
  const srcRoot = join(ROOT, "src");
  const entries = [];
  for (const file of walk(srcRoot)) {
    const ext = file.slice(file.lastIndexOf("."));
    if (!SOURCE_EXTENSIONS.includes(ext)) continue;
    entries.push({ path: toPosix(relative(ROOT, file)), source: readText(file) });
  }
  const byDigest = Object.fromEntries(
    entries.map((e) => [sha256(normaliseModuleSource(e.source)), e.path]),
  );
  return {
    hash: moduleMultisetHash(entries),
    detail: { modules: entries.length, byDigest },
  };
}

/* --------------------------------------------------------------- prerender */

/**
 * Strip everything from prerendered HTML that a pure file move is allowed to
 * change, and nothing else.
 *
 * Removed: inline scripts (the RSC flight payload embeds path-derived module
 * ids), chunk URLs and the tags that carry them, the build id, and the
 * path-derived hash inside a CSS module class name (the export name survives,
 * so losing the class is still caught).
 *
 * Kept: the rendered DOM. Every visible string, attribute and element order.
 */
export function normalisePrerenderedHtml(html, buildId) {
  let out = html;
  if (buildId) out = out.split(buildId).join("<BUILD_ID>");
  // Wall clock. The dashboard renders the current time into the prerendered
  // page, so two builds a minute apart differ by one <div>. Measured, not
  // guessed: two consecutive cold builds of an unchanged tree differed in
  // exactly this one element and nothing else. Masking the clock is what makes
  // this surface usable at all; the cost is that a change to a rendered
  // date or time is invisible here, and is covered by moduleGraph instead.
  out = out.replace(/\d{4}-\d{2}-\d{2}T[\d:.]+(?:Z|[+-]\d{2}:?\d{2})?/g, "<TIMESTAMP>");
  out = out.replace(/\b\d{1,2}:\d{2}:\d{2}\b(?:\s?[AaPp][Mm])?/g, "<TIME>");
  out = out.replace(/\b\d{4}-\d{2}-\d{2}\b/g, "<DATE>");
  out = out.replace(/<script[^>]*src="\/_next\/[^"]*"[^>]*>\s*<\/script>/g, "");
  out = out.replace(/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/g, "");
  out = out.replace(/<link[^>]*href="\/_next\/static\/chunks\/[^"]*"[^>]*\/?>/g, "");
  out = out.replace(/\/_next\/static\/chunks\/[^"'\s)]+/g, "/_next/static/chunks/<chunk>");
  out = out.replace(
    /\b[A-Za-z0-9]+_[a-f0-9]{6,}-module__[A-Za-z0-9_-]+__([A-Za-z0-9_-]+)\b/g,
    "cssmodule__$1",
  );
  return out.replace(/\s+/g, " ").trim();
}

function surfacePrerender() {
  const nextDir = join(ROOT, ".next");
  const appDir = join(nextDir, "server", "app");
  if (!existsSync(appDir)) return null;
  const buildIdPath = join(nextDir, "BUILD_ID");
  const buildId = existsSync(buildIdPath) ? readText(buildIdPath).trim() : "";
  const lines = [];

  const routeManifest = join(nextDir, "app-path-routes-manifest.json");
  if (existsSync(routeManifest)) {
    const values = Object.values(JSON.parse(readText(routeManifest)));
    for (const value of [...new Set(values)].sort()) lines.push(`build-route ${value}`);
  }
  const routesManifest = join(nextDir, "routes-manifest.json");
  if (existsSync(routesManifest)) {
    const manifest = JSON.parse(readText(routesManifest));
    for (const key of ["redirects", "rewrites", "headers"]) {
      lines.push(`build-${key} ${sha256(JSON.stringify(manifest[key] ?? null))}`);
    }
  }

  const rendered = [];
  const htmlRoots = [
    ["prerender", appDir],
    ["prerender-pages", join(nextDir, "server", "pages")],
  ];
  for (const [label, root] of htmlRoots) {
    for (const file of walk(root)) {
      if (!file.endsWith(".html")) continue;
      let route = toPosix(relative(root, file)).replace(/\.html$/, "");
      route = route === "index" ? "/" : `/${route}`;
      const digest = sha256(normalisePrerenderedHtml(readText(file), buildId));
      lines.push(`${label} ${route} ${digest}`);
      rendered.push({ route, digest });
    }
  }
  lines.sort();
  // A half-written .next/ (a concurrent build, an interrupted one) must not
  // produce a surface at all. Comparing an empty surface to an empty surface
  // is the exact failure this whole task exists to prevent.
  if (rendered.length === 0) return null;
  return { hash: sha256(lines.join("\n")), detail: { rendered: rendered.length, lines } };
}

/* ----------------------------------------------------------------- report */

export function buildReport({ includePrerender = true } = {}) {
  const surfaces = {};
  const diagnostics = {};
  const add = (name, computed) => {
    if (!computed) return;
    surfaces[name] = computed.hash;
    diagnostics[name] = computed.detail;
  };
  add("appConfig", surfaceAppConfig());
  add("generatedArtefacts", surfaceGeneratedArtefacts());
  add("httpSurface", surfaceHttp());
  add("moduleGraph", surfaceModuleGraph());
  add("seedPack", surfaceSeedPack());
  if (includePrerender) add("prerender", surfacePrerender());

  const ordered = Object.fromEntries(Object.keys(surfaces).sort().map((k) => [k, surfaces[k]]));
  return {
    canaryVersion: CANARY_VERSION,
    surfaces: ordered,
    digest: sha256(JSON.stringify(ordered)),
    diagnostics,
  };
}

export function readGolden() {
  return JSON.parse(readText(GOLDEN_PATH));
}

/** Compare two reports over the surfaces they share. Returns the differing names. */
export function diffSurfaces(expected, actual, names) {
  const differing = [];
  for (const name of names) {
    if (expected[name] !== actual[name]) differing.push(name);
  }
  return differing;
}

/** Names present in both reports, sorted. */
export function sharedSurfaceNames(a, b) {
  return Object.keys(a).filter((k) => k in b).sort();
}

/* ------------------------------------------------- automatic move checking */

/**
 * A commit that claims to be a move says so in its subject, with [move].
 *
 * Automatic detection was considered and rejected. A Phase 3 move commit is
 * NOT a pure rename set: it is renames plus the mechanical import updates the
 * renames force, so "every path in the diff is an R" is never true and any
 * looser rule would either fire on ordinary work or miss the commits that
 * matter. Making the claim explicit is better than inferring it, because the
 * claim is then on the record and the gate holds the author to it.
 */
export const MOVE_COMMIT_MARKER = /\[move\]/i;

function git(args, options = {}) {
  const run = spawnSync("git", args, { cwd: ROOT, encoding: "utf-8", ...options });
  if (run.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${(run.stderr ?? "").trim()}`);
  }
  return (run.stdout ?? "").trim();
}

/** Canary report for an arbitrary commit, via a throwaway detached worktree. */
function reportAtCommit(rev) {
  // Resolve first: callers pass things like "<sha>^", and "^" has no business
  // appearing in a directory name.
  const sha = git(["rev-parse", rev]);
  const dir = join(
    process.env.RUNNER_TEMP || process.env.TMPDIR || process.env.TEMP || ".",
    `canary-${sha.slice(0, 12)}`,
  );
  try {
    git(["worktree", "add", "--detach", "--quiet", dir, sha]);
    const script = join(dir, "scripts", "tooling", "output-canary.mjs");
    if (!existsSync(script)) return null;
    // The canary derives its ROOT from its own location, and every build-free
    // surface is stdlib-only, so the worktree needs no npm install.
    const run = spawnSync(process.execPath, [script, "--no-prerender"], {
      cwd: dir,
      encoding: "utf-8",
    });
    if (run.status !== 0) {
      throw new Error(`canary failed at ${sha}: ${(run.stderr ?? "").trim()}`);
    }
    return JSON.parse(run.stdout);
  } finally {
    spawnSync("git", ["worktree", "remove", "--force", dir], { cwd: ROOT, encoding: "utf-8" });
    spawnSync("git", ["worktree", "prune"], { cwd: ROOT, encoding: "utf-8" });
  }
}

function assertMoveNeutral(baseRef) {
  const listed = git(["rev-list", "--reverse", `${baseRef}..HEAD`]);
  const commits = listed ? listed.split("\n") : [];
  const moves = commits.filter((sha) => MOVE_COMMIT_MARKER.test(git(["log", "-1", "--format=%s", sha])));
  if (moves.length === 0) {
    console.log(`Output canary: no [move] commits in ${baseRef}..HEAD (${commits.length} commits scanned).`);
    return 0;
  }
  let failed = 0;
  for (const sha of moves) {
    const subject = git(["log", "-1", "--format=%s", sha]);
    const before = reportAtCommit(`${sha}^`);
    const after = reportAtCommit(sha);
    if (!before || !after) {
      console.log(`  skipped ${sha.slice(0, 8)}: the canary does not exist on both sides of this commit.`);
      continue;
    }
    const names = sharedSurfaceNames(before.surfaces, after.surfaces);
    const differing = diffSurfaces(before.surfaces, after.surfaces, names);
    if (differing.length === 0) {
      console.log(`  ${sha.slice(0, 8)} NEUTRAL  ${subject}`);
      continue;
    }
    failed += 1;
    console.error(`  ${sha.slice(0, 8)} NOT NEUTRAL  ${subject}`);
    for (const name of differing) {
      console.error(`      ${name}: ${before.surfaces[name]} -> ${after.surfaces[name]}`);
    }
  }
  if (failed > 0) {
    console.error("");
    console.error(`${failed} commit(s) claimed [move] and changed the output. Split the behaviour`);
    console.error("change out of the move commit, or drop the [move] claim. See docs/contributing/output-canary.md.");
    return 1;
  }
  console.log(`Output canary: ${moves.length} [move] commit(s) proved output-neutral.`);
  return 0;
}

function describeModuleDrift(baselineDetail, currentDetail) {
  if (!baselineDetail?.byDigest || !currentDetail?.byDigest) return [];
  const before = baselineDetail.byDigest;
  const after = currentDetail.byDigest;
  const gone = Object.keys(before).filter((d) => !(d in after));
  const fresh = Object.keys(after).filter((d) => !(d in before));
  const notes = [];
  for (const d of gone) notes.push(`  - no longer present: ${before[d]}`);
  for (const d of fresh) notes.push(`  + newly present:    ${after[d]}`);
  return notes;
}

/* -------------------------------------------------------------------- cli */

function main(argv) {
  const moveIdx = argv.indexOf("--assert-move-neutral");
  if (moveIdx >= 0) {
    const baseRef = argv[moveIdx + 1];
    if (!baseRef) {
      console.error("--assert-move-neutral needs a base ref, for example origin/dev");
      return 2;
    }
    return assertMoveNeutral(baseRef);
  }

  const includePrerender = !argv.includes("--no-prerender");
  const report = buildReport({ includePrerender });

  const outIdx = argv.indexOf("--out");
  if (outIdx >= 0 && argv[outIdx + 1]) {
    writeFileSync(argv[outIdx + 1], `${JSON.stringify(report, null, 2)}\n`, "utf-8");
    console.log(`Canary report written to ${argv[outIdx + 1]}`);
  }

  if (argv.includes("--write-golden")) {
    const golden = {
      canaryVersion: CANARY_VERSION,
      goldenSurfaces: GOLDEN_SURFACES,
      surfaces: Object.fromEntries(GOLDEN_SURFACES.map((n) => [n, report.surfaces[n]])),
    };
    writeFileSync(GOLDEN_PATH, `${JSON.stringify(golden, null, 2)}\n`, "utf-8");
    console.log(`Golden rewritten: ${toPosix(relative(ROOT, GOLDEN_PATH))}`);
    return 0;
  }

  const assertIdx = argv.indexOf("--assert");
  if (assertIdx >= 0) {
    const baselineFile = argv[assertIdx + 1];
    if (!baselineFile || !existsSync(baselineFile)) {
      console.error(`--assert needs a baseline report file; not found: ${baselineFile}`);
      return 2;
    }
    const baseline = JSON.parse(readText(baselineFile));
    const names = sharedSurfaceNames(baseline.surfaces, report.surfaces);
    const differing = diffSurfaces(baseline.surfaces, report.surfaces, names);
    if (differing.length === 0) {
      console.log(`Output canary: NEUTRAL. ${names.length} surfaces identical (${names.join(", ")}).`);
      return 0;
    }
    console.error("Output canary: NOT NEUTRAL. These surfaces changed:");
    for (const name of differing) {
      console.error(`  ${name}: ${baseline.surfaces[name]} -> ${report.surfaces[name]}`);
      if (name === "moduleGraph") {
        for (const note of describeModuleDrift(baseline.diagnostics?.moduleGraph, report.diagnostics.moduleGraph)) {
          console.error(note);
        }
      }
    }
    console.error("");
    console.error("If this was meant to be a pure move, it was not one. See docs/contributing/output-canary.md.");
    return 1;
  }

  if (argv.includes("--check")) {
    const golden = readGolden();
    const differing = diffSurfaces(golden.surfaces, report.surfaces, golden.goldenSurfaces);
    if (differing.length === 0) {
      console.log(`Output canary: OK. Stable surfaces match the golden (${golden.goldenSurfaces.join(", ")}).`);
      return 0;
    }
    console.error("Output canary: FAILED. The observable output contract changed:");
    for (const name of differing) {
      console.error(`  ${name}: golden ${golden.surfaces[name]} -> now ${report.surfaces[name]}`);
    }
    console.error("");
    console.error("This is not a lint rule to silence. Either the change was unintended, in which");
    console.error("case fix it, or it was intended, in which case re-bless the golden in the same");
    console.error("commit with: npm run canary:bless. See docs/contributing/output-canary.md.");
    return 1;
  }

  console.log(JSON.stringify({ canaryVersion: report.canaryVersion, surfaces: report.surfaces, digest: report.digest }, null, 2));
  return 0;
}

const invokedDirectly = process.argv[1] && toPosix(process.argv[1]).endsWith("output-canary.mjs");
if (invokedDirectly) {
  process.exit(main(process.argv.slice(2)));
}
