/**
 * @jest-environment node
 *
 * K6 · The gates see.
 *
 * Five checks report a number that is not the number, and every batch of the
 * refactor programme is refereed by them. Written before the fixes exist, by a
 * session that does not implement them (org/roles/ORACLE.md).
 *
 *   components-01  design-lint's raw-control rule matches `<button` only when a
 *                  character follows the tag name, so an opening tag that ENDS
 *                  ITS LINE is invisible. It reports 0; the tree holds 104 in
 *                  43 files. Ruled "fix now, baseline with a reason".
 *   app-04a        The route census counts a route only when its catch calls
 *                  serverErrorFromCatch, so eleven hand-rolled log-and-500
 *                  catches in six files go uncounted and routesWithTryCatch
 *                  reads 13 instead of 18. Ruled "widen the same measure".
 *   docs-02 +
 *   tooling-19     check-doc-links walks docs/ alone, so the sixteen tracked
 *                  markdown files outside docs/, org/ and data/seed/ are
 *                  unchecked, and three of their links are broken. Ruled
 *                  "widen and fix the paths".
 *   tooling-22     The line census walks src and tests alone, so scripts/ is
 *                  unmeasured by the ratchet that referees every batch.
 *   tests-13       Three exported test helpers have no caller, and knip — the
 *                  gate that would say so — does not read tests/.
 *
 * ── How each one is proved, and why it is shaped this way ───────────────────
 *
 * Invariant I1 asks for more than the new number. A gate that has been blind
 * for a programme is not fixed by a test that asserts what it now counts:
 * that is exactly the test these five already passed. So each gate here is
 * proved BLIND first — the violation it cannot see is planted, the shipped
 * behaviour is shown to miss it, and the fixed behaviour is required to catch
 * it.
 *
 * The trap in that shape is that "the shipped gate stays green" becomes a lie
 * the moment the fix lands, because the shipped gate and the fixed gate are the
 * same file. So the SHIPPED half is never read from the tree. Each blindness
 * case carries the shipped predicate as a literal, recorded here with the date
 * it was read off the script, and asserts that literal against the same fixture
 * the live gate must catch. Old pattern misses, new pattern catches, and
 * neither half rots.
 *
 * Two things are deliberately not asserted here rather than asserted weakly.
 * The raw-control debt (104 hits in 43 files) and the scripts line count belong
 * in their baselines, not in an oracle: a number in a test that the burn-down
 * is meant to drive down turns a batch doing the right thing red. What this
 * file holds instead is that the baseline HOLDS them, with a reason recorded on
 * the batch's own date.
 *
 * Numbers measured on 2026-09-12, on this tree, by the probes named beside them
 * on org/tasks/T-0154.json — not taken from the decision register, which was
 * cut before K0–K5 moved the tree.
 */

import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import {
  MIN_REASON_LENGTH,
  scanTree,
  splitBaseline,
  violationsIn,
} from "../../scripts/tooling/design-lint.mjs";

const ROOT = join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const CENSUS = join(ROOT, "scripts", "tooling", "line-census.mjs");

/** Temp trees this file builds, removed when it is done with them. */
const scratch: string[] = [];
function scratchDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  scratch.push(dir);
  return dir;
}
afterAll(() => {
  for (const dir of scratch) rmSync(dir, { recursive: true, force: true });
});

/** A source file with its comments removed, so prose about a shape is not the shape. */
const withoutComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

// ════════════════════════════════════════════════════════════════════════════
// components-01 · the raw-control rule
// ════════════════════════════════════════════════════════════════════════════

const RAW_CONTROL = "no-raw-control-outside-ui";

/**
 * scripts/tooling/design-lint.mjs:436 exactly as it stood on 2026-09-12.
 *
 * Recorded as a literal, never read from the module, so that the proof "the
 * shipped rule could not see this" keeps proving that after the module is
 * fixed. The fix adds `|$` to the lookahead.
 */
const SHIPPED_RAW_CONTROL = /<(?:button|input|select|textarea)(?=[\s/>])/;

const CONTROL_TAGS = ["button", "input", "select", "textarea"] as const;

/** An opening tag whose attributes are on the lines below it — the invisible shape. */
const endsItsLine = (tag: string) => `        <${tag}`;
/** The same control, written the way the shipped rule could already see. */
const withAttributes = (tag: string) => `        <${tag} className="x" onClick={go}>`;
/** A longer element name that merely begins with a control's name. Never a control. */
const longerName = (tag: string) => `        <${tag}Bar onClick={go}>`;

