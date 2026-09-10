/**
 * C0 · The line census.
 *
 * The consolidation programme's referee. The UI overhaul measured the
 * rendered product with a census that could only fall; this measures the
 * source the same way: lines by tree, lines inside a repeated window, and
 * the shapes the programme is making one (the route body, the hand-rolled
 * read, the write without the hook, the repeated type, the one-importer
 * component, the flat lib root, the comment essay, the inline db mock). A
 * baseline holds today's numbers; a batch that moves one the wrong way fails
 * the gate, and `--allow-growth "<reason>"` records the reason when it must.
 *
 * The ratchet is proven against a fixture tree, not the real one: a
 * baseline is cut, a file grows, the census refuses; the file shrinks, the
 * census passes and says what fell.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const SCRIPT = join(ROOT, "scripts", "tooling", "line-census.mjs");

const MEASURES = [
  "srcLines",
  "testLines",
  "srcRepeatedWindowLines",
  "testRepeatedWindowLines",
  "routesWithTryCatch",
  "handRolledReadHooks",
  "writeHooksWithoutMutation",
  "repeatedTypeShapeFiles",
  "oneImporterComponents",
  "libRootFiles",
  "commentEssays",
  "suitesMockingDbInline",
];

function census(args: string[]): { code: number; out: string } {
  try {
    const out = execFileSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { code: 0, out };
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    return { code: err.status ?? 1, out: `${err.stdout ?? ""}${err.stderr ?? ""}` };
  }
}

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), "line-census-"));
  mkdirSync(join(root, "src", "lib"), { recursive: true });
  mkdirSync(join(root, "tests", "unit"), { recursive: true });
  // No trailing newline, so a line count is the count of statements.
  writeFileSync(join(root, "src", "lib", "a.ts"), Array.from({ length: 10 }, (_, i) => `export const a${i} = ${i};`).join("\n"));
  writeFileSync(join(root, "tests", "unit", "a.test.ts"), 'describe("a", () => { it("is", () => {}); });');
  return root;
}

describe("C0 · the line census", () => {
  it("is a tooling script with a baseline, wired as npm run census:lines", () => {
    expect(existsSync(SCRIPT)).toBe(true);
    const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    expect(pkg.scripts["census:lines"]).toMatch(/line-census\.mjs/);
    const baseline = JSON.parse(read("scripts/tooling/line-census.baseline.json")) as { counts: Record<string, number> };
    for (const m of MEASURES) expect(typeof baseline.counts[m]).toBe("number");
  });

  it("refuses growth and accepts a fall, against a fixture tree", () => {
    const root = fixture();
    const baseline = join(root, "baseline.json");
    expect(census(["--root", root, "--baseline", baseline, "--update-baseline"]).code).toBe(0);
    const held = census(["--root", root, "--baseline", baseline]);
    expect(held.code).toBe(0);
    expect(held.out).toMatch(/measures held/);

    const a = join(root, "src", "lib", "a.ts");
    writeFileSync(a, readFileSync(a, "utf8") + "\nexport const more = 1;\nexport const still = 2;");
    const grew = census(["--root", root, "--baseline", baseline]);
    expect(grew.code).toBe(1);
    expect(grew.out).toMatch(/srcLines rose from 10 to 12/);
    expect(census(["--root", root, "--baseline", baseline, "--allow-growth", "a fixture"]).code).toBe(0);

    writeFileSync(a, "export const one = 1;");
    const fell = census(["--root", root, "--baseline", baseline]);
    expect(fell.code).toBe(0);
    expect(fell.out).toMatch(/srcLines fell from 10 to 1/);
  });

  // Sharpened in C1 (T-0136): a source batch that adds its oracle suite
  // raises testLines, and the re-cut that follows must not hold that rise
  // silently. The reason goes into the baseline beside the number.
  it("a re-cut holds a rise only with a reason, and writes the reason down", () => {
    const root = fixture();
    const baseline = join(root, "baseline.json");
    expect(census(["--root", root, "--baseline", baseline, "--update-baseline"]).code).toBe(0);
    const t = join(root, "tests", "unit", "a.test.ts");
    writeFileSync(t, readFileSync(t, "utf8") + '\nit("more", () => {});');
    const refused = census(["--root", root, "--baseline", baseline, "--update-baseline"]);
    expect(refused.code).toBe(1);
    expect(refused.out).toMatch(/would hold a rise: testLines rose from 1 to 2/);
    const held = census(["--root", root, "--baseline", baseline, "--update-baseline", "--allow-growth", "the batch adds its oracle"]);
    expect(held.code).toBe(0);
    const written = JSON.parse(readFileSync(baseline, "utf8")) as { counts: { testLines: number }; allowed: { rise: string; reason: string }[] };
    expect(written.counts.testLines).toBe(2);
    expect(written.allowed).toEqual([expect.objectContaining({ rise: "testLines rose from 1 to 2", reason: "the batch adds its oracle" })]);
  });

  it("the recon and the plan are filed, and the plan is measured by it", () => {
    const recon = read("org/reviews/2026-09-consolidation-recon.md");
    expect(recon).toMatch(/^status: done$/m);
    const plan = read("org/plans/2026-09-consolidation.md");
    // `approved` while the programme ran, `done` once C8 closed it (T-0145).
    // Anything else means the plan was filed without a ruling or edited by hand.
    expect(plan).toMatch(/^status: (?:approved|done)$/m);
    expect(plan).toMatch(/line-census/);
    for (const m of ["srcLines", "testLines", "routesWithTryCatch", "oneImporterComponents", "libRootFiles"]) {
      expect(plan).toContain(m);
    }
    // It knows the programme it follows.
    expect(plan).toMatch(/2026-08-consolidation/);
  });

  it("the testing guide names both censuses", () => {
    const testing = read("docs/contributing/testing.md");
    expect(testing).toMatch(/npm run census\b/);
    expect(testing).toMatch(/census:lines/);
  });
});
