/** @jest-environment node */
// ═══════════════════════════════════════════════════════════════
// T-0113: no screen tells the operator a money figure came from a published rate.
//
// This rule already existed, and it already failed. The spend console had
// "prices are the published per-model rates" removed earlier in this same round,
// with a test pinning it and a comment in the source asking for it not to be
// restored. Hours later a different change put that exact sentence into a NEW
// component in the Rec Room reader, beside the identical number.
//
// A rule held in one component is not held. `estimateCost` prices an unknown
// model at a flat fallback, and the rate table is a short static list, so on any
// install running something not on that list EVERY figure is a fallback. For
// stories it is not even occasional: a story run records no model at all, so the
// fallback is used one hundred per cent of the time, for ever.
//
// Scanned across the source rather than rendered, because the point is that the
// sentence must not exist anywhere a user can read it, including in a component
// nobody has written yet.
// ═══════════════════════════════════════════════════════════════

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = join(process.cwd(), "src");

/** Every .ts/.tsx under src/, since a claim can be made from anywhere. */
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

/**
 * Strip comments before looking.
 *
 * The two files that explain WHY this rule exists both have to quote the
 * forbidden sentence to explain it, and a rule that punished them for saying so
 * would delete its own reasoning.
 */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const FORBIDDEN = [
  /published per-model rates/i,
  /published rates/i,
  /at the provider's published/i,
];

describe("no user-facing string claims a money figure came from a published rate", () => {
  it("holds across the whole source tree, not just the panel that got it wrong first", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(SRC)) {
      const code = withoutComments(readFileSync(file, "utf-8"));
      for (const pattern of FORBIDDEN) {
        if (!pattern.test(code)) continue;
        offenders.push(`${file.replace(process.cwd(), "").replace(/\\/g, "/")} matches ${pattern}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("GREEN CONTROL: the rule can see a violation when there is one", () => {
    // Without this the case above passes just as happily on an empty regex list
    // or a broken file walk, which is how the first version of this rule ended
    // up covering one component.
    const sample = withoutComments('const t = "Estimated at published per-model rates.";');
    expect(FORBIDDEN.some((p) => p.test(sample))).toBe(true);
  });

  it("and it does not fire on the comments that explain why it exists", () => {
    const sample = withoutComments(
      '/* The old wording said "published per-model rates". Do not put it back. */\nconst t = "Estimated from recorded tokens.";',
    );
    expect(FORBIDDEN.some((p) => p.test(sample))).toBe(false);
  });
});
