// ═══════════════════════════════════════════════════════════════
// scripts/docs/check.mts — the docs gate, as a command
//
//   npm run docs:check      (also the fourth step of `npm run lint`)
//
// Four audits found the same class of defect: prose that named a screen which
// had moved, an image that had been renamed, a concept nobody defined, a
// generated table nobody had regenerated. Every one of those is checkable, so
// none of them is a review comment any more.
//
// This file is only the reading and the printing. Every decision — which
// refusals exist and exactly how each one is worded — is checkDocs() in
// ./lib.mjs, which the oracles call with fixtures. A gate whose logic lives in
// its own CLI can only be tested by running the CLI, and then the fixtures have
// to be a directory tree.
//
// .mts rather than .mjs because the covered route set is documentedRoutes()
// from src/lib/modules/registry.ts, which is TypeScript; tsx is already a
// devDependency and already runs db:migrate and generate:schema-json.
// ═══════════════════════════════════════════════════════════════

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { GENERATED_BLOCK_IDS, checkDocs, findGeneratedBlocks, parseDocFrontMatter, slugFor } from "./lib.mjs";
import type { DocPage } from "./lib.mjs";
import { generateBlock } from "./extract.ts";
import { documentedRoutes, railOrder } from "../../src/lib/modules/registry.ts";
import { CONCEPT_ATTACHMENTS } from "../../src/lib/help/concept-attachments.ts";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const DOCS = join(ROOT, "docs");

/** Repo-root-relative and forward-slashed: the form every refusal quotes. */
function rel(absolute: string): string {
  return relative(ROOT, absolute).split(sep).join("/");
}

function markdownFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) markdownFiles(full, out);
    else if (entry.name.endsWith(".md")) out.push(full);
  }
  return out;
}

/**
 * Every rail destination is documented by a GUIDE, not by whatever page
 * happened to name it.
 *
 * `route-without-guide` in checkDocs asks only that some page claims the screen,
 * which a tour page or a running-it note can satisfy. The `?` on a screen's
 * header resolves to the guide, so a rail entry whose only claimant is a tour
 * page would send the reader to a walkthrough instead of the reference.
 */
function railGuideRefusals(pages: DocPage[], routes: string[]): string[] {
  const out: string[] = [];
  // The rail routes that are also documented routes. The generated settings
  // editors sit on the rail as sub-links but share the Settings index's guide,
  // which is the same ruling documentedRoutes() makes.
  const documented = new Set(routes);
  for (const route of railOrder().filter((r) => documented.has(r))) {
    const claimants = pages.filter((p) => p.data.screen === route);
    const guides = claimants.filter((p) => p.data.section === "guides");
    if (guides.length === 1) continue;
    if (guides.length === 0) {
      out.push(`docs:check: the rail route ${route} has no page under docs/guides/ (${claimants.length} other page(s) name it)`);
    } else {
      out.push(
        `docs:check: the rail route ${route} is claimed by ${guides.length} guides ` +
          `(${guides.map((g) => g.slug).join(", ")}); a screen has one guide`,
      );
    }
  }
  return out;
}

/**
 * Every concept id a screen names is defined by the corpus.
 *
 * `<ConceptHint id="widget">` renders its children as plain text when the id is
 * unknown, which is the right runtime behaviour and exactly why it needs a gate:
 * a typo'd id is a hint that silently stops being a hint, and nothing on the
 * screen says so.
 */
function conceptHintRefusals(pages: DocPage[]): string[] {
  const defined = new Set(
    pages.filter((p) => p.data.section === "concepts").map((p) => p.slug.split("/").pop()!),
  );
  const out: string[] = [];
  const seen = new Set<string>();
  const used = new Set<string>();
  for (const file of sourceFiles(join(ROOT, "src"))) {
    const source = readFileSync(file, "utf-8");
    for (const match of source.matchAll(/<ConceptHint\s[^>]*id=["']([^"']+)["']/g)) {
      const id = match[1];
      used.add(id);
      if (defined.has(id)) continue;
      const key = `${rel(file)}:${id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(`docs:check: ${rel(file)} names concept "${id}", which no page under docs/concepts/ defines`);
    }
  }

  // The declared table and the screens have to agree in BOTH directions. A
  // declared attachment nobody rendered is a hint the plan promised and the
  // screen never got; an id rendered but undeclared is a hint no gate is
  // watching, which is how the first kind happens next time.
  for (const attachment of CONCEPT_ATTACHMENTS) {
    for (const id of attachment.conceptIds) {
      if (used.has(id)) continue;
      out.push(
        `docs:check: concept-attachments.ts declares "${id}" on ${attachment.screen}, ` +
          "and no screen renders a ConceptHint for it",
      );
    }
  }
  return out;
}

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

async function main(): Promise<void> {
  const files = markdownFiles(DOCS);
  const pages: DocPage[] = [];
  const malformed: string[] = [];

  for (const file of files) {
    const path = rel(file);
    const parsed = parseDocFrontMatter(readFileSync(file, "utf-8"), path);
    if (!parsed.ok) {
      malformed.push(...parsed.errors);
      continue;
    }
    pages.push({ path, slug: slugFor(path), data: parsed.data, body: parsed.body });
  }

  // A page whose front matter did not parse has no screen, no shots and no
  // concepts, so letting it through would turn one malformed header into a
  // handful of unrelated refusals about the guide it was meant to be. Every
  // line of this gate's output carries the gate's name, malformed headers
  // included, so a lint log can be read a line at a time.
  if (malformed.length > 0) {
    for (const error of malformed) console.error(`docs:check: ${error}`);
    console.error(
      `\n${malformed.length} page(s) have front matter this pipeline cannot read. ` +
        "The required keys are title, summary, section and nav.",
    );
    process.exit(1);
  }

  const routes = documentedRoutes();

  // Only the ids some page actually fences are generated. Nothing else needs
  // regenerating to answer the question, and four of the nine read the app's
  // own modules to produce their body.
  const fenced = new Set<string>();
  for (const page of pages) for (const block of findGeneratedBlocks(page.body)) fenced.add(block.id);

  const freshBlocks: Record<string, string> = {};
  for (const id of GENERATED_BLOCK_IDS) {
    if (fenced.has(id)) freshBlocks[id] = await generateBlock(id);
  }

  const refusals = checkDocs({
    pages,
    routes,
    imageExists: (repoRelPath: string) => existsSync(join(ROOT, repoRelPath)),
    freshBlocks,
  });

  // Two more, checked here rather than inside checkDocs() because both read
  // something the pure checker is not given: the rail's own order, and the
  // application source. checkDocs stays a function of its pages and its routes.
  const inAppRefusals = [...railGuideRefusals(pages, routes), ...conceptHintRefusals(pages)];

  if (refusals.length > 0 || inAppRefusals.length > 0) {
    for (const refusal of refusals) console.error(refusal.message);
    for (const line of inAppRefusals) console.error(line);
    process.exit(1);
  }

  console.log(`docs:check: ${pages.length} pages, ${routes.length} routes, every guide accounted for`);
}

main().catch((error: unknown) => {
  console.error(`docs:check: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
