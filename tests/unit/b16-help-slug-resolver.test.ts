/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports -- the modules under
   contract do not exist in the tree yet, so a static import would not compile
   and the oracle could not be committed alone. Each require sits inside the
   test that needs it, so a missing module fails THAT test with the contract
   sentence rather than collapsing the suite into one unreadable red. */

// ═══════════════════════════════════════════════════════════════
// B16 oracle, the pure layer: the pathname -> help-slug resolver, the manifest
// parser, the nav order and prev/next.
//
// Contract sections 2.1 (help-manifest.ts) and 2.4 (railOrder()). The resolver
// is the piece three consumers share: the Help page renders through it, the
// `?` on every PageHeader resolves through it, and docs:check proves every
// registry route reaches a guide through it. It must therefore stay pure: no
// React, no fs, no db, and no knowledge of where the corpus lives.
//
// NOTHING here reads public/help/. That directory is git-ignored and generated
// by B15's prebuild, so an oracle that read it would be green on the operator's
// machine and red on a fresh clone. Every manifest below is a fixture; the real
// corpus is held to the same shape by docs:check (contract 0.7).
//
// The one non-fixture input is the registry itself, which is why railOrder() is
// pinned against literals: a test that derived the expected order the same way
// the function does would pass for a function that returned its input.
// ═══════════════════════════════════════════════════════════════

import { allModuleRoutes } from "@/lib/modules/registry";

// ── The shapes the contract names (contract 0.3, 2.1) ───────────

type HelpSection = "start-here" | "concepts" | "guides" | "running" | "reference" | "contributing";

interface HelpPageMeta {
  slug: string;
  title: string;
  summary: string;
  section: HelpSection;
  nav: number;
  audience?: string;
  screen?: string;
  concepts?: string[];
  shots?: string[];
}

interface HelpManifest {
  generatedAt: string;
  pages: HelpPageMeta[];
}

type HelpScreenIndex = Record<string, string>;

interface ConceptEntry {
  id: string;
  term: string;
  short: string;
  slug: string;
}

interface HelpNavSection {
  section: HelpSection;
  label: string;
  pages: HelpPageMeta[];
}

interface HelpManifestModule {
  HELP_SECTIONS: readonly HelpSection[];
  HELP_SECTION_LABELS: Record<HelpSection, string>;
  EMPTY_HELP_MANIFEST: HelpManifest;
  isSafeHelpSlug: (slug: string) => boolean;
  parseHelpManifest: (raw: unknown) => HelpManifest;
  parseConcepts: (raw: unknown) => Record<string, ConceptEntry>;
  helpScreenIndex: (manifest: HelpManifest) => HelpScreenIndex;
  helpSlugForPathname: (pathname: string, index: HelpScreenIndex) => string | null;
  helpPageBySlug: (manifest: HelpManifest, slug: string) => HelpPageMeta | null;
  helpNavOrder: (manifest: HelpManifest) => HelpNavSection[];
  helpIndexSlug: (manifest: HelpManifest) => string | null;
  helpNeighbours: (
    manifest: HelpManifest,
    slug: string,
  ) => { prev: HelpPageMeta | null; next: HelpPageMeta | null };
}

/** The module under contract, or a failure that says which file B16 owes. */
function help(): HelpManifestModule {
  let mod: unknown;
  try {
    mod = require("@/lib/help/help-manifest") as unknown;
  } catch (err) {
    throw new Error(
      "B16 owes src/lib/help/help-manifest.ts (contract 2.1). require() said: " + String(err),
    );
  }
  const api = mod as Partial<HelpManifestModule>;
  const missing = (
    [
      "isSafeHelpSlug",
      "parseHelpManifest",
      "parseConcepts",
      "helpScreenIndex",
      "helpSlugForPathname",
      "helpPageBySlug",
      "helpNavOrder",
      "helpIndexSlug",
      "helpNeighbours",
    ] as const
  ).filter((k) => typeof api[k] !== "function");
  if (missing.length) {
    throw new Error(
      "src/lib/help/help-manifest.ts is missing the contract's exports (2.1): " + missing.join(", "),
    );
  }
  return api as HelpManifestModule;
}

