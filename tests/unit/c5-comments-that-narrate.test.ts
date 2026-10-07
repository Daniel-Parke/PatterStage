/**
 * C5 · Comments that narrate.
 *
 * A quarter of src was comment, and 104 files of sixty lines or more were
 * forty percent comment or more. Some of that is the culture the overhaul
 * kept on purpose (a comment that names the defect a decision fixes); the
 * rest narrated the extraction arithmetic, the byte-equivalence of a move,
 * the session it happened in, and what the code used to be. Read file by
 * file, never cut by regex (T-0142); what stays is what says why.
 *
 * This suite holds the outcome: the narration markers are gone from
 * comments, the census's essay count is under the plan's line, and the
 * pragmas the gates read are all still there. The batch's other rule, that
 * not one code line moved, is checked against git at the gate by
 * scratchpad/c5/verify-comments-only.mjs and recorded.
 */

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const ROOT = join(__dirname, "..", "..");
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}
const SRC = walk(join(ROOT, "src"));
const rel = (p: string) => p.slice(ROOT.length + 1).replace(/\\/g, "/");

/** The comment lines of a file, and the block comments' interiors. */
function commentText(text: string): string {
  const blocks = (text.match(/\/\*[\s\S]*?\*\//g) ?? []).join("\n");
  const lines = text.split("\n").filter((l) => /^\s*\/\//.test(l)).join("\n");
  return blocks + "\n" + lines;
}

// Q015 independent amendment, Faraday, 2026-10-04. Retired sites checked at f9d1911f.
const retiredModelsSites = [
  ["openAddModel", "useCallback(() => setEditing(null), [setEditing])"],
  ["closeModelEditor", "useCallback(() => setEditing(undefined), [setEditing])"],
  ["closeFallbackModal", "useCallback(() => setEditingFallbackEntry(null), [setEditingFallbackEntry])"],
] as const;
const retainedDirectives = [
  ["src/app/agent/settings/page.tsx", '  }, [loaded, visibleIds.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps -- the joined ids are the dependency; the array is rebuilt every render'],
  ["src/app/results/logs/page.tsx", "  /* eslint-disable-next-line react-hooks/purity -- a freshness readout is a wall-clock fact; the 5s refetch is what advances it */"],
  ["src/components/logs/LogFilePicker.tsx", "  /* eslint-disable-next-line react-hooks/purity -- freshness is a wall-clock fact; the page refetches this listing every 5s */"],
  ["src/components/missions/MissionEditorPanel.tsx", "  /* eslint-disable-next-line react-hooks/purity -- a live duration reads the wall clock; the missions page repolls every 15s, which is what advances it */"],
  ["src/components/missions/MissionsList.tsx", "  /* eslint-disable-next-line react-hooks/purity -- live durations read the wall clock; the 15s poll re-renders the board */"],
  ["src/lib/api/api-fetch.ts", "// eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic JSON fetch returns arbitrary shapes"],
  ["src/lib/db/upgrade.ts", "  // eslint-disable-next-line @typescript-eslint/no-require-imports"],
  ["src/lib/templates-handlers/shared.ts", " * eslint-disable lines."],
  ["src/lib/templates-handlers/shared.ts", "// eslint-disable-next-line @typescript-eslint/no-explicit-any -- body is action-discriminated; per-branch validators narrow the shape"],
] as const;
function validatedRetiredDirectiveCredit(): number {
  const file = "src/app/agent/models/page.tsx", text = readFileSync(join(ROOT, file), "utf8");
  const parsed = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const declarations: ts.VariableDeclaration[] = [];
  function visit(node: ts.Node): void {
    if (ts.isVariableDeclaration(node)) declarations.push(node);
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  const printer = ts.createPrinter({ removeComments: true });
  for (const [name, expression] of retiredModelsSites) {
    const matches = declarations.filter(node => ts.isIdentifier(node.name) && node.name.text === name);
    expect(matches).toHaveLength(1);
    expect(matches[0].initializer).toBeDefined();
    expect(printer.printNode(ts.EmitHint.Expression, matches[0].initializer!, parsed)).toBe(expression);
    expect(commentText(matches[0].parent.parent.getFullText(parsed))).not.toMatch(/eslint-disable.*react-hooks\/exhaustive-deps/);
  }
  for (const [path, line] of retainedDirectives) expect(readFileSync(join(ROOT, path), "utf8").split(/\r?\n/).filter(value => value === line)).toHaveLength(1);
  return retiredModelsSites.length;
}

describe("C5 · comments that narrate", () => {
  it.each([
    ["byte-equivalence", /byte-equivalen|byte-for-byte|byte for byte/i],
    ["extraction history", /extracted verbatim|pre-refactor|pre-extraction|pre-session|god-file decomposition/i],
    ["session diaries", /\bsession[- ]\d{2,3}\b/i],
    ["counted wins", /\bhas \d wins\b|\d+ call sites collapse|collapses? from .{0,40} to .{0,40} levels?/i],
  ])("no comment narrates %s", (_name, re) => {
    const offenders = SRC.filter((f) => re.test(commentText(readFileSync(f, "utf8")))).map(rel);
    expect(offenders).toEqual([]);
  });

  it("every design-lint pragma and every eslint directive the tree had is still there", () => {
    // Read from the tree at C4's chore commit, the batch's base: the count
    // and the files may fall only if the code they excused moved, and no
    // code moves in a comment batch.
    const pragmas = SRC.reduce((n, f) => n + (readFileSync(f, "utf8").match(/design-lint-disable-next-line/g) ?? []).length, 0);
    const directives = SRC.reduce((n, f) => n + (readFileSync(f, "utf8").match(/eslint-disable|@ts-expect-error|prettier-ignore/g) ?? []).length, 0);
    expect(pragmas).toBeGreaterThanOrEqual(PRAGMA_LINES_AT_BASE);
    expect(directives + validatedRetiredDirectiveCredit()).toBeGreaterThanOrEqual(DIRECTIVES_AT_BASE);
  });

  it("the census reads the essays under the plan's line", () => {
    const out = execFileSync(process.execPath, [join(ROOT, "scripts", "tooling", "line-census.mjs"), "--report"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    const report = JSON.parse(out) as { counts: { commentEssays: number } };
    expect(report.counts.commentEssays).toBeLessThanOrEqual(60);
  });
});

// Measured on the tree at the batch's base (filled in when the oracle lands).
const PRAGMA_LINES_AT_BASE = 37;
// 13 at C5; C6 (T-0143) took useChatConversations' effect read onto
// useApiResource, and the exhaustive-deps directive on that effect went with it.
const DIRECTIVES_AT_BASE = 12;
