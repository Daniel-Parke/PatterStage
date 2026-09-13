/**
 * @jest-environment node
 *
 * K1 · The three things that kept CI red, each held by a check that runs on
 * this machine.
 *
 * `dev` failed on all 61 pushes from 2026-09-05 to 2026-09-11 while about fifty
 * task records reported a green local gate. Two of the three causes could not be
 * seen from Windows at all, which is the point of this file: each one becomes a
 * check that fails here, on a case-insensitive filesystem, on Node 24, without
 * Docker.
 *
 *   1. Six doc links that resolve only where the filesystem ignores case.
 *      Ubuntu stops the lint chain at step 2 on these, so lint steps 3 to 12
 *      have not run on Linux since. check-doc-links uses existsSync, which is
 *      case-blind on Windows and macOS; this reads the directory instead.
 *   2. extract.ts's lazily imported app modules. tsx compiles that file into a
 *      data: URL, where a relative specifier has no base to resolve against, so
 *      docs:check dies on CI and passes here. The imports must stay lazy, which
 *      the file's header and b15 require, so the specifier has to be absolute.
 *   3. A runtime smoke that drives a route nobody deleted it with. T-0129
 *      removed POST /api/missions/[id]/dispatch as an orphan with "zero
 *      callers"; this smoke was the caller the walk did not count.
 *   4. The census report, truncated at the pipe buffer. Found by the same CI run
 *      once the first three were fixed and macOS finally reached its jest step:
 *      three census suites failed at "position 8192" there and nowhere else.
 *      This one cannot go red on Windows, and says so where it sits.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";

const ROOT = join(__dirname, "..", "..");
const DOCS = join(ROOT, "docs");

/** Every markdown file under docs/, repo-relative and forward-slashed. */
function docFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) docFiles(full, out);
    else if (entry.name.endsWith(".md")) out.push(full);
  }
  return out;
}

/**
 * True when every segment of the path exists with exactly the spelling given.
 * existsSync answers "yes" on Windows for DEPLOY.md when the file is deploy.md;
 * a Linux runner answers "no", and that difference is the whole defect.
 */
function existsWithExactCase(absolute: string): boolean {
  if (!existsSync(absolute)) return false;
  const parent = dirname(absolute);
  const name = absolute.slice(parent.length + 1);
  try {
    return readdirSync(parent).includes(name);
  } catch {
    return false;
  }
}

describe("K1 · every documentation link resolves on a case-sensitive filesystem", () => {
  it("names each target with the spelling the file actually has", () => {
    const broken: string[] = [];
    for (const file of docFiles(DOCS)) {
      const source = readFileSync(file, "utf-8");
      for (const match of source.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
        const target = match[1].split("#")[0].trim();
        if (!target || /^(https?:|mailto:|#)/.test(target)) continue;
        const absolute = resolve(dirname(file), target);
        if (!existsWithExactCase(absolute)) {
          broken.push(`${file.slice(ROOT.length + 1).split(sep).join("/")} -> ${match[1]}`);
        }
      }
    }
    expect(broken).toEqual([]);
  });
});

describe("K1 · docs:check resolves its lazy imports wherever tsx puts the module", () => {
  it("imports the app's modules by absolute specifier, and still lazily", () => {
    const source = readFileSync(join(ROOT, "scripts", "docs", "extract.ts"), "utf-8");

    // Lazy is the property b15 and the file's own header protect: a module-scope
    // import would boot better-sqlite3 to render a markdown table.
    const moduleScope = [...source.matchAll(/^\s*import\s[^;]*?from\s+["']([^"']+)["']/gm)].map((m) => m[1]);
    expect(moduleScope.filter((s) => s.includes("src/"))).toEqual([]);

    // A relative specifier inside a dynamic import cannot resolve from a data:
    // URL, which is what CI's tsx produces.
    const relativeDynamic = [...source.matchAll(/await import\(\s*["'](\.[^"']+)["']/g)].map((m) => m[1]);
    expect(relativeDynamic).toEqual([]);
  });
});

describe("K1 · the runtime smokes drive routes this tree has", () => {
  it("calls no API path that no route file serves", () => {
    const runtimeDir = join(ROOT, "tests", "integration", "runtime");
    const missing: string[] = [];

    for (const entry of readdirSync(runtimeDir)) {
      if (!entry.endsWith(".mjs")) continue;
      const source = readFileSync(join(runtimeDir, entry), "utf-8");
      for (const match of source.matchAll(/\$\{CH\}\/api\/([A-Za-z0-9\-/_$.{}]+)/g)) {
        // Drop template holes and any query string: /api/missions/${id}/cancel
        // is the route /api/missions/[id]/cancel.
        const segments = match[1]
          .split("?")[0]
          .split("/")
          .filter(Boolean)
          .map((s) => (s.includes("${") ? "[id]" : s));
        if (!segments.length) continue;

        const direct = join(ROOT, "src", "app", "api", ...segments, "route.ts");
        const dynamic = join(ROOT, "src", "app", "api", ...segments.slice(0, -1), "[id]", "route.ts");
        if (existsSync(direct) || (segments.length > 1 && existsSync(dynamic))) continue;
        missing.push(`${entry}: /api/${segments.join("/")}`);
      }
    }

    expect([...new Set(missing)]).toEqual([]);
  });
});

describe("K1 · the census report survives the pipe it is read through", () => {
  it("arrives whole, though it is larger than the smallest pipe buffer", () => {
    // Three census suites failed on the macOS runner with "Unterminated string
    // in JSON at position 8192" and nowhere else: the report is about 15 KB,
    // console.log buffers, and process.exit() cut it at the pipe buffer, which
    // is 8 KB on macOS and 64 KB on Linux.
    //
    // This check cannot go red on Windows, where the write is synchronous
    // whatever the code does. It is here because the runner is where it bites,
    // and because the next person to add a --report is owed the reason.
    const out = execFileSync(process.execPath, [join(ROOT, "scripts", "tooling", "line-census.mjs"), "--report"], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    expect(out.length).toBeGreaterThan(8192);
    expect(() => JSON.parse(out)).not.toThrow();
  });
});

describe("K1 · the notice only a machine without an agent ever draws", () => {
  it("gives its link the 24px floor gate 8 measures", () => {
    // AgentSetupNotice renders only when no agent is installed, so it appears on
    // every CI runner and on no developer box with Hermes. Its link came out
    // 128x21 on Linux and failed hit-targets on /agent/profiles,
    // /results/sessions and /work/missions, while the local full e2e passed
    // because the component returned null here.
    //
    // A class check, not a measurement: only a browser can measure, and the e2e
    // gate that does is in the PR run. This is the part that can be held here.
    const source = readFileSync(join(ROOT, "src", "components", "agents", "AgentSetupNotice.tsx"), "utf-8");
    const link = source.slice(source.indexOf("<a"));
    expect(link).toMatch(/className="[^"]*min-h-6/);
  });
});
