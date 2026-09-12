/* eslint-disable @typescript-eslint/no-require-imports -- scripts/docs/lib.mjs is loaded by a COMPUTED path, for the reason the B15 oracle beside this one gives: a static import would be a typecheck error whenever the module was absent, and typecheck:tests runs inside npm run lint */
/**
 * T-0112: the two refusals that tell a written guide from a placeholder.
 *
 * B18 added both rules to checkDocs and measured them red against the real
 * tree -- 17 stubs and 6 guides in the wrong shape -- which proves the rules
 * FIRE but not that they fire for the right reasons. The batch's mutation sweep
 * said so plainly: a mutant that made the stub check always pass, and four more
 * that hollowed out the section check, all lived, because nothing exercised
 * either rule from a fixture. These are those cases.
 *
 * The rules exist because B15 shipped 23 placeholder guides carrying REAL front
 * matter, which is exactly what made them invisible to every other rule in the
 * file: a title, a summary, a screen that resolves, concepts that exist. And
 * because six more guides were complete, accurate prose written for a
 * maintainer rather than a reader, which no word count would ever catch.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

const LIB_PATH = join(process.cwd(), "scripts", "docs", "lib.mjs");

interface Refusal {
  code: string;
  path: string;
  subject: string;
  message: string;
}

interface DocsLib {
  checkDocs: (input: unknown) => Refusal[];
}

let cached: DocsLib | undefined;
function lib(): DocsLib {
  if (!existsSync(LIB_PATH)) throw new Error("B15 contract: scripts/docs/lib.mjs must exist");
  if (!cached) cached = require(LIB_PATH) as DocsLib;
  return cached;
}

const HOUSE = ["## What you see", "", "Words.", "", "## Typical use", "", "Words.", "", "## Notes", "", "Words."].join(
  "\n",
);

/** One guide, one route, and whatever body the case is about. */
function inputWith(body: string, slug = "guides/missions") {
  return {
    pages: [
      {
        path: `docs/${slug}.md`,
        slug,
        body,
        data: { title: "Missions", summary: "Dispatch work", section: "guides", nav: 10, screen: "/work/missions" },
      },
    ],
    routes: ["/work/missions"],
    imageExists: () => true,
    freshBlocks: {},
  };
}

const refusals = (body: string, slug?: string): Refusal[] => lib().checkDocs(inputWith(body, slug));
const codes = (body: string, slug?: string): string[] => refusals(body, slug).map((r) => r.code);

// ═══════════════════════════════════════════════════════════════
// the stub rule
// ═══════════════════════════════════════════════════════════════

describe("a guide that has not been written yet", () => {
  it("GREEN CONTROL: a finished guide is refused for nothing", () => {
    expect(refusals(`# Missions\n\nReal prose.\n\n${HOUSE}`)).toEqual([]);
  });

  it.each([
    ["the B15 placeholder sentence", "This page is a stub. Its prose is written in B18."],
    ["the bare promise", "Written in B18."],
    ["the italicised promise", "_Written in B18._"],
  ])("is refused when it still says %s", (_name, marker) => {
    const found = refusals(`# Missions\n\n${HOUSE}\n\n${marker}`);
    expect(found.map((r) => r.code)).toContain("guide-is-a-stub");
  });

  it("says which sentence gave it away, so the writer knows what to delete", () => {
    const found = refusals(`# Missions\n\n${HOUSE}\n\nThis page is a stub.`).filter(
      (r) => r.code === "guide-is-a-stub",
    );
    expect(found).toHaveLength(1);
    expect(found[0].subject).toBe("This page is a stub");
    expect(found[0].message).toBe('docs:check: docs/guides/missions.md is still a stub (it says "This page is a stub")');
  });

  it("refuses a placeholder ONCE, however many of its sentences it carries", () => {
    // A B15 placeholder carries all three. Three identical lines about one file
    // is noise, not detail, and a writer fixing it deletes the section anyway.
    const all = "This page is a stub. Written in B18. _Written in B18._";
    expect(refusals(`# Missions\n\n${HOUSE}\n\n${all}`).filter((r) => r.code === "guide-is-a-stub")).toHaveLength(1);
  });

  it("judges guides only, because no other tier promised this shape", () => {
    // A concept page or a reference page saying "written in B18" would be odd,
    // but it is not this rule's business, and a rule that reached across every
    // tier would refuse the contributing notes that DESCRIBE the placeholders.
    expect(codes(`# Mission\n\nThis page is a stub.`, "concepts/mission")).not.toContain("guide-is-a-stub");
    expect(codes(`# API\n\nWritten in B18.`, "reference/api")).not.toContain("guide-is-a-stub");
  });
});

// ═══════════════════════════════════════════════════════════════
// the section rule
// ═══════════════════════════════════════════════════════════════

describe("the shape every guide carries", () => {
  it("refuses a guide with none of the three headings", () => {
    // This is the state the six carried-over developer guides were in: complete,
    // accurate prose, opening on a schema table, in nobody's reading order.
    const found = refusals("# Chat\n\n## Persistence\n\nA table of columns.").filter(
      (r) => r.code === "guide-missing-sections",
    );
    expect(found).toHaveLength(1);
    expect(found[0].message).toContain("## What you see, ## Typical use, ## Notes");
  });

  it.each([
    ["What you see", "## Typical use\n\n## Notes"],
    ["Typical use", "## What you see\n\n## Notes"],
    ["Notes", "## What you see\n\n## Typical use"],
  ])("refuses a guide missing only %s", (missing, present) => {
    const found = refusals(`# Missions\n\n${present}`).filter((r) => r.code === "guide-missing-sections");
    expect(found).toHaveLength(1);
    expect(found[0].subject).toBe(`## ${missing}`);
  });

  it("names its subject exactly as the writer would type it", () => {
    // The file's own invariant is that a message quotes its subject verbatim,
    // and "Notes" alone is not a thing anyone searches a document for.
    const found = refusals("# Missions\n\n## What you see\n\n## Typical use").filter(
      (r) => r.code === "guide-missing-sections",
    );
    expect(found[0].subject).toBe("## Notes");
    expect(found[0].message).toContain(found[0].subject);
  });

  it("wants a heading, not the words: a sentence mentioning Notes is not a Notes section", () => {
    const body = "# Missions\n\n## What you see\n\n## Typical use\n\nSee the Notes below for what you see.";
    expect(codes(body)).toContain("guide-missing-sections");
  });

  it("wants that heading at H2, because the rail is built from H2s", () => {
    const body = "# Missions\n\n## What you see\n\n## Typical use\n\n### Notes\n\nToo deep.";
    expect(codes(body)).toContain("guide-missing-sections");
  });

  it("allows a guide to carry more than the three", () => {
    const body = `# Missions\n\n## What you see\n\n## Templates\n\n## Typical use\n\n## Notes`;
    expect(codes(body)).not.toContain("guide-missing-sections");
  });

  it("judges guides only", () => {
    expect(codes("# Mission\n\nA unit of work.", "concepts/mission")).not.toContain("guide-missing-sections");
  });
});