/** railOrder(), or a failure that says which export B16 owes (contract 2.4). */
function railOrder(): string[] {
  const reg = require("@/lib/modules/registry") as { railOrder?: () => string[] };
  if (typeof reg.railOrder !== "function") {
    throw new Error("B16 owes railOrder() in src/lib/modules/registry.ts (contract 2.4).");
  }
  return reg.railOrder();
}

// ── Fixtures ────────────────────────────────────────────────────

/**
 * The rail as the registry spells it: five sections in NAV_SECTIONS order,
 * each section's links by `order` across modules, each link followed by its
 * sub-links. Written out rather than derived, so railOrder() is measured
 * against a statement of the answer and not against its own algorithm.
 *
 * ONE entry is read off the registry rather than written down: B9 (T-0103) is
 * folding Personalities into the Agents tabs and dropping its sub-link. That
 * changes this one row and nothing else, and B16 must not go red for B9's
 * reason.
 */
const PERSONALITIES_ROW: readonly string[] = allModuleRoutes().includes("/agent/personalities")
  ? ["/agent/personalities"]
  : [];

const HOME_ROWS: readonly string[] = ["/", "/quests", "/help"];
const WORK_ROWS: readonly string[] = [
  "/work/chat",
  "/work/missions",
  "/work/composer",
  "/work/research",
  "/work/scripts",
];
const RESULTS_ROWS: readonly string[] = [
  "/results/sessions",
  "/results/artifacts",
  "/results/insights",
  "/results/logs",
];
const AGENT_ROWS: readonly string[] = [
  "/agent/profiles",
  ...PERSONALITIES_ROW,
  "/agent/skills",
  "/agent/tools",
  "/agent/memory",
  "/agent/models",
  "/agent/settings",
  "/agent/settings/restore",
  "/agent/settings/system",
];
const REC_ROOM_ROWS: readonly string[] = [
  "/recroom/story-weaver",
  "/recroom/story-weaver/library",
  "/recroom/story-weaver/create",
  "/recroom/story-weaver/characters",
  "/recroom/story-weaver/themes",
];

const EXPECTED_RAIL: readonly string[] = [
  ...HOME_ROWS,
  ...WORK_ROWS,
  ...RESULTS_ROWS,
  ...AGENT_ROWS,
  ...REC_ROOM_ROWS,
];

const slugFor = (route: string): string =>
  route === "/" ? "guides/dashboard" : "guides/" + route.slice(1).split("/").join("-");

function page(over: Partial<HelpPageMeta> & { slug: string }): HelpPageMeta {
  return {
    title: over.slug,
    summary: "",
    section: "guides",
    nav: 1,
    ...over,
  };
}

/** A manifest with one guide per rail destination, in rail order. */
function railManifest(): HelpManifest {
  return {
    generatedAt: "2026-09-05T00:00:00.000Z",
    pages: EXPECTED_RAIL.map((route, i) =>
      page({ slug: slugFor(route), title: route, section: "guides", nav: i + 1, screen: route }),
    ),
  };
}

// ── The control, green today ────────────────────────────────────

describe("the inputs the resolver is measured against", () => {
  it("finds the registry's routes, so an empty matrix cannot read as a pass", () => {
    const routes = allModuleRoutes();
    expect(routes.length).toBeGreaterThanOrEqual(40);
    expect(routes).toContain("/work/missions");
    expect(routes).toContain("/agent/settings/security");
    expect(new Set(EXPECTED_RAIL).size).toBe(EXPECTED_RAIL.length);
    expect(EXPECTED_RAIL.length).toBeGreaterThanOrEqual(25);
  });
});

// ── railOrder (contract 2.4) ────────────────────────────────────

