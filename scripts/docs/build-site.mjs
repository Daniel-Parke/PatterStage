#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// scripts/docs/build-site.mjs — the generator half of the documentation pipeline
//
// Decision 3: docs/**/*.md is the ONE source for the published site, the in-app
// Help section and the screenshot set. This is what turns that source into the
// two renderings that are not the markdown itself — the static site under
// site/, and the fragments and indexes under public/help/ that B16's Help
// section reads.
//
// Every decision worth arguing about (slugs, front matter, ordering, relative
// links, the page shell, the search rows) lives in ./lib.mjs, where the oracles
// can ask it the same questions the gates ask. This file walks the tree, hands
// markdown to markdown-it, and writes bytes. When something here looks like a
// judgement call, it is a bug: move it next door.
//
// Run:
//   node scripts/docs/build-site.mjs                      site/ + public/help/
//   node scripts/docs/build-site.mjs --help-only          public/help/ only (prebuild)
//   node scripts/docs/build-site.mjs --manifest-only      docs/manifest.json only
//   node scripts/docs/build-site.mjs --base /PatterStage/ canonical tags for Pages
// ═══════════════════════════════════════════════════════════════

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import MarkdownIt from "markdown-it";

import {
  buildManifest,
  buildSearchIndex,
  conceptIdFor,
  parseDocFrontMatter,
  relativeAsset,
  relativeHref,
  renderFragment,
  stripLeadingH1,
  renderPage,
  serialiseManifest,
  slugFor,
  slugifyHeading,
} from "./lib.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * Where a link that leaves docs/ points instead.
 *
 * ADR-0010 moved the governance corpus under org/, which is deliberately NOT
 * published: the site is the operator's manual, org/ is the venture's own
 * record. A page that links to org/LOCKBOOK.md is not making a mistake, so the
 * link is sent to the file on GitHub rather than left as a ../ that resolves to
 * nothing once the page has been flattened into site/.
 */
const REPO_BLOB = "https://github.com/Daniel-Parke/PatterStage/blob/main/";

const toPosix = (p) => String(p).replace(/\\/g, "/");

// ── arguments ─────────────────────────────────────────────────

function parseArgs(argv) {
  const value = (flag, fallback) => {
    const i = argv.indexOf(flag);
    return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : fallback;
  };
  let base = value("--base", "");
  // A base path is only ever a prefix for the canonical URL, so it is
  // normalised once here and every consumer can just concatenate.
  if (base && !base.endsWith("/")) base += "/";
  return {
    out: value("--out", join(ROOT, "site")),
    docs: value("--docs", join(ROOT, "docs")),
    base,
    helpOnly: argv.includes("--help-only"),
    manifestOnly: argv.includes("--manifest-only"),
  };
}

// ── reading docs/ ─────────────────────────────────────────────

/** Every file under a directory, as "/"-joined paths relative to it, sorted. */
function walk(dir, prefix = "") {
  const out = [];
  const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...walk(join(dir, entry.name), rel));
    else out.push(rel);
  }
  return out;
}

/**
 * Read and validate every page.
 *
 * Paths are reported as `docs/<rel>` whatever `--docs` points at, because the
 * slug rules, the `shots:` entries and the manifest are all written in
 * repo-root-relative terms and a build against a fixture directory must produce
 * the same bytes as a build against the real tree.
 *
 * Every refusal is collected before any is reported: a page with a typo'd key
 * should not hide the other nine pages that have the same typo.
 */
function readPages(docsDir) {
  const pages = [];
  const errors = [];
  for (const rel of walk(docsDir)) {
    if (!/\.md$/i.test(rel)) continue;
    const path = `docs/${rel}`;
    const parsed = parseDocFrontMatter(readFileSync(join(docsDir, rel), "utf-8"), path);
    if (!parsed.ok) {
      errors.push(...parsed.errors);
      continue;
    }
    pages.push({ path, slug: slugFor(path), data: parsed.data, body: parsed.body });
  }
  return { pages, errors };
}

// ── markdown ──────────────────────────────────────────────────

const md = new MarkdownIt({ html: true, linkify: true, typographer: false });

// Heading ids, computed by lib.mjs's slugifyHeading — the same function
// buildSearchIndex uses for its anchors. Two implementations of "what is this
// heading's id" is how a search result starts landing at the top of the page
// instead of at the heading it promised.
md.renderer.rules.heading_open = (tokens, idx, options, env, self) => {
  const inline = tokens[idx + 1];
  const text = inline && inline.type === "inline" ? inline.content : "";
  if (text) tokens[idx].attrSet("id", slugifyHeading(text));
  return self.renderToken(tokens, idx, options);
};

