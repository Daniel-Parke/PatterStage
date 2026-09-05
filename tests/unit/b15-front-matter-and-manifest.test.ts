/* eslint-disable @typescript-eslint/no-require-imports -- scripts/docs/lib.mjs is loaded by a COMPUTED path, deliberately: a static import of it from a test would be a typecheck error while the module was still unwritten, and typecheck:tests runs inside npm run lint */
/**
 * B15 (T-0109), decision 3 — the documentation pipeline's front door.
 *
 * `docs/` becomes the single source for the static site, the in-app Help and the
 * screenshot set, and `docs/manifest.json` becomes a DERIVED file held by
 * `check-derived-views`. Both of those need a parser that refuses a malformed
 * page loudly rather than publishing it, and a manifest builder whose output is
 * byte-stable — a derived view that moves on every run is a view nobody can gate.
 *
 * Red today because `scripts/docs/lib.mjs` does not exist. The module is plain
 * ESM (not the `.mts` of the CLI) precisely so this file can load it: `next/jest`
 * installs a transform for js/jsx/ts/tsx/mjs and a supplied `transform` replaces
 * Jest's default entirely, so a `.mts` module is unloadable from a unit test.
 * Precedent for importing a tooling `.mjs` from here: b2-confirm-button.test.tsx.
 *
 * Loaded by a COMPUTED path rather than a static import, so that `npm run
 * typecheck:tests` stays green while the module is still unwritten. An oracle
 * that breaks the typechecker is not an oracle, it is a broken build.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const LIB_PATH = join(ROOT, "scripts", "docs", "lib.mjs");

type DocSection = "start-here" | "concepts" | "guides" | "running" | "reference" | "contributing";

interface DocFrontMatter {
  title: string;
  summary: string;
  section: DocSection;
  nav: number;
  audience?: string;
  screen?: string;
  concepts?: string[];
  shots?: string[];
}

interface DocPage {
  path: string;
  slug: string;
  data: DocFrontMatter;
  body: string;
}

type ParseResult =
  | { ok: true; data: DocFrontMatter; body: string }
  | { ok: false; errors: string[] };

interface ManifestPage {
  slug: string;
  title: string;
  summary: string;
  nav: number;
  screen?: string;
  concepts?: string[];
  shots?: string[];
}

interface Manifest {
  generatedBy: string;
  sections: Array<{ id: DocSection; label: string; pages: ManifestPage[] }>;
  screens: Record<string, string>;
  concepts: string[];
  order: string[];
}

interface DocsLib {
  SECTIONS: readonly DocSection[];
  SECTION_LABELS: Record<string, string>;
  REQUIRED_KEYS: readonly string[];
  OPTIONAL_KEYS: readonly string[];
  slugFor(repoRelPath: string): string;
  parseDocFrontMatter(source: string, path: string): ParseResult;
  buildManifest(pages: readonly DocPage[]): Manifest;
  serialiseManifest(manifest: Manifest): string;
}

let cached: DocsLib | undefined;

function lib(): DocsLib {
  if (!existsSync(LIB_PATH)) {
    throw new Error(
      "B15 contract: scripts/docs/lib.mjs does not exist. It holds the pure half of the " +
        "docs pipeline (front matter, slugs, manifest, links, render, checkDocs) so that " +
        "build-site.mjs, check.mts and this oracle all read one implementation.",
    );
  }
  if (!cached) cached = require(LIB_PATH) as DocsLib;
  return cached;
}

/** A well-formed page, as a string, so the parser is exercised end to end. */
function page(front: string, body = "\nSome prose.\n"): string {
  return `---\n${front}\n---\n${body}`;
}

const GOOD_FRONT = [
  "title: Missions",
  "summary: Dispatch work and watch it run",
  "section: guides",
  "nav: 20",
  "audience: operator",
  "screen: /work/missions",
  "concepts: [mission, run, schedule]",
  "shots: [docs/images/work-missions.png]",
].join("\n");

