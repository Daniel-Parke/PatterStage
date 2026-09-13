/**
 * U5 (T-0119): five steps, and a register that says what a word IS.
 *
 * `@theme` declared no `--text-*` at all until U2, so the product used
 * Tailwind's default scale as if it had two steps: `text-xs` 921 times and
 * `text-sm` 247, against 35 uses of everything larger combined. Rendered, 2,226
 * of 3,173 text nodes are 12px and 1,897 of those are JetBrains Mono. A console
 * in which seven words in ten are a 12px machine label has no hierarchy left to
 * spend, and the first thing that suffers is the prose.
 *
 * The five steps are declared already. This is the batch that uses them, and
 * the register split is the whole of it (decision 10, ruled with the operator):
 *
 *   MONO keeps machine words. Values, IDs, paths, timestamps, status words,
 *   counts, commands, and the uppercase micro-caps that label a section. They
 *   stay at `micro`, 12px, because a fixed-width column of them is what makes
 *   a console readable.
 *
 *   INTER takes prose. Body copy, descriptions, empty states, headings. Those
 *   were 291 of the 921 `text-xs` sites: prose set two steps below the body
 *   size, which is the defect. They become `body`, 14px.
 *
 * Measured before: 630 of the `text-xs` sites carry mono, uppercase or
 * tabular-nums on the same line; 291 carry none of the three.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { blockCommentLines } from "../../scripts/tooling/design-lint.mjs";

const ROOT = join(__dirname, "..", "..");
const SRC = join(ROOT, "src");

/** Every .tsx/.ts/.css under src/, keyed by its repo-relative path. */
function sources(): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(tsx?|css)$/.test(entry.name)) {
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

/**
 * Sites of a pattern, as `path:line  text`, so a failure names them.
 *
 * Comments do not count: a comment naming a defect is not a use of it, and
 * every one of these files is commented. The leading-marker test is not enough
 * on its own, because globals.css documents both the ladder and the tiers
 * inside block comments whose interior lines carry no marker at all — which is
 * the same hole design-lint had until T-0118.
 */
function sites(pattern: RegExp, skip: (path: string) => boolean = () => false): string[] {
  const found: string[] = [];
  for (const [path, source] of sources()) {
    if (skip(path)) continue;
    const lines = source.split("\n");
    const commented = blockCommentLines(lines);
    lines.forEach((line, i) => {
      if (commented[i]) return;
      const t = line.trimStart();
      if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) return;
      if (pattern.test(line)) found.push(`${path}:${i + 1}  ${line.trim().slice(0, 90)}`);
    });
  }
  return found;
}

const read = (rel: string) => readFileSync(join(ROOT, rel), "utf-8").replace(/\r\n/g, "\n");

describe("the scale has five steps and the product uses them", () => {
  it("has sources to check, so none of this passes vacuously", () => {
    expect(sources().length).toBeGreaterThan(200);
  });

  /**
   * Tailwind's default scale, in every spelling. `globals.css` is exempt: it
   * declares the steps, and one of them has to say what 14px is.
   */
  it("no component sizes text off Tailwind's default scale", () => {
    expect(
      sites(/(?<![\w-])text-(?:xs|sm|base|lg|xl|[2-9]xl)(?![\w-])/, (p) => p === "src/app/globals.css"),
    ).toEqual([]);
  });

  it("and none reaches for an arbitrary size instead", () => {
    expect(sites(/(?<![\w-])text-\[[^\]]*(?:px|rem|em)\]/)).toEqual([]);
  });

  /**
   * The hierarchy is the four derived tiers, which are computed from the
   * painted ground and gated by contrast-check. A raw white opacity is how
   * 2,377 elements once failed AA.
   */
  it("no component spells text hierarchy as a white opacity", () => {
    expect(sites(/(?<![\w-])(?:text|placeholder|caret|decoration)-white(?:\/(?:\[[^\]]+\]|\d{1,3}))?(?![\w-])/)).toEqual([]);
  });

  /**
   * Every step has to be REACHABLE, or "five steps" is four steps and a name
   * nobody can spell. A step with no call site is a step that will be deleted
   * by the next person who greps for it.
   */
  it.each(["text-micro", "text-body", "text-lead", "text-title", "text-display"])(
    "%s has call sites",
    (step) => {
      const pattern = new RegExp(`(?<![\\w-])${step}(?![\\w-])`);
      expect(sites(pattern).length).toBeGreaterThan(0);
    },
  );
});

describe("the register says what a word is", () => {
  /**
   * The micro step exists for machine words, so a `text-micro` that is not one
   * is prose that was left at 12px. This is the assertion that the codemod's
   * split actually happened rather than every `text-xs` being renamed.
   */
  it("keeps micro for machine words, not for prose", () => {
    const offenders = sites(
      /(?<![\w-])text-micro(?![\w-])/,
    ).filter((site) => !/font-mono|uppercase|tabular-nums|tracking-wide/.test(site));
    // Some sites set the register on a parent and the size on a child, so this
    // is a ceiling rather than zero: what it refuses is a rename in disguise.
    expect(offenders.length).toBeLessThan(120);
  });

  /**
   * Prose that was two steps too small. 291 `text-xs` sites carried no machine
   * marker at all; they are the ones that had to move.
   */
  it("gives the body step more call sites than the whole larger half used to have", () => {
    expect(sites(/(?<![\w-])text-body(?![\w-])/).length).toBeGreaterThan(300);
  });
});

describe("one treatment for a section heading", () => {
  /**
   * `h2` had ten treatments across the tree, from `text-xs` micro-caps to
   * `text-xl` bold. One of them is right for a section heading in a console:
   * micro-caps mono, on the secondary tier, with a hairline under it, so it
   * reads as a HEADING rather than as a slightly smaller list item.
   */
  it("declares the section heading once, in the theme", () => {
    const theme = read("src/lib/ui/theme.ts");
    expect(theme).toContain("sectionHeadingClasses");
    expect(theme).toContain("text-micro");
    expect(theme).toContain("uppercase");
  });
});
