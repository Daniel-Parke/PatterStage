/**
 * U15 · Nothing in src lives only for its test.
 *
 * knip is clean and has been for months, and the reconnaissance still found
 * three modules (424 lines) that no page, route, script or server reaches:
 * run-trajectory, llm-judge, session-window. Each is kept green by exactly one
 * test file, and knip counts a test file as an entrypoint, both through the
 * glob knip.json declares and, with that glob gone, through its Jest plugin,
 * which adds every test as an entry on its own. So knip cannot see this class
 * of dead code by design, and this gate asks the question knip cannot: from
 * the REAL entrypoints, the app's pages and routes and instrumentation, the
 * proxy, the scripts and the mock servers, which src modules are never
 * reached? The answer must be none.
 *
 * (The reconnaissance named a fourth, concept-attachments; scripts/docs/check
 * imports it, so it is tooling, like the retention chain, and stays.)
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const ROOT = join(__dirname, "..", "..");
const rel = (f: string) => relative(ROOT, f).replace(/\\/g, "/");

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const SOURCE = /\.(ts|tsx|mts|mjs|js|cjs)$/;

/** Next's file conventions under app/, plus the server's own entry files. */
const APP_ENTRY =
  /\/src\/app\/(?:.*\/)?(page|layout|route|error|global-error|not-found|loading|template|default|manifest|robots|sitemap|icon|apple-icon|opengraph-image|twitter-image)\.(ts|tsx)$/;

function entries(): string[] {
  const out = walk(join(ROOT, "src", "app")).filter((f) => APP_ENTRY.test(f.replace(/\\/g, "/")));
  for (const f of ["src/instrumentation.ts", "src/proxy.ts", "src/middleware.ts", "next.config.ts", "jest.setup.ts"]) {
    if (existsSync(join(ROOT, f))) out.push(join(ROOT, f));
  }
  out.push(...walk(join(ROOT, "scripts")).filter((f) => SOURCE.test(f)));
  for (const d of ["mock-hermes", "mock-hindsight", "mock-llm"]) {
    out.push(...walk(join(ROOT, d)).filter((f) => SOURCE.test(f)));
  }
  return out;
}

const IMPORT_RES = [
  /(?:import|export)\s[^'"`;]*?\sfrom\s*['"]([^'"]+)['"]/g,
  /import\s*['"]([^'"]+)['"]/g,
  /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /jest\.mock\s*\(\s*['"]([^'"]+)['"]/g,
];

function specifiers(file: string): string[] {
  const text = readFileSync(file, "utf8");
  const out = new Set<string>();
  for (const re of IMPORT_RES) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) out.add(m[1]);
  }
  return [...out];
}

const CANDIDATE_EXTS = ["", ".ts", ".tsx", ".mts", ".mjs", ".js", ".cjs", "/index.ts", "/index.tsx", "/index.mjs", "/index.js"];

function resolveSpecifier(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = join(ROOT, "src", spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(from), spec);
  else return null; // a package
  const stripped = base.replace(/\.(js|mjs)$/, "");
  for (const root of [base, stripped]) {
    for (const ext of CANDIDATE_EXTS) {
      const p = root + ext;
      if (existsSync(p) && statSync(p).isFile()) return p;
    }
  }
  return null;
}

function reachable(): Set<string> {
  const seen = new Set<string>();
  const queue = entries();
  while (queue.length) {
    const f = queue.pop() as string;
    const key = f.replace(/\\/g, "/");
    if (seen.has(key)) continue;
    seen.add(key);
    if (!SOURCE.test(f)) continue;
    for (const spec of specifiers(f)) {
      const target = resolveSpecifier(f, spec);
      if (target) queue.push(target);
    }
  }
  return seen;
}

describe("U15 · nothing in src lives only for its test", () => {
  it("every src module is reachable from a page, a route, the server or a script", () => {
    const seen = reachable();
    const all = walk(join(ROOT, "src"))
      .filter((f) => /\.(ts|tsx)$/.test(f) && !/\.d\.ts$/.test(f) && !/\.test\.tsx?$/.test(f))
      .map((f) => f.replace(/\\/g, "/"));
    const unreachable = all.filter((f) => !seen.has(f)).map((f) => rel(f)).sort();
    expect(unreachable).toEqual([]);
  });

  it("knip's own entry list no longer names the tests, which its plugin adds anyway", () => {
    const knip = JSON.parse(readFileSync(join(ROOT, "knip.json"), "utf8")) as { entry: string[] };
    expect(knip.entry.some((e) => e.startsWith("tests/**"))).toBe(false);
  });
});
