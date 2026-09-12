/**
 * B1 (T-0095), D114 and D115: `neon-red` was not a declared token and
 * `semantic-error` was not either, so thirteen sites, including the global
 * error fallback and every failed tool call, rendered with no colour at all.
 * Tailwind generates nothing for a class it cannot resolve and says nothing.
 *
 * The token is declared once (an alias of semantic-danger), the two wrong
 * names are fixed, and design-lint gains a rule so the next undeclared house
 * token is a red build rather than an invisible error box.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  RULES,
  declaredColourTokens,
  scanTree,
  undeclaredColourClasses,
  violationsIn,
} from "../../scripts/tooling/design-lint.mjs";

const ROOT = join(__dirname, "..", "..");
const DECLARED = new Set(["neon-cyan", "semantic-danger", "ps-text-muted", "ps-surface-panel"]);

describe("undeclaredColourClasses", () => {
  it("names a house-prefixed colour class that no token declares", () => {
    expect(undeclaredColourClasses('className="text-neon-red/80 bg-semantic-danger/10"', DECLARED)).toEqual([
      "neon-red",
    ]);
  });

  it("sees through variant prefixes and opacity suffixes", () => {
    expect(undeclaredColourClasses("hover:text-semantic-error focus:ring-neon-red/40", DECLARED)).toEqual([
      "semantic-error",
      "neon-red",
    ]);
  });

  it("accepts every declared token in every utility position", () => {
    const line =
      'className="text-neon-cyan bg-ps-surface-panel border-semantic-danger/30 ring-neon-cyan/60 hover:text-ps-text-muted"';
    expect(undeclaredColourClasses(line, DECLARED)).toEqual([]);
  });

  it("ignores what is not a house token: Tailwind's own palette, sizes, and whites", () => {
    const line = 'className="text-red-400 bg-orange-500/10 text-[11px] bg-white/5 border-white/10 text-sm"';
    expect(undeclaredColourClasses(line, DECLARED)).toEqual([]);
  });
});

describe("declaredColourTokens", () => {
  it("reads every --color-* name out of a @theme block, aliases included", () => {
    const css = `@theme {\n  --color-neon-cyan: #00bfff;\n  --color-ps-surface-panel: var(--color-dark-900);\n  --font-mono: x;\n}`;
    const tokens = declaredColourTokens(css);
    expect(tokens.has("neon-cyan")).toBe(true);
    expect(tokens.has("ps-surface-panel")).toBe(true);
    expect(tokens.has("font-mono")).toBe(false);
  });
});

describe("the tree, after the fix", () => {
  it("declares neon-red, as an alias of the danger colour", () => {
    const css = readFileSync(join(ROOT, "src", "app", "globals.css"), "utf-8");
    const tokens = declaredColourTokens(css);
    expect(tokens.has("neon-red")).toBe(true);
    expect(css).toMatch(/--color-neon-red:\s*(#f87171|var\(--color-semantic-danger\))/);
  });

  it("registers the rule", () => {
    expect(RULES.some((r: { id: string }) => r.id === "token-must-exist")).toBe(true);
  });

  it("carries no undeclared house colour class anywhere, so the rule lands at a zero baseline", () => {
    const { counts } = scanTree();
    const offenders = Object.keys(counts).filter((k) => k.startsWith("token-must-exist::"));
    expect(offenders).toEqual([]);
  });

  // FOUND BY MUTATION. A scan that silently skipped the predicate rule still
  // passed the assertion above: zero offenders and a blind rule look identical
  // from outside. So the scan is made to see a planted line.
  it("the scan SEES a planted undeclared class, through the same path the gate walks", () => {
    const hits = violationsIn("src/components/Planted.tsx", [
      'export const a = <div className="text-neon-nonexistent" />;',
    ]);
    expect([...hits.keys()]).toContain("token-must-exist::src/components/Planted.tsx");
    expect(hits.get("token-must-exist::src/components/Planted.tsx")?.[0].line).toBe(1);
  });

  it("and stays quiet for a declared class, a comment, and a pragma'd line", () => {
    const quiet = violationsIn("src/components/Quiet.tsx", [
      'export const a = <div className="text-neon-cyan bg-ps-surface-panel" />;',
      "// text-neon-nonexistent in prose is not a class",
      "// design-lint-disable-next-line token-must-exist -- a fixture name, not a class",
      'export const b = "text-neon-nonexistent";',
    ]);
    expect([...quiet.keys()].filter((k) => k.startsWith("token-must-exist::"))).toEqual([]);
  });

  it("no longer tells contributors the token does not exist", () => {
    const doc = readFileSync(join(ROOT, "docs", "contributing", "design-tokens.md"), "utf-8");
    expect(doc).not.toMatch(/`neon-red` or `neon-blue`: neither exists/);
  });
});
