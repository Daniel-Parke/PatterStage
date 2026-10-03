/* eslint-disable @typescript-eslint/no-require-imports -- scripts/docs/lib.mjs is loaded by a COMPUTED path, deliberately: a static import of it from a test would be a typecheck error while the module was still unwritten, and typecheck:tests runs inside npm run lint */
/**
 * B15 (T-0109), decision 3 — the generated-block extractor.
 *
 * Nine facts in the documentation are already written down somewhere a machine
 * can read: the achievements, the analytics event types, the lint steps, the
 * config sections, the seed manifests, the API route list, the schema head, the
 * quest definitions and the env table in `.env.example`. Every one of them has
 * drifted in prose at least once — `docs/API.md` asserted an invariant that three
 * routes broke, and four audits found stale claims of exactly this shape. B15
 * fences them between markers and regenerates them, and `docs:check` refuses a
 * page whose fence no longer holds what the extractor produces.
 *
 * The marker functions are pure and live in `scripts/docs/lib.mjs`; the reading
 * of the app's own sources lives in `scripts/docs/extract.ts`, which the lint
 * gate runs through `npx tsx`. That split is load-bearing and is asserted below:
 * `extract.ts` must import nothing but node builtins (and its own pure sibling)
 * at module scope, so that regenerating a markdown fence never boots the
 * database.
 *
 * Red today because neither file exists.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const LIB_PATH = join(ROOT, "scripts", "docs", "lib.mjs");
const EXTRACT_PATH = join(ROOT, "scripts", "docs", "extract.ts");

interface GeneratedBlock {
  id: string;
  body: string;
  start: number;
  end: number;
  closed: boolean;
}

interface DocsLib {
  GENERATED_BLOCK_IDS: readonly string[];
  findGeneratedBlocks(markdown: string): GeneratedBlock[];
  replaceGeneratedBlock(markdown: string, id: string, body: string): string;
}

let cached: DocsLib | undefined;

function lib(): DocsLib {
  if (!existsSync(LIB_PATH)) {
    throw new Error(
      "B15 contract: scripts/docs/lib.mjs does not exist. findGeneratedBlocks / " +
        "replaceGeneratedBlock live there so that build-site.mjs, check.mts, extract.ts " +
        "and this oracle share one definition of the marker syntax.",
    );
  }
  if (!cached) cached = require(LIB_PATH) as DocsLib;
  return cached;
}

const DOC = [
  "# API",
  "",
  "Intro prose.",
  "",
  "<!-- generated:api-routes -->",
  "| `/api/health` |",
  "| `/api/status` |",
  "<!-- /generated:api-routes -->",
  "",
  "Outro prose.",
  "",
  "<!-- generated:env-table -->",
  "| PS_PORT | 3000 |",
  "<!-- /generated:env-table -->",
  "",
].join("\n");

describe("B15 · the nine generated blocks", () => {
  it("names exactly the nine facts the plan fences", () => {
    expect([...lib().GENERATED_BLOCK_IDS].sort()).toEqual([
      "achievements",
      "api-routes",
      "config-sections",
      "env-table",
      "event-types",
      "lint-steps",
      // Renamed from "quest-defs" when B17 landed the block it fences: its
      // own oracle names the marker `<!-- generated:quests -->`, and one
      // marker name is better than a page and a generator disagreeing.
      "quests",
      "schema-head",
      "seed-manifests",
    ]);
  });
});

describe("B15 · findGeneratedBlocks", () => {
  it("finds every fenced block, in document order", () => {
    expect(lib().findGeneratedBlocks(DOC).map((b) => b.id)).toEqual(["api-routes", "env-table"]);
  });

  it("returns the body between the markers, without the marker lines", () => {
    const [api] = lib().findGeneratedBlocks(DOC);
    expect(api.body).toBe("| `/api/health` |\n| `/api/status` |");
    expect(api.body).not.toContain("generated:");
  });

  it("returns offsets that slice the whole fence back out of the source", () => {
    const [api] = lib().findGeneratedBlocks(DOC);
    const slice = DOC.slice(api.start, api.end);
    expect(slice.startsWith("<!-- generated:api-routes -->")).toBe(true);
    expect(slice.endsWith("<!-- /generated:api-routes -->")).toBe(true);
    expect(api.closed).toBe(true);
  });

  it("finds nothing in a page with no fences", () => {
    expect(lib().findGeneratedBlocks("# Chat\n\nJust prose.\n")).toEqual([]);
  });

  it("reports an unclosed opening marker rather than skipping it silently", () => {
    // Skipping it would let a half-deleted fence read as "this page has no
    // generated content", which is the exact failure the gate exists to catch.
    const blocks = lib().findGeneratedBlocks("<!-- generated:api-routes -->\n| x |\n");
    expect(blocks.map((b) => b.id)).toEqual(["api-routes"]);
    expect(blocks[0].closed).toBe(false);
  });

  it("does not pair an opening marker with a different block's closing marker", () => {
    const crossed = "<!-- generated:api-routes -->\nx\n<!-- /generated:env-table -->\n";
    const blocks = lib().findGeneratedBlocks(crossed);
    expect(blocks.map((b) => b.id)).toEqual(["api-routes"]);
    expect(blocks[0].closed).toBe(false);
  });
});

describe("B15 · replaceGeneratedBlock", () => {
  it("swaps one block's body and leaves the prose alone", () => {
    const next = lib().replaceGeneratedBlock(DOC, "api-routes", "| `/api/new` |");
    expect(next).toContain("Intro prose.");
    expect(next).toContain("Outro prose.");
    expect(next).toContain("| PS_PORT | 3000 |");
    expect(lib().findGeneratedBlocks(next)[0].body).toBe("| `/api/new` |");
  });

  it("keeps the markers, so the fence can be regenerated again", () => {
    const next = lib().replaceGeneratedBlock(DOC, "api-routes", "| `/api/new` |");
    expect(next).toContain("<!-- generated:api-routes -->");
    expect(next).toContain("<!-- /generated:api-routes -->");
  });

  it("is idempotent: writing the body it already holds changes nothing", () => {
    // `docs:generate` runs on every docs build; a non-idempotent writer would put
    // a diff in front of every commit and train everyone to ignore it.
    const body = lib().findGeneratedBlocks(DOC)[0].body;
    expect(lib().replaceGeneratedBlock(DOC, "api-routes", body)).toBe(DOC);
  });

  it("leaves a document that has no such block untouched", () => {
    const plain = "# Chat\n\nJust prose.\n";
    expect(lib().replaceGeneratedBlock(plain, "api-routes", "anything")).toBe(plain);
  });
});

describe("B15 · scripts/docs/extract.ts stays cheap to load", () => {
  it("exists", () => {
    expect(existsSync(EXTRACT_PATH)).toBe(true);
  });

  it("imports nothing but node builtins at module scope", () => {
    // Everything it reads from the app — achievements, event types, quest defs,
    // config sections, the seed manifests, the schema head — is imported LAZILY
    // inside generateBlock(). Otherwise `npm run lint` boots better-sqlite3 and
    // the whole analytics tree to regenerate a markdown table.
    if (!existsSync(EXTRACT_PATH)) {
      throw new Error(
        "B15 contract: scripts/docs/extract.ts does not exist. It is the CLI behind " +
          "`npm run docs:generate` and exports generateBlock(id) for each of the nine fences.",
      );
    }
    const source = readFileSync(EXTRACT_PATH, "utf-8");
    const specifiers = [...source.matchAll(/^\s*import\s[^;]*?from\s+["']([^"']+)["']/gm)].map(
      (m) => m[1],
    );
    // Its own pure sibling is allowed: replaceGeneratedBlock has one home.
    const nonBuiltin = specifiers.filter(
      (s) => !s.startsWith("node:") && !/^\.\.?\/lib\.mjs$/.test(s),
    );
    expect(nonBuiltin).toEqual([]);
  });
});