/** A .tsx path the rule covers: under src/, outside src/components/ui/ and src/kit/. */
const LINT_FIXTURE = "src/components/k6-raw-control-fixture.tsx";

/** True when design-lint, as it stands in the tree right now, reports this line. */
const rulePicksUp = (line: string): boolean =>
  violationsIn(LINT_FIXTURE, [line]).has(`${RAW_CONTROL}::${LINT_FIXTURE}`);

describe("K6 · components-01 · the raw-control rule sees a tag that ends its line", () => {
  it.each(CONTROL_TAGS)(
    "the shipped pattern saw <%s only when a character followed the tag name",
    (tag) => {
      expect(SHIPPED_RAW_CONTROL.test(withAttributes(tag))).toBe(true);
      expect(SHIPPED_RAW_CONTROL.test(endsItsLine(tag))).toBe(false);
    },
  );

  it.each(CONTROL_TAGS)("the rule reports a <%s whose tag ends its line", (tag) => {
    // The ordinary form first: a rule that stopped seeing THAT would satisfy
    // nothing, and the case would have nowhere to hide if it broke.
    expect(rulePicksUp(withAttributes(tag))).toBe(true);
    expect(rulePicksUp(endsItsLine(tag))).toBe(true);
  });

  it.each(CONTROL_TAGS)("and still says nothing about <%sBar, which is not a control", (tag) => {
    // The lazy fix is to drop the lookahead rather than widen it, which would
    // flag every element whose name starts with a control's.
    expect(rulePicksUp(longerName(tag))).toBe(false);
    expect(rulePicksUp(`        <${tag}Bar`)).toBe(false);
  });

  /**
   * The 104 hits in 43 files are the ruled baseline, not an assertion: the
   * burn-down through the component and app batches is supposed to drive that
   * number down, and a test holding it would turn each of those batches red.
   * What is held here is that the baseline holds them, and that the entry which
   * admitted them is THIS batch's — U2 baselined the same rule on 2026-09-06
   * and burned it to zero, so an entry naming the rule is not by itself news.
   */
  it("every raw control the rule now finds is held in the baseline, admitted on this batch's date", () => {
    const { counts } = scanTree();
    const { counts: baseline, log } = splitBaseline(
      JSON.parse(read("scripts/tooling/design-lint.baseline.json")) as unknown,
    );

    const found = Object.keys(counts).filter((k) => k.startsWith(`${RAW_CONTROL}::`));
    // Not a floor on the debt. This refuses the one reading that would make
    // everything below vacuous: a rule widened and narrowed in the same breath,
    // finding nothing at all.
    expect(found).not.toEqual([]);

    const above = found
      .filter((k) => counts[k] > (baseline[k] ?? 0))
      .map((k) => `${k}: ${counts[k]} found, ${baseline[k] ?? 0} allowed`);
    expect(above).toEqual([]);

    const held = Object.keys(baseline).filter((k) => k.startsWith(`${RAW_CONTROL}::`));
    expect(held).not.toEqual([]);

    const admitting = log.filter(
      (entry) => entry.when >= "2026-09-12" && entry.grew.some((g) => g.startsWith(`${RAW_CONTROL}::`)),
    );
    expect(admitting).not.toEqual([]);
    for (const entry of admitting) {
      expect(entry.reason.length).toBeGreaterThanOrEqual(MIN_REASON_LENGTH);
      // I2: the reason says which gate changed.
      expect(entry.reason).toContain(RAW_CONTROL);
    }

    // And nothing sits in the baseline that no growth entry ever admitted: the
    // ratchet's whole claim is that a rise is written down when it is held.
    const admitted = new Set(
      log.flatMap((entry) => entry.grew.map((g) => g.slice(0, g.lastIndexOf(": ")))),
    );
    expect(held.filter((k) => !admitted.has(k))).toEqual([]);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// app-04a and tooling-22 · the line census
// ════════════════════════════════════════════════════════════════════════════

type CensusReport = {
  counts: Record<string, number>;
  routes: { count: number; sites: number; files: string[] };
};

/** `line-census.mjs --report` over a tree; `null` is the repository itself. */
function census(root: string | null): CensusReport {
  const args = root === null ? [CENSUS, "--report"] : [CENSUS, "--root", root, "--report"];
  const out = execFileSync(process.execPath, args, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return JSON.parse(out) as CensusReport;
}

/**
 * scripts/tooling/line-census.mjs:96-100 as it stood on 2026-09-12: a route was
 * counted only when its code named the shared helper. Recorded as a literal for
 * the same reason as the lint pattern above.
 */
const SHIPPED_ROUTE_TEST = (code: string) => /serverErrorFromCatch\(/.test(code);

/** line-census.mjs:50-51 as it stood on 2026-09-12: the census walked two roots. */
const SHIPPED_CENSUS_ROOTS = ["src", "tests"];

const HELPER_ROUTE = [
  'import { serverErrorFromCatch } from "@/lib/api/api-response";',
  "",
  "export async function GET() {",
  "  try {",
  "    return await read();",
  "  } catch (error) {",
  '    return serverErrorFromCatch("GET /api/helper", "read", error, "Failed to read");',
  "  }",
  "}",
];

const HAND_ROLLED_ROUTE = [
  'import { NextResponse } from "next/server";',
  'import { logApiError } from "@/lib/api/api-logger";',
  "",
  "export async function GET() {",
  "  try {",
  "    return await read();",
  "  } catch (error) {",
  '    logApiError("GET /api/handrolled", "read", error);',
  '    return NextResponse.json({ error: "Failed to read" }, { status: 500 });',
  "  }",
  "}",
];

const NO_CATCH_ROUTE = ["export async function GET() {", "  return await read();", "}"];

const SCRIPTS_FIXTURE = ["#!/usr/bin/env node", "// a tooling script", "export const one = 1;"];
const TEST_FIXTURE = ['it("a", () => {});'];

/**
 * A tree with one route of each shape, one test and two files under scripts/.
 * No trailing newlines, so a file's line count is the length of its array.
 */
function censusFixture(): string {
  const root = scratchDir("k6-census-");
  for (const dir of [
    "src/app/api/helper",
    "src/app/api/handrolled",
    "src/app/api/plain",
    "tests/unit",
    "scripts/tooling",
  ]) {
    mkdirSync(join(root, dir), { recursive: true });
  }
  writeFileSync(join(root, "src/app/api/helper/route.ts"), HELPER_ROUTE.join("\n"));
  writeFileSync(join(root, "src/app/api/handrolled/route.ts"), HAND_ROLLED_ROUTE.join("\n"));
  writeFileSync(join(root, "src/app/api/plain/route.ts"), NO_CATCH_ROUTE.join("\n"));
  writeFileSync(join(root, "tests/unit/a.test.ts"), TEST_FIXTURE.join("\n"));
  writeFileSync(join(root, "scripts/tooling/one.mjs"), SCRIPTS_FIXTURE.join("\n"));
  writeFileSync(join(root, "scripts/two.mjs"), SCRIPTS_FIXTURE.join("\n"));
  return root;
}

/**
 * Every route file that keeps a catch of its own, found without the census.
 *
 * A differential reference: catch bodies are taken by brace depth rather than
 * by the whole-file regex the census uses, so the two agree only if both are
 * right. The shape is the one the operator ruled on 2026-09-12 (app-04a,
 * "widen the same measure"): the shared helper, OR a catch that logs and
 * answers 500. A catch that answers 500 without logging (seed and seed/clean
 * refusing to run without a backup) is not that shape and is not counted.
 */
function routesKeepingTheirOwnCatch(): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (name === "route.ts") files.push(p.split("\\").join("/"));
    }
  };
  walk(join(ROOT, "src", "app", "api"));

  const bodies = (source: string): string[] => {
    const code = withoutComments(source);
    const out: string[] = [];
    const opener = /catch\s*(?:\([^)]*\)\s*)?\{/g;
    let m: RegExpExecArray | null;
    while ((m = opener.exec(code)) !== null) {
      let depth = 1;
      let i = m.index + m[0].length;
      while (i < code.length && depth > 0) {
        if (code[i] === "{") depth += 1;
        else if (code[i] === "}") depth -= 1;
        i += 1;
      }
      out.push(code.slice(m.index, i));
    }
    return out;
  };
  const keepsItsOwn = (body: string) =>
    /serverErrorFromCatch\s*\(/.test(body) ||
    (/logApiError\s*\(/.test(body) &&
      (/\bserverError\s*\(/.test(body) || /status:\s*[^,}]*\b500\b/.test(body)));

  const rootPrefix = ROOT.split("\\").join("/") + "/";
  return files
    .filter((f) => bodies(readFileSync(f, "utf8")).some(keepsItsOwn))
    .map((f) => f.slice(rootPrefix.length))
    .sort();
}

/**
 * The six route files that hand-roll a log-and-500 catch, by name.
 *
 * models/fallbacks was already counted through the helper; the other five were
 * invisible. memory/hindsight is on the list deliberately — see the decision
 * below the describe.
 */
const HAND_ROLLED_ROUTE_FILES = [
  "src/app/api/admin/sessions/backfill-status/route.ts",
  "src/app/api/memory/hindsight/route.ts",
  "src/app/api/mission-categories/route.ts",
  "src/app/api/models/fallbacks/route.ts",
  "src/app/api/sync/route.ts",
  "src/app/api/update/route.ts",
];

type CensusBaseline = {
  counts: Record<string, number>;
  allowed?: { measuredAt?: string; rise?: string; reason?: string }[];
};
const censusBaseline = (): CensusBaseline =>
  JSON.parse(read("scripts/tooling/line-census.baseline.json")) as CensusBaseline;

/**
 * app-04a · 18, not 17.
 *
 * The register's sceptic offered 17 as a stricter reading that leaves out
 * memory/hindsight/route.ts:101, whose catch answers 503 for a connection error
 * and 500 for everything else. It is counted here, for three reasons. It is a
 * route body that keeps its own try, which is what the measure is named after.
 * app-04b's ruling ("keep the text, use serverErrorFromError") says in terms
 * that this one catch cannot move to a shared helper without changing its
 * response, so it stays hand-rolled permanently — the one catch the programme
 * has already decided will never move is the last one a census should be blind
 * to. And a predicate reading "logs, and answers 500 and nothing else" is a
 * narrower rule than the one that was ruled, which is how this gate went blind
 * in the first place.
 */
describe("K6 · app-04a · the route census counts a catch that logs and answers 500", () => {
  it("the helper-name test as shipped could not see a hand-rolled catch", () => {
    expect(SHIPPED_ROUTE_TEST(HELPER_ROUTE.join("\n"))).toBe(true);
    expect(SHIPPED_ROUTE_TEST(HAND_ROLLED_ROUTE.join("\n"))).toBe(false);
    expect(SHIPPED_ROUTE_TEST(NO_CATCH_ROUTE.join("\n"))).toBe(false);
  });

  it("on a fixture tree it counts both shapes, and not a route that keeps no catch", () => {
    const report = census(censusFixture());
    expect(report.routes.files.slice().sort()).toEqual([
      "src/app/api/handrolled/route.ts",
      "src/app/api/helper/route.ts",
    ]);
    expect(report.counts.routesWithTryCatch).toBe(2);
  });

  it("on this tree it counts every route that keeps its own catch, and only those", () => {
    expect(census(null).routes.files.slice().sort()).toEqual(routesKeepingTheirOwnCatch());
  });

  it("the six files that hand-roll one are named in the report, hindsight included", () => {
    const counted = new Set(census(null).routes.files);
    expect(HAND_ROLLED_ROUTE_FILES.filter((f) => !counted.has(f))).toEqual([]);
  });

  it("the rise the widening causes is held in the census baseline, with its reason", () => {
    const baseline = censusBaseline();
    expect(baseline.counts.routesWithTryCatch).toBe(18);
    // The exact sentence `--allow-growth` writes, so this is the fact the
    // ratchet recorded and not a phrase somebody typed near it.
    const held = (baseline.allowed ?? []).filter(
      (entry) => entry.rise === "routesWithTryCatch rose from 13 to 18",
    );
    expect(held).not.toEqual([]);
    for (const entry of held) {
      // design-lint's bar for a reason rather than a keystroke. The census has
      // none of its own, so the same one is applied.
      expect((entry.reason ?? "").trim().length).toBeGreaterThanOrEqual(MIN_REASON_LENGTH);
    }
  });
});

describe("K6 · tooling-22 · the line census measures scripts/", () => {
  it("the two roots as shipped could not reach a file under scripts/", () => {
    const under = (roots: string[], path: string) => roots.some((r) => path.startsWith(`${r}/`));
    expect(under(SHIPPED_CENSUS_ROOTS, "scripts/tooling/line-census.mjs")).toBe(false);
    expect(under(SHIPPED_CENSUS_ROOTS, "src/app/page.tsx")).toBe(true);
    expect(under(SHIPPED_CENSUS_ROOTS, "tests/unit/k6-the-gates-see.test.ts")).toBe(true);
    // Widening the roots is what reaches it.
    expect(under([...SHIPPED_CENSUS_ROOTS, "scripts"], "scripts/tooling/line-census.mjs")).toBe(true);
  });

  it("on a fixture tree scriptsLines counts the scripts files exactly, and src and tests are untouched", () => {
    const report = census(censusFixture());
    expect(report.counts.scriptsLines).toBe(SCRIPTS_FIXTURE.length * 2);
    expect(report.counts.srcLines).toBe(
      HELPER_ROUTE.length + HAND_ROLLED_ROUTE.length + NO_CATCH_ROUTE.length,
    );
    expect(report.counts.testLines).toBe(TEST_FIXTURE.length);
  });

  /**
   * The tree's own scripts total is a baseline number, not an assertion: it is a
   * ratchet a comment pass over scripts/tooling is meant to drive down. What is
   * held here is that the measure exists, that the baseline holds it, and that
   * the tree is not above what the baseline holds.
   */
  it("the measure is reported by the census and held in its baseline", () => {
    const live = census(null).counts.scriptsLines;
    expect(typeof live).toBe("number");
    expect(live).toBeGreaterThan(0);
    const held = censusBaseline().counts.scriptsLines;
    expect(typeof held).toBe("number");
    expect(live).toBeLessThanOrEqual(held);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// docs-02 and tooling-19 · the link gate
// ════════════════════════════════════════════════════════════════════════════

/** check-doc-links.mjs:21 and :39 as they stood on 2026-09-12: docs/ and nothing else. */
const SHIPPED_LINK_SCOPE = (repoRelative: string) => repoRelative.startsWith("docs/");

/** The scope the ruling asks for: every tracked .md except org/ and data/seed/. */
const REQUIRED_LINK_SCOPE = (repoRelative: string) =>
  !repoRelative.startsWith("org/") && !repoRelative.startsWith("data/seed/");

/**
 * The sixteen tracked markdown files in the widened scope that the shipped gate
 * never opened. Measured 2026-09-12 with `git ls-files "*.md"`.
 */
const OUTSIDE_DOCS = [
  ".github/ISSUE_TEMPLATE/bug_report.md",
  ".github/ISSUE_TEMPLATE/feature_request.md",
  ".github/pull_request_template.md",
  "AGENTS.md",
  "CHANGELOG.md",
  "CLAUDE.md",
  "README.md",
  "REBRANDING.md",
  "TRADEMARK.md",
  "branding/LICENSE.md",
  "branding/README.md",
  "branding/assets/README.md",
  "branding/guidelines/COLORS.md",
  "ops/runbooks/deploy.md",
  "src/kit/PROVENANCE.md",
  "tests/scripts/README.md",
];

function trackedMarkdown(): string[] {
  const out = execFileSync("git", ["ls-files", "*.md"], { cwd: ROOT, encoding: "utf8" });
  return out
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .sort();
}

const INLINE_LINK = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const REFERENCE_LINK = /^[ \t]*\[[^\]]+\]:[ \t]*(\S+)/gm;

/** Every relative link target in a markdown file, resolved to an absolute path. */
function resolvedLinkTargets(repoRelative: string): string[] {
  // HTML comments out; a link a reader never sees must not satisfy a check.
  const source = read(repoRelative).replace(/<!--[\s\S]*?-->/g, "");
  const here = dirname(join(ROOT, repoRelative));
  const out: string[] = [];
  for (const re of [INLINE_LINK, REFERENCE_LINK]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(source)) !== null) {
      const target = m[1];
      if (/^(https?:|mailto:|#|<)/.test(target)) continue;
      const path = decodeURIComponent(target.split("#")[0]);
      if (!path) continue;
      out.push(resolve(here, path));
    }
  }
  return out;
}

/** True when every segment resolves with exactly the spelling written (K1's check). */
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

function docLinkFixture(): string {
  const root = scratchDir("k6-doclinks-");
  for (const dir of ["scripts/tooling", "docs", "branding", "org", "data/seed", "src/lib"]) {
    mkdirSync(join(root, dir), { recursive: true });
  }
  copyFileSync(
    join(ROOT, "scripts", "tooling", "check-doc-links.mjs"),
    join(root, "scripts", "tooling", "check-doc-links.mjs"),
  );
  writeFileSync(join(root, "src/lib/here.ts"), "export const here = 1;\n");
  writeFileSync(join(root, "docs/index.md"), "# Docs\n\nSee [the note](./ok.md).\n");
  writeFileSync(join(root, "docs/ok.md"), "# Ok\n");
  // The plants: a broken link in a root document and in branding/, which the
  // shipped gate never opens.
  writeFileSync(join(root, "GUIDE.md"), "# Guide\n\nImplemented [here](src/lib/gone.ts).\n");
  writeFileSync(join(root, "branding/COLORS.md"), "# Colours\n\nTokens in [theme](../src/lib/gone.ts).\n");
  // And two the widened gate must still leave alone: ADR-0010 §3 keeps task
  // records historical, and data/seed is shipped content.
  writeFileSync(join(root, "org/note.md"), "# Note\n\nA historical [record](./gone.md).\n");
  writeFileSync(join(root, "data/seed/s.md"), "# Seed\n\nA seeded [page](./gone.md).\n");
  // The gate the ruling describes reads `git ls-files`, so the fixture is a
  // repository. An index is enough; nothing here is committed.
  execFileSync("git", ["init", "-q"], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
  execFileSync("git", ["add", "-A"], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
  return root;
}

function runLinkGate(root: string): { code: number; out: string } {
  try {
    const out = execFileSync(process.execPath, [join(root, "scripts", "tooling", "check-doc-links.mjs")], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, out };
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    return { code: err.status ?? 1, out: `${err.stdout ?? ""}${err.stderr ?? ""}` };
  }
}

describe("K6 · docs-02 and tooling-19 · the link gate walks every tracked document", () => {
  it("the docs-only scope as shipped could not open the sixteen files outside it", () => {
    const inScope = trackedMarkdown().filter(REQUIRED_LINK_SCOPE);
    expect(inScope.filter((f) => !SHIPPED_LINK_SCOPE(f))).toEqual(OUTSIDE_DOCS);
    // And it did open the ones inside docs/, so the scope was the whole defect.
    expect(inScope.some(SHIPPED_LINK_SCOPE)).toBe(true);
  });

  it("on a fixture repository it reports a broken link outside docs/, and leaves org/ and data/seed/ alone", () => {
    const { code, out } = runLinkGate(docLinkFixture());
    expect(code).toBe(1);
    expect(out).toMatch(/GUIDE\.md[^\n]*gone\.ts/);
    expect(out).toMatch(/branding\/COLORS\.md[^\n]*gone\.ts/);
    expect(out).not.toMatch(/org\/note\.md/);
    expect(out).not.toMatch(/data\/seed\/s\.md/);
  });

  it("no tracked document outside org/ and data/seed/ has a broken relative link", () => {
    const broken: string[] = [];
    for (const file of trackedMarkdown().filter(REQUIRED_LINK_SCOPE)) {
      for (const target of resolvedLinkTargets(file)) {
        if (!existsWithExactCase(target)) broken.push(`${file} -> ${target.slice(ROOT.length + 1)}`);
      }
    }
    expect(broken).toEqual([]);
  });

  it("the trademark and colour documents point at the files that hold the palette today", () => {
    // The fact, not the spelling: C7 moved theme.ts and B15 moved the tokens
    // doc, so what has to be true is that the pointers resolve to where those
    // two live now, however the relative path is written.
    const theme = join(ROOT, "src", "lib", "ui", "theme.ts");
    const tokens = join(ROOT, "docs", "contributing", "design-tokens.md");
    expect(existsSync(theme)).toBe(true);
    expect(existsSync(tokens)).toBe(true);

    expect(resolvedLinkTargets("TRADEMARK.md")).toContain(theme);
    const colours = resolvedLinkTargets("branding/guidelines/COLORS.md");
    expect(colours).toContain(theme);
    expect(colours).toContain(tokens);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// tests-13 · the dead test helpers
// ════════════════════════════════════════════════════════════════════════════

/**
 * knip.json's `project` globs on 2026-09-12 — the entire scope of the gate that
 * would report an export with no importer. Recorded as a literal: tooling-16
 * widens the live config, and this proof is about the config that was blind.
 */
const SHIPPED_KNIP_PROJECT = [
  "src/**/*.{ts,tsx}",
  "scripts/**/*.{ts,mjs}",
  "mock-hermes/**/*.mjs",
  "mock-hindsight/**/*.mjs",
  "mock-llm/**/*.mjs",
];
/** A glob covers a path when the path is under the glob's literal prefix. */
const covers = (globs: string[], path: string) =>
  globs.some((g) => path.startsWith(g.split("*")[0]));

/**
 * The three exports tests-13 found with no caller anywhere but the review notes.
 *
 * Assembled at run time rather than written as literals, so this file does not
 * match its own sweep — b15-corpus-moves-under-org does the same, and for the
 * same reason: a scan that finds itself is a scan that can never go green.
 */
const DEAD_HELPER_EXPORTS = ["expectJson.Response", "setupFs.Mocks", "setupRoute.Mocks"].map((n) =>
  n.replace(".", ""),
);

/** The nine suites that use mockRequest, which the ruling keeps. Measured 2026-09-12. */
const MOCK_REQUEST_CALLERS = [
  "tests/unit/api-cron-system.test.ts",
  "tests/unit/api-routes-complex.test.ts",
  "tests/unit/api-routes-simple.test.ts",
  "tests/unit/b13-scheduler-runs-scripts.test.ts",
  "tests/unit/b3-operator-prefs.test.ts",
  "tests/unit/b4-emits-scripts-records.test.ts",
  "tests/unit/cron-hardware-api.test.ts",
  "tests/unit/profiles-api.test.ts",
  "tests/unit/the-run-route-says-which-happened.test.ts",
];

/** Every source file a caller could live in, read once. */
function codeFiles(): { path: string; code: string }[] {
  const out: { path: string; code: string }[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === "node_modules" || name === ".next") continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx|mts|mjs|cjs)$/.test(name)) {
        out.push({
          path: p.split("\\").join("/").slice(ROOT.split("\\").join("/").length + 1),
          code: withoutComments(readFileSync(p, "utf8")),
        });
      }
    }
  };
  for (const dir of ["src", "tests", "scripts"]) walk(join(ROOT, dir));
  return out;
}

describe("K6 · tests-13 · the test helpers with no caller are gone", () => {
  it("knip's scope as shipped could not see an export in tests/ (tooling-16, deferred)", () => {
    expect(covers(SHIPPED_KNIP_PROJECT, "tests/helpers/api-test-helpers.ts")).toBe(false);
    expect(covers(SHIPPED_KNIP_PROJECT, "src/lib/api/api-response.ts")).toBe(true);
    // The widening tooling-16 waits to make is what reaches them.
    expect(covers([...SHIPPED_KNIP_PROJECT, "tests/**/*.{ts,tsx}"], "tests/helpers/api-test-helpers.ts")).toBe(true);
  });

  it("the three exports nothing called are gone from src, tests and scripts", () => {
    const files = codeFiles();
    const survivors = DEAD_HELPER_EXPORTS.flatMap((name) =>
      files
        .filter(({ code }) => new RegExp(`\\b${name}\\b`).test(code))
        .map(({ path }) => `${name} in ${path}`),
    );
    expect(survivors).toEqual([]);
  });

  it("mockRequest is still exported once from tests/helpers, and the nine suites still call it", () => {
    const files = codeFiles();
    const exporters = files
      .filter(({ path }) => path.startsWith("tests/helpers/"))
      .filter(({ code }) => /export\s+function\s+mockRequest\b/.test(code))
      .map(({ path }) => path);
    expect(exporters.length).toBe(1);

    const byPath = new Map(files.map(({ path, code }) => [path, code]));
    const silent = MOCK_REQUEST_CALLERS.filter((f) => !/\bmockRequest\s*\(/.test(byPath.get(f) ?? ""));
    expect(silent).toEqual([]);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// I4 · the blind gates this batch does NOT fix
// ════════════════════════════════════════════════════════════════════════════

/** Each deferred gate with the item the register says it waits for. */
const DEFERRED_GATES: [string, string][] = [
  ["tooling-16", "tooling-02"],
  ["hooks-04", "app-03"],
  ["hooks-05", "hooks-01"],
  ["critic-06", "components-03"],
];

describe("K6 · the blind gates this batch does not fix are named, not dropped", () => {
  it("each one is on the task record with what it waits for", () => {
    const record = JSON.parse(read("org/tasks/T-0154.json")) as { notes: string };
    const silent = DEFERRED_GATES.filter(
      ([id, waitsFor]) => !record.notes.includes(id) || !record.notes.includes(waitsFor),
    );
    expect(silent).toEqual([]);
  });
});