describe("B15 · scripts/docs/lib.mjs is the pipeline's pure module", () => {
  it("exists", () => {
    expect(existsSync(LIB_PATH)).toBe(true);
  });

  it("names the six tiers, in reading order, with labels for each", () => {
    const { SECTIONS, SECTION_LABELS } = lib();
    expect([...SECTIONS]).toEqual([
      "start-here",
      "concepts",
      "guides",
      "running",
      "reference",
      "contributing",
    ]);
    for (const id of SECTIONS) {
      expect(typeof SECTION_LABELS[id]).toBe("string");
      expect(SECTION_LABELS[id].length).toBeGreaterThan(0);
    }
  });

  it("requires four keys and offers four more", () => {
    const { REQUIRED_KEYS, OPTIONAL_KEYS } = lib();
    expect([...REQUIRED_KEYS]).toEqual(["title", "summary", "section", "nav"]);
    expect([...OPTIONAL_KEYS]).toEqual(["audience", "screen", "concepts", "shots"]);
  });
});

describe("B15 · slugFor", () => {
  it("turns a docs path into a site slug", () => {
    expect(lib().slugFor("docs/guides/missions.md")).toBe("guides/missions");
    expect(lib().slugFor("docs/concepts/mission.md")).toBe("concepts/mission");
    expect(lib().slugFor("docs/start-here/first-hour.md")).toBe("start-here/first-hour");
  });

  it("gives docs/README.md the site's index slug", () => {
    expect(lib().slugFor("docs/README.md")).toBe("index");
  });

  it("keeps the uppercase GitHub files addressable", () => {
    // CONTRIBUTING, CODE_OF_CONDUCT, SECURITY and SUPPORT stay uppercase at the
    // top of docs/ because GitHub looks for them there; the site still needs a
    // slug, and it is kebab-case like every other one.
    expect(lib().slugFor("docs/SECURITY.md")).toBe("security");
    expect(lib().slugFor("docs/CONTRIBUTING.md")).toBe("contributing");
    expect(lib().slugFor("docs/CODE_OF_CONDUCT.md")).toBe("code-of-conduct");
  });
});

