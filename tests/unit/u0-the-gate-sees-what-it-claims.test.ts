/**
 * U0 (T-0114), the UI overhaul's first batch: three places where a gate, or a
 * comment, says something about this tree that is not true.
 *
 * A gate reporting zero is only worth what its blindest case is worth, and the
 * design-lint baseline is `{}` — every rule reports zero across 105k lines. Two
 * of those zeros are wrong:
 *
 *   1. `no-raw-colour-in-tsx` is anchored with `\brgba?\(`. Tailwind writes a
 *      space as `_` inside an arbitrary value, and `_` is a word character, so
 *      there is no word boundary in `shadow-[0_0_8px_rgba(6,214,214,0.3)]`. The
 *      rule reports "0 in 0 files" while two raw colours ship, and both are
 *      colours no token declares: #06d6d6, a teal, and #22d3ee, Tailwind's
 *      cyan-400 sitting on the same element as a `ring-neon-cyan/60` that IS
 *      the brand cyan.
 *
 *   2. `no-sub-12px-type` matches only the Tailwind class syntax. An SVG chart
 *      sets its size as a prop, so `fontSize={8}` walks past a rule whose whole
 *      subject is type below 12px, and the Insights charts render axis labels
 *      at two-thirds the minimum the project declares readable.
 *
 * The third is not a gate but a comment. globals.css carries a 39-line block
 * asserting that around twenty of its own rules "currently paint nothing", and
 * instructing the next maintainer not to fix them. Measured against the built
 * stylesheet from `npm run build`, `.glow-cyan` emits
 * `box-shadow:0 0 14px rgb(var(--ps-rgb-neon-cyan) / .08)` and the mirror emits
 * `--ps-rgb-neon-cyan:0 191 255`, which is exactly the space-separated form
 * `rgb(… / a)` consumes. The premise was true when it was written and stopped
 * being true on 2026-08-24 when the mirrors moved off comma lists; the comment
 * did not follow. A confident wrong claim in the design system's central file
 * is inherited by every session that reads it.
 *
 * Fourth, unrelated to design and found by running the gate rather than reading
 * it: `npm run lint:knip` exits 1 on this tree and has since T-0113. `npm run
 * lint` does not include knip, so a green lint hid it. Four symbols are
 * exported and used only inside their own file.
 *
 * Authored before any file under src/ or scripts/ was edited. Every case below
 * was red on write.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { RULES, scanTree, violationsIn } from "../../scripts/tooling/design-lint.mjs";

const ROOT = join(__dirname, "..", "..");
const read = (relative: string): string =>
  readFileSync(join(ROOT, ...relative.split("/")), "utf-8").replace(/\r\n/g, "\n");

/** The rule ids a single line trips, for a file at `path`. */
const rulesTripped = (path: string, line: string): string[] =>
  [...violationsIn(path, [line]).keys()].map((key) => key.split("::")[0]);

/** Every violation the tree carries for one rule, as `path:line` strings. */
const treeHits = (ruleId: string): string[] => {
  const { found } = scanTree();
  const out: string[] = [];
  for (const [key, hits] of found) {
    const [id, path] = key.split("::");
    if (id !== ruleId) continue;
    for (const hit of hits) out.push(`${path}:${hit.line}`);
  }
  return out.sort();
};

