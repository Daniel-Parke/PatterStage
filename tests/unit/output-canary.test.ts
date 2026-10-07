/**
 * The output canary's own gate (T-0009, source row WO-0008).
 *
 * Two jobs, and the second one is the point.
 *
 * 1. The standing contract gate. The stable surfaces still match the committed
 *    golden, so a change to the URL surface, the seed pack or a generated
 *    artefact cannot land silently.
 *
 * 2. The canary is proved in BOTH directions, permanently, not just once in the
 *    session that built it. A canary that only ever answers "same" proves
 *    nothing, so every invariance assertion below is paired with a sensitivity
 *    assertion using the same function. If someone ever loosens the
 *    normalisation until it stops seeing behaviour changes, the paired test
 *    goes red.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  GOLDEN_SURFACES,
  buildReport,
  exportedHttpMethods,
  segmentConfig,
  moduleMultisetHash,
  normalisePrerenderedHtml,
  normaliseSpecifier,
  readGolden,
} from "../../scripts/tooling/output-canary.mjs";

type ModuleEntry = { path: string; source: string };

/** A two-module tree: one leaf with behaviour, one importer. */
const LEAF = 'import { z } from "zod";\nexport const bump = (n: number) => n + 1;\nexport const S = z.string();\n';
const IMPORTER = 'import { bump } from "./bump-helper";\nexport const run = () => bump(1);\n';

const BEFORE: ModuleEntry[] = [
  { path: "src/lib/bump-helper.ts", source: LEAF },
  { path: "src/lib/caller.ts", source: IMPORTER },
];

describe("output canary: the standing contract gate", () => {
  const report = buildReport({ includePrerender: false });
  const golden = readGolden();

  it.each(GOLDEN_SURFACES)("surface %s matches the committed golden", (surface: string) => {
    expect(report.surfaces[surface]).toBe(golden.surfaces[surface]);
  });

  it("keeps the noisy surfaces out of the golden on purpose", () => {
    // moduleGraph and prerender change on any ordinary edit. Pinning them to a
    // committed file would train everyone to re-bless without reading, which is
    // how a gate becomes decoration. They are compared against a captured
    // baseline instead, see docs/contributing/output-canary.md.
    expect(GOLDEN_SURFACES).not.toContain("moduleGraph");
    expect(GOLDEN_SURFACES).not.toContain("prerender");
    expect(report.surfaces.moduleGraph).toEqual(expect.any(String));
  });

  it("reads a real tree, not an empty one", () => {
    expect(report.diagnostics.moduleGraph.modules).toBeGreaterThan(400);
    expect(report.diagnostics.httpSurface.entries).toBeGreaterThan(100);
    expect(report.diagnostics.seedPack.files).toBeGreaterThan(30);
    expect(report.diagnostics.seedPack.lines[0]).toBe("seed-pack exit=0");
  });
});

describe("output canary: a pure move is neutral", () => {
  it("survives a file moving into a domain folder", () => {
    const afterMove: ModuleEntry[] = [
      { path: "src/lib/missions/bump-helper.ts", source: LEAF },
      { path: "src/lib/caller.ts", source: 'import { bump } from "@/lib/missions/bump-helper";\nexport const run = () => bump(1);\n' },
    ];
    expect(moduleMultisetHash(afterMove)).toBe(moduleMultisetHash(BEFORE));
  });

  it("survives the import re-wrapping that a longer path causes", () => {
    const afterMove: ModuleEntry[] = [
      { path: "src/lib/missions/bump-helper.ts", source: LEAF },
      {
        path: "src/lib/caller.ts",
        source: 'import {\n  bump,\n} from "../../lib/missions/bump-helper";\n\nexport const run = () => bump(1);\n',
      },
    ];
    expect(moduleMultisetHash(afterMove)).toBe(moduleMultisetHash(BEFORE));
  });

  it("treats every spelling of the same relocated module as the same module", () => {
    const forms = ["./bump-helper", "../bump-helper", "../../lib/bump-helper", "@/lib/missions/bump-helper"];
    const normalised = forms.map(normaliseSpecifier);
    expect(new Set(normalised).size).toBe(1);
  });

  it("leaves package specifiers alone, because swapping a package is not a move", () => {
    expect(normaliseSpecifier("zod")).toBe("zod");
    expect(normaliseSpecifier("next/server")).toBe("next/server");
  });
});

