// ═══════════════════════════════════════════════════════════════
// scripts/docs/lib.mjs — the pure half of the documentation pipeline
//
// Decision 3: docs/**/*.md is the ONE source for the published site, the in-app
// Help section and the screenshot set. Three surfaces reading three copies of
// the same prose is how three copies stop agreeing, so there is one copy and
// three renderings of it.
//
// Everything here is pure: front matter in, data out; pages in, manifest out;
// a page and its HTML in, a document out. No fs, no process, no network. The
// CLIs (build-site.mjs, check.mts, extract.ts) do the reading and writing and
// call in here for every decision, which is also what lets the oracles ask the
// same questions the gates ask.
//
// Plain ESM rather than the .mts of check.mts, deliberately: next/jest installs
// a transform for js/jsx/ts/tsx/mjs and a supplied transform replaces Jest's
// default outright, so a .mts module cannot be loaded from a unit test. The
// pure logic has to be testable, so the pure logic lives in a .mjs.
// ═══════════════════════════════════════════════════════════════

import { load as parseYaml } from "js-yaml";

/** The six tiers, in reading order. The order IS the site's reading path. */
export const SECTIONS = ["start-here", "concepts", "guides", "running", "reference", "contributing"];

export const SECTION_LABELS = {
  "start-here": "Start here",
  concepts: "Concepts",
  guides: "Guides",
  running: "Running it",
  reference: "Reference",
  contributing: "Contributing",
};

export const REQUIRED_KEYS = ["title", "summary", "section", "nav"];
export const OPTIONAL_KEYS = ["audience", "screen", "concepts", "shots"];

/**
 * Keys the EOS corpus already carries on every governing file in this tree.
 * Permitted and ignored: refusing them would mean rewriting front matter that
 * another toolchain reads, which is not this pipeline's business.
 */
export const IGNORED_KEYS = ["type", "tags", "compiled_from", "status", "approved_by", "session"];

export const REFUSAL_CODES = [
  "route-without-guide",
  "screen-not-a-route",
  "missing-image",
  "undefined-concept",
  "stale-generated-block",
  "retired-path",
];

/** The nine facts the docs fence off and regenerate rather than retype. */
export const GENERATED_BLOCK_IDS = [
  "achievements",
  "event-types",
  "lint-steps",
  "config-sections",
  "seed-manifests",
  "api-routes",
  "schema-head",
  "quests",
  "env-table",
];

/**
 * The URL groups B3's regroup retired. A guide that still sends a reader to one
 * of these is worse than a guide with a broken link: the redirect answers, so
 * nothing looks wrong, and the prose teaches an address that is on its way out.
 */
export const RETIRED_PATHS = [
  "/orchestration/",
  "/operations/",
  "/laboratory/",
  "/config/",
  "/sessions/",
  "/logs",
  "/memory",
  "/insights",
  "/benchmarks",
];

/**
 * Matches a retired path only where it is actually a URL the reader might type.
 *
 * The lookbehind rules out the longer paths these words also appear in: a
 * source file (`src/app/laboratory/...`), an API route (`/api/laboratory/...`),
 * a template (`{PS_DATA_DIR}/logs`) and a Next.js route group
 * (`(main)/sessions/page.tsx`). What is left is a bare page URL, which is the
 * thing the regroup retired. Ordinary prose containing the word "logs" is not a
 * refusal; `/results/logs` is not either, because it is not one of these words.
 */
// The lookbehind carries a `.` so that `./logs.md` and `../logs.md` are read as
// what they are -- a relative link to the sibling guide -- rather than as the
// retired route `/logs`. Five guides are named for a retired route (logs,
// sessions, memory, insights, models), so this fires the moment the guides link
// to one another. A path beginning `./` or `../` is a file, never a URL.
const RETIRED_RE =
  /(?<![\w/\-.})])\/(?:orchestration|operations|laboratory|config|sessions|logs|memory|insights|benchmarks)(?![\w-])(?:\/[\w-]+)*/g;

/**
 * What B15's placeholder guides say about themselves.
 *
 * Matched as literal sentences rather than by word count: a short guide for a
 * simple screen is a good guide, and "under 200 words" would refuse it while
 * passing a 400-word placeholder that had grown a paragraph of apology.
 */
