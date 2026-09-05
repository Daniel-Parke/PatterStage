/**
 * B15 (T-0109), decisions 3 and 9 — the pipeline is wired, not just written.
 *
 * A generator nobody runs is a folder of dead code, and this repository has the
 * receipts: `eos-compile.mjs` still names paths it has not written since the
 * scale matrix changed shape. So B15's generator is held to the same standard as
 * every other gate here — it runs inside `npm run lint` (by EXIT CODE, never by
 * grepping its output), it runs in CI, its derived file is held by
 * `check-derived-views`, and its two outputs are git-ignored so nobody commits a
 * build.
 *
 * This file also holds the doc-coverage claim against the LIVE registry rather
 * than a copy: `allModuleRoutes()` is imported for real and the covered set is
 * derived from it, because the route list is still moving (B9 is deleting
 * `/agent/personalities` as this is written). A hard-coded list of routes would
 * be stale before the batch landed.
 *
 * Red today: no scripts/docs, no npm scripts, no workflow, no manifest.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { allModuleRoutes, documentedRoutes } from "@/lib/modules/registry";

const ROOT = join(__dirname, "..", "..");

function read(...parts: string[]): string {
  const path = join(ROOT, ...parts);
  if (!existsSync(path)) {
    throw new Error(`B15 contract: ${parts.join("/")} does not exist yet.`);
  }
  return readFileSync(path, "utf-8");
}

interface PackageJson {
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

const pkg = (): PackageJson => JSON.parse(read("package.json")) as PackageJson;

describe("B15 · the five scripts under scripts/docs/", () => {
  it.each([
    ["lib.mjs", "the pure half: front matter, slugs, manifest, links, render, checkDocs"],
    ["build-site.mjs", "the generator: site/ and public/help/"],
    ["check.mts", "the doc-coverage gate, run through tsx inside npm run lint"],
    ["extract.ts", "the generated-block extractor"],
    ["serve.mjs", "npm run docs:serve"],
  ])("scripts/docs/%s exists (%s)", (file) => {
    expect(existsSync(join(ROOT, "scripts", "docs", file))).toBe(true);
  });

  it("declares lib.mjs's shapes beside it, as every other tooling .mjs does", () => {
    // Same arrangement as scripts/tooling/output-canary.d.mts and design-lint.d.mts:
    // the module is plain ESM so bare node can run it, and the types live next door
    // so `npm run typecheck:tests` can see what the tests are calling.
    expect(existsSync(join(ROOT, "scripts", "docs", "lib.d.mts"))).toBe(true);
  });
});

describe("B15 · npm scripts", () => {
  it("adds docs:build, docs:serve, docs:check and docs:generate", () => {
    const { scripts } = pkg();
    expect(scripts["docs:build"]).toContain("scripts/docs/build-site.mjs");
    expect(scripts["docs:serve"]).toContain("scripts/docs/serve.mjs");
    expect(scripts["docs:check"]).toContain("scripts/docs/check.mts");
    expect(scripts["docs:generate"]).toContain("scripts/docs/extract.ts");
  });

  it("runs check.mts and extract.ts through tsx, which is already a devDependency", () => {
    const { scripts, devDependencies } = pkg();
    expect(devDependencies.tsx).toBeDefined();
    expect(scripts["docs:check"]).toContain("tsx");
    expect(scripts["docs:generate"]).toContain("tsx");
  });

  it("puts the doc-coverage gate inside npm run lint", () => {
    expect(pkg().scripts.lint).toContain("docs/check.mts");
  });

  it("builds the in-app Help fragments as part of prebuild", () => {
    // public/help/ is what B16 renders; it must exist before `next build` runs,
    // and it must never be committed.
    const { scripts } = pkg();
    expect(scripts.prebuild).toContain("scripts/tooling/prebuild-db.mjs");
    expect(scripts.prebuild).toContain("scripts/docs/build-site.mjs");
  });

  it("adds a markdown renderer and no framework", () => {
    const { dependencies, devDependencies } = pkg();
    expect(devDependencies["markdown-it"]).toBeDefined();
    // js-yaml is ALREADY a dependency of this repo and already parses this
    // convention; a second front-matter parser is not needed. See the contract's
    // divergence D3.
    expect(dependencies["js-yaml"]).toBeDefined();
    for (const name of ["next-mdx-remote", "docusaurus", "vitepress", "@11ty/eleventy", "astro"]) {
      expect(devDependencies[name]).toBeUndefined();
      expect(dependencies[name]).toBeUndefined();
    }
  });
});

describe("B15 · the two build outputs are git-ignored", () => {
  it("ignores site/ and public/help/", () => {
    const gitignore = read(".gitignore");
    expect(gitignore).toMatch(/^\/?site\/?$/m);
    expect(gitignore).toMatch(/^\/?public\/help\/?$/m);
  });
});

describe("B15 · docs/manifest.json is a derived view with a gate", () => {
  it("check-derived-views knows about it", () => {
    // The script today holds org/TASKS.md alone. A derived file with no checker
    // is a file that drifts: that is the incident its own header records.
    expect(read("scripts", "tooling", "check-derived-views.mjs")).toContain("docs/manifest.json");
  });

  it("says in as many words that it must not be hand-edited", () => {
    expect(read("docs", "manifest.json").length).toBeGreaterThan(0);
    expect(read("scripts", "tooling", "check-derived-views.mjs")).toContain(
      "Do NOT hand-edit docs/manifest.json",
    );
  });
});

describe("B15 · the manifest covers every documented registry route", () => {
  /** Decision 8: the generated /agent/settings/<section> editors share one guide,
   *  so the covered set is the rail's own routes plus the Settings index. Read
   *  from the SHIPPED function rather than recomputed here: a copy of the filter
   *  in the test is a second definition, and the gate would go on passing while
   *  documentedRoutes() drifted away from it. */
  const documented = documentedRoutes();

  it("derives a non-trivial route set from the live registry", () => {
    expect(documented.length).toBeGreaterThan(15);
    expect(documented).toContain("/work/missions");
    expect(documented).toContain("/agent/settings");
    expect(documented).not.toContain("/agent/settings/agent");
  });

  it("is the rail's routes minus the generated settings editors, and nothing else", () => {
    // The definition, pinned once against allModuleRoutes(). Without this the
    // case above passes for any filter that happens to keep /work/missions and
    // drop one settings section.
    const all = allModuleRoutes();
    expect(all.length).toBeGreaterThan(documented.length);
    expect([...documented].sort()).toEqual(
      all.filter((p) => p === "/agent/settings" || !p.startsWith("/agent/settings/")).sort(),
    );
  });

  it("has a guide for each of them", () => {
    const manifest = JSON.parse(read("docs", "manifest.json")) as {
      screens: Record<string, string>;
    };
    expect(documented.filter((route) => !manifest.screens[route])).toEqual([]);
  });

  it("declares no screen the registry does not have", () => {
    const manifest = JSON.parse(read("docs", "manifest.json")) as {
      screens: Record<string, string>;
    };
    const routes = allModuleRoutes();
    expect(Object.keys(manifest.screens).filter((r) => !routes.includes(r))).toEqual([]);
  });

  it("defines every concept its pages name", () => {
    const manifest = JSON.parse(read("docs", "manifest.json")) as {
      concepts: string[];
      sections: Array<{ pages: Array<{ slug: string; concepts?: string[] }> }>;
    };
    expect(manifest.concepts.length).toBeGreaterThan(0);
    const named = new Set(
      manifest.sections.flatMap((s) => s.pages.flatMap((p) => p.concepts ?? [])),
    );
    expect([...named].filter((id) => !manifest.concepts.includes(id))).toEqual([]);
  });
});

describe("B15 · publishing (decision 9)", () => {
  it("adds the Pages workflow", () => {
    expect(existsSync(join(ROOT, ".github", "workflows", "docs-pages.yml"))).toBe(true);
  });

  it("deploys only from main, under the /PatterStage/ base path", () => {
    const workflow = read(".github", "workflows", "docs-pages.yml");
    expect(workflow).toContain("actions/upload-pages-artifact");
    expect(workflow).toContain("actions/deploy-pages");
    expect(workflow).toContain("/PatterStage/");
    expect(workflow).toMatch(/branches:\s*\[\s*main\s*\]/);
    expect(workflow).toContain("pages: write");
  });

  it("builds the site in CI too, so a broken generator is caught before main", () => {
    expect(read(".github", "workflows", "ci.yml")).toContain("docs:build");
  });
});
