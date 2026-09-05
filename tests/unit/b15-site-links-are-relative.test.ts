/* eslint-disable @typescript-eslint/no-require-imports -- scripts/docs/lib.mjs is loaded by a COMPUTED path, deliberately: a static import of it from a test would be a typecheck error while the module was still unwritten, and typecheck:tests runs inside npm run lint */
/**
 * B15 (T-0109), decisions 3 and 9 — the built site must open from `file://`.
 *
 * The same `site/` output has to work in three places: GitHub Pages under the
 * base path `/PatterStage/`, a local static server, and a plain double-click on
 * `site/index.html` with no server at all. One root-relative `href="/guides/…"`
 * breaks two of the three, and a `fetch("search.json")` breaks the third
 * silently — Chrome gives a `file://` page an opaque origin, so the request is
 * refused by CORS and the search box simply never finds anything.
 *
 * So: every link the generator writes is RELATIVE, the stylesheet is INLINE, and
 * the search index arrives as a `<script src>` that assigns a global rather than
 * as JSON that has to be fetched.
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

interface ManifestPage {
  slug: string;
  title: string;
  summary: string;
  nav: number;
  screen?: string;
}

interface Manifest {
  generatedBy: string;
  sections: Array<{ id: DocSection; label: string; pages: ManifestPage[] }>;
  screens: Record<string, string>;
  concepts: string[];
  order: string[];
}

interface DocsLib {
  relativeHref(fromSlug: string, toSlug: string): string;
  stripLeadingH1(html: string): string;
  relativeAsset(fromSlug: string, repoRelPath: string): string;
  buildManifest(pages: readonly DocPage[]): Manifest;
  renderPage(page: DocPage, html: string, manifest: Manifest): string;
  renderFragment(page: DocPage, html: string, manifest: Manifest): string;
}

let cached: DocsLib | undefined;

function lib(): DocsLib {
  if (!existsSync(LIB_PATH)) {
    throw new Error(
      "B15 contract: scripts/docs/lib.mjs does not exist. relativeHref / relativeAsset / " +
        "renderPage / renderFragment live there; build-site.mjs is the CLI over them.",
    );
  }
  if (!cached) cached = require(LIB_PATH) as DocsLib;
  return cached;
}

const PAGES: DocPage[] = [
  {
    path: "docs/README.md",
    slug: "index",
    body: "",
    data: { title: "Documentation", summary: "Where to start", section: "start-here", nav: 0 },
  },
  {
    path: "docs/start-here/first-hour.md",
    slug: "start-here/first-hour",
    body: "",
    data: {
      title: "The first hour",
      summary: "Install to first mission",
      section: "start-here",
      nav: 1,
    },
  },
  {
    path: "docs/concepts/mission.md",
    slug: "concepts/mission",
    body: "",
    data: { title: "Mission", summary: "A unit of work", section: "concepts", nav: 1 },
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
    path: "docs/guides/missions.md",
    slug: "guides/missions",
    body: "",
    data: {
      title: "Missions",
      summary: "Dispatch work",
      section: "guides",
      nav: 20,
      screen: "/work/missions",
      shots: ["docs/images/work-missions.png"],
    },
  },
];

const MISSIONS = PAGES[4];
const HTML = '<h2 id="dispatch">Dispatch</h2>\n<p>Press <em>Dispatch</em>.</p>';

/** Every href/src the rendered document carries. */
function attrs(html: string): string[] {
  return [...html.matchAll(/(?:href|src)="([^"]*)"/g)].map((m) => m[1]);
}

describe("B15 · relativeHref", () => {
  it("stays inside the same folder", () => {
    expect(lib().relativeHref("guides/missions", "guides/chat")).toBe("chat.html");
  });

  it("climbs out of a folder to reach another", () => {
    expect(lib().relativeHref("guides/missions", "concepts/mission")).toBe(
      "../concepts/mission.html",
    );
  });

  it("reaches the index from a page, and a page from the index", () => {
    expect(lib().relativeHref("guides/missions", "index")).toBe("../index.html");
    expect(lib().relativeHref("index", "guides/missions")).toBe("guides/missions.html");
  });

  it("never produces a root-relative or absolute href", () => {
    for (const from of PAGES.map((p) => p.slug)) {
      for (const to of PAGES.map((p) => p.slug)) {
        const href = lib().relativeHref(from, to);
        expect(href.startsWith("/")).toBe(false);
        expect(href).not.toMatch(/^[a-z]+:/);
        expect(href.endsWith(".html")).toBe(true);
      }
    }
  });
});