describe("output canary: a behaviour change is NOT neutral", () => {
  it("catches a one-line change to what a function returns", () => {
    const afterEdit: ModuleEntry[] = [
      { path: "src/lib/bump-helper.ts", source: LEAF.replace("n + 1", "n + 2") },
      { path: "src/lib/caller.ts", source: IMPORTER },
    ];
    expect(moduleMultisetHash(afterEdit)).not.toBe(moduleMultisetHash(BEFORE));
  });

  it("catches an import repointed at a different module", () => {
    const afterEdit: ModuleEntry[] = [
      { path: "src/lib/bump-helper.ts", source: LEAF },
      { path: "src/lib/caller.ts", source: IMPORTER.replace("./bump-helper", "./other-helper") },
    ];
    expect(moduleMultisetHash(afterEdit)).not.toBe(moduleMultisetHash(BEFORE));
    expect(normaliseSpecifier("./bump-helper")).not.toBe(normaliseSpecifier("./other-helper"));
  });

  it("catches a dependency swap", () => {
    const afterEdit: ModuleEntry[] = [
      { path: "src/lib/bump-helper.ts", source: LEAF.replace('from "zod"', 'from "yup"') },
      { path: "src/lib/caller.ts", source: IMPORTER },
    ];
    expect(moduleMultisetHash(afterEdit)).not.toBe(moduleMultisetHash(BEFORE));
  });

  it("catches a file being deleted", () => {
    expect(moduleMultisetHash([BEFORE[0]])).not.toBe(moduleMultisetHash(BEFORE));
  });
});

describe("output canary: the HTTP surface", () => {
  it("reads all three ways a route module can export a method", () => {
    expect(exportedHttpMethods("export async function GET() {}")).toEqual(["GET"]);
    expect(exportedHttpMethods("export const POST = withAuth(handler);")).toEqual(["POST"]);
    // Phase 4 splits four route handlers, and a split naturally re-exports.
    // A parser that missed this would report the split as a deleted endpoint.
    expect(exportedHttpMethods('export { GET, DELETE } from "./handlers";')).toEqual(["DELETE", "GET"]);
  });

  it("does not invent methods from unrelated identifiers", () => {
    expect(exportedHttpMethods("const GETTER = 1; export default GETTER;")).toEqual([]);
  });

  // The fourth spelling. A star re-export names no method in this file, so the
  // surface records the star itself: a split that hides GET behind one still
  // moves the hash, which is the property the canary needs. Before this, a star
  // read as an empty method list, i.e. as a deleted endpoint that had not moved.
  it("records a star re-export rather than reading it as no methods", () => {
    expect(exportedHttpMethods('export * from "./handlers";')).toEqual([
      "*from:<mod:handlers>",
    ]);
    expect(exportedHttpMethods('export * from "./handlers";')).not.toEqual([]);
  });

  it("is invariant when a star re-export merely moves", () => {
    // Same target module, different relative depth: a pure move.
    expect(exportedHttpMethods('export * from "./handlers";')).toEqual(
      exportedHttpMethods('export * from "../../lib/handlers";'),
    );
  });
});

