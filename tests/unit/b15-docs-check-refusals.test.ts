/* eslint-disable @typescript-eslint/no-require-imports -- scripts/docs/lib.mjs is loaded by a COMPUTED path, deliberately: a static import of it from a test would be a typecheck error while the module was still unwritten, and typecheck:tests runs inside npm run lint */
/**
 * B15 (T-0109), decision 3 — `docs:check`, the doc-coverage gate.
 *
 * The plan gives this gate six refusals: a registry route with no guide, a
 * `screen:` that is not a registry route, a missing referenced image, an
 * undefined concept id, a stale generated block, and a leftover old group name.
 * Four documentation audits found the same failure over and over — a doc that
 * reads as verified while naming something that no longer exists — so the gate
 * is the point of the whole pipeline, not a nicety on top of it.
 *
 * The refusals are pinned as PURE data: `checkDocs()` takes its pages, its
 * routes, an `imageExists` probe and the freshly generated block bodies, and
 * returns refusal records. The CLI (`scripts/docs/check.mts`, run by `npm run
 * lint` through `npx tsx`) gathers those four inputs from the registry, the
 * filesystem and `scripts/docs/extract.ts` and prints them. Keeping the judgement
 * pure is what lets this file test it without a docs tree, a build, or tsx.
 *
 * Red today because `scripts/docs/lib.mjs` does not exist.
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

type RefusalCode =
  | "route-without-guide"
  | "screen-not-a-route"
  | "missing-image"
  | "undefined-concept"
  | "stale-generated-block"
  | "retired-path";

interface Refusal {
  code: RefusalCode;
  path: string;
  subject: string;
  message: string;
}

interface CheckInput {
  pages: readonly DocPage[];
  routes: readonly string[];
  imageExists: (repoRelPath: string) => boolean;
  freshBlocks: Readonly<Record<string, string>>;
}

interface DocsLib {
  REFUSAL_CODES: readonly RefusalCode[];
  RETIRED_PATHS: readonly string[];
  checkDocs(input: CheckInput): Refusal[];
}

let cached: DocsLib | undefined;

function lib(): DocsLib {
  if (!existsSync(LIB_PATH)) {
    throw new Error(
      "B15 contract: scripts/docs/lib.mjs does not exist. checkDocs() lives there, pure, so " +
        "that scripts/docs/check.mts is a thin CLI and this oracle needs no docs tree.",
    );
  }
  if (!cached) cached = require(LIB_PATH) as DocsLib;
  return cached;
}

const ROUTES = ["/work/chat", "/work/missions"];

/**
 * The three headings B18 requires of every guide.
 *
 * Appended to a GUIDE fixture's body rather than written into each case,
 * because after B18 a guide without them is not a complete corpus, and a
 * fixture that omitted them would make this file's green control red for a
 * reason none of its cases are about. A case that wants to prove something
 * about a body still writes that body; it just also gets the house shape.
 */
const HOUSE_SECTIONS = ["## What you see", "## Typical use", "## Notes"].join("\n\n");

function makePage(over: Partial<DocPage> & { slug: string; data: DocFrontMatter }): DocPage {
  const page = { path: `docs/${over.slug}.md`, body: "", ...over };
  if (!over.slug.startsWith("guides/")) return page;
  return { ...page, body: `${page.body}\n\n${HOUSE_SECTIONS}\n` };
}

/** Every route covered, every reference resolvable, every block fresh. */
function cleanInput(): CheckInput {
  return {
    pages: [
      makePage({
        slug: "guides/chat",
        data: {
          title: "Chat",
          summary: "Talk to the agent",
          section: "guides",
          nav: 10,
          screen: "/work/chat",
        },
      }),
      makePage({
        slug: "guides/missions",
        body: "Open the board at /work/missions and dispatch one.",
        data: {
          title: "Missions",
          summary: "Dispatch work",
          section: "guides",
          nav: 20,
          screen: "/work/missions",
          concepts: ["mission"],
          shots: ["docs/images/work-missions.png"],
        },
      }),
      makePage({
        slug: "concepts/mission",
        data: { title: "Mission", summary: "A unit of work", section: "concepts", nav: 1 },
      }),
    ],
    routes: [...ROUTES],
    imageExists: (p) => p === "docs/images/work-missions.png",
    freshBlocks: {},
  };
}