describe("B15 · parseDocFrontMatter", () => {
  it("accepts a complete block and hands back the body without it", () => {
    const result = lib().parseDocFrontMatter(page(GOOD_FRONT), "docs/guides/missions.md");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.title).toBe("Missions");
    expect(result.data.section).toBe("guides");
    expect(result.data.nav).toBe(20);
    expect(result.data.screen).toBe("/work/missions");
    expect(result.data.concepts).toEqual(["mission", "run", "schedule"]);
    expect(result.data.shots).toEqual(["docs/images/work-missions.png"]);
    expect(result.body).not.toContain("title: Missions");
    expect(result.body).toContain("Some prose.");
  });

  it("refuses a page with no front matter", () => {
    const result = lib().parseDocFrontMatter("# Missions\n\nProse.\n", "docs/guides/missions.md");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContain(
      "docs/guides/missions.md: no front matter (a page must open with a --- block)",
    );
  });

  it("names every missing required key, in REQUIRED_KEYS order", () => {
    const result = lib().parseDocFrontMatter(page("nav: 1"), "docs/guides/thin.md");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual([
      'docs/guides/thin.md: front matter is missing "title"',
      'docs/guides/thin.md: front matter is missing "summary"',
      'docs/guides/thin.md: front matter is missing "section"',
    ]);
  });

  it("refuses a nav that is not a number, and quotes what it got", () => {
    const front = GOOD_FRONT.replace("nav: 20", 'nav: "20"');
    const result = lib().parseDocFrontMatter(page(front), "docs/guides/missions.md");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContain(
      'docs/guides/missions.md: front matter "nav" must be a number (got "20")',
    );
  });

  it("refuses a section outside the six, and lists the six", () => {
    const front = GOOD_FRONT.replace("section: guides", "section: guide");
    const result = lib().parseDocFrontMatter(page(front), "docs/guides/missions.md");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContain(
      'docs/guides/missions.md: front matter "section" must be one of start-here, concepts, ' +
        'guides, running, reference, contributing (got "guide")',
    );
  });

  it("refuses an unknown key rather than silently dropping it", () => {
    const result = lib().parseDocFrontMatter(
      page(`${GOOD_FRONT}\nautor: someone`),
      "docs/guides/missions.md",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContain(
      'docs/guides/missions.md: front matter has an unknown key "autor"',
    );
  });

  it("refuses concepts and shots that are not lists of strings", () => {
    const bad = GOOD_FRONT.replace("concepts: [mission, run, schedule]", "concepts: mission").replace(
      "shots: [docs/images/work-missions.png]",
      "shots: 3",
    );
    const result = lib().parseDocFrontMatter(page(bad), "docs/guides/missions.md");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContain(
      'docs/guides/missions.md: front matter "concepts" must be a list of strings',
    );
    expect(result.errors).toContain(
      'docs/guides/missions.md: front matter "shots" must be a list of strings',
    );
  });

  it("refuses an audience outside the two", () => {
    const front = GOOD_FRONT.replace("audience: operator", "audience: everyone");
    const result = lib().parseDocFrontMatter(page(front), "docs/guides/missions.md");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContain(
      'docs/guides/missions.md: front matter "audience" must be "operator" or ' +
        '"contributor" (got "everyone")',
    );
  });

  it("tolerates the EOS keys every file in this repo already carries", () => {
    // type / tags / compiled_from are on every governing file in the tree and on
    // most of docs/. Refusing them would mean rewriting front matter the EOS
    // reads, which is not this batch's job.
    const front = `${GOOD_FRONT}\ntype: venture\ntags: [product]\ncompiled_from: preserved`;
    const result = lib().parseDocFrontMatter(page(front), "docs/guides/missions.md");
    expect(result.ok).toBe(true);
  });

  it("reports invalid YAML as invalid YAML, not as a missing key", () => {
    const result = lib().parseDocFrontMatter(
      page("title: [unclosed\nsummary: x"),
      "docs/guides/broken.md",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.length).toBe(1);
    expect(result.errors[0]).toMatch(
      /^docs\/guides\/broken\.md: front matter is not valid YAML \(/,
    );
  });
});

describe("B15 · buildManifest", () => {
  const pages: DocPage[] = [
    {
      path: "docs/guides/missions.md",
      slug: "guides/missions",
      body: "",
      data: {
        title: "Missions",
        summary: "Dispatch work",
        section: "guides",
        nav: 20,
        screen: "/work/missions",
        concepts: ["mission", "run"],
        shots: ["docs/images/work-missions.png"],
      },
    },
    {
      path: "docs/guides/chat.md",
      slug: "guides/chat",
      body: "",
      data: {
        title: "Chat",
        summary: "Talk to the agent",
        section: "guides",
        nav: 10,
        screen: "/work/chat",
      },
    },
    {
      path: "docs/concepts/mission.md",
      slug: "concepts/mission",
      body: "",
      data: { title: "Mission", summary: "A unit of work", section: "concepts", nav: 1 },
    },
    {
      path: "docs/concepts/run.md",
      slug: "concepts/run",
      body: "",
      data: { title: "Run", summary: "One execution", section: "concepts", nav: 2 },
    },
    {
      path: "docs/start-here/index.md",
      slug: "start-here/index",
      body: "",
      data: { title: "Start here", summary: "The first hour", section: "start-here", nav: 1 },
    },
  ];

  it("orders sections by SECTIONS and pages by nav", () => {
    const manifest = lib().buildManifest(pages);
    expect(manifest.sections.map((s) => s.id)).toEqual(["start-here", "concepts", "guides"]);
    const guides = manifest.sections.find((s) => s.id === "guides");
    expect(guides?.pages.map((p) => p.slug)).toEqual(["guides/chat", "guides/missions"]);
  });

  it("puts nav ahead of the slug, which is the whole reason nav exists", () => {
    // chat/missions happen to be alphabetical as well as in nav order, so the
    // case above cannot tell a nav sort from no sort at all. This one can: the
    // rail's order is a decision the author makes, not one the alphabet makes.
    const disagreeing: DocPage[] = [
      {
        path: "docs/guides/zebra.md",
        slug: "guides/zebra",
        body: "",
        data: { title: "Zebra", summary: "Last alphabetically, first in the rail", section: "guides", nav: 1 },
      },
      {
        path: "docs/guides/apple.md",
        slug: "guides/apple",
        body: "",
        data: { title: "Apple", summary: "First alphabetically, last in the rail", section: "guides", nav: 2 },
      },
    ];
    const manifest = lib().buildManifest(disagreeing);
    expect(manifest.sections[0].pages.map((p) => p.slug)).toEqual(["guides/zebra", "guides/apple"]);
    expect(manifest.order).toEqual(["guides/zebra", "guides/apple"]);
  });

  it("keeps a section's pages out of another section's list, whatever their nav", () => {
    // The grouping loop walks SECTIONS, so a page can only land in its own
    // section; this pins that rather than leaving it to the loop's shape.
    const mixed: DocPage[] = [
      {
        path: "docs/concepts/late.md",
        slug: "concepts/late",
        body: "",
        data: { title: "Late", summary: "A concept with a high nav", section: "concepts", nav: 900 },
      },
      {
        path: "docs/guides/early.md",
        slug: "guides/early",
        body: "",
        data: { title: "Early", summary: "A guide with a low nav", section: "guides", nav: 1 },
      },
    ];
    const manifest = lib().buildManifest(mixed);
    expect(manifest.sections.map((s) => s.id)).toEqual(["concepts", "guides"]);
    expect(manifest.order).toEqual(["concepts/late", "guides/early"]);
  });

  it("maps every screen to the slug that documents it", () => {
    const manifest = lib().buildManifest(pages);
    expect(manifest.screens).toEqual({
      "/work/chat": "guides/chat",
      "/work/missions": "guides/missions",
    });
  });

  it("collects the concept ids the concepts tier defines", () => {
    const manifest = lib().buildManifest(pages);
    expect(manifest.concepts).toEqual(["mission", "run"]);
  });

  it("gives one reading order across the whole path, for prev/next", () => {
    const manifest = lib().buildManifest(pages);
    expect(manifest.order).toEqual([
      "start-here/index",
      "concepts/mission",
      "concepts/run",
      "guides/chat",
      "guides/missions",
    ]);
  });

  it("names its own generator, so a hand-edit is obvious", () => {
    expect(lib().buildManifest(pages).generatedBy).toBe("scripts/docs/build-site.mjs");
  });
});

describe("B15 · serialiseManifest is the exact bytes of docs/manifest.json", () => {
  const one: DocPage[] = [
    {
      path: "docs/guides/chat.md",
      slug: "guides/chat",
      body: "",
      data: { title: "Chat", summary: "Talk", section: "guides", nav: 10, screen: "/work/chat" },
    },
  ];

  it("is two-space JSON with a trailing newline", () => {
    const text = lib().serialiseManifest(lib().buildManifest(one));
    expect(text.endsWith("\n")).toBe(true);
    expect(text).toContain('\n  "sections": [');
    expect(JSON.parse(text)).toEqual(lib().buildManifest(one));
  });

  it("is byte-identical across runs, so check-derived-views can hold it", () => {
    // No timestamp, no absolute path, no Date.now(). A derived view that moves on
    // every run trains everyone to re-bless it blind, which is how a gate becomes
    // decoration (the standing lesson from the output canary).
    const a = lib().serialiseManifest(lib().buildManifest(one));
    const b = lib().serialiseManifest(lib().buildManifest(one));
    expect(a).toBe(b);
    expect(a).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
  });
});