const STUB_MARKERS = ["This page is a stub", "Written in B18", "_Written in B18._"];

/**
 * The three headings every guide carries, in the reader's order: what is on
 * the screen, what they would come here to do, and what is worth knowing once
 * they have done it. Internals live under a disclosure inside Notes, so a
 * reader who wants the schema can have it and a reader who does not never
 * meets it.
 */
const GUIDE_SECTIONS = ["What you see", "Typical use", "Notes"];

/** A hit that names a FILE rather than a page is not a retired URL. */
function looksLikeAFile(hit) {
  return /\.[a-z]{2,4}$/i.test(hit) || hit.endsWith("/page");
}

// ── slugs ─────────────────────────────────────────────────────

/**
 * "docs/guides/missions.md" -> "guides/missions"; "docs/README.md" -> "index".
 *
 * The four uppercase files GitHub looks for at the top of docs/ keep their
 * filenames and get kebab-case slugs, so CODE_OF_CONDUCT.md is addressable at
 * code-of-conduct.html like everything else.
 */
export function slugFor(repoRelPath) {
  const rel = String(repoRelPath).replace(/\\/g, "/").replace(/^docs\//, "").replace(/\.md$/i, "");
  if (rel === "README") return "index";
  const parts = rel.split("/");
  const base = parts.pop();
  const kebab = base.replace(/_/g, "-").toLowerCase();
  return [...parts, kebab].join("/");
}

// ── front matter ──────────────────────────────────────────────

/**
 * Split and validate a page's leading `---` block.
 *
 * Every error names the file first, because these are read from a gate's output
 * where the file is the only way to find the problem. Missing required keys are
 * reported all at once, in REQUIRED_KEYS order, so one run fixes one page.
 */
export function parseDocFrontMatter(source, path) {
  const text = String(source).replace(/^﻿/, "");
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!match) {
    return { ok: false, errors: [`${path}: no front matter (a page must open with a --- block)`] };
  }

  let raw;
  try {
    raw = parseYaml(match[1]);
  } catch (err) {
    // One error and no others: a page whose YAML did not parse has no keys to
    // report missing, and a list of eight follow-on errors buries the one that
    // matters.
    return { ok: false, errors: [`${path}: front matter is not valid YAML (${err.message})`] };
  }

  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, errors: [`${path}: front matter is not a mapping`] };
  }

  const body = text.slice(match[0].length);
  const errors = [];

  for (const key of REQUIRED_KEYS) {
    if (raw[key] === undefined || raw[key] === null) errors.push(`${path}: front matter is missing "${key}"`);
  }

  if (raw.title !== undefined && typeof raw.title !== "string") {
    errors.push(`${path}: front matter "title" must be a string (got ${JSON.stringify(raw.title)})`);
  }
  if (raw.summary !== undefined && typeof raw.summary !== "string") {
    errors.push(`${path}: front matter "summary" must be a string (got ${JSON.stringify(raw.summary)})`);
  }
  if (raw.nav !== undefined && typeof raw.nav !== "number") {
    errors.push(`${path}: front matter "nav" must be a number (got ${JSON.stringify(raw.nav)})`);
  }
  if (raw.section !== undefined && !SECTIONS.includes(raw.section)) {
    errors.push(
      `${path}: front matter "section" must be one of ${SECTIONS.join(", ")} ` +
        `(got ${JSON.stringify(raw.section)})`,
    );
  }
  if (raw.audience !== undefined && raw.audience !== "operator" && raw.audience !== "contributor") {
    errors.push(
      `${path}: front matter "audience" must be "operator" or "contributor" ` +
        `(got ${JSON.stringify(raw.audience)})`,
    );
  }
  if (raw.screen !== undefined && typeof raw.screen !== "string") {
    errors.push(`${path}: front matter "screen" must be a string (got ${JSON.stringify(raw.screen)})`);
  }
  for (const key of ["concepts", "shots"]) {
    const v = raw[key];
    if (v === undefined) continue;
    if (!Array.isArray(v) || v.some((x) => typeof x !== "string")) {
      errors.push(`${path}: front matter "${key}" must be a list of strings`);
    }
  }

  const known = new Set([...REQUIRED_KEYS, ...OPTIONAL_KEYS, ...IGNORED_KEYS]);
  for (const key of Object.keys(raw)) {
    // Silently dropping an unknown key is how a typo'd `screan:` becomes a page
    // that documents nothing and a route with no guide at the same time.
    if (!known.has(key)) errors.push(`${path}: front matter has an unknown key "${key}"`);
  }

  if (errors.length > 0) return { ok: false, errors };

  const data = { title: raw.title, summary: raw.summary, section: raw.section, nav: raw.nav };
  for (const key of OPTIONAL_KEYS) if (raw[key] !== undefined) data[key] = raw[key];
  return { ok: true, data, body };
}

