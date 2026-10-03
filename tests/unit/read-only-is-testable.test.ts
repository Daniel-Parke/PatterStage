/** @jest-environment node */
/**
 * T-0049 acceptance oracle — the ratchets that stop T-0048 recurring.
 *
 * T-0048 removed a read-only guard from 34 read handlers. The interesting
 * question is not how it got there; it is how it survived 33 files while a
 * 3,000-test suite went green the whole time.
 *
 * Two mechanisms, and this file closes both.
 *
 * 1. READ-ONLY DID NOT EXIST IN THE SUITE. `tests/helpers/api-test-helpers.ts`
 *    mocked `@/lib/api/api-auth` wholesale with `isReadOnly: jest.fn(() => false)`,
 *    and forty test files repeat the pattern inline. Every test that touched a
 *    route ran with the mode hard-wired off, so no test could observe the bug
 *    even in principle. `tests/unit/missions-read-only-reads.test.ts:67` is the
 *    one file that opts out, and it says why: "the whole point is the real
 *    read-only guard reading the real environment variable."
 *
 * 2. THE MOCKS LIE ABOUT THE MODULE'S SHAPE. A jest factory may return any
 *    object; nothing checks it against the real exports. `requireMcApiKey` and
 *    `requireChApiKey` have not existed for a long time and are still mocked,
 *    and after T-0048 thirty files mock `requireAuth`, which is now equally
 *    fictional. A phantom entry is worse than dead weight: it is how a function
 *    can be deleted from `src/` while the suite carries on demonstrating that it
 *    works.
 *
 * The behavioural half of the contract lives in read-only-actually-reads.test.ts.
 * This file guards the conditions that made that contract untestable.
 */

import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

import * as apiAuth from "@/lib/api/api-auth";

const TESTS_ROOT = join(__dirname, "..");
const HELPERS = join(TESTS_ROOT, "helpers", "api-test-helpers.ts");

function testFiles(dir = TESTS_ROOT, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) testFiles(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

const rel = (f: string) => f.replace(/\\/g, "/").split("/tests/")[1];

/**
 * The property names a `jest.mock("@/lib/api/api-auth", …)` factory returns.
 *
 * Line-oriented rather than parsed, for the same reason design-lint is: a
 * parser is a dependency this repo will not take for a lint. The factories are
 * all object literals of `name: value,` at one indent level, so the shape is
 * regular enough to read without one.
 */
function mockedApiAuthNames(file: string): string[] {
  const lines = readFileSync(file, "utf-8").split(/\r?\n/);
  const names: string[] = [];
  let depth = 0;
  let inside = false;
  for (const raw of lines) {
    if (!inside && /jest\.mock\(\s*["']@\/lib\/api\/api-auth["']/.test(raw)) {
      inside = true;
      depth = 0;
    }
    if (!inside) continue;
    for (const ch of raw) {
      if (ch === "{" || ch === "(") depth++;
      else if (ch === "}" || ch === ")") depth--;
    }
    const m = /^\s{2,}([A-Za-z_$][\w$]*)\s*:/.exec(raw);
    if (m) names.push(m[1]);
    if (depth <= 0 && /\)\s*;?\s*$/.test(raw)) inside = false;
  }
  return names;
}

describe("read-only mode is observable by the suite that guards it", () => {
  it("the shared helper does not hard-wire the mode off", () => {
    // Comment-aware, like design-lint and the T-0048 oracle. The prose in that
    // helper explains the old shape in order to warn against it, and a check
    // that tripped on its own explanation would force the explanation out.
    const code = readFileSync(HELPERS, "utf-8")
      .split(/\r?\n/)
      .filter((l) => {
        const t = l.trim();
        return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
      })
      .join("\n");
    // The precise shape that hid the defect: a factory value that decides the
    // answer, rather than the real function reading the real environment.
    expect(code).not.toMatch(/isReadOnly:\s*jest\.fn\(\(\)\s*=>\s*false\)/);
    expect(code).not.toMatch(/isReadOnly:\s*\(\)\s*=>\s*false/);
  });

  it("no shared helper replaces @/lib/api/api-auth", () => {
    // This was called "the shared helper keeps the real read-only
    // implementation" and asserted the helper spread the real module:
    // `...jest.requireActual("@/lib/api/api-auth")`. That line lived in
    // setupRouteMocks, which tests-13 (T-0154) deleted because nothing called
    // it and jest does not hoist a mock declared inside a function anyway.
    //
    // The fact the case is for is that no SHARED helper decides read-only for a
    // route test, and not mocking the module at all keeps that better than
    // spreading the real one: the old form passed a faithful spread AND relied
    // on the case above to catch the unfaithful one. This form fails both. The
    // name is changed with the assertion, because a green case whose title
    // states the opposite of what it checks is worse than no case, and this
    // batch is the one about a gate saying a true thing.
    //
    // Comment-aware, like the case above and for the same reason: the helper's
    // prose has to be able to name the anti-pattern in order to warn against
    // it, and a check that tripped on its own explanation would force the
    // explanation out.
    const code = readFileSync(HELPERS, "utf-8")
      .split(/\r?\n/)
      .filter((l) => {
        const t = l.trim();
        return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
      })
      .join("\n");
    expect(code).not.toMatch(/jest\.(mock|doMock|setMock)\(\s*[`"']@\/lib\/api\/api-auth[`"']/);
  });

  it("no test mocks a name `@/lib/api/api-auth` does not export", () => {
    const real = new Set(Object.keys(apiAuth));
    const offenders: string[] = [];
    for (const file of testFiles()) {
      for (const name of mockedApiAuthNames(file)) {
        if (!real.has(name)) offenders.push(`${rel(file)} mocks '${name}'`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("finds mocks to check, so an empty scan cannot read as a pass", () => {
    const withMocks = testFiles().filter((f) => mockedApiAuthNames(f).length > 0);
    expect(withMocks.length).toBeGreaterThan(5);
  });
});

describe("the lint gate that fails a build on a guard in a read handler", () => {
  const GATE = join(__dirname, "..", "..", "scripts", "tooling", "check-read-only-guards.mjs");

  it("exists", () => {
    expect(() => readFileSync(GATE, "utf-8")).not.toThrow();
  });

  it("is wired into `npm run lint`, because a rule that is not a red build does not exist", () => {
    const pkg = readFileSync(join(__dirname, "..", "..", "package.json"), "utf-8");
    expect(pkg).toMatch(/check-read-only-guards\.mjs/);
  });

  it("is dependency-free, per WG-WEB-013", () => {
    const src = readFileSync(GATE, "utf-8");
    const imports = [...src.matchAll(/^import .*? from "([^"]+)";/gm)].map((m) => m[1]);
    const nonNode = imports.filter((i) => !/^(node:)?(fs|path|url|os)$/.test(i));
    expect(nonNode).toEqual([]);
  });
});