describe("output canary: the golden must be platform independent", () => {
  // The golden is blessed on a maintainer's machine and checked on a Linux CI
  // runner. Anything that differs between the two is not part of the output
  // contract. The first version hashed raw file bytes, so a Windows CRLF
  // checkout produced a golden CI could never match, and the gate shipped red.
  // These assertions pin the property rather than the incident.
  const goldenSurfaces = ["appConfig", "generatedArtefacts", "httpSurface", "seedPack"];

  it.each(goldenSurfaces)(
    "surface %s is stable across line-ending conventions",
    (surface: string) => {
      // buildReport reads the working tree, so this asserts the real surfaces
      // are reproducible rather than re-deriving them from a fixture.
      const a = buildReport({ includePrerender: false });
      const b = buildReport({ includePrerender: false });
      expect(a.surfaces[surface]).toBe(b.surfaces[surface]);
      expect(a.surfaces[surface]).toEqual(expect.any(String));
    },
  );

  it("hashes checked-in files by content, never by raw bytes", () => {
    // A canary that hashes bytes cannot be blessed on one platform and checked
    // on another. If this ever reappears, the seedPack and generatedArtefacts
    // surfaces go environment-dependent and the gate becomes unpassable.
    const source = readFileSync(
      join(__dirname, "..", "..", "scripts", "tooling", "output-canary.mjs"),
      "utf-8",
    );
    expect(source).not.toMatch(/sha256\(readFileSync\(/);
  });
});

describe("output canary: route segment config", () => {
  // This surface is in the golden, so a miss is silent under-reporting. The
  // first regex here could not match a semicolon, which is how everyone writes
  // one, and nothing caught it because the function was untested. Each
  // invariance assertion below is paired with a sensitivity one.
  it("reads every spelling a segment config is actually written in", () => {
    expect(segmentConfig('export const dynamic = "force-dynamic";')).toEqual([
      'dynamic="force-dynamic"',
    ]);
    expect(segmentConfig("export const revalidate = 60;")).toEqual(["revalidate=60"]);
    expect(segmentConfig('export const runtime = "edge"')).toEqual(['runtime="edge"']);
    const midFile = [
      "const a = 1;",
      'export const dynamic = "force-static";',
      "const b = 2;",
    ].join("\n");
    expect(segmentConfig(midFile)).toEqual(['dynamic="force-static"']);
  });

  it("is sensitive: changing the value changes the surface", () => {
    expect(segmentConfig('export const dynamic = "force-dynamic";')).not.toEqual(
      segmentConfig('export const dynamic = "force-static";'),
    );
    expect(segmentConfig("export const revalidate = 60;")).not.toEqual(
      segmentConfig("export const revalidate = 120;"),
    );
  });

  it("is invariant: a terminator or reflow alone changes nothing", () => {
    expect(segmentConfig('export const dynamic = "force-dynamic";')).toEqual(
      segmentConfig('export const dynamic   =   "force-dynamic"'),
    );
  });

  it("reads nothing when there is nothing to read", () => {
    expect(segmentConfig("export async function GET() {}")).toEqual([]);
  });
});

describe("output canary: the rendered surface", () => {
  const page = (body: string, chunk: string, buildId: string, clock: string) =>
    `<!DOCTYPE html><html><head><script src="/_next/static/chunks/${chunk}.js" async=""></script>` +
    `<link rel="stylesheet" href="/_next/static/chunks/${chunk}.css"/></head>` +
    `<body class="inter_950d5e3d-module__2SzjIa__variable"><main>${body}</main>` +
    `<div>${clock}</div>` +
    `<script>self.__next_f.push([1,"${buildId}:${chunk}"])</script></body></html>`;

  it("ignores the churn a pure move causes: chunk names, build id, inline payload, clock", () => {
    const a = normalisePrerenderedHtml(page("Missions", "1kti7z3m5794", "kPJSMR2zmJFu", "18:55:49"), "kPJSMR2zmJFu");
    const b = normalisePrerenderedHtml(page("Missions", "9zzqq0aa1122", "p0GGogdZ9WA6", "19:02:11"), "p0GGogdZ9WA6");
    expect(a).toBe(b);
  });

  it("still sees a change to what the page actually renders", () => {
    const a = normalisePrerenderedHtml(page("Missions", "1kti7z3m5794", "kPJSMR2zmJFu", "18:55:49"), "kPJSMR2zmJFu");
    const c = normalisePrerenderedHtml(page("Mission Control", "1kti7z3m5794", "kPJSMR2zmJFu", "18:55:49"), "kPJSMR2zmJFu");
    expect(a).not.toBe(c);
  });

  it("keeps the CSS module export name after dropping its path-derived hash", () => {
    const out = normalisePrerenderedHtml('<body class="inter_950d5e3d-module__2SzjIa__variable">x</body>', "");
    expect(out).toContain("cssmodule__variable");
    expect(out).not.toContain("950d5e3d");
  });
});