// ── the manifest ──────────────────────────────────────────────

/**
 * The derived view every other surface reads: the sidebar, the reading order,
 * the screen -> guide map that resolves an in-app ? link, and the concept ids
 * the hint popovers are allowed to name.
 *
 * Deterministic by construction — sections in SECTIONS order, pages by nav then
 * slug, nothing derived from the clock or the filesystem's ordering — because
 * `check-derived-views` recomputes it and compares byte for byte. A derived view
 * that moves on every run trains everyone to re-bless it blind.
 */
export function buildManifest(pages) {
  // Within a section only. The grouping below walks SECTIONS itself, so a
  // section key in this comparator would be a second answer to a question
  // already settled, and a second answer is a place for the two to disagree.
  const sorted = [...pages].sort((a, b) => {
    if (a.data.nav !== b.data.nav) return a.data.nav - b.data.nav;
    return a.slug.localeCompare(b.slug);
  });

  const sections = [];
  for (const id of SECTIONS) {
    const inSection = sorted.filter((p) => p.data.section === id);
    if (inSection.length === 0) continue;
    sections.push({
      id,
      label: SECTION_LABELS[id],
      pages: inSection.map((p) => {
        const entry = { slug: p.slug, title: p.data.title, summary: p.data.summary, nav: p.data.nav };
        if (p.data.screen !== undefined) entry.screen = p.data.screen;
        if (p.data.concepts !== undefined) entry.concepts = p.data.concepts;
        if (p.data.shots !== undefined) entry.shots = p.data.shots;
        return entry;
      }),
    });
  }

  const screens = {};
  for (const p of [...sorted].sort((a, b) => a.slug.localeCompare(b.slug))) {
    if (p.data.screen) screens[p.data.screen] = p.slug;
  }

  const concepts = sorted
    .filter((p) => p.data.section === "concepts")
    .map((p) => conceptIdFor(p))
    .sort();

  return {
    generatedBy: "scripts/docs/build-site.mjs",
    sections,
    // Sorted by route, not by page order: a map read by a resolver reads better
    // when its keys are in a predictable order, and the bytes are gated.
    screens: Object.fromEntries(Object.entries(screens).sort(([a], [b]) => a.localeCompare(b))),
    concepts,
    order: sections.flatMap((s) => s.pages.map((p) => p.slug)),
  };
}

/** A concepts page's id is its own basename: docs/concepts/mission.md -> "mission". */
export function conceptIdFor(page) {
  return page.slug.split("/").pop();
}

