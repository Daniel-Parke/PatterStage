/** @jest-environment node */

// T-0062 — the guard that replaced a guard which did not guard.
//
// WHAT WAS HERE BEFORE, and why it is worth writing down rather than quietly
// deleting. T-0050 shipped this matcher:
//
//   /<button\b([^>]*)>\s*<[A-Z][\w]*\s[^>]*\/>\s*<\/button>/
//
// It matched 3 of 394 buttons. Four independent causes, each fatal alone: no `i`
// flag, so `<Button>` (the shared component, and the dominant form in this
// codebase) never matched; applied per line, so multi-line JSX was invisible;
// the icon had to be the sole child, so any trailing expression failed it; and
// `[^>]*` cannot cross a `>`, so `onClick={() => fn()}` ended the capture early.
// It found one already-compliant button on day one, which is the most
// persuasive possible camouflage, and 26 unnamed buttons shipped beneath it.
//
// THE LESSON, which is bigger than this rule. That guard WAS mutation-tested,
// and it WAS given a denominator: `files.length > 100`. Neither helped.
// Mutation testing proves a guard is SENSITIVE, not COMPREHENSIVE: it asks "if
// the defect returned, would this go red?" for the defects you thought to
// inject, and the mutation and the guard share a blind spot. And the denominator
// was counted on the wrong noun: the rule is about BUTTONS and it counted FILES,
// so a walk that opened every file and understood none of them still passed.
//
// So this file asserts three different kinds of thing:
//   1. FIXTURES  — the classifier still classifies. Each case is named for the
//                  reason the old matcher missed it.
//   2. FLOORS    — the population is still the size it should be, counted on
//                  buttons and on icon-only buttons, not only on files.
//   3. THE GATE  — it exists, it is wired into `npm run lint`, it takes no
//                  dependency the chain does not already run, and it prints its
//                  denominator so an inert run is visible in a build log.

import { readFileSync } from "fs";
import { join } from "path";

import { classifyButtons, scanTree, formatSummary } from "../../scripts/tooling/check-icon-button-names.mjs";

const ROOT = process.cwd();

const btn = (body: string) => `export const C = () => (${body});`;

describe("the classifier still classifies", () => {
  it.each([
    ["a lowercase single-line icon button", `<button onClick={f}><X className="w" /></button>`, true],
    ["a capitalised <Button>, which the missing /i flag never saw", `<Button onClick={f}><X className="w" /></Button>`, true],
    ["an arrow function in an attribute, whose > ended the old match", `<button onClick={() => f()}><X className="w" /></button>`, true],
    ["an icon and a trailing expression, which the sole-child rule rejected", `<button onClick={f}><X className="w" />{n}</button>`, false],
    ["a self-closing <button /> with no children at all", `<button onClick={f} className="dot" />`, true],
    ["an icon beside a ternary with an empty branch", `<button onClick={f}><X className="w" />{armed ? " Confirm?" : ""}</button>`, true],
    ["an icon beside {cond && \"Save\"}", `<button onClick={f}><X className="w" />{ok && "Save"}</button>`, true],
    ["an icon beside literal text", `<button onClick={f}><X className="w" /> Delete</button>`, false],
    ["an icon beside a ternary whose branches both render", `<button onClick={f}><X className="w" />{on ? "Pause" : "Resume"}</button>`, false],
    ["an icon beside {label}", `<button onClick={f}><X className="w" />{label}</button>`, false],
    ["an icon beside a nested <span>{title}</span>", `<button onClick={f}><X className="w" /><span>{title}</span></button>`, false],
    ["aria-label satisfies the rule", `<button aria-label="Close" onClick={f}><X className="w" /></button>`, false],
    ["aria-labelledby satisfies the rule", `<button aria-labelledby="x" onClick={f}><X className="w" /></button>`, false],
    ["title satisfies the rule", `<button title="Close" onClick={f}><X className="w" /></button>`, false],
  ])("%s", (_name, body, shouldFlag) => {
    const r = classifyButtons(btn(body));
    expect(r.buttons).toBe(1);
    expect(r.unnamed.length > 0).toBe(shouldFlag);
  });

  it("a multi-line icon button, which a per-line matcher cannot see", () => {
    const r = classifyButtons(
      btn(`<Button
        variant="ghost"
        onClick={() => remove(id)}
      >
        <Trash2 className="w-3 h-3" />
      </Button>`),
    );
    expect(r.unnamed).toHaveLength(1);
  });

  it("a pragma with a written reason exempts the line, and one without does not", () => {
    const withReason = `export const C = () => (
  // icon-button-names-disable-next-line -- decorative, named by its row header
  <button onClick={f}><X className="w" /></button>
);`;
    const bare = `export const C = () => (
  // icon-button-names-disable-next-line
  <button onClick={f}><X className="w" /></button>
);`;
    expect(classifyButtons(withReason).unnamed).toHaveLength(0);
    expect(classifyButtons(bare).unnamed).toHaveLength(1);
  });

  it("a > inside a string attribute does not end the tag", () => {
    // The exact shape that broke the old `[^>]*` capture.
    const r = classifyButtons(btn(`<button title="a > b" onClick={() => f()}><X className="w" /></button>`));
    expect(r.buttons).toBe(1);
    expect(r.unnamed).toHaveLength(0);
  });
});

describe("an icon-only button has an accessible name", () => {
  const counts = scanTree();

  it("finds the button population it claims to check, so an empty walk cannot read as a pass", () => {
    expect(counts.filesScanned).toBeGreaterThan(150);
    expect(counts.buttonsSeen).toBeGreaterThan(250);
    expect(counts.filesWithButtons).toBeGreaterThan(80);
  });

  it("still classifies icon-only buttons, so a matcher that stopped matching cannot read as a pass", () => {
    // THE floor that matters. The two above only prove the walk ran. Break
    // rendersText so every button reads as text-bearing and the offender list
    // empties while both of those stay green; only this one goes red.
    expect(counts.iconOnlySeen).toBeGreaterThan(40);
  });

  it("names every icon-only button", () => {
    expect(counts.offenders).toEqual([]);
  });
});

describe("the gate that fails a build on an unnamed icon button", () => {
  const gate = join(ROOT, "scripts", "tooling", "check-icon-button-names.mjs");

  it("is wired into `npm run lint`, because a rule that is not a red build does not exist", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8")) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts.lint).toContain("check-icon-button-names.mjs");
  });

  it("takes no dependency the lint chain does not already run", () => {
    // WG-WEB-013 forbids a gate that needs an install step. `typescript` is not
    // that: the chain already executes it twice, as eslint's parser and as
    // `npm run typecheck:tests`. Operator-ruled 2026-08-30. The allowlist is
    // explicit rather than a widened regex so the exception stays visible.
    const src = readFileSync(gate, "utf-8");
    const imports = [...src.matchAll(/^import[^"']+["']([^"']+)["']/gm)].map((m) => m[1]);
    expect(imports.sort()).toEqual(["fs", "path", "typescript", "url"]);

    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8")) as {
      devDependencies: Record<string, string>;
    };
    expect(pkg.devDependencies.typescript).toBeTruthy();
  });

  it("reports its denominator, so an inert run is visible in the log", () => {
    const line = formatSummary(scanTree());
    expect(line).toMatch(/\d+ icon-only buttons/);
    expect(line).toMatch(/\d+ button elements across \d+ of \d+ \.tsx files/);
  });
});