describe("railOrder names every rail destination in the order the rail shows it", () => {
  it("is the five sections in order, each link followed by its sub-links", () => {
    expect(railOrder()).toEqual([...EXPECTED_RAIL]);
  });

  it("keeps the sections whole, in NAV_SECTIONS order", () => {
    const rail = railOrder();
    expect(rail.slice(0, HOME_ROWS.length)).toEqual([...HOME_ROWS]);
    expect(rail.slice(HOME_ROWS.length, HOME_ROWS.length + WORK_ROWS.length)).toEqual([...WORK_ROWS]);
    expect(rail.slice(-REC_ROOM_ROWS.length)).toEqual([...REC_ROOM_ROWS]);
  });

  it("leaves the derived settings SECTION routes out: they are not rail destinations", () => {
    const rail = railOrder();
    expect(rail).not.toContain("/agent/settings/security");
    expect(rail).not.toContain("/agent/settings/hermes_md");
    expect(rail).toContain("/agent/settings");
    expect(rail).toContain("/agent/settings/restore");
  });

  it("keeps the flagged Composer, because a flag hides a rail entry and not its guide", () => {
    expect(railOrder()).toContain("/work/composer");
  });
});

// ── isSafeHelpSlug (contract 2.1) ───────────────────────────────

describe("isSafeHelpSlug is the whole path-traversal guard", () => {
  it("accepts the kebab-case, multi-segment slugs the corpus produces", () => {
    const ok = [
      "guides/missions",
      "start-here/tour/missions",
      "start-here/what-it-is",
      "concepts/api-key",
      "reference/api",
      "running/backup-and-upgrade",
      "a1/b2-c3",
    ];
    for (const slug of ok) expect({ slug, safe: help().isSafeHelpSlug(slug) }).toEqual({ slug, safe: true });
  });

  it("refuses everything that could leave the fragments directory or name a file", () => {
    const bad = [
      "",
      "/",
      "/guides/missions",
      "guides/",
      "guides//missions",
      "..",
      "guides/..",
      "guides/../../etc/passwd",
      "./guides/missions",
      "guides/Missions",
      "guides/missions.html",
      "guides\\missions",
      "guides/missions ",
      "-guides/missions",
      "guides/ missions",
      "guides/missions?x=1",
    ];
    for (const slug of bad) {
      expect({ slug, safe: help().isSafeHelpSlug(slug) }).toEqual({ slug, safe: false });
    }
  });
});

// ── parseHelpManifest / parseConcepts totality (contract 2.1) ───

describe("the parsers are total: a corpus that is absent or broken is empty, never a throw", () => {
  it("answers the empty manifest for anything that is not a manifest", () => {
    const api = help();
    for (const raw of [null, undefined, 0, "", "{}", [], { pages: null }, { pages: {} }]) {
      expect(api.parseHelpManifest(raw)).toEqual(api.EMPTY_HELP_MANIFEST);
    }
    expect(api.EMPTY_HELP_MANIFEST.pages).toEqual([]);
  });

  it("drops the entries it cannot trust and keeps the rest", () => {
    const parsed = help().parseHelpManifest({
      generatedAt: "now",
      pages: [
        { slug: "guides/missions", title: "Missions", summary: "s", section: "guides", nav: 1 },
        { title: "no slug", section: "guides", nav: 1 },
        { slug: "guides/x", title: "unknown section", section: "appendix", nav: 1 },
        { slug: "../escape", title: "unsafe", section: "guides", nav: 1 },
        { slug: "concepts/agent", title: "Agent", summary: "s", section: "concepts", nav: 2 },
      ],
    });
    expect(parsed.pages.map((p) => p.slug)).toEqual(["guides/missions", "concepts/agent"]);
  });

  it("indexes concepts by id and drops an entry with no term or no short", () => {
    const index = help().parseConcepts({
      concepts: [
        { id: "agent", term: "Agent", short: "The thing that does the work.", slug: "concepts/agent" },
        { id: "broken", term: "Broken" },
        { term: "No id", short: "x", slug: "concepts/x" },
      ],
    });
    expect(Object.keys(index)).toEqual(["agent"]);
    expect(index.agent.slug).toBe("concepts/agent");
    expect(help().parseConcepts(null)).toEqual({});
  });
});

// ── helpScreenIndex (contract 2.1) ──────────────────────────────

