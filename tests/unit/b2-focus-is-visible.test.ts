/**
 * B2 (T-0096), D117: sixteen Story Weaver controls set `outline-none` with no
 * replacement, and in Tailwind v4 that is outline-style:none unconditionally,
 * so tabbing through those forms showed no focus at all (WCAG 2.4.7). The
 * global :focus-visible ring is one token; a skip link gets a keyboard user
 * past the rail; and a design-lint rule refuses a bare `outline-none` on any
 * line that does not put a focus ring back.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { RULES, scanTree, violationsIn } from "../../scripts/tooling/design-lint.mjs";

const ROOT = join(__dirname, "..", "..");

describe("one focus ring, from a token", () => {
  it("globals.css declares a :focus-visible outline in a house colour", () => {
    const css = readFileSync(join(ROOT, "src", "app", "globals.css"), "utf-8");
    // No `s` flag: tsconfig.tests.json targets below es2018, and the negated
    // classes already cross newlines.
    expect(css).toMatch(/:focus-visible\s*\{[^}]*outline:[^;]*var\(--color-(neon|semantic|ps)-[a-z-]+\)/);
  });

  it("the shell carries a skip link to the main region", () => {
    const layout = readFileSync(join(ROOT, "src", "app", "layout.tsx"), "utf-8");
    expect(layout).toMatch(/href="#main"/);
    expect(layout).toMatch(/Skip to (main )?content/i);
    expect(layout).toMatch(/<main[^>]*id="main"/);
  });
});

describe("the rule", () => {
  it("is registered", () => {
    expect(RULES.some((r: { id: string }) => r.id === "no-bare-outline-none")).toBe(true);
  });

  it("flags outline-none with nothing to replace it, and accepts a line that puts a ring back", () => {
    const hits = violationsIn("src/app/x/page.tsx", [
      'className="w-full outline-none font-mono"',
      'className="w-full outline-none focus-visible:ring-1 focus-visible:ring-neon-purple/50"',
      'className="w-full outline-none focus:border-neon-purple/40"',
      'className="w-full focus:outline-none focus:ring-2"',
      "// outline-none in a comment is prose",
      // `focus:outline-none` is itself an outline-none, not a ring put back.
      'className="w-full focus:outline-none"',
    ]);
    expect(hits.get("no-bare-outline-none::src/app/x/page.tsx")?.map((h) => h.line)).toEqual([1, 6]);
  });

  it("the tree carries none", () => {
    const { counts } = scanTree();
    expect(Object.keys(counts).filter((k) => k.startsWith("no-bare-outline-none::"))).toEqual([]);
  });
});