/** The exact bytes of docs/manifest.json. */
export function serialiseManifest(manifest) {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

// ── links ─────────────────────────────────────────────────────

function dirOf(slug) {
  const parts = slug.split("/");
  parts.pop();
  return parts;
}

/**
 * A relative path from one directory to a file, with the shared prefix dropped.
 *
 * "guides/missions" to "guides/chat.html" is "chat.html", not
 * "../guides/chat.html": a link that climbs out only to come straight back in
 * works, but it reads as though the two pages are unrelated.
 */
function relativeFromDir(fromDir, toParts) {
  const toFile = toParts[toParts.length - 1];
  const toDir = toParts.slice(0, -1);
  let shared = 0;
  while (shared < fromDir.length && shared < toDir.length && fromDir[shared] === toDir[shared]) shared += 1;
  const up = "../".repeat(fromDir.length - shared);
  return `${up}${[...toDir.slice(shared), toFile].join("/")}`;
}

/**
 * A page-to-page href, always relative and always ending ".html".
 *
 * Relative rather than root-relative because the output has to satisfy two
 * origins at once: GitHub Pages under /PatterStage/ and a folder opened from
 * file://. A leading slash works on neither of those the same way.
 */
export function relativeHref(fromSlug, toSlug) {
  return relativeFromDir(dirOf(fromSlug), `${toSlug}.html`.split("/"));
}

/**
 * A page-to-asset href. The build copies docs/images/ to site/images/, so the
 * "docs/" prefix is stripped and the rest resolved against the page's folder.
 */
export function relativeAsset(fromSlug, repoRelPath) {
  const rel = String(repoRelPath).replace(/\\/g, "/").replace(/^docs\//, "");
  return relativeFromDir(dirOf(fromSlug), rel.split("/"));
}

// ── rendering ─────────────────────────────────────────────────

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * The site's stylesheet, inlined.
 *
 * Inlined rather than linked because a <link> to a stylesheet is one more
 * relative path to get wrong, and because the whole point of the output is that
 * a single .html file opened from disk looks right. The palette follows
 * docs/contributing/design-tokens.md rather than importing it: the site is
 * built by Node with no Tailwind and no bundler, so the tokens are written out
 * once here and the design-lint gate does not reach this file.
 */
const SITE_CSS = `
:root {
  color-scheme: dark;
  --ink: #e8eef5; --ink-muted: #9fb0c3; --ink-faint: #6b7f95;
  --bg: #040b12; --panel: #0a141d; --line: #1b2a3a;
  --accent: #22d3ee; --accent-soft: rgba(34, 211, 238, 0.12);
}
* { box-sizing: border-box; }
body {
  margin: 0; background: var(--bg); color: var(--ink);
  font: 16px/1.65 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }
.layout { display: grid; grid-template-columns: 260px minmax(0, 1fr); min-height: 100vh; }
.rail {
  border-right: 1px solid var(--line); background: var(--panel);
  padding: 24px 16px; overflow-y: auto; max-height: 100vh; position: sticky; top: 0;
}
.rail h1 { font-size: 15px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-muted); margin: 0 0 16px; }
.rail section { margin-bottom: 20px; }
.rail h2 {
  font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase;
  color: var(--ink-faint); margin: 0 0 6px;
}
.rail ul { list-style: none; margin: 0; padding: 0; }
.rail li { margin: 2px 0; }
.rail a { display: block; padding: 4px 8px; border-radius: 6px; color: var(--ink-muted); font-size: 14px; }
.rail a:hover { background: var(--accent-soft); color: var(--ink); text-decoration: none; }
.rail a[aria-current="page"] { background: var(--accent-soft); color: var(--accent); }
main { padding: 32px 40px 80px; max-width: 860px; }
main h1 { font-size: 32px; line-height: 1.2; margin: 0 0 8px; }
main .summary { color: var(--ink-muted); margin: 0 0 32px; font-size: 17px; }
main h2 { font-size: 22px; margin: 40px 0 12px; padding-top: 8px; border-top: 1px solid var(--line); }
main h3 { font-size: 17px; margin: 28px 0 8px; }
main img { max-width: 100%; border: 1px solid var(--line); border-radius: 8px; }
main table { border-collapse: collapse; width: 100%; margin: 16px 0; font-size: 14px; display: block; overflow-x: auto; }
main th, main td { border: 1px solid var(--line); padding: 6px 10px; text-align: left; vertical-align: top; }
main th { background: var(--panel); color: var(--ink-muted); }
main code { background: var(--panel); border: 1px solid var(--line); border-radius: 4px; padding: 1px 5px; font-size: 90%; }
main pre { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 14px 16px; overflow-x: auto; }
main pre code { background: none; border: 0; padding: 0; }
main blockquote { margin: 16px 0; padding: 8px 16px; border-left: 3px solid var(--accent); background: var(--panel); color: var(--ink-muted); }
.search { width: 100%; padding: 7px 10px; margin-bottom: 18px; border-radius: 6px;
  border: 1px solid var(--line); background: var(--bg); color: var(--ink); font: inherit; font-size: 14px; }
.results { list-style: none; margin: 0 0 18px; padding: 0; }
.results li { margin: 4px 0; font-size: 13px; }
.results .where { color: var(--ink-faint); }
.pager { display: flex; justify-content: space-between; gap: 16px; margin-top: 56px;
  padding-top: 20px; border-top: 1px solid var(--line); font-size: 14px; }
@media (max-width: 800px) {
  .layout { grid-template-columns: 1fr; }
  .rail { position: static; max-height: none; }
  main { padding: 24px 20px 60px; }
}
`.trim();

/**
 * The client search.
 *
 * Reads window.__PS_DOCS_SEARCH__, which search-index.js assigns. NOT a
 * fetch("search.json"): Chrome gives a file:// page an opaque origin and blocks
 * the request, so a site that fetched its index would have a dead search box
 * exactly where the plan promises the output opens from disk.
 */
const SITE_JS = `
(function () {
  var box = document.getElementById("q");
  var out = document.getElementById("results");
  if (!box || !out) return;
  var rows = window.__PS_DOCS_SEARCH__ || [];
  var here = document.body.getAttribute("data-slug") || "index";
  function up(slug) { var n = here.split("/").length - 1; return (n ? new Array(n + 1).join("../") : "") + slug; }
  box.addEventListener("input", function () {
    var q = box.value.trim().toLowerCase();
    out.innerHTML = "";
    if (q.length < 2) return;
    var hits = rows.filter(function (r) {
      return (r.title + " " + r.heading + " " + r.text).toLowerCase().indexOf(q) !== -1;
    }).slice(0, 20);
    hits.forEach(function (r) {
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.href = up(r.slug) + ".html" + (r.anchor ? "#" + r.anchor : "");
      a.textContent = r.heading || r.title;
      li.appendChild(a);
      var span = document.createElement("span");
      span.className = "where";
      span.textContent = " \\u00b7 " + r.title;
      li.appendChild(span);
      out.appendChild(li);
    });
  });
})();
`.trim();

function railHtml(page, manifest) {
  const parts = ['<nav class="rail">', "<h1>PatterStage docs</h1>"];
  parts.push('<input id="q" class="search" type="search" placeholder="Search the docs" aria-label="Search the docs">');
  parts.push('<ul id="results" class="results"></ul>');
  for (const section of manifest.sections) {
    parts.push("<section>", `<h2>${escapeHtml(section.label)}</h2>`, "<ul>");
    for (const entry of section.pages) {
      const current = entry.slug === page.slug ? ' aria-current="page"' : "";
      parts.push(
        `<li><a href="${relativeHref(page.slug, entry.slug)}"${current}>${escapeHtml(entry.title)}</a></li>`,
      );
    }
    parts.push("</ul>", "</section>");
  }
  parts.push("</nav>");
  return parts.join("\n");
}

function pagerHtml(page, manifest) {
  const i = manifest.order.indexOf(page.slug);
  const prev = i > 0 ? manifest.order[i - 1] : null;
  const next = i >= 0 && i < manifest.order.length - 1 ? manifest.order[i + 1] : null;
  const titleOf = (slug) => {
    for (const s of manifest.sections) {
      const hit = s.pages.find((p) => p.slug === slug);
      if (hit) return hit.title;
    }
    return slug;
  };
  const left = prev
    ? `<a href="${relativeHref(page.slug, prev)}">&larr; ${escapeHtml(titleOf(prev))}</a>`
    : "<span></span>";
  const right = next
    ? `<a href="${relativeHref(page.slug, next)}">${escapeHtml(titleOf(next))} &rarr;</a>`
    : "<span></span>";
  return `<div class="pager">${left}${right}</div>`;
}

/**
 * Drop a body's own leading H1.
 *
 * Every page's markdown opens with `# Title`, and both renderers already put
 * the title on the page from the front matter, which is where the manifest
 * and the sidebar read it from too. Left in, the title appears twice on the
 * site and twice again inside the app, the second time as a second h1 on a
 * screen that already has one. Only the FIRST element is dropped, and only
 * when it is an h1: an h1 later in a body is the author saying something.
 */
export function stripLeadingH1(html) {
  return String(html).replace(/^\s*<h1\b[^>]*>[\s\S]*?<\/h1>\s*/, "");
}

/** A complete HTML document: rail, prose, pager, inline CSS, relative script. */
export function renderPage(page, html, manifest) {
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(page.data.title)} · PatterStage docs</title>`,
    `<meta name="description" content="${escapeHtml(page.data.summary)}">`,
    `<style>${SITE_CSS}</style>`,
    "</head>",
    `<body data-slug="${escapeHtml(page.slug)}">`,
    '<div class="layout">',
    railHtml(page, manifest),
    "<main>",
    `<h1>${escapeHtml(page.data.title)}</h1>`,
    `<p class="summary">${escapeHtml(page.data.summary)}</p>`,
    html,
    pagerHtml(page, manifest),
    "</main>",
    "</div>",
    `<script src="${relativeAsset(page.slug, "docs/search-index.js")}"></script>`,
    `<script>${SITE_JS}</script>`,
    "</body>",
    "</html>",
    "",
  ].join("\n");
}

/**
 * The in-app half: body only.
 *
 * No <html>, no <style>, no <script>, because Help renders this inside
 * AppPageShell with the app's own chrome and its own rail. B16 rebases the
 * relative links against /help/, which is only possible because none of them
 * is root-relative.
 */
export function renderFragment(page, html, manifest) {
  void page;
  void manifest;
  // The BODY only: no title, no summary, no chrome. The app renders a page's
  // title and summary in its own PageHeader, so a fragment that carried them
  // too printed both twice, one under the other, and put two h1s on one
  // screen. renderPage still carries them, because on the site nothing else
  // does.
  return html;
}

// ── search ────────────────────────────────────────────────────

/** One row per heading, plus one for the page itself, so a hit can deep-link. */
export function buildSearchIndex(pages) {
  const rows = [];
  for (const page of pages) {
    rows.push({
      slug: page.slug,
      title: page.data.title,
      section: page.data.section,
      heading: page.data.title,
      anchor: "",
      text: page.data.summary,
    });
    const lines = page.body.split("\n");
    let inFence = false;
    let heading = null;
    let buffer = [];
    const flush = () => {
      if (heading) {
        rows.push({
          slug: page.slug,
          title: page.data.title,
          section: page.data.section,
          heading: heading.text,
          anchor: heading.anchor,
          text: buffer.join(" ").slice(0, 400),
        });
      }
      buffer = [];
    };
    for (const line of lines) {
      if (/^\s*```/.test(line)) inFence = !inFence;
      if (inFence) continue;
      const m = /^(#{2,4})\s+(.+?)\s*$/.exec(line);
      if (m) {
        flush();
        heading = { text: m[2], anchor: slugifyHeading(m[2]) };
        continue;
      }
      if (line.trim()) buffer.push(line.trim());
    }
    flush();
  }
  return rows;
}

