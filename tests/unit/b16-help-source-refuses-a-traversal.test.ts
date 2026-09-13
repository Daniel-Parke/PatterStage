/** @jest-environment node */

// ═══════════════════════════════════════════════════════════════
// B16 sweep answer: the loader that turns a slug into bytes off disk.
//
// The render oracle points PS_HELP_DIR at a real corpus and asks what the page
// shows, which is the right question for a page and the wrong one for a guard.
// It left four mutants alive, and every one of them is a way out of the
// fragments directory or a way to take the render down:
//
//   1. the slug guard removed, so a path is BUILT from "../../etc/passwd"
//      before anything judges it;
//   2. the resolved-path check removed, so a slug the regex somehow let through
//      is served from wherever it lands;
//   3. the JSON reader's catch removed, so a half-written file mid-build throws
//      into a server render instead of reading as "no corpus yet";
//   4. the page's own guard removed, so an unsafe slug reaches the loader at
//      all.
//
// A real directory, real files, and a slug that genuinely climbs out of it.
// ═══════════════════════════════════════════════════════════════

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  helpIsBuilt,
  helpRoot,
  loadHelpConcepts,
  loadHelpFragment,
  loadHelpManifest,
  loadHelpSearchIndex,
  resetHelpCache,
} from "@/lib/help/help-source";

let root: string;
let outside: string;

const MANIFEST = {
  generatedAt: "2026-09-06T00:00:00.000Z",
  pages: [{ slug: "guides/missions", title: "Missions", summary: "s", section: "guides", nav: 1 }],
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "ps-help-"));
  outside = mkdtempSync(join(tmpdir(), "ps-secret-"));
  writeFileSync(join(outside, "passwd.html"), "<p>the thing outside</p>");

  mkdirSync(join(root, "fragments", "guides"), { recursive: true });
  writeFileSync(join(root, "manifest.json"), JSON.stringify(MANIFEST));
  writeFileSync(join(root, "fragments", "guides", "missions.html"), "<p>the guide</p>");

  process.env.PS_HELP_DIR = root;
  resetHelpCache();
});

afterEach(() => {
  delete process.env.PS_HELP_DIR;
  resetHelpCache();
  rmSync(root, { recursive: true, force: true });
  rmSync(outside, { recursive: true, force: true });
});

describe("loadHelpFragment", () => {
  it("GREEN CONTROL: reads the fragment a real slug names", () => {
    expect(loadHelpFragment("guides/missions")).toBe("<p>the guide</p>");
  });

  it("refuses a slug that climbs out of the fragments directory", () => {
    // The file genuinely exists at the other end of this path, so a loader that
    // only checked existence would serve it.
    const climb = `../../../${outside.replace(/\\/g, "/").split("/").filter(Boolean).join("/")}/passwd`;
    expect(loadHelpFragment(climb)).toBeNull();
  });

  it("refuses the shapes a traversal is written in", () => {
    for (const slug of ["..", "guides/..", "../fragments/guides/missions", "/guides/missions", "guides\\missions"]) {
      expect({ slug, html: loadHelpFragment(slug) }).toEqual({ slug, html: null });
    }
  });

  it("refuses a slug naming a file rather than a page", () => {
    // The bytes are there under fragments/, and the extension is what stops it:
    // a slug is a page's address, not a filename.
    expect(loadHelpFragment("guides/missions.html")).toBeNull();
  });

  it("answers null for a page the manifest names and the corpus does not hold", () => {
    expect(loadHelpFragment("guides/nothing-here")).toBeNull();
  });
});

describe("the loaders survive a corpus that is absent or half-written", () => {
  it("reads an unreadable manifest as no corpus, rather than throwing", () => {
    writeFileSync(join(root, "manifest.json"), "{ this is not json");
    resetHelpCache();
    // Mid-build is exactly this state, and it reaches a SERVER RENDER: a throw
    // here is a 500 on the Help page rather than the panel that says how to
    // build it.
    expect(() => loadHelpManifest()).not.toThrow();
    expect(loadHelpManifest().pages).toEqual([]);
    expect(helpIsBuilt()).toBe(false);
  });

  it("reads a missing directory as no corpus", () => {
    process.env.PS_HELP_DIR = join(root, "not-here");
    resetHelpCache();
    expect(loadHelpManifest().pages).toEqual([]);
    expect(loadHelpConcepts()).toEqual({});
    expect(loadHelpSearchIndex()).toEqual([]);
    expect(loadHelpFragment("guides/missions")).toBeNull();
  });

  it("GREEN CONTROL: a whole corpus is built", () => {
    expect(helpIsBuilt()).toBe(true);
    expect(loadHelpManifest().pages).toHaveLength(1);
  });
});

describe("helpRoot", () => {
  it("says where it looked, so 'no corpus' can name a path", () => {
    expect(helpRoot()).toBe(root);
  });

  it("falls back to public/help under the working directory", () => {
    delete process.env.PS_HELP_DIR;
    resetHelpCache();
    expect(helpRoot()).toBe(join(process.cwd(), "public", "help"));
  });

  it("re-reads the override between calls, so a test can move the corpus", () => {
    // Read at call time rather than at module load. The override exists so the
    // isolated instance and these cases can point at a built corpus with no
    // public/ in the checkout, and a module-load read would freeze the first
    // value a process ever saw.
    process.env.PS_HELP_DIR = outside;
    expect(helpRoot()).toBe(outside);
  });
});
