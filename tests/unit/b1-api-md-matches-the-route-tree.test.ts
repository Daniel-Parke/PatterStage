/**
 * B1 (T-0095), D129: docs/reference/api.md says "Every route.ts under src/app/api has a
 * row ... A route absent from all four does not exist", and three routes were
 * absent: GET /api/status/subsystems, DELETE /api/credentials/[id] (the same
 * table still said "No per-id route"), and POST /api/composer/runs/[id]/cancel.
 * An invariant nothing enforces is a sentence. This enforces it, both ways.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = join(__dirname, "..", "..");
const API_ROOT = join(ROOT, "src", "app", "api");
const API_MD = readFileSync(join(ROOT, "docs", "reference", "api.md"), "utf-8");

function routePaths(dir = API_ROOT, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) routePaths(full, out);
    else if (entry === "route.ts") {
      out.push("/api/" + relative(API_ROOT, dir).split(sep).join("/"));
    }
  }
  return out.sort();
}

/** The first cell of every inventory row: | `/api/...` | */
function documentedPaths(): string[] {
  return [...API_MD.matchAll(/^\| `(\/api\/[^`]+)` \|/gm)].map((m) => m[1]).sort();
}

describe("docs/reference/api.md and src/app/api agree", () => {
  const tree = routePaths();
  const documented = documentedPaths();

  it("finds a route tree and an inventory, so an empty walk cannot read as a pass", () => {
    expect(tree.length).toBeGreaterThan(50);
    expect(documented.length).toBeGreaterThan(50);
  });

  it("every route in the tree has a row", () => {
    const missing = tree.filter((p) => !documented.includes(p));
    expect(missing).toEqual([]);
  });

  it("every row names a route that exists", () => {
    const stale = documented.filter((p) => !tree.includes(p));
    expect(stale).toEqual([]);
  });

  it("the credentials row no longer denies its own per-id route", () => {
    expect(API_MD).not.toMatch(/No per-id route\./);
  });
});
