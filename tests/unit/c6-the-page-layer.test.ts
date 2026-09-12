/**
 * C6 · The page layer.
 *
 * The overhaul built the primitives and the token ladder (U2, U8) and left a
 * debt with a direction: design-lint's baseline held 221 inline card chromes
 * in 86 files, 74 raw palette colours, 20 arbitrary z values, 23 raw controls
 * outside ui/, 12 raw border alphas and 19 page-level writes that never went
 * through runWrite. Eleven screens and hooks still read the API from an
 * effect of their own (held on the census by name since C3), and two of them
 * swap their body for a spinner on every reload, the defect T-0139 fixed on
 * Models. Twenty-five components under sixty lines have exactly one importer
 * and no life of their own.
 *
 * After this batch: the six rules read zero on the tree and the pragmas that
 * excuse a genuine exception are few enough to read in a minute; every
 * effect read is a useApiResource; the folds are folded.
 *
 * The recon: org/reviews/2026-09-consolidation-recon.md §5; the plan's C6 row.
 */

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { scanTree, splitBaseline } from "../../scripts/tooling/design-lint.mjs";

const ROOT = join(__dirname, "..", "..");

const RULES_C6 = [
  "no-inline-card-chrome",
  "palette-must-be-house",
  "z-scale-only",
  "no-raw-control-outside-ui",
  "no-raw-border-alpha",
  "no-raw-write-outside-the-helper",
];

/** A pragma may excuse a line that is genuinely not the thing the rule names; it may not be the batch. */
const PRAGMA_CEILING = 12;
const ONE_IMPORTER_CEILING = 105;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

const SRC = walk(join(ROOT, "src"));

describe("C6 · the page layer", () => {
  const { counts } = scanTree() as { counts: Record<string, number> };

  /**
   * Amended 2026-09-12 (T-0154, K6), under operator ruling Q-015 (2026-09-12):
   * a closed-programme oracle may change for the one rule its ruled item fixes,
   * dated and attributed, authored by a session that does not implement the
   * fix. The case keeps its name, as the ruling requires. One rule changes;
   * the other five below read zero exactly as before, and no violation is
   * blessed away.
   *
   * The rule, and why. components-01, ruled "fix now, baseline with a reason"
   * (Daniel Parke, operator, 2026-09-12): design-lint.mjs:436 matched
   * `<(?:button|input|select|textarea)(?=[\s/>])`, so an opening tag that ENDS
   * ITS LINE — the ordinary shape when a control's attributes are on the lines
   * below it — was invisible. The rule reported zero for this whole programme
   * while the tree held 104 raw controls in 43 files. The lookahead gains `|$`,
   * and the 104 go into design-lint.baseline.json under --allow-growth with the
   * reason recorded beside them.
   *
   * So for THAT rule, zero on the tree was never a fact; it was a measurement
   * error, and asserting it would mean either keeping the rule blind or
   * refusing the fix. What this case now requires of it is the ratchet the
   * baseline exists for: no file above the count the baseline holds for it, so
   * a new raw control is refused the moment it is written, and the burn-down
   * through the component and app batches can only take the number down. The
   * baseline's own honesty — that every held key was admitted by a dated growth
   * entry that names the rule — is held in tests/unit/k6-the-gates-see.test.ts,
   * which also proves the shipped pattern could not see the shape at all.
   */
  const BASELINED_BY_RULING = new Set(["no-raw-control-outside-ui"]);

  it.each(RULES_C6)("%s reads zero on the tree", (rule) => {
    const found = Object.entries(counts).filter(([key]) => key.startsWith(`${rule}::`));

    if (BASELINED_BY_RULING.has(rule)) {
      const { counts: baseline } = splitBaseline(
        JSON.parse(
          readFileSync(join(ROOT, "scripts", "tooling", "design-lint.baseline.json"), "utf8"),
        ) as unknown,
      );
      const above = found
        .filter(([key, n]) => n > (baseline[key] ?? 0))
        .map(([key, n]) => `${key.slice(rule.length + 2)}: ${n} found, ${baseline[key] ?? 0} allowed`);
      expect(above).toEqual([]);
      return;
    }

    expect(found.map(([key, n]) => `${key.slice(rule.length + 2)}: ${n}`)).toEqual([]);
  });

  it("the pragmas that excuse the six rules are few enough to read", () => {
    const re = new RegExp(`design-lint-disable-next-line (${RULES_C6.join("|")})\\b`, "g");
    const pragmas = SRC.flatMap((f) => {
      const text = readFileSync(f, "utf8");
      return [...text.matchAll(re)].map((m) => `${f.slice(ROOT.length + 1).replace(/\\/g, "/")}: ${m[1]}`);
    });
    expect(pragmas.length).toBeLessThanOrEqual(PRAGMA_CEILING);
  });

  /**
   * The skip link is `sr-only` until it is focused, so its SIZE has to be
   * focus-only too: unprefixed height and padding utilities override the 1x1
   * clip and the hidden link becomes a 22x26 target on every route, which is
   * how C6 first broke gate 8. The literals cannot be composed from the scale
   * at runtime (Tailwind compiles what it reads in the source), so this holds
   * them to it instead.
   */
  it("the skip link wears the button's scale, on focus only", () => {
    const layout = readFileSync(join(ROOT, "src", "app", "layout.tsx"), "utf8");
    const chrome = readFileSync(join(ROOT, "src", "components", "ui", "button-chrome.ts"), "utf8");
    const size = [/buttonHeights[\s\S]*?sm: "([^"]+)"/, /buttonPadding[\s\S]*?sm: "([^"]+)"/]
      .flatMap((re) => (chrome.match(re)?.[1] ?? "").split(/\s+/))
      .filter(Boolean);
    expect(size.length).toBeGreaterThanOrEqual(4);
    const link = layout.split(/\r?\n/).find((l) => l.includes("sr-only focus:not-sr-only")) ?? "";
    for (const cls of size) expect(link).toContain(`focus:${cls}`);
    // And nothing that sizes the box unprefixed.
    expect(link.replace(/focus:\S+/g, "")).not.toMatch(/(?:^|\s)(?:h|w|p[xytblr]?)-/);
  });

  it("no screen or hook reads the API from an effect of its own", () => {
    const out = execFileSync(process.execPath, [join(ROOT, "scripts", "tooling", "line-census.mjs"), "--report"], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    const report = JSON.parse(out) as {
      counts: { handRolledReadHooks: number; oneImporterComponents: number };
      reads: { files: string[] };
      oneImporter: { files: [string, number][] };
    };
    expect(report.reads.files).toEqual([]);
    expect(report.counts.handRolledReadHooks).toBe(0);
    const small = report.oneImporter.files.filter(([, n]) => n < 60).map(([f]) => f);
    // The re-exports through an index are not folds; everything else under sixty lines is.
    expect(small.filter((f) => !/\/ui\/field\/|\/achievements\//.test(f))).toEqual([]);
    expect(report.counts.oneImporterComponents).toBeLessThanOrEqual(ONE_IMPORTER_CEILING);
  });
});