/** GitHub-style heading anchors, which is what markdown-it's anchor plugin-free
 *  output needs to agree with; the build applies the same function. */
export function slugifyHeading(text) {
  return String(text)
    .toLowerCase()
    .replace(/`/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

// ── generated blocks ──────────────────────────────────────────

/**
 * Find every `<!-- generated:id -->` fence in a document.
 *
 * An opening marker with no closing marker is REPORTED (closed: false) rather
 * than skipped, because a half-written fence is exactly the state in which a
 * regenerated fact silently stops being regenerated.
 */
export function findGeneratedBlocks(markdown) {
  const out = [];
  const open = /<!--\s*generated:([\w-]+)\s*-->/g;
  let m;
  while ((m = open.exec(markdown)) !== null) {
    const id = m[1];
    const bodyStart = m.index + m[0].length;
    const closeRe = new RegExp(`<!--\\s*/generated:${id}\\s*-->`, "g");
    closeRe.lastIndex = bodyStart;
    const close = closeRe.exec(markdown);
    if (!close) {
      out.push({ id, body: "", start: m.index, end: bodyStart, closed: false });
      continue;
    }
    const raw = markdown.slice(bodyStart, close.index);
    out.push({
      id,
      body: raw.replace(/^\r?\n/, "").replace(/\r?\n$/, ""),
      start: m.index,
      end: close.index + close[0].length,
      closed: true,
    });
    open.lastIndex = close.index + close[0].length;
  }
  return out;
}

/**
 * Replace one fence's body, keeping the markers so it can be regenerated again.
 * Idempotent: writing the body a fence already holds returns the same string.
 * A document with no such fence is returned untouched.
 */
export function replaceGeneratedBlock(markdown, id, body) {
  const block = findGeneratedBlocks(markdown).find((b) => b.id === id && b.closed);
  if (!block) return markdown;
  const opener = markdown.slice(block.start, markdown.indexOf("-->", block.start) + 3);
  const closer = `<!-- /generated:${id} -->`;
  return `${markdown.slice(0, block.start)}${opener}\n${body}\n${closer}${markdown.slice(block.end)}`;
}

// ── the gate ──────────────────────────────────────────────────

/**
 * Every refusal `npm run docs:check` can make, as pure data.
 *
 * Pure because the CLI's job is reading the tree and the checker's job is
 * deciding, and a checker that reads the filesystem can only be tested by
 * building one. `imageExists` and `freshBlocks` are injected for exactly that
 * reason.
 */
export function checkDocs(input) {
  const { pages, routes, imageExists, freshBlocks } = input;
  const refusals = [];

  const documented = new Set(pages.map((p) => p.data.screen).filter(Boolean));
  for (const route of routes) {
    if (documented.has(route)) continue;
    refusals.push({
      code: "route-without-guide",
      path: "",
      subject: route,
      message: `docs:check: the registry route ${route} has no guide (no page declares screen: ${route})`,
    });
  }

  const routeSet = new Set(routes);
  const definedConcepts = new Set(
    pages.filter((p) => p.data.section === "concepts").map((p) => conceptIdFor(p)),
  );

  for (const page of pages) {
    if (page.data.screen && !routeSet.has(page.data.screen)) {
      refusals.push({
        code: "screen-not-a-route",
        path: page.path,
        subject: page.data.screen,
        message: `docs:check: ${page.path} declares screen: ${page.data.screen}, which is not a registry route`,
      });
    }

    for (const shot of page.data.shots ?? []) {
      if (imageExists(shot)) continue;
      refusals.push({
        code: "missing-image",
        path: page.path,
        subject: shot,
        message: `docs:check: ${page.path} references ${shot}, which does not exist`,
      });
    }

    if (page.path.includes("docs/guides/")) {
      // One refusal per page, not one per marker: a placeholder carries all
      // three and three identical lines about one file is noise, not detail.
      const marker = STUB_MARKERS.find((m) => page.body.includes(m));
      if (marker) {
        refusals.push({
          code: "guide-is-a-stub",
          path: page.path,
          subject: marker,
          message: `docs:check: ${page.path} is still a stub (it says "${marker}")`,
        });
      }

      const missing = GUIDE_SECTIONS.filter((h) => !new RegExp(`^##\\s+${h}\\s*$`, "m").test(page.body));
      if (missing.length > 0) {
        // The subject is the heading as a reader would type it, `##` and all,
        // because the file's own invariant is that a message quotes its subject
        // verbatim -- and because "Notes" alone is not a thing to search for.
        const headings = missing.map((h) => `## ${h}`).join(", ");
        refusals.push({
          code: "guide-missing-sections",
          path: page.path,
          subject: headings,
          message: `docs:check: ${page.path} is missing the section(s) every guide carries: ${headings}`,
        });
      }
    }

    for (const id of page.data.concepts ?? []) {
      if (definedConcepts.has(id)) continue;
      refusals.push({
        code: "undefined-concept",
        path: page.path,
        subject: id,
        message: `docs:check: ${page.path} names concept "${id}", which no page under docs/concepts/ defines`,
      });
    }

    for (const block of findGeneratedBlocks(page.body)) {
      if (!block.closed) {
        refusals.push({
          code: "stale-generated-block",
          path: page.path,
          subject: block.id,
          message: `docs:check: ${page.path} generated block "${block.id}" has no closing marker`,
        });
        continue;
      }
      const fresh = freshBlocks[block.id];
      if (fresh === undefined || fresh === block.body) continue;
      refusals.push({
        code: "stale-generated-block",
        path: page.path,
        subject: block.id,
        message: `docs:check: ${page.path} generated block "${block.id}" is stale (run npm run docs:generate)`,
      });
    }

    const seen = new Set();
    for (const hit of page.body.matchAll(RETIRED_RE)) {
      if (looksLikeAFile(hit[0])) continue;
      if (seen.has(hit[0])) continue;
      seen.add(hit[0]);
      refusals.push({
        code: "retired-path",
        path: page.path,
        subject: hit[0],
        message: `docs:check: ${page.path} names the retired path "${hit[0]}"`,
      });
    }
  }

  return refusals;
}