describe("no-raw-colour-in-tsx sees a colour written the way Tailwind writes one", () => {
  it("is a registered rule", () => {
    expect(RULES.map((r) => r.id)).toContain("no-raw-colour-in-tsx");
  });

  // The two lines that ship today, verbatim enough to be recognisable.
  it.each([
    ['rgba, comma form', 'x = "shadow-[0_0_8px_rgba(6,214,214,0.3)]";'],
    ['rgb, space form', 'x = "shadow-[0_0_12px_2px_rgb(34_211_238/0.4)]";'],
  ])("flags a raw colour behind an underscore: %s", (_name, line) => {
    expect(rulesTripped("src/components/x.tsx", line)).toContain("no-raw-colour-in-tsx");
  });

  /**
   * The half that matters more than the catch. `rgb(var(--ps-rgb-neon-purple)
   * / 0.06)` is a TOKEN reference wearing the same punctuation, it is the form
   * four live call sites already use, and the built stylesheet proves it
   * compiles. A rule that fires on it would push those sites back onto hex.
   */
  it.each([
    ["a token triplet in an arbitrary value", 'x = "shadow-[0_0_15px_rgb(var(--ps-rgb-neon-purple)_/_0.06)]";'],
    ["a method whose name ends in rgba", "const c = palette.rgba(1, 2, 3);"],
    ["a colour() function naming the srgb space", 'const c = "color(srgb 0 0.74902 1 / 0.3)";'],
    ["color-mix against a token", 'const c = "color-mix(in srgb, var(--color-neon-cyan) 7%, transparent)";'],
  ])("does not fire on %s", (_name, line) => {
    expect(rulesTripped("src/components/x.tsx", line)).not.toContain("no-raw-colour-in-tsx");
  });

  /**
   * Anti-vacuity. "The tree is clean" and "the rule cannot see this file" read
   * identically from outside, and that is exactly how these two survived a
   * `{}` baseline. Plant the line at the real path and prove the rule reaches
   * it before believing the zero below.
   */
  it("reaches the files it was missing, so a clean tree is not a blind rule", () => {
    for (const path of [
      "src/components/logs/LogsHeaderActions.tsx",
      "src/components/composer/WorkflowRunCanvas.tsx",
    ]) {
      expect(rulesTripped(path, 'x = "shadow-[0_0_8px_rgba(6,214,214,0.3)]";')).toContain(
        "no-raw-colour-in-tsx",
      );
    }
  });

  it("and the tree carries none", () => {
    expect(treeHits("no-raw-colour-in-tsx")).toEqual([]);
  });
});