describe("helpScreenIndex maps a screen to exactly one slug", () => {
  it("skips the pages that document no screen", () => {
    const index = help().helpScreenIndex({
      generatedAt: "",
      pages: [
        page({ slug: "guides/missions", section: "guides", nav: 1, screen: "/work/missions" }),
        page({ slug: "concepts/agent", section: "concepts", nav: 1 }),
      ],
    });
    expect(index).toEqual({ "/work/missions": "guides/missions" });
  });

  it("gives the guide the screen when the tour page names it too", () => {
    const index = help().helpScreenIndex({
      generatedAt: "",
      pages: [
        page({ slug: "start-here/tour/missions", section: "start-here", nav: 1, screen: "/work/missions" }),
        page({ slug: "guides/missions", section: "guides", nav: 9, screen: "/work/missions" }),
      ],
    });
    expect(index["/work/missions"]).toBe("guides/missions");
  });

  it("falls back to the lowest nav, then the smallest slug, when no guide claims the screen", () => {
    const api = help();
    expect(
      api.helpScreenIndex({
        generatedAt: "",
        pages: [
          page({ slug: "running/operating", section: "running", nav: 4, screen: "/results/logs" }),
          page({ slug: "start-here/tour/logs", section: "start-here", nav: 2, screen: "/results/logs" }),
        ],
      })["/results/logs"],
    ).toBe("start-here/tour/logs");
    expect(
      api.helpScreenIndex({
        generatedAt: "",
        pages: [
          page({ slug: "running/z", section: "running", nav: 3, screen: "/results/logs" }),
          page({ slug: "running/a", section: "running", nav: 3, screen: "/results/logs" }),
        ],
      })["/results/logs"],
    ).toBe("running/a");
  });
});

// ── helpSlugForPathname (contract 2.1) ──────────────────────────

describe("every registry route reaches a guide", () => {
  it("resolves a slug for all of allModuleRoutes(), settings sections included", () => {
    const api = help();
    const index = api.helpScreenIndex(railManifest());
    const unreachable = allModuleRoutes().filter((r) => api.helpSlugForPathname(r, index) === null);
    expect(unreachable).toEqual([]);
  });

  it("gives each rail destination its own guide, not an ancestor's", () => {
    const api = help();
    const index = api.helpScreenIndex(railManifest());
    const wrong = EXPECTED_RAIL.filter((r) => api.helpSlugForPathname(r, index) !== slugFor(r));
    expect(wrong).toEqual([]);
  });

  it("sends a settings section to the Settings guide, and Restore to its own", () => {
    const api = help();
    const index = api.helpScreenIndex(railManifest());
    expect(api.helpSlugForPathname("/agent/settings/security", index)).toBe(slugFor("/agent/settings"));
    expect(api.helpSlugForPathname("/agent/settings/hermes_md", index)).toBe(slugFor("/agent/settings"));
    expect(api.helpSlugForPathname("/agent/settings/restore", index)).toBe(slugFor("/agent/settings/restore"));
  });
});

describe("helpSlugForPathname reads a path the way labelFor does", () => {
  const index = (): HelpScreenIndex => ({
    "/": "guides/dashboard",
    "/work/chat": "guides/work-chat",
    "/results/sessions": "guides/results-sessions",
  });

  it("gives a detail path its list page's guide", () => {
    expect(help().helpSlugForPathname("/results/sessions/abc123", index())).toBe("guides/results-sessions");
  });

  it("strips the query, the hash and a trailing slash", () => {
    const api = help();
    for (const path of ["/work/chat?tab=x", "/work/chat#top", "/work/chat/", "/work/chat/?a=1#b"]) {
      expect({ path, slug: api.helpSlugForPathname(path, index()) }).toEqual({
        path,
        slug: "guides/work-chat",
      });
    }
  });

  it("does not let the dashboard's guide own every path", () => {
    const api = help();
    expect(api.helpSlugForPathname("/", index())).toBe("guides/dashboard");
    expect(api.helpSlugForPathname("/agent/models", index())).toBeNull();
  });

  it("owns a path only on a segment boundary", () => {
    expect(help().helpSlugForPathname("/work/chatter", index())).toBeNull();
  });

  it("answers null for a path no screen claims, and for an empty index", () => {
    const api = help();
    expect(api.helpSlugForPathname("/nowhere", index())).toBeNull();
    expect(api.helpSlugForPathname("/work/chat", {})).toBeNull();
  });
});

// ── helpNavOrder / helpIndexSlug / helpNeighbours (contract 2.1) ─