/** Resolve a relative link against the page that carries it, repo-root-relative. */
function resolveFromPage(pagePath, target) {
  const parts = pagePath.split("/").slice(0, -1);
  for (const segment of target.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") parts.pop();
    else parts.push(segment);
  }
  return parts.join("/");
}

/**
 * Rewrite one authored link into one the built page can follow.
 *
 * Authors write `../reference/api.md` because that is the link `check-doc-links`
 * and GitHub's own markdown view can both follow. The site serves .html, so the
 * target is resolved, turned back into a slug, and re-expressed as a relative
 * href from this page. Anything absolute, protocol-bearing or root-relative is
 * left exactly as written: it is either an external address or prose about an
 * app route, and neither is ours to touch.
 */
function rewriteHref(page, href) {
  if (!href) return href;
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("#") || href.startsWith("/")) return href;

  const hash = href.indexOf("#");
  const target = hash >= 0 ? href.slice(0, hash) : href;
  const anchor = hash >= 0 ? href.slice(hash) : "";
  if (!target) return href;

  const repoRel = resolveFromPage(page.path, target);
  const insideDocs = repoRel.startsWith("docs/");
  if (/\.md$/i.test(repoRel)) {
    return insideDocs ? relativeHref(page.slug, slugFor(repoRel)) + anchor : REPO_BLOB + repoRel + anchor;
  }
  return insideDocs ? relativeAsset(page.slug, repoRel) + anchor : REPO_BLOB + repoRel + anchor;
}

function eachToken(tokens, visit) {
  for (const token of tokens) {
    visit(token);
    if (token.children) eachToken(token.children, visit);
  }
}

function renderMarkdown(page) {
  const tokens = md.parse(page.body, {});
  eachToken(tokens, (token) => {
    if (token.type === "link_open") token.attrSet("href", rewriteHref(page, token.attrGet("href")));
    else if (token.type === "image") token.attrSet("src", rewriteHref(page, token.attrGet("src")));
  });
  return md.renderer.render(tokens, md.options, {});
}

// ── writing ───────────────────────────────────────────────────

function write(path, contents) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, "utf-8");
}

const escapeAttr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/**
 * The only thing `--base` does.
 *
 * Hrefs stay relative whatever the base is, because the same output has to
 * satisfy GitHub Pages under /PatterStage/, a local static server and a page
 * opened straight from disk. A canonical URL is the one thing that genuinely
 * needs the deployed origin, so it is added here rather than being threaded
 * through renderPage and tempting somebody to build hrefs out of it.
 */
function withCanonical(html, page, base) {
  if (!base) return html;
  const url = escapeAttr(`${base}${page.slug}.html`);
  const tags = `<link rel="canonical" href="${url}">\n<meta property="og:url" content="${url}">`;
  return html.replace("</head>", `${tags}\n</head>`);
}

/**
 * Copy docs/ assets into the site.
 *
 * Everything that is not a page and not the derived manifest: the screenshots
 * today, and whatever a page reasonably sits next to tomorrow. relativeAsset()
 * strips the "docs/" prefix from every asset href, so the tree is mirrored
 * rather than flattened and an image referenced from two tiers still resolves
 * from both.
 */
function copyAssets(docsDir, outDir) {
  for (const rel of walk(docsDir)) {
    if (/\.md$/i.test(rel) || rel === "manifest.json") continue;
    cpSync(join(docsDir, rel), join(outDir, rel));
  }
}

