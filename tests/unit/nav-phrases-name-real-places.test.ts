/** @jest-environment node */
// ═══════════════════════════════════════════════════════════════
// Every "Section → Screen" phrase on a screen names a place that exists.
//
// The regroup renamed the sections and the prose did not follow. Ten sites
// still sent the reader to "Operations", which has never been one of the five
// sections, and two more to "Config", which stopped being one when Models moved
// under Agent. Two of the ten were in error messages, so the sentence a person
// read at the worst moment was the one that named nowhere.
//
// Fixing the ten is a day's work that lasts until the next route moves, so the
// rule is here instead: any navigation phrase in user copy must name a section
// from NAV_SECTIONS and a link label the registry actually registers under it.
//
// SCOPE, and why it stops where it does:
//
//   • Copy only. Comments are stripped, because maintainer prose legitimately
//     draws arrows between things that are not screens ("Map → Record",
//     "PatterStage → Hermes"), and a rule that fought those would be turned off.
//   • The first two segments only. A third segment names a control on the page
//     ("Agent → Agents → Pull") and the registry does not know page controls,
//     so the rule would be guessing. Two segments is what it can actually check.
//   • `// nav-phrase-allow -- <reason>` on the line above exempts a line, with
//     the reason required, for the arrow that is genuinely not navigation.
// ═══════════════════════════════════════════════════════════════

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { MODULES } from "@/lib/modules/registry";
import { NAV_SECTIONS } from "@/lib/modules/types";

const SRC = join(process.cwd(), "src");

/** A word of a nav name: capitalised, up to three of them per segment. */
const SEGMENT = "[A-Z][A-Za-z0-9]*(?: [A-Z][A-Za-z0-9]*){0,2}";
/** The separator, as either the character the copy uses or its ASCII spelling. */
const ARROW = "(?:→|->)";
const CHAIN = new RegExp(`\\b${SEGMENT}(?:\\s*${ARROW}\\s*${SEGMENT})+`, "g");
/** The escape hatch, reason required, so an exemption has to say why. */
const ALLOW = /nav-phrase-allow\s+--\s+\S/;

interface NavPhrase {
  line: number;
  segments: string[];
  text: string;
}

/**
 * Strip comments while keeping the line count, so a hit still knows its line.
 *
 * The `[^:]` guard in front of `//` is what keeps a URL in a string from being
 * read as the start of a comment.
 */
export function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** Every navigation phrase in the copy of one file. */
export function findNavPhrases(source: string): NavPhrase[] {
  const rawLines = source.split(/\r?\n/);
  const lines = withoutComments(source).split(/\r?\n/);
  const out: NavPhrase[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (i > 0 && ALLOW.test(rawLines[i - 1])) continue;
    const matches = lines[i].match(CHAIN);
    if (!matches) continue;
    for (const chain of matches) {
      out.push({
        line: i + 1,
        segments: chain.split(new RegExp(`\\s*${ARROW}\\s*`)),
        text: lines[i].trim().slice(0, 120),
      });
    }
  }
  return out;
}

/**
 * What is wrong with one phrase, or null when it names a real place.
 *
 * The section is looked for as a SUFFIX of the first segment and the screen as
 * a PREFIX of the second, because the words either side of the arrow run into
 * the sentence around them: "Edit them on Agent → Tools now" hands this
 * "Edit them on Agent" and "Tools now" and both name the right place.
 */
export function phraseProblem(segments: string[], nav: Map<string, Set<string>>): string | null {
  const [left, right] = segments;
  const leftWords = left.split(" ");
  let section: string | null = null;
  for (let k = leftWords.length; k >= 1 && !section; k--) {
    const candidate = leftWords.slice(leftWords.length - k).join(" ");
    if (nav.has(candidate)) section = candidate;
  }
  if (!section) return `"${left}" is not one of the sections (${[...nav.keys()].join(", ")})`;
  const screens = nav.get(section)!;
  const rightWords = right.split(" ");
  for (let k = rightWords.length; k >= 1; k--) {
    if (screens.has(rightWords.slice(0, k).join(" "))) return null;
  }
  return `"${right}" is not a screen in ${section} (${[...screens].join(", ")})`;
}

/** The sections and the screens each one registers, from the registry itself. */
export function navMap(): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const label of NAV_SECTIONS) map.set(label, new Set<string>());
  for (const mod of MODULES) {
    for (const section of mod.nav ?? []) {
      for (const link of section.links) map.get(section.label)!.add(link.label);
    }
  }
  return map;
}

/** Every .ts/.tsx under src/, since copy can be written anywhere. */
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

