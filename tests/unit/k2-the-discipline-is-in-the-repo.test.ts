/**
 * @jest-environment node
 *
 * K2 · The discipline is in the repo.
 *
 * The gate was a list in a handover note and the mutation sweep lived in a
 * session scratchpad, so neither survived the session that wrote it, and three
 * written copies of the gate disagreed. This pins the two properties that make
 * them re-runnable by a stranger: the step list is one list, in code, and the
 * sweep tells the truth about a mutant that never applied.
 *
 * The sweep's four outcomes are tested through classifyMutant rather than the
 * CLI, because the CLI needs a clean git tree and a jest run of its own.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { STEPS, verdict } from "../../scripts/tooling/gate.mjs";
import { anchorIsCommentOnly, classifyMutant, occurrences } from "../../scripts/tooling/mutation-sweep.mjs";

const ROOT = join(__dirname, "..", "..");
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8")) as {
  scripts: Record<string, string>;
};

describe("K2 · the gate is one list, in code", () => {
  it("runs the nine steps the landing procedure names, in order", () => {
    expect(STEPS.map((s: { name: string }) => s.name)).toEqual([
      "lint",
      "tsc",
      "jest",
      "knip",
      "canary",
      "build",
      "e2e",
      "census",
      "census-lines",
    ]);
  });

  it("names only commands this repository actually has", () => {
    for (const step of STEPS as { name: string; command: string }[]) {
      const npmScript = /^npm run ([\w:-]+)/.exec(step.command)?.[1];
      if (npmScript) expect(Object.keys(pkg.scripts)).toContain(npmScript);
      else expect(step.command.startsWith("npx ")).toBe(true);
    }
  });

  it("is reachable as npm run gate, and the sweep as npm run sweep", () => {
    expect(pkg.scripts.gate).toContain("gate.mjs");
    expect(pkg.scripts.sweep).toContain("mutation-sweep.mjs");
  });

  it("writes its logs where they cannot dirty the tree it stamps", () => {
    // The runner stamps git status before and after. Its own logs showing up
    // in that status would report the tree as moved underneath itself.
    const ignored = readFileSync(join(ROOT, ".gitignore"), "utf-8");
    expect(ignored).toContain(".gate/");
  });

  it("gives every step a reason, so the list explains itself", () => {
    for (const step of STEPS as { why: string }[]) expect(step.why.length).toBeGreaterThan(10);
  });

  it("is green only when every step passed", () => {
    const green = [{ step: "lint", code: 0 }, { step: "tsc", code: 0 }];
    expect(verdict(green, false)).toEqual({ red: [], ok: true });
    expect(verdict([...green, { step: "jest", code: 1 }], false)).toEqual({ red: ["jest"], ok: false });
  });

  it("is red when the tree moved underneath it, however green the steps", () => {
    const green = [{ step: "lint", code: 0 }];
    expect(verdict(green, true)).toEqual({ red: [], ok: false });
  });
});

describe("K2 · the sweep refuses to call a mutant killed that never applied", () => {
  const source = ["// a comment mentioning total", "const total = a + b;", "export { total };"].join("\n");

  it("reports NOT-APPLIED when the anchor is not in the file", () => {
    expect(classifyMutant(source, { anchor: "const missing = 1;", replacement: "const missing = 2;" })).toEqual({
      outcome: "NOT-APPLIED",
      note: "anchor not found",
    });
  });

  it("reports NOT-APPLIED when the anchor is ambiguous", () => {
    const twice = "const x = 1;\nconst x = 1;";
    expect(classifyMutant(twice, { anchor: "const x = 1;", replacement: "const x = 2;" })).toEqual({
      outcome: "NOT-APPLIED",
      note: "anchor found 2 times",
    });
  });

  it("reports INEFFECTIVE for a replacement that changes nothing", () => {
    expect(classifyMutant(source, { anchor: "a + b", replacement: "a + b" })).toEqual({
      outcome: "INEFFECTIVE",
      note: "replacement equals anchor",
    });
  });

  it("reports INEFFECTIVE for an anchor that sits only in a comment", () => {
    const result = classifyMutant(source, { anchor: "comment mentioning total", replacement: "comment mentioning sum" });
    expect(result?.outcome).toBe("INEFFECTIVE");
  });

  it("lets a comment anchor through when force says that is the point", () => {
    const forced = classifyMutant(source, {
      anchor: "comment mentioning total",
      replacement: "comment mentioning sum",
      force: true,
    });
    expect(forced).toBeNull();
  });

  it("passes a real code anchor through to be applied", () => {
    expect(classifyMutant(source, { anchor: "a + b", replacement: "a - b" })).toBeNull();
  });

  it("counts occurrences without overlapping itself", () => {
    expect(occurrences("aaaa", "aa")).toBe(2);
    expect(anchorIsCommentOnly(source, "a + b")).toBe(false);
  });
});