describe("B15 · relativeAsset", () => {
  it("points a page at the copy of the image under site/images/", () => {
    expect(lib().relativeAsset("guides/missions", "docs/images/work-missions.png")).toBe(
      "../images/work-missions.png",
    );
    expect(lib().relativeAsset("index", "docs/images/dashboard.png")).toBe("images/dashboard.png");
  });
});

describe("B15 · renderPage opens from file://", () => {
  const manifest = () => lib().buildManifest(PAGES);
  const html = () => lib().renderPage(MISSIONS, HTML, manifest());

  it("is a complete HTML document", () => {
    const out = html();
    expect(out.trimStart().slice(0, 15).toLowerCase()).toBe("<!doctype html>");
    expect(out).toContain('<html lang="en"');
    expect(out).toContain("</html>");
    expect(out).toContain("<title>Missions");
  });

  it("carries no root-relative and no absolute-URL href or src", () => {
    // The one assertion this whole file exists for.
    const bad = attrs(html()).filter((a) => a.startsWith("/") || /^https?:\/\//.test(a));
    expect(bad).toEqual([]);
  });

  it("links every sidebar entry relatively, and reaches them all", () => {
    const out = html();
    for (const other of PAGES) {
      if (other.slug === MISSIONS.slug) continue;
      expect(out).toContain(`href="${lib().relativeHref(MISSIONS.slug, other.slug)}"`);
    }
  });

  it("carries prev/next from the manifest's reading order", () => {
    // guides/chat is the page before guides/missions in the reading order.
    expect(html()).toContain(`href="${lib().relativeHref(MISSIONS.slug, "guides/chat")}"`);
  });

  it("inlines its stylesheet instead of linking one", () => {
    const out = html();
    expect(out).toContain("<style>");
    expect(out).not.toMatch(/<link[^>]+rel="stylesheet"/);
  });

  it("loads the search index as a script, never by fetching JSON", () => {
    // fetch("search.json") is refused on a file:// origin, and refused silently.
    const out = html();
    const scripts = [...out.matchAll(/<script[^>]+src="([^"]*)"/g)].map((m) => m[1]);
    expect(scripts.some((s) => s.endsWith("search-index.js"))).toBe(true);
    for (const s of scripts) expect(s.startsWith("/")).toBe(false);
    expect(out).not.toContain("fetch(");
    expect(out).not.toContain("search.json");
  });

  it("renders the page's own body HTML", () => {
    expect(html()).toContain('<h2 id="dispatch">Dispatch</h2>');
  });
});

describe("B15 · renderFragment is the in-app half", () => {
  it("is a fragment, not a document: no html, head, style or script", () => {
    const fragment = lib().renderFragment(MISSIONS, HTML, lib().buildManifest(PAGES));
    expect(fragment).not.toMatch(/<!doctype/i);
    expect(fragment).not.toContain("<html");
    expect(fragment).not.toContain("<head");
    expect(fragment).not.toContain("<style");
    expect(fragment).not.toContain("<script");
    expect(fragment).toContain('<h2 id="dispatch">Dispatch</h2>');
  });

  it("is the body and nothing else: no title, no summary", () => {
    // The app renders a page's title and summary in its own PageHeader. A
    // fragment that carried them too printed both twice, one under the other,
    // and put a second h1 on a screen that already had one (T-0110, found by
    // the browser walk and invisible to a jsdom render).
    const fragment = lib().renderFragment(MISSIONS, HTML, lib().buildManifest(PAGES));
    expect(fragment).toBe(HTML);
    expect(fragment).not.toContain("<h1");
    expect(fragment).not.toContain(MISSIONS.data.summary);
  });

  it("carries no root-relative link either, so Help can rebase them", () => {
    const fragment = lib().renderFragment(MISSIONS, HTML, lib().buildManifest(PAGES));
    expect(attrs(fragment).filter((a) => a.startsWith("/"))).toEqual([]);
  });
});

describe("B15 · stripLeadingH1", () => {
  it("drops a body's own opening title, which the front matter already gave", () => {
    expect(lib().stripLeadingH1(`<h1 id="missions">Missions</h1>\n<p>Prose.</p>`)).toBe("<p>Prose.</p>");
  });

  it("leaves an h1 that is not the first thing, because that one is deliberate", () => {
    const html = `<p>Intro.</p>\n<h1>A second title</h1>`;
    expect(lib().stripLeadingH1(html)).toBe(html);
  });

  it("leaves a body that opens with anything else alone", () => {
    const html = `<h2 id="dispatch">Dispatch</h2>\n<p>Press it.</p>`;
    expect(lib().stripLeadingH1(html)).toBe(html);
  });
});
