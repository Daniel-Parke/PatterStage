/**
 * U14 · The ring paints, and motion stops when asked.
 *
 * Two promises the token layer made that the tree did not keep.
 *
 * THE RING. globals.css declares the console's one focus indicator: a 2px
 * neon-cyan outline on :focus-visible, in @layer base, once. The field kit
 * then removed it on every text input, select and toggle it renders
 * (`outline-none`, on T-0122's own primitives) and painted a 1px ring at 30%
 * alpha in its place. That ring fires on :focus rather than :focus-visible,
 * so a mouse click drew it and a keyboard user got a third of the indicator
 * every other control in the product has. And the house `transition-colors`
 * is Tailwind's, which transitions outline-color too, so on every control
 * wearing it the ring faded in from grey over 150ms and a fast tabber never
 * saw it cyan. The comment beside the duration tokens has said "in U14"
 * since T-0116. This is U14.
 *
 * MOTION. The reduced-motion block was an allowlist of seven class names,
 * written when there were seven animations. There are fourteen keyframes in
 * the file and nine Tailwind animate-* utilities in the tree, and the
 * reconnaissance measured 28 animations still running under
 * `prefers-reduced-motion: reduce`, the logo's flame on all 25 screens among
 * them (WCAG 2.3.3). An allowlist can only ever name what its author knew
 * about. The rule inverts to deny by default, with one re-enable: a spinner,
 * which is information (still working) rather than decoration.
 *
 * These are the source oracles. The live half is tests/e2e/motion.spec.ts,
 * gate 10, which counts what actually runs under reduce on every route.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(__dirname, "..", "..");
const CSS = readFileSync(join(ROOT, "src", "app", "globals.css"), "utf8");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

const SOURCE_FILES = walk(join(ROOT, "src"));

/** The bodies of every `@media (prefers-reduced-motion: reduce)` block. */
function reduceBlocks(): string[] {
  const out: string[] = [];
  const open = /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = open.exec(CSS)) !== null) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    while (i < CSS.length && depth > 0) {
      if (CSS[i] === "{") depth += 1;
      else if (CSS[i] === "}") depth -= 1;
      i += 1;
    }
    out.push(CSS.slice(start, i - 1));
  }
  return out;
}

/** `selector { body }` pairs inside one block, comments stripped. */
function rules(block: string): Array<{ selectors: string[]; body: string }> {
  const clean = block.replace(/\/\*[\s\S]*?\*\//g, "");
  const out: Array<{ selectors: string[]; body: string }> = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(clean)) !== null) {
    out.push({
      selectors: m[1]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      body: m[2],
    });
  }
  return out;
}

describe("U14 · the ring paints", () => {
  it("no control in src removes the outline", () => {
    const offenders: string[] = [];
    for (const file of SOURCE_FILES) {
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        // A comment naming the class it refuses is not a control removing it.
        if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
        if (/\boutline-none\b/.test(line)) {
          offenders.push(`${relative(ROOT, file).replace(/\\/g, "/")}:${i + 1}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  it("the house transition-colors leaves outline-color alone", () => {
    const declared =
      CSS.match(/@utility\s+transition-colors\s*\{([^}]*)\}/) ??
      CSS.match(/\.transition-colors\s*\{([^}]*)\}/);
    // globals.css must declare a transition-colors of its own.
    expect(declared).not.toBeNull();
    const body = declared![1];
    expect(body).toMatch(/transition-property\s*:/);
    expect(body).not.toMatch(/outline-color/);
    // The properties Tailwind's version transitions, less the one it should not.
    for (const prop of ["color", "background-color", "border-color", "fill", "stroke"]) {
      // ...and it still transitions everything Tailwind's did, less the outline.
      expect(body).toMatch(new RegExp(`(?:^|[\\s,:])${prop}(?:[\\s,;]|$)`));
    }
  });

  it("the comment that promised U14 no longer promises", () => {
    expect(CSS).not.toMatch(/in U14/);
  });
});

describe("U14 · reduced motion denies by default", () => {
  const blocks = reduceBlocks();
  const halting = blocks.find((b) =>
    rules(b).some(
      (r) =>
        r.selectors.includes("*") &&
        /animation-duration\s*:\s*0\.01ms\s*!important/.test(r.body) &&
        /animation-iteration-count\s*:\s*1\s*!important/.test(r.body) &&
        /transition-duration\s*:\s*0\.01ms\s*!important/.test(r.body),
    ),
  );

  it("one reduce block halts every animation and transition", () => {
    // A `*` rule under prefers-reduced-motion halts animation and transition.
    expect(halting).toBeDefined();
  });

  it("re-enables at most the spinners", () => {
    const allowed = new Set([".animate-spin", ".animate-spin-slow"]);
    const reEnabled = rules(halting ?? "")
      .filter((r) => /animation-duration\s*:\s*(?!0\.01ms)/.test(r.body))
      .flatMap((r) => r.selectors);
    expect(reEnabled.length).toBeGreaterThan(0);
    expect(reEnabled.filter((s) => !allowed.has(s))).toEqual([]);
  });

  it("the seven-name allowlist is gone", () => {
    for (const block of blocks) {
      expect(block).not.toMatch(/\.animate-shimmer::after\s*\{\s*animation\s*:\s*none/);
      expect(block).not.toMatch(/\.animate-flame\s*,/);
    }
  });

  it("a drawn line under reduce is drawn, not hidden", () => {
    // viz-draw animates stroke-dashoffset from the path's length to 0. Halt
    // the animation and the line must still be there, so the block also pins
    // the end state, as the old allowlist did.
    const vizDraw = rules(halting ?? "").find((r) => r.selectors.includes(".viz-draw"));
    // The reduce block pins .viz-draw's end state.
    expect(vizDraw).toBeDefined();
    expect(vizDraw!.body).toMatch(/stroke-dashoffset\s*:\s*0/);
  });
});