const API_PAGE = (body: string): DocPage =>
  makePage({
    slug: "reference/api",
    body,
    data: { title: "API", summary: "REST endpoints", section: "reference", nav: 1 },
  });

describe("B15 · docs:check refuses nothing when the corpus is whole", () => {
  it("is a GREEN CONTROL: a complete fixture produces no refusals", () => {
    // Without this, every red below could be a checker that refuses everything.
    expect(lib().checkDocs(cleanInput())).toEqual([]);
  });

  it("declares its six refusal codes", () => {
    expect([...lib().REFUSAL_CODES].sort()).toEqual([
      "missing-image",
      "retired-path",
      "route-without-guide",
      "screen-not-a-route",
      "stale-generated-block",
      "undefined-concept",
    ]);
  });
});

describe("B15 · docs:check refusal 1 — a registry route with no guide", () => {
  it("names the route and says what would satisfy it", () => {
    const input = cleanInput();
    const refusals = lib().checkDocs({
      ...input,
      pages: input.pages.filter((p) => p.slug !== "guides/chat"),
    });
    expect(refusals.map((r) => r.code)).toEqual(["route-without-guide"]);
    expect(refusals[0].subject).toBe("/work/chat");
    expect(refusals[0].message).toBe(
      "docs:check: the registry route /work/chat has no guide (no page declares screen: /work/chat)",
    );
  });

  it("reports the routes in the order the registry gives them", () => {
    const input = cleanInput();
    const refusals = lib().checkDocs({ ...input, pages: [input.pages[2]] });
    expect(refusals.filter((r) => r.code === "route-without-guide").map((r) => r.subject)).toEqual([
      "/work/chat",
      "/work/missions",
    ]);
  });
});

describe("B15 · docs:check refusal 2 — a screen: that is not a registry route", () => {
  it("names the page and the route it invented", () => {
    const input = cleanInput();
    const ghost = makePage({
      slug: "guides/ghost",
      data: {
        title: "Ghost",
        summary: "A page for a screen that is not there",
        section: "guides",
        nav: 99,
        screen: "/orchestration/missions",
      },
    });
    const refusals = lib()
      .checkDocs({ ...input, pages: [...input.pages, ghost] })
      .filter((r) => r.code === "screen-not-a-route");
    expect(refusals).toHaveLength(1);
    expect(refusals[0].path).toBe("docs/guides/ghost.md");
    expect(refusals[0].subject).toBe("/orchestration/missions");
    expect(refusals[0].message).toBe(
      "docs:check: docs/guides/ghost.md declares screen: /orchestration/missions, " +
        "which is not a registry route",
    );
  });
});

describe("B15 · docs:check refusal 3 — a referenced image that is not on disk", () => {
  it("names the page and the image", () => {
    const input = cleanInput();
    const refusals = lib()
      .checkDocs({ ...input, imageExists: () => false })
      .filter((r) => r.code === "missing-image");
    expect(refusals).toHaveLength(1);
    expect(refusals[0].path).toBe("docs/guides/missions.md");
    expect(refusals[0].subject).toBe("docs/images/work-missions.png");
    expect(refusals[0].message).toBe(
      "docs:check: docs/guides/missions.md references docs/images/work-missions.png, " +
        "which does not exist",
    );
  });
});