describe("no-sub-12px-type sees a size set as a prop, not only as a class", () => {
  it.each([
    ["fontSize={8}", "  <text fontSize={8} fontFamily=\"monospace\">"],
    ["fontSize={9}", "  <text fontSize={9} fontFamily=\"monospace\">"],
    ["fontSize={11}", "  <text fontSize={11}>"],
    ['fontSize="10"', '  <text fontSize="10">'],
    ["the class form it already caught", 'className="text-[8px]"'],
  ])("flags %s", (_name, line) => {
    expect(rulesTripped("src/components/viz/x.tsx", line)).toContain("no-sub-12px-type");
  });

  it.each([
    ["the floor itself", "  <text fontSize={12}>"],
    ["a size above the floor", "  <text fontSize={14}>"],
    ["a three-digit size", "  <text fontSize={100}>"],
    ["a size the component computes", "  <text fontSize={size * 0.06}>"],
    // Lowercase f, deliberately. The first draft of this case wrote
    // `cssFontSize={8}`, whose capital F could never match a lowercase pattern,
    // so it proved nothing and the sweep's word-boundary mutant walked straight
    // through it. A batch whose whole subject is a boundary in the wrong place
    // does not get to leave its own boundary untested.
    ["a longer identifier ending in the prop name", "  <Chart labelfontSize={8} />"],
  ])("does not fire on %s", (_name, line) => {
    expect(rulesTripped("src/components/viz/x.tsx", line)).not.toContain("no-sub-12px-type");
  });

  it("reaches the chart files it was missing", () => {
    for (const path of [
      "src/components/viz/DistributionHistogram.tsx",
      "src/components/viz/RadialActivityClock.tsx",
    ]) {
      expect(rulesTripped(path, "  <text fontSize={8}>")).toContain("no-sub-12px-type");
    }
  });

  it("and the tree carries none", () => {
    expect(treeHits("no-sub-12px-type")).toEqual([]);
  });

  /**
   * The rendered half. The class rule and the prop rule between them are only
   * worth something if no chart paints text below the floor by any spelling.
   */
  it("and no chart paints text below the floor by any spelling", () => {
    const charts = [
      "src/components/viz/DistributionHistogram.tsx",
      "src/components/viz/RadialActivityClock.tsx",
      "src/components/viz/ActivityHeatmap.tsx",
      "src/components/viz/StackedAreaTrend.tsx",
    ];
    const offenders: string[] = [];
    for (const path of charts) {
      const source = read(path);
      for (const m of source.matchAll(/fontSize=\{(\d+(?:\.\d+)?)\}/g)) {
        if (Number(m[1]) < 12) offenders.push(`${path}: fontSize={${m[1]}}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("globals.css does not assert a defect the build disproves", () => {
  const css = () => read("src/app/globals.css");

  /**
   * Measured, not reasoned about: the stylesheet emitted by `npm run build`
   * contains
   *   .glow-cyan{box-shadow:0 0 14px rgb(var(--ps-rgb-neon-cyan) / .08), …}
   * and
   *   --ps-rgb-neon-cyan:0 191 255;
   * which is the space-separated form the slash-alpha syntax requires. The
   * rules the comment calls dead are alive.
   */
  it.each([
    ["the claim that its own rules paint nothing", "currently paint nothing"],
    ["the instruction not to repair them", "a straight revert to invisible"],
    ["the premise that the token holds a comma list", 'holds a COMMA list'],
  ])("no longer carries %s", (_name, phrase) => {
    expect(css()).not.toContain(phrase);
  });

  it("still says what the bloom is and why its two guards exist", () => {
    const text = css();
    expect(text).toMatch(/fine-pointer|pointer: fine/);
    expect(text).toMatch(/reduced-motion/);
  });

  /**
   * Caught while writing the replacement: the first draft of that comment
   * restated `--ps-rgb-neon-cyan` and its value verbatim as evidence, and
   * lockbook-tokens.test.ts reads this file as TEXT with
   * `/(--ps-rgb-[a-z-]+):\s*([^;]+);/g`. It matched the prose, captured
   * everything up to the next semicolon twelve lines away, and failed. A
   * comment that quotes a declaration is a declaration as far as that gate is
   * concerned, so no comment in this file may look like one.
   */
  it("restates no token declaration in prose, because a gate reads this file as text", () => {
    const withComments = css();
    const withoutComments = withComments.replace(/\/\*[\s\S]*?\*\//g, "");
    const declarations = (source: string): string[] =>
      [...source.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)].map((m) => m[1]);
    expect(declarations(withComments)).toEqual(declarations(withoutComments));
  });

  it("and the mirrors stay in the form that made the claim stale", () => {
    // Space-separated, per the 2026-08-24 correction. This is the fact the
    // comment was written before and never caught up with; if it ever reverts,
    // the comment becomes true again and this test is the warning.
    expect(css()).toMatch(/--ps-rgb-neon-cyan:\s*0\s+191\s+255\s*;/);
  });
});

describe("knip is green: four symbols are used only inside their own file", () => {
  /**
   * `npm run lint` does not run knip, so `npm run lint` was green while
   * `npm run lint:knip` exited 1. Both of these landed in T-0107 and T-0113.
   * The fix is to drop the `export`, not to drop the symbol: each is still
   * used where it is declared.
   */
  it.each([
    ["src/modules/rec-room/handlers/generate.ts", "CHAPTER_STOPPED_STATUS", "const"],
    ["src/lib/models/model-readiness.ts", "ModelReadinessState", "type"],
    ["src/lib/scripts/scripts-manager.ts", "ScriptRunOutcome", "type"],
    ["src/lib/scripts/scripts-manager.ts", "ScriptStartFailure", "type"],
  ])("%s does not export %s", (path, symbol, kind) => {
    const source = read(path);
    expect(source).not.toContain(`export ${kind} ${symbol}`);
    // Still declared, and still used: this is a de-export, not a deletion.
    expect(source).toContain(`${kind} ${symbol}`);
    expect(source.split(symbol).length - 1).toBeGreaterThan(1);
  });
});