function main(argv) {
  const args = parseArgs(argv);
  const docsDir = args.docs;

  if (!existsSync(docsDir)) {
    console.error(`docs:build: ${toPosix(docsDir)} does not exist`);
    return 1;
  }

  const { pages, errors } = readPages(docsDir);
  if (errors.length > 0) {
    console.error(`docs:build: refusing to build, ${errors.length} front-matter problem(s):\n`);
    for (const error of errors) console.error(`  ${error}`);
    console.error("\nSee docs/contributing/ for the front-matter contract.");
    return 1;
  }

  const manifest = buildManifest(pages);
  const bySlug = new Map(pages.map((page) => [page.slug, page]));
  const ordered = manifest.order.map((slug) => bySlug.get(slug)).filter(Boolean);
  const manifestBytes = serialiseManifest(manifest);

  // Written on a full build and on --manifest-only, never on --help-only.
  // --help-only is what `prebuild` runs, and prebuild runs BEFORE lint in CI: a
  // help build that regenerated the derived view would hand check-derived-views
  // a file it had just rewritten, and a gate that blesses its own input checks
  // nothing at all.
  if (!args.helpOnly) write(join(docsDir, "manifest.json"), manifestBytes);
  if (args.manifestOnly) {
    console.log(`docs:build: docs/manifest.json, ${pages.length} pages.`);
    return 0;
  }

  const html = new Map(ordered.map((page) => [page.slug, renderMarkdown(page)]));
  // Both renderers put the title on the page from the front matter, so the
  // body's own opening H1 would say it a second time. Stripped once here rather
  // than in each renderer, so the site and the app cannot disagree about it.
  const body = (page) => stripLeadingH1(html.get(page.slug));
  const search = buildSearchIndex(ordered);
  const searchJson = `${JSON.stringify(search, null, 2)}\n`;

  if (!args.helpOnly) {
    // Removed rather than overwritten: a page that was renamed or retired leaves
    // its old .html behind, and a stale page nobody links to is still a page the
    // search index has forgotten and a reader can land on.
    rmSync(args.out, { recursive: true, force: true });
    for (const page of ordered) {
      write(join(args.out, `${page.slug}.html`), withCanonical(renderPage(page, body(page), manifest), page, args.base));
    }
    copyAssets(docsDir, args.out);
    write(join(args.out, "manifest.json"), manifestBytes);
    write(join(args.out, "search.json"), searchJson);
    write(join(args.out, "search-index.js"), `window.__PS_DOCS_SEARCH__ = ${JSON.stringify(search)};\n`);
    // Pages runs Jekyll over an artefact unless told not to, and Jekyll drops
    // every path beginning with an underscore.
    write(join(args.out, ".nojekyll"), "");
  }

  // ── public/help/: the SAME corpus, in the shape the app reads ──
  //
  // Deliberately not a copy of docs/manifest.json. That file is the derived
  // view a gate holds byte for byte, grouped by tier for the site's rail; the
  // app's resolver wants a flat list it can index by screen and by slug, and it
  // has to survive a half-written file, so it reads a shape whose every entry
  // stands alone. Two shapes of one corpus, generated together, is the only way
  // they cannot disagree.
  const help = join(ROOT, "public", "help");
  rmSync(help, { recursive: true, force: true });

  const generatedAt = new Date().toISOString();
  const helpPages = ordered.map((page) => {
    const entry = {
      slug: page.slug,
      title: page.data.title,
      summary: page.data.summary,
      section: page.data.section,
      nav: page.data.nav,
    };
    if (page.data.audience !== undefined) entry.audience = page.data.audience;
    if (page.data.screen !== undefined) entry.screen = page.data.screen;
    if (page.data.concepts !== undefined) entry.concepts = page.data.concepts;
    if (page.data.shots !== undefined) entry.shots = page.data.shots;
    return entry;
  });
  write(join(help, "manifest.json"), `${JSON.stringify({ generatedAt, pages: helpPages }, null, 2)}\n`);

  write(join(help, "search.json"), `${JSON.stringify({ generatedAt, entries: search }, null, 2)}\n`);

  // `short` is the concept page's own summary. One sentence written once, shown
  // in the popover and under the title, rather than a second short form for an
  // author to keep in step with the first.
  const concepts = ordered
    .filter((page) => page.data.section === "concepts")
    .map((page) => ({
      id: conceptIdFor(page),
      term: page.data.title,
      short: page.data.summary,
      slug: page.slug,
    }));
  write(join(help, "concepts.json"), `${JSON.stringify({ generatedAt, concepts }, null, 2)}\n`);

  for (const page of ordered) {
    write(join(help, "fragments", `${page.slug}.html`), `${renderFragment(page, body(page), manifest)}\n`);
  }
  // The fragments reference images by an app path, so the same files have to
  // sit under public/help/ as well as under site/.
  copyAssets(docsDir, help);

  const where = args.helpOnly ? "public/help/" : `${toPosix(args.out)}/ and public/help/`;
  console.log(`docs:build: ${pages.length} pages, ${search.length} search rows -> ${where}`);
  return 0;
}

const invokedDirectly = process.argv[1] && toPosix(process.argv[1]).endsWith("build-site.mjs");
if (invokedDirectly) {
  process.exit(main(process.argv.slice(2)));
}

export { main };