describe("B15 · docs:check refusal 4 — an undefined concept id", () => {
  it("names the page and the concept nothing defines", () => {
    const input = cleanInput();
    const pages = input.pages.map((p) =>
      p.slug === "guides/missions"
        ? { ...p, data: { ...p.data, concepts: ["mission", "widget"] } }
        : p,
    );
    const refusals = lib()
      .checkDocs({ ...input, pages })
      .filter((r) => r.code === "undefined-concept");
    expect(refusals).toHaveLength(1);
    expect(refusals[0].path).toBe("docs/guides/missions.md");
    expect(refusals[0].subject).toBe("widget");
    expect(refusals[0].message).toBe(
      'docs:check: docs/guides/missions.md names concept "widget", ' +
        "which no page under docs/concepts/ defines",
    );
  });

  it("does not let a page in another tier define a concept by its basename", () => {
    // docs/guides/mission.md is a guide, not a definition. Reading its basename
    // as a concept id would mean a concepts/ page could be deleted and every
    // reference to it stay green.
    const input = cleanInput();
    const pages = input.pages
      .filter((p) => p.slug !== "concepts/mission")
      .concat(
        makePage({
          slug: "guides/mission",
          data: { title: "Mission guide", summary: "Not a definition", section: "guides", nav: 25 },
        }),
      );
    const refusals = lib()
      .checkDocs({ ...input, pages })
      .filter((r) => r.code === "undefined-concept");
    expect(refusals.map((r) => r.subject)).toEqual(["mission"]);
  });

  it("takes the concept id from the concepts page's own basename", () => {
    // No `defines:` key: a concept's id IS its slug under docs/concepts/, so the
    // id and the file cannot drift apart.
    const input = cleanInput();
    const pages = input.pages.map((p) =>
      p.slug === "concepts/mission"
        ? { ...p, slug: "concepts/task", path: "docs/concepts/task.md" }
        : p,
    );
    const refusals = lib()
      .checkDocs({ ...input, pages })
      .filter((r) => r.code === "undefined-concept");
    expect(refusals.map((r) => r.subject)).toEqual(["mission"]);
  });
});

describe("B15 · docs:check refusal 5 — a stale generated block", () => {
  const fenced = (body: string) =>
    `Intro.\n\n<!-- generated:api-routes -->\n${body}\n<!-- /generated:api-routes -->\n`;

  it("refuses a block whose body is not what the extractor produces now", () => {
    const input = cleanInput();
    const refusals = lib()
      .checkDocs({
        ...input,
        pages: [...input.pages, API_PAGE(fenced("| `/api/old` |"))],
        freshBlocks: { "api-routes": "| `/api/new` |" },
      })
      .filter((r) => r.code === "stale-generated-block");
    expect(refusals).toHaveLength(1);
    expect(refusals[0].path).toBe("docs/reference/api.md");
    expect(refusals[0].subject).toBe("api-routes");
    expect(refusals[0].message).toBe(
      'docs:check: docs/reference/api.md generated block "api-routes" is stale ' +
        "(run npm run docs:generate)",
    );
  });

  it("says nothing about a fence the extractor does not know", () => {
    // freshBlocks holds what the extractor can produce NOW. A fence for an id it
    // has no generator for is not stale, it is unimplemented, and refusing it
    // would make every page carrying a not-yet-wired fence red (quest-defs is
    // exactly that until B17).
    const refusals = lib()
      .checkDocs({
        ...cleanInput(),
        pages: [API_PAGE("<!-- generated:quest-defs -->\n_pending_\n<!-- /generated:quest-defs -->")],
        routes: [],
        freshBlocks: {},
      })
      .filter((r) => r.code === "stale-generated-block");
    expect(refusals).toEqual([]);
  });

  it("passes a block whose body already matches", () => {
    const input = cleanInput();
    const refusals = lib()
      .checkDocs({
        ...input,
        pages: [...input.pages, API_PAGE(fenced("| `/api/new` |"))],
        freshBlocks: { "api-routes": "| `/api/new` |" },
      })
      .filter((r) => r.code === "stale-generated-block");
    expect(refusals).toEqual([]);
  });

  it("refuses an opening marker with no closing marker, rather than reading it as absent", () => {
    const input = cleanInput();
    const refusals = lib()
      .checkDocs({
        ...input,
        pages: [
          ...input.pages,
          API_PAGE("Intro.\n\n<!-- generated:api-routes -->\n| `/api/new` |\n"),
        ],
        freshBlocks: { "api-routes": "| `/api/new` |" },
      })
      .filter((r) => r.code === "stale-generated-block");
    expect(refusals).toHaveLength(1);
    expect(refusals[0].message).toBe(
      'docs:check: docs/reference/api.md generated block "api-routes" has no closing marker',
    );
  });
});