describe("navigation phrases in user copy", () => {
  it("every one of them names a real section and a real screen", () => {
    const nav = navMap();
    const files = sourceFiles(SRC);
    // A walk that found nothing would pass this test in silence, which is the
    // failure mode the rule exists to prevent.
    expect(files.length).toBeGreaterThan(500);
    const offenders: string[] = [];
    for (const file of files) {
      const rel = file.replace(process.cwd(), "").replace(/\\/g, "/");
      for (const phrase of findNavPhrases(readFileSync(file, "utf-8"))) {
        const problem = phraseProblem(phrase.segments, nav);
        if (problem) offenders.push(`${rel}:${phrase.line}  ${problem}\n    ${phrase.text}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("the rule can see", () => {
  const nav = navMap();

  it("GREEN CONTROL: a section that does not exist, and a screen that does not", () => {
    expect(phraseProblem(["Operations", "Tools"], nav)).toMatch(/"Operations" is not one of the sections/);
    expect(phraseProblem(["Config", "Models"], nav)).toMatch(/"Config" is not one of the sections/);
    expect(phraseProblem(["Agent", "Widgets"], nav)).toMatch(/"Widgets" is not a screen in Agent/);
  });

  it("accepts the three real destinations the stale copy was pointing away from", () => {
    expect(phraseProblem(["Agent", "Agents"], nav)).toBeNull();
    expect(phraseProblem(["Agent", "Tools"], nav)).toBeNull();
    expect(phraseProblem(["Agent", "Models"], nav)).toBeNull();
  });

  it("reads a two-word section and a two-word screen", () => {
    expect(phraseProblem(["Rec Room", "Story Weaver"], nav)).toBeNull();
  });

  it("reads the phrase out of the sentence around it", () => {
    expect(phraseProblem(["Edit them on Agent", "Tools now"], nav)).toBeNull();
  });

  it("finds a phrase in copy and ignores one in a comment", () => {
    const found = findNavPhrases(
      [
        '<p>Configure on Operations → Tools.</p>',
        "// the map is Map → Record, which is not navigation",
        "/* Laboratory → Artifacts is a module, not a section */",
      ].join("\n"),
    );
    expect(found.map((p) => [p.line, p.segments])).toEqual([[1, ["Operations", "Tools"]]]);
  });

  it("reads a chain of three and checks the two segments it can", () => {
    const found = findNavPhrases("<strong>Agent → Agents → Pull</strong>");
    expect(found[0].segments).toEqual(["Agent", "Agents", "Pull"]);
    expect(phraseProblem(found[0].segments, nav)).toBeNull();
  });

  it("lets a line out when the line above says why", () => {
    const source = ["// nav-phrase-allow -- Fast and Agent are chat modes, not screens", '"Fast → Agent"'].join("\n");
    expect(findNavPhrases(source)).toEqual([]);
    // A pragma with no reason is not a pragma.
    expect(findNavPhrases(["// nav-phrase-allow", '"Fast → Agent"'].join("\n"))).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// docs/, which is rendered to users as the site and as in-app Help.
// ═══════════════════════════════════════════════════════════════

/**
 * The section names the regroup retired.
 *
 * Asked of docs/ instead of "does this name a real section", because docs/
 * legitimately describes OTHER products' interfaces: SECURITY.md points at
 * GitHub's own Settings > Security, which is right, and which a rule demanding
 * PatterStage sections would insist on breaking. A retired name is wrong
 * everywhere, so it needs no such judgement.
 */
const RETIRED_SECTIONS = ["Orchestration", "Operations", "Laboratory"];

/** An arrow, a chevron, or the word "menu": the shapes a nav instruction takes. */
const DOCS_NAV = new RegExp(
  `\\b(${RETIRED_SECTIONS.join("|")})\\s*(?:->|\u2192|>)\\s*[A-Z]`,
  "g",
);

function docsFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) docsFiles(full, out);
    else if (entry.endsWith(".md")) out.push(full);
  }
  return out;
}

describe("the documentation names the navigation the product actually has", () => {
  it("uses no section name the regroup retired", () => {
    const offenders: string[] = [];
    for (const file of docsFiles(join(process.cwd(), "docs"))) {
      const lines = readFileSync(file, "utf-8").split("\n");
      lines.forEach((line, i) => {
        DOCS_NAV.lastIndex = 0;
        const hit = DOCS_NAV.exec(line);
        if (!hit) return;
        offenders.push(`${file.replace(process.cwd(), "").replace(/\\/g, "/")}:${i + 1} ${hit[0]}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it("GREEN CONTROL: the rule can see a retired name when there is one", () => {
    DOCS_NAV.lastIndex = 0;
    expect(DOCS_NAV.test("Schedule it from Orchestration > Scripts")).toBe(true);
  });

  it("leaves another product's menus alone, which is why it asks only about retired names", () => {
    // GitHub's own settings, quoted correctly in SECURITY.md.
    DOCS_NAV.lastIndex = 0;
    expect(DOCS_NAV.test("Settings > Security > Private vulnerability reporting")).toBe(false);
    // And the architecture prose, which names a source directory, not a screen.
    DOCS_NAV.lastIndex = 0;
    expect(DOCS_NAV.test("Orchestration core (src/lib/orchestration/) owns the mission lifecycle")).toBe(false);
  });
});
