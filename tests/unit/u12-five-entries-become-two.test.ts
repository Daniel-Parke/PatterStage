/** @jest-environment node */
/**
 * U12 (T-0126), decision 6: five Story Weaver entries become two.
 *
 * The hub, Library, Create, Characters and Themes were five routes for one
 * small app, and the hub's whole job was four buttons to the other four. The
 * library IS the hub now: it lives at the door, /recroom/story-weaver, where
 * the rail already points. Characters and Themes were lists Create already
 * read and wrote, so they are panels on Create, with anchors. Every retired
 * address answers 307 to where its content went - 307, never 308, for the
 * reason next.config.ts gives.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

import nextConfig from "../../next.config";
import { allModuleRoutes, documentedRoutes, labelFor, railOrder } from "@/lib/modules/registry";

const ROOT = join(__dirname, "..", "..");
const SW = "/recroom/story-weaver";
const RETIRED = [`${SW}/library`, `${SW}/characters`, `${SW}/themes`];

type Redirect = { source: string; destination: string; permanent: boolean };

async function redirects(): Promise<Redirect[]> {
  const fn = nextConfig.redirects;
  if (!fn) throw new Error("next.config.ts declares no redirects()");
  return (await fn()) as Redirect[];
}

function pageFile(...segments: string[]): string {
  return join(ROOT, "src", "app", "recroom", "story-weaver", ...segments, "page.tsx");
}

describe("the registry", () => {
  it("names two Story Weaver routes: the library at the door, and Create", () => {
    expect(allModuleRoutes().filter((r) => r.startsWith(SW))).toEqual([SW, `${SW}/create`]);
    expect(documentedRoutes().filter((r) => r.startsWith(SW))).toEqual([SW, `${SW}/create`]);
  });

  it("walks the rail through them in that order and through nothing else", () => {
    expect(railOrder().filter((r) => r.startsWith(SW))).toEqual([SW, `${SW}/create`]);
  });

  it("still names the two pages, and a retired path in flight titles itself Story Weaver", () => {
    expect(labelFor(SW)).toBe("Story Weaver");
    expect(labelFor(`${SW}/create`)).toBe("Create");
    for (const path of RETIRED) expect(labelFor(path)).toBe("Story Weaver");
  });
});

describe("the three retired addresses", () => {
  it.each([
    [`${SW}/library`, SW],
    [`${SW}/characters`, `${SW}/create#characters`],
    [`${SW}/themes`, `${SW}/create#themes`],
  ])("%s answers 307 to %s", async (source, destination) => {
    const hit = (await redirects()).find((r) => r.source === source);
    expect(hit).toEqual({ source, destination, permanent: false });
  });

  it("have no page of their own, and the two that remain do", () => {
    for (const seg of ["library", "characters", "themes"]) {
      expect({ seg, exists: existsSync(pageFile(seg)) }).toEqual({ seg, exists: false });
    }
    expect(existsSync(pageFile())).toBe(true);
    expect(existsSync(pageFile("create"))).toBe(true);
  });
});

function markdownFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) markdownFiles(full, out);
    else if (entry.endsWith(".md")) out.push(full);
  }
  return out;
}

describe("the guides follow the screens", () => {
  const guides = join(ROOT, "docs", "guides");

  it("no guide claims a retired screen", () => {
    for (const file of readdirSync(guides)) {
      const m = readFileSync(join(guides, file), "utf-8").match(/^screen:\s*(\S+)/m);
      if (m) expect({ file, screen: m[1], retired: RETIRED.includes(m[1]) }).toEqual({ file, screen: m[1], retired: false });
    }
  });

  it("the three retired guides and their screenshots are gone", () => {
    for (const g of ["story-library", "story-characters", "story-themes"]) {
      expect({ g, guide: existsSync(join(guides, `${g}.md`)) }).toEqual({ g, guide: false });
      expect({ g, shot: existsSync(join(ROOT, "docs", "images", `${g}.png`)) }).toEqual({ g, shot: false });
    }
  });

  it("and nothing under docs/ still links to one of them", () => {
    const stale = /story-(?:library|characters|themes)\.md/;
    for (const file of markdownFiles(join(ROOT, "docs"))) {
      const src = readFileSync(file, "utf-8");
      expect({ file, stale: stale.test(src) }).toEqual({ file, stale: false });
    }
  });

  it("the Create guide describes the two panels that arrived", () => {
    const src = readFileSync(join(guides, "story-create.md"), "utf-8");
    expect(src).toMatch(/Saved themes/);
    expect(src).toMatch(/Character library/);
  });
});
