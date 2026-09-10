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

  it.each(Object.keys(STAYS).sort())("%s says in its own header why it is not in a domain", (name) => {
    const head = readFileSync(join(LIB, name), "utf8").split(/\r?\n/).slice(0, 40).join("\n");
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
   * A move is not a rewrite. Nothing under `@/lib/` may be imported by a path
   * that no longer exists, and no file may be left importing itself through
   * its old home; `tsc` proves the first and this proves the second, cheaply,
   * for the paths a string import would hide from the compiler.
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
          if (new RegExp(`@/lib/${name}["'\`]`).test(text) || new RegExp(`src/lib/${name}\\.ts`).test(text)) {
            offenders.push(`${dir}/${rel.replace(/\\/g, "/")}: @/lib/${name}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
