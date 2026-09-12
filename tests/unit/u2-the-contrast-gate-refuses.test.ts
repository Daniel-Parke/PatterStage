/**
 * U2 (T-0116): what contrast-check does when the ladder is wrong.
 *
 * The gate was extended from four text tokens to the whole surface ladder, and
 * an extension nobody has watched fail is a gate reporting zero for an unknown
 * reason. That is the lesson U0 was about: `no-raw-colour-in-tsx` reported "0 in
 * 0 files" for months while two raw colours shipped, because nothing had ever
 * planted one and checked.
 *
 * So this runs the real script against fixture stylesheets and reads its exit
 * code. It is the only test in the suite that spawns a process, and it is worth
 * the second it costs: everything else in this batch asserts what the file
 * SAYS, and this asserts what the gate DOES about it.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const SCRIPT = join(ROOT, "scripts", "tooling", "contrast-check.mjs");
const REAL = readFileSync(join(ROOT, "src", "app", "globals.css"), "utf-8");

/** Run the gate over a stylesheet and hand back what it decided. */
function run(css: string): { code: number; out: string } {
  const dir = mkdtempSync(join(tmpdir(), "ps-contrast-"));
  const file = join(dir, "globals.css");
  writeFileSync(file, css, "utf-8");
  const r = spawnSync(process.execPath, [SCRIPT, "--css", file], { encoding: "utf-8" });
  return { code: r.status ?? -1, out: `${r.stdout}\n${r.stderr}` };
}

/** The real stylesheet with one declaration rewritten. */
const withToken = (name: string, value: string): string =>
  REAL.replace(new RegExp(`(--${name}:\\s*)[^;]+;`), `$1${value};`);

describe("contrast-check accepts the ladder it is given", () => {
  it("passes on the real stylesheet, so the fixtures below mean something", () => {
    const { code, out } = run(REAL);
    expect(out).toContain("ladder rungs hold their separation");
    expect(code).toBe(0);
  });
});

describe("and refuses a ladder that does not separate", () => {
  /**
   * The exact state the reconnaissance measured, restored: panel back to
   * dark-900, which is 1.06:1 against the ground. This is the regression the
   * gate exists for, and it is the one a future "simplify the tokens" commit
   * would make.
   */
  it("refuses the flat ladder the walk found, at 1.06:1", () => {
    const { code, out } = run(withToken("color-ps-surface-panel", "#0c1520"));
    expect(out).toContain("below the separation they owe");
    expect(code).toBe(1);
  });

  it.each([
    ["a panel that barely lifts", "color-ps-surface-panel", "#0e1620"],
    ["a raised surface level with its panel", "color-ps-surface-raised", "#1e3042"],
    ["an edge at the old white/10 hairline", "color-ps-edge", "#1e232a"],
    ["an emphasis that cannot beat an edge", "color-ps-edge-emphasis", "#4a5058"],
  ])("refuses %s", (_name, token, value) => {
    expect(run(withToken(token, value)).code).toBe(1);
  });

  /**
   * A rung it cannot measure has to be a failure, not a pass. A value written
   * as a keyword, an oklab() or a nested alias would otherwise slip through as
   * "nothing to check here", which is precisely how the four text tiers could
   * have been silently dropped from measurement.
   */
  it.each([
    ["a keyword", "transparent"],
    ["an oklab", "oklab(0.3 0 0)"],
    ["a colour-mix", "color-mix(in srgb, #fff 20%, transparent)"],
  ])("refuses %s rather than skipping it", (_name, value) => {
    const { code, out } = run(withToken("color-ps-edge", value));
    expect(out).toContain("not a hex this can measure");
    expect(code).toBe(1);
  });

  it("refuses a stylesheet with no ladder at all", () => {
    const stripped = REAL.replace(/--color-ps-surface-panel:[^;]+;/, "");
    expect(run(stripped).code).toBe(1);
  });

  /** The half that was already there must keep working. */
  it("still refuses a text tier below AA", () => {
    const { code, out } = run(withToken("color-ps-text-faint", "rgb(255 255 255 / 0.30)"));
    expect(out).toContain("below AA");
    expect(code).toBe(1);
  });

  /**
   * An alias must be followed, not treated as unmeasurable. `well` is still
   * `var(--color-dark-800)` today and the roles the codemods retire will be
   * aliases for a batch each; a gate that gave up on the first `var()` would
   * stop measuring exactly while things are moving.
   *
   * A LEAF rung, deliberately. The first draft aliased the panel, which does
   * not test alias resolution at all: it moves the base that four other rungs
   * are measured against, and they fail, correctly. See the cascade below.
   */
  it("follows an alias to the value underneath it", () => {
    // cherenkov-100 is #33ddff, far brighter than the panel, so emphasis still
    // clears the 4.5 it owes. It can only clear it if the alias was resolved.
    const aliased = withToken("color-ps-edge-emphasis", "var(--color-cherenkov-100)");
    expect(run(aliased).code).toBe(0);
  });

  /**
   * The cascade, learned by writing the test above wrongly. Four of the five
   * rungs are measured against the panel, so moving the panel moves all of
   * them: a ladder is a chain and not five independent facts, and the gate has
   * to report it that way or a "safe" tweak to one value quietly breaks four.
   */
  it("re-measures every rung that hangs off the panel when the panel moves", () => {
    // Bright enough to clear 1.45 against the ground on its own, and bright
    // enough to leave raised, edge and hairline with nothing left above it.
    const { code, out } = run(withToken("color-ps-surface-panel", "var(--color-dark-600)"));
    expect(code).toBe(1);
    for (const rung of ["ps-surface-raised", "ps-edge", "ps-edge-hairline"]) {
      expect(out).toMatch(new RegExp(`${rung}\\s+vs\\s+ps-surface-panel.*FAIL`));
    }
  });
});
