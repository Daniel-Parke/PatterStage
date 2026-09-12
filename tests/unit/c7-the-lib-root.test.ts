/**
 * C7 · The lib root.
 *
 * Seventy-one files sat directly under `src/lib/`, beside thirty domain
 * directories that T-0010 and the batches since had already carved out. A
 * root that big is not a layer: it is where a file goes when nobody decides,
 * and `@/lib/thing` tells a reader nothing about which part of the product
 * `thing` belongs to. The API layer, the config family, the deploy and host
 * helpers, thirteen repositories and the presentation helpers each have a
 * domain; this batch puts them in it, by script, with every import rewritten.
 *
 * What stays is what belongs to no domain, and each one says so in its own
 * header: the cross-cutting helpers every layer uses, and `db-schema`, which
 * is deliberately outside `src/lib/db/` because the global `@/lib/db` mock
 * would otherwise intercept it inside the migration tests.
 *
 * The plan's C7 row; the recon at org/reviews/2026-09-consolidation-recon.md.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const LIB = join(ROOT, "src", "lib");

/** Every file left at the root, and the reason it is not in a domain. */
const STAYS: Record<string, RegExp> = {
  "utils.ts": /every layer|cross-cutting|no domain/i,
  "secret-mask.ts": /config|logger|API|no domain|every layer/i,
  "feature-flags.ts": /every layer|read everywhere|no domain/i,
  "feature-flags-guard.ts": /flags it guards|beside the flags|no domain/i,
  "parse-bag-flags.ts": /routes|CLI|no domain|every layer/i,
  "db-schema.ts": /mock/i,
};

describe("C7 · the lib root", () => {
  const rootFiles = readdirSync(LIB)
    .filter((f) => f.endsWith(".ts"))
    .sort();

  it("holds only the files that belong to no domain", () => {
    expect(rootFiles).toEqual(Object.keys(STAYS).sort());
  });

  /**
   * The marker AND the reason. The reason alone was too soft to hold: the
   * mutation sweep cut the marker off `utils.ts` and the check still passed,
   * because the words "every layer" survived in ordinary prose underneath it.
   * A file at the root has to say, in those words, that it is there on
   * purpose, and then say why.
   */
  it.each(Object.keys(STAYS).sort())("%s says in its own header that it is at the root on purpose, and why", (name) => {
    const head = readFileSync(join(LIB, name), "utf8").split(/\r?\n/).slice(0, 40).join("\n");
    expect(head).toContain("AT THE LIB ROOT ON PURPOSE");
    expect(head).toMatch(STAYS[name]);
  });

  it("the census agrees, and the plan's line is met", () => {
    const out = execFileSync(process.execPath, [join(ROOT, "scripts", "tooling", "line-census.mjs"), "--report"], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    const report = JSON.parse(out) as { counts: { libRootFiles: number }; libRoot: { files: string[] } };
    expect(report.counts.libRootFiles).toBeLessThanOrEqual(12);
    expect(report.counts.libRootFiles).toBe(rootFiles.length);
    expect(report.libRoot.files.sort()).toEqual(Object.keys(STAYS).map((f) => `src/lib/${f}`).sort());
  });

  /**
   * A move is not a rewrite, and this batch found that a file is named FIVE
   * ways: the alias `@/lib/x`; the path `src/lib/x.ts` in prose or a doc; the
   * segments `"src", "lib", "x.ts"` a suite passes to join(); the relative
   * `../../src/lib/x` that scripts/ and tests/e2e/ use because the alias does
   * not reach them; and the alias escaped inside a regex literal, which is how
   * a suite matches an import line. The codemod rewrote the first at once and
   * the rest only after each broke something: four suites read a source by
   * segments, five scripts imported one relatively, and two matched one by an
   * escaped regex. `tsc` proves the imports that resolve through the compiler;
   * this proves the four spellings it cannot see.
   *
   * One more shape has no rule here and is worth knowing about: a path
   * ALTERNATION inside a regex (`@/lib/(models|credentials)-repository`).
   * Nothing can rewrite that mechanically, and a `not.toMatch` built on one
   * passes vacuously the moment the path stops existing, which is what
   * b6-models-diff-route did until C7 rewrote it as the rule it meant.
   */
  it("no source or test names a lib path that moved", () => {
    const gone = Object.keys(
      JSON.parse(readFileSync(join(ROOT, "scripts", "tooling", "lib-moves.json"), "utf8")) as Record<string, string>,
    );
    const offenders: string[] = [];
    for (const dir of ["src", "tests", "scripts", "docs"]) {
      const walk = (d: string): string[] =>
        readdirSync(join(ROOT, dir, d), { withFileTypes: true }).flatMap((e) =>
          e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)],
        );
      for (const rel of walk(".")) {
        if (!/\.(ts|tsx|mjs|js|md)$/.test(rel)) continue;
        const text = readFileSync(join(ROOT, dir, rel), "utf8");
        for (const name of gone) {
          const segments = new RegExp(`"src",\\s*"lib",\\s*"${name}\\.ts"`);
          const relative = new RegExp(`(?:\\.\\./)+src/lib/${name}["'\`]`);
          const escaped = new RegExp(`@\\\\/lib\\\\/${name}(?![\\w\\\\-])`);
          if (
            new RegExp(`@/lib/${name}["'\`]`).test(text) ||
            new RegExp(`src/lib/${name}\\.ts`).test(text) ||
            segments.test(text) ||
            relative.test(text) ||
            escaped.test(text)
          ) {
            offenders.push(`${dir}/${rel.replace(/\\/g, "/")}: @/lib/${name}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
