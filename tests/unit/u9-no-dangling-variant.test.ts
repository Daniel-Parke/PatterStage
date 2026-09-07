/**
 * U9 (T-0123): a variant prefix with nothing after it.
 *
 * T-0122's focus pass deleted `outline-none` with a `\b` anchor. `:` is a word
 * boundary, so it matched INSIDE `focus:outline-none` and left a bare `focus:`
 * standing at eleven sites across nine files.
 *
 * `focus:` on its own is a class Tailwind can never generate. It is inert -
 * which is exactly why nothing failed, and why it survived a full gate, a
 * mutation sweep and a browser walk. It belongs to the same family as
 * `border-${token}`: a style that silently does not exist, invisible because
 * the absence of a style looks like the absence of an intention.
 *
 * The rule is narrow in three ways, and each narrowing was earned:
 *
 *   THE VARIANTS ARE SPELLED OUT. `[a-z-]+:` would flag prose - "error:",
 *   "note:" - and any pseudo-selector written in a plain string.
 *
 *   IT IS ANCHORED ON THE CLOSING QUOTE, not on whitespace, because a ternary
 *   (`cond ? "x" : "y"`) puts a colon before a space and is not a class.
 *
 *   THE PREFIX MUST FOLLOW ANOTHER CLASS. The dry run found this one:
 *   `skills-config.ts` writes `"  disabled:"` as a YAML key and
 *   `startsWith("disabled:")` as a parser, and a rule without the lookbehind
 *   would have deleted both and broken a config writer to tidy a class list.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { RULES, violationsIn } from "../../scripts/tooling/design-lint.mjs";

const SRC = join(__dirname, "..", "..", "src");

function sources(): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const walk = (dir: string, rel: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      const path = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(full, path);
      else if (/\.tsx?$/.test(entry.name)) {
        out.push([`src/${path}`, readFileSync(full, "utf-8").replace(/\r\n/g, "\n")]);
      }
    }
  };
  walk(SRC, "");
  return out;
}

const trips = (line: string) =>
  [...violationsIn("src/components/x.tsx", [line]).keys()].map((k) => k.split("::")[0]);

describe("no class is left half-deleted", () => {
  it("has the rule", () => {
    expect(RULES.map((r: { id: string }) => r.id)).toContain("no-dangling-variant");
  });

  it.each([
    ["the one the focus pass left", '<input className="px-3 py-2 text-body focus:" />'],
    ["a stacked pair", '<input className="rounded-ps-md hover:focus:" />'],
    ["one in a template literal", "const cls = `border border-ps-edge focus:`;"],
  ])("refuses %s", (_what, line) => {
    expect(trips(line)).toContain("no-dangling-variant");
  });

  it.each([
    ["a real variant with a utility", '<input className="px-3 focus:ring-2" />'],
    ["a YAML key a config writer emits", 'lines.push("  disabled:");'],
    ["a parser looking for that key", 'if (trimmed.startsWith("disabled:")) {'],
    ["a ternary", 'const cls = cond ? "a" : "b";'],
    ["prose that ends in a colon", 'const label = "error:";'],
    ["a bare class list", '<div className="rounded-ps-lg border border-ps-edge" />'],
  ])("allows %s", (_what, line) => {
    expect(trips(line)).not.toContain("no-dangling-variant");
  });
});

describe("and none is left in the tree", () => {
  it("finds no dangling prefix anywhere in src", () => {
    const offenders: string[] = [];
    for (const [path, source] of sources()) {
      const found = violationsIn(path, source.split("\n"));
      for (const key of found.keys()) {
        if (key.startsWith("no-dangling-variant::")) {
          offenders.push(`${path}  ${found.get(key)![0].text.trim().slice(0, 64)}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