describe("helpNavOrder is the Help rail", () => {
  it("puts the sections in tier order and leaves out the ones with no pages", () => {
    const order = help().helpNavOrder({
      generatedAt: "",
      pages: [
        page({ slug: "reference/api", section: "reference", nav: 1 }),
        page({ slug: "start-here/what-it-is", section: "start-here", nav: 1 }),
        page({ slug: "guides/dashboard", section: "guides", nav: 1, screen: "/" }),
      ],
    });
    expect(order.map((s) => s.section)).toEqual(["start-here", "guides", "reference"]);
    expect(order[0].label).toBe(help().HELP_SECTION_LABELS["start-here"]);
  });

  it("sorts the guides by rail order, whatever their nav numbers say", () => {
    const order = help().helpNavOrder({
      generatedAt: "",
      pages: [
        page({ slug: "guides/agent-models", section: "guides", nav: 1, screen: "/agent/models" }),
        page({ slug: "guides/dashboard", section: "guides", nav: 2, screen: "/" }),
        page({ slug: "guides/work-chat", section: "guides", nav: 3, screen: "/work/chat" }),
      ],
    });
    expect(order[0].pages.map((p) => p.slug)).toEqual([
      "guides/dashboard",
      "guides/work-chat",
      "guides/agent-models",
    ]);
  });

  it("sorts a guide that documents no rail route after every one that does", () => {
    const order = help().helpNavOrder({
      generatedAt: "",
      pages: [
        page({ slug: "guides/orphan", section: "guides", nav: 0 }),
        page({ slug: "guides/agent-models", section: "guides", nav: 9, screen: "/agent/models" }),
      ],
    });
    expect(order[0].pages.map((p) => p.slug)).toEqual(["guides/agent-models", "guides/orphan"]);
  });

  it("sorts every other section by nav, then by slug", () => {
    const order = help().helpNavOrder({
      generatedAt: "",
      pages: [
        page({ slug: "start-here/tour/missions", section: "start-here", nav: 5 }),
        page({ slug: "start-here/what-it-is", section: "start-here", nav: 1 }),
        page({ slug: "start-here/tour/chat", section: "start-here", nav: 4 }),
        page({ slug: "start-here/b", section: "start-here", nav: 1 }),
      ],
    });
    expect(order[0].pages.map((p) => p.slug)).toEqual([
      "start-here/b",
      "start-here/what-it-is",
      "start-here/tour/chat",
      "start-here/tour/missions",
    ]);
  });
});

describe("the index page and the prev/next chain", () => {
  const corpus = (): HelpManifest => ({
    generatedAt: "",
    pages: [
      page({ slug: "start-here/what-it-is", section: "start-here", nav: 1 }),
      page({ slug: "start-here/tour/chat", section: "start-here", nav: 2 }),
      page({ slug: "guides/dashboard", section: "guides", nav: 1, screen: "/" }),
      page({ slug: "guides/work-chat", section: "guides", nav: 2, screen: "/work/chat" }),
      page({ slug: "reference/api", section: "reference", nav: 1 }),
    ],
  });

  it("renders /help as the first page of the nav order, not a hard-coded slug", () => {
    const api = help();
    expect(api.helpIndexSlug(corpus())).toBe("start-here/what-it-is");
    expect(api.helpIndexSlug(api.EMPTY_HELP_MANIFEST)).toBeNull();
  });

  it("walks the chain across a section boundary", () => {
    const n = help().helpNeighbours(corpus(), "start-here/tour/chat");
    expect(n.prev?.slug).toBe("start-here/what-it-is");
    expect(n.next?.slug).toBe("guides/dashboard");
  });

  it("has no previous at the front and no next at the back", () => {
    const api = help();
    expect(api.helpNeighbours(corpus(), "start-here/what-it-is").prev).toBeNull();
    expect(api.helpNeighbours(corpus(), "reference/api").next).toBeNull();
  });

  it("answers both null for a slug the manifest does not carry", () => {
    expect(help().helpNeighbours(corpus(), "guides/nope")).toEqual({ prev: null, next: null });
  });

  it("finds a page by slug, and nothing for one that is absent", () => {
    const api = help();
    expect(api.helpPageBySlug(corpus(), "guides/work-chat")?.section).toBe("guides");
    expect(api.helpPageBySlug(corpus(), "guides/nope")).toBeNull();
  });
});
