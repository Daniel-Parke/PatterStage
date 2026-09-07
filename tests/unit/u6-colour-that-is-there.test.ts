/**
 * U6 (T-0120), part one: colour that is actually there.
 *
 * Tailwind scans source statically and generates a utility only for a class it
 * can SEE as a literal string. `globals.css` says `@import "tailwindcss"` with
 * no `@source`, so v4's automatic detection scans the whole project bar what
 * .gitignore excludes: `org/`, `docs/`, `tests/`, every task record and every
 * markdown file. A class name written in PROSE therefore becomes real CSS.
 *
 * Measured: 94 candidate-shaped strings, 46 of them naming a colour, exist in
 * the shipped stylesheet only because a file outside `src/` mentions them. Some
 * are classes these batches deliberately deleted from the product -
 * `bg-dark-900/50`, `bg-ps-surface-well`, `border-white/10` - still emitted
 * because the reconnaissance describes them.
 *
 * And one of them is load-bearing. The dashboard's Spend pill has a border
 * because `border-yellow-400/20` appears exactly once in the repository, in
 * `org/reviews/2026-09-ui-recon.md`, the document REPORTING that the border
 * does not work. StatPill builds that class with
 * `textColor.replace(/^text-/, "border-") + "/20"`, which Tailwind cannot see.
 * Pinning the scan to `src/` and rebuilding, the pill's border computes to
 * `rgba(255, 255, 255, 0.92)`: the solid white ring the recon described. The
 * recon was right, and committing it is what made it wrong.
 *
 * So the fix is two-sided. Pin the scan, so the stylesheet is what the code
 * asks for; and stop building class names by string surgery, so the code asks
 * for what it means.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { RULES, violationsIn } from "../../scripts/tooling/design-lint.mjs";

const ROOT = join(__dirname, "..", "..");
const SRC = join(ROOT, "src");

const read = (rel: string) => readFileSync(join(ROOT, rel), "utf-8").replace(/\r\n/g, "\n");

/** Every .ts/.tsx under src/, keyed by its repo-relative path. */
function sources(): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name)) {
        out.push([
          `src/${full.slice(SRC.length + 1).split("\\").join("/")}`,
          readFileSync(full, "utf-8").replace(/\r\n/g, "\n"),
        ]);
      }
    }
  };
  walk(SRC);
  return out;
}

describe("the stylesheet is what the code asks for", () => {
  const css = () => read("src/app/globals.css");

  /**
   * Automatic source detection is the default and it is too wide for a
   * repository that documents its own class names. The app is entirely in
   * `src/`; the generated help fragments carry no `class` attribute at all
   * (they are styled by `.ps-help-prose` descendant selectors), so nothing
   * outside `src/` needs scanning.
   */
  it("scans src/ and nothing else", () => {
    expect(css()).toMatch(/@import "tailwindcss" source\(none\)/);
    expect(css()).toMatch(/@source\s+"\.\.\/\.\.\/src"/);
  });

  it("and says why, because the next person will want to widen it", () => {
    const at = css().indexOf("@source");
    // Not `Math.max(0, at - 1200)` on a missing directive: indexOf returns -1
    // and the slice then reads the whole file, which contains the word
    // "recon" somewhere and passes for no reason at all.
    expect(at).toBeGreaterThan(-1);
    expect(css().slice(Math.max(0, at - 1200), at)).toMatch(/recon|prose|document|org\//i);
  });
});

describe("no component builds a class name it cannot spell", () => {
  /**
   * Three shapes, all of which produce a class Tailwind never generates. The
   * first two are what `no-template-literal-tailwind` already refused; the
   * third and fourth are how the two live defects were written, and the rule
   * did not see either.
   */
  it.each([
    ["an interpolated prefix", '<div className={`border-${tone} p-2`} />'],
    ["an opacity on an interpolation", '<div className={`${iconColorMap[c]}/60`} />'],
    ["replace() onto a utility prefix", 'const b = textColor.replace(/^text-/, "border-") + "/20";'],
    ["two interpolations touching in a className", '<Icon className={`w-4 h-4 ${iconColorMap[color]}${opacityClass}`} />'],
  ])("the linter refuses %s", (_what, line) => {
    const ids = [...violationsIn("src/components/x.tsx", [line]).keys()].map((k) => k.split("::")[0]);
    expect(ids).toContain("no-template-literal-tailwind");
  });

  /**
   * The half that matters more. A rule that fires on the replacement is a rule
   * nobody can satisfy, and every one of these is an ordinary line.
   */
  it.each([
    ["a literal class", '<div className="border-neon-cyan/20 rounded-ps-md" />'],
    ["a whole class chosen from a map", '<div className={TONE[status].border} />'],
    ["a template that interpolates a WHOLE class", '<div className={`${TONE[status]} rounded-ps-md`} />'],
    ["a url", 'const href = `/api/composer/runs/${id}/events`;'],
    ["a message", 'showToast(`Deleted ${label}${suffix}`, "success");'],
  ])("and leaves %s alone", (_what, line) => {
    const ids = [...violationsIn("src/components/x.tsx", [line]).keys()].map((k) => k.split("::")[0]);
    expect(ids).not.toContain("no-template-literal-tailwind");
  });

  it("so no site in src/ builds one", () => {
    const offenders: string[] = [];
    for (const [path, source] of sources()) {
      const lines = source.split("\n");
      const ids = violationsIn(path, lines);
      for (const key of ids.keys()) {
        if (key.startsWith("no-template-literal-tailwind::")) {
          offenders.push(`${path}  ${ids.get(key)![0].text.slice(0, 70)}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("has the rule at all, so none of this passes vacuously", () => {
    expect(RULES.map((r: { id: string }) => r.id)).toContain("no-template-literal-tailwind");
  });
});

describe("the accent maps are written out, one class per entry", () => {
  /**
   * StatPill derived its border from its text colour with a regex, so three of
   * the eight accents had no border rule at all and every one of the eight had
   * a dead hover. The file beside it already says how this is done:
   * theme.ts's own comment reads "The accent maps below are written out
   * LITERALLY, one class per entry."
   */
  it("StatPill picks its border from a map rather than editing a string", () => {
    const source = read("src/components/dashboard/StatPill.tsx");
    expect(source).not.toMatch(/\.replace\(/);
    expect(source).toMatch(/pillBorderMap|colorBorderMap/);
  });

  it("and the map has an entry for every accent, resting and hover", () => {
    const theme = read("src/lib/theme.ts");
    for (const accent of ["cyan", "purple", "green", "pink", "orange", "red", "blue", "yellow"]) {
      expect(theme).toMatch(new RegExp(`${accent}:\\s*"[^"]*border-`));
    }
  });

  it("ModelsSectionHeader's muted icon is a class, not two interpolations", () => {
    const source = read("src/components/models/ModelsSectionHeader.tsx");
    expect(source).not.toMatch(/\$\{[^}]+\}\$\{[^}]+\}/);
  });
});