describe("B15 · docs:check refusal 6 — a leftover old group name", () => {
  it("refuses a body still pointing at a retired path", () => {
    const input = cleanInput();
    const pages = input.pages.map((p) =>
      p.slug === "guides/missions"
        ? { ...p, body: "Open the board at /orchestration/missions and dispatch one." }
        : p,
    );
    const refusals = lib()
      .checkDocs({ ...input, pages })
      .filter((r) => r.code === "retired-path");
    expect(refusals).toHaveLength(1);
    expect(refusals[0].path).toBe("docs/guides/missions.md");
    expect(refusals[0].subject).toBe("/orchestration/missions");
    expect(refusals[0].message).toBe(
      'docs:check: docs/guides/missions.md names the retired path "/orchestration/missions"',
    );
  });

  it("does not refuse a relative link to the sibling guide of the same name", () => {
    // Five guides are named for a route the regroup retired -- logs, sessions,
    // memory, insights, models -- so a guide linking to its neighbour writes
    // exactly the string the matcher is hunting for. `../guides/logs.md` was
    // always safe, because the segment in front of it fired the lookbehind;
    // `./logs.md` had nothing in front of the dot. A path that begins `./` or
    // `../` is a file on disk, and no reader can visit it as a URL.
    const input = cleanInput();
    const pages = input.pages.map((p) =>
      p.slug === "guides/missions"
        ? {
            ...p,
            body: [
              "The [Logs](./logs.md) screen reads the same files, and a run leaves a",
              "[transcript](./sessions.md) behind. See also [Insights](../guides/insights.md)",
              "and what the agent [remembers](./memory.md).",
            ].join("\n"),
          }
        : p,
    );
    const refusals = lib()
      .checkDocs({ ...input, pages })
      .filter((r) => r.code === "retired-path");
    expect(refusals).toEqual([]);
  });

  it("still refuses a retired path used as a link target, which IS a URL", () => {
    // The counterweight to the case above: the fix must not open a hole. A
    // markdown target with no leading dot is a path the reader's browser will
    // actually request, and that one is still wrong.
    const input = cleanInput();
    const pages = input.pages.map((p) =>
      p.slug === "guides/missions" ? { ...p, body: "Open [the board](/orchestration/missions)." } : p,
    );
    const refusals = lib()
      .checkDocs({ ...input, pages })
      .filter((r) => r.code === "retired-path");
    expect(refusals).toHaveLength(1);
    expect(refusals[0].subject).toBe("/orchestration/missions");
  });

  it("lists the three retired groups the regroup replaced", () => {
    expect([...lib().RETIRED_PATHS]).toEqual(
      expect.arrayContaining(["/orchestration/", "/operations/", "/laboratory/"]),
    );
  });

  it("does not refuse a source file that happens to sit under one of those words", () => {
    // src/app/(main)/sessions/page.tsx is a file, not a URL an operator types,
    // and the guides are full of them. A matcher that refuses those would make
    // every architecture note red for naming its own source.
    const input = cleanInput();
    const pages = input.pages.map((p) =>
      p.slug === "guides/missions"
        ? {
            ...p,
            body:
              "The board is `src/app/(main)/results/sessions/page.tsx`, its logs go to " +
              "`{PS_DATA_DIR}/logs`, and before the regroup this page was " +
              "/orchestration/missions/page.tsx.",
          }
        : p,
    );
    expect(lib().checkDocs({ ...input, pages }).filter((r) => r.code === "retired-path")).toEqual([]);
  });

  it("GREEN CONTROL: the new paths are not refused", () => {
    // /work/missions is in the clean fixture's body. A matcher that refuses the
    // replacement as well as the thing it replaced is worse than no matcher.
    expect(lib().checkDocs(cleanInput()).filter((r) => r.code === "retired-path")).toEqual([]);
  });
});

describe("B15 · every refusal prints under one prefix", () => {
  it("starts every message with docs:check: and names its subject", () => {
    const input = cleanInput();
    const refusals = lib().checkDocs({
      ...input,
      pages: input.pages
        .filter((p) => p.slug !== "guides/chat")
        .map((p) =>
          p.slug === "guides/missions"
            ? {
                ...p,
                body: "See /operations/agents.",
                data: { ...p.data, concepts: ["widget"], screen: "/nope" },
              }
            : p,
        ),
      imageExists: () => false,
    });
    expect(refusals.length).toBeGreaterThanOrEqual(5);
    for (const r of refusals) {
      expect(r.message.startsWith("docs:check: ")).toBe(true);
      expect(r.message).toContain(r.subject);
    }
  });
});
