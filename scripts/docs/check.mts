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
import { documentedRoutes } from "../../src/lib/modules/registry.ts";

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

  if (refusals.length > 0) {
    for (const refusal of refusals) console.error(refusal.message);
    process.exit(1);
  }

  console.log(`docs:check: ${pages.length} pages, ${routes.length} routes, every guide accounted for`);
}

main().catch((error: unknown) => {
  console.error(`docs:check: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
