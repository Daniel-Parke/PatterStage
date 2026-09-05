/** @jest-environment node */
/**
 * B2 (T-0096): the copy law, written down and measured.
 *
 * The review found three registers of copy on the product's screens (novice,
 * operator, Hermes-internal) and the last two dominating; an ADR reference on
 * the Agents page; task ids in tooltips. docs/contributing/copy.md says which register each
 * surface speaks and what may never appear in user copy. copy-lint.mjs measures
 * the debt in --report mode; it becomes a gate once the sweep in B18 lands.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { decide, findCopyDebt } from "../../scripts/tooling/copy-lint.mjs";

const ROOT = join(__dirname, "..", "..");

describe("docs/contributing/copy.md", () => {
  const path = join(ROOT, "docs", "contributing", "copy.md");
  it("exists and names the three registers and the forbidden references", () => {
    expect(existsSync(path)).toBe(true);
    const doc = readFileSync(path, "utf-8");
    expect(doc).toMatch(/novice/i);
    expect(doc).toMatch(/operator/i);
    expect(doc).toMatch(/internal/i);
    expect(doc).toMatch(/ADR-/);
    expect(doc).toMatch(/T-00/);
    expect(doc).toMatch(/sentence case/i);
    expect(doc).toMatch(/Pull from Hermes/);
    expect(doc).toMatch(/Push to Hermes/);
  });
});

describe("copy-lint", () => {
  it("finds a governance reference in user-visible copy", () => {
    const hits = findCopyDebt("src/app/x/page.tsx", [
      "<p>Capability measurement is not implemented; see ADR-0004.</p>",
      'title="Ruled in WG-ARCH-003"',
      'showToast("Done (T-0089)", "success");',
      "// ADR-0004 in a comment is not copy",
      // An import line carrying an id in its exact form: the maintainer's
      // business, never rendered.
      'import { T0089 } from "@/lib/T-0089-fixture";',
    ]);
    expect(hits.map((h) => h.line)).toEqual([1, 2, 3]);
  });

  it("decides: --report never fails, --check fails on any hit, an empty walk fails either way", () => {
    expect(decide("--report", 12, 400)).toBe(0);
    expect(decide("--check", 0, 400)).toBe(0);
    expect(decide("--check", 1, 400)).toBe(1);
    expect(decide("--report", 0, 3)).toBe(2);
    expect(decide("--check", 0, 3)).toBe(2);
  });

  it("reports without failing the build, for now", () => {
    const r = spawnSync(process.execPath, [join(ROOT, "scripts", "tooling", "copy-lint.mjs"), "--report"], {
      cwd: ROOT,
      encoding: "utf-8",
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/copy-lint:/);
  });

  it("is wired as npm run lint:copy", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8")) as { scripts: Record<string, string> };
    expect(pkg.scripts["lint:copy"]).toMatch(/copy-lint\.mjs --report/);
  });
});
