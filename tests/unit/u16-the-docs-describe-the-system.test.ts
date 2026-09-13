/**
 * U16 · The docs describe the system that exists.
 *
 * design-tokens.md was written for a colour system with three widths and one
 * rhythm, and the batches since have amended it a section at a time. What it
 * still lacks is the rest of what S6 declared and S4 built: the layer ladder
 * (z-base to z-tooltip, with arbitrary z refused), the two elevations, the two
 * durations and the house transition, and the primitive set with the rule that
 * puts a component in ui/ (three or more independent callers). Two of its
 * sentences also describe rules that no longer exist: the `.glow-*` classes
 * U6 deleted, and a form-input helper that is not the Field Kit.
 *
 * The repo guide says a multi-query bundle stays off the hook; since T-0129
 * every read is the hook and the endpoint is the key. The testing guide counts
 * nine gates in a chain of twelve. The plan is still `approved` when it is
 * done, and owes its closing: the before-census beside the after-census, and
 * the line counts, including the one the programme did not move.
 *
 * Source oracles: a doc that names the thing is not proof the thing works
 * (the gates are), but a doc that names a thing that is gone misleads the
 * next reader, and that is what this catches.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

describe("U16 · design-tokens.md describes the system", () => {
  const doc = read("docs/contributing/design-tokens.md");
  const headings = doc
    .split("\n")
    .filter((l) => l.startsWith("## "))
    .map((l) => l.slice(3).trim());

  it("names the system in its summary, not only the palette", () => {
    const summary = doc.match(/^summary:\s*(.+)$/m)?.[1] ?? "";
    expect(summary).toMatch(/ladder/i);
    expect(summary).toMatch(/primitive/i);
  });

  it("has a section for each thing S6 declared and S4 built", () => {
    for (const want of [/^Layers/, /^Elevation/, /^Duration/, /^The primitive set/]) {
      expect(headings.some((h) => want.test(h))).toBe(true);
    }
  });

  it("names every rung of the layer ladder and refuses the arbitrary one", () => {
    for (const z of ["z-base", "z-sticky", "z-dropdown", "z-overlay", "z-modal", "z-toast", "z-tooltip"]) {
      expect(doc).toContain(`\`${z}\``);
    }
    expect(doc).toMatch(/arbitrary/);
  });

  it("names the two elevations and the two durations", () => {
    expect(doc).toContain("shadow-ps-raised");
    expect(doc).toContain("glow-surface");
    expect(doc).toContain("--ps-duration-fast");
    expect(doc).toMatch(/120ms/);
    expect(doc).toMatch(/200ms/);
  });

  it("states the rule that puts a component in ui/, and lists the set", () => {
    expect(doc).toMatch(/three or more/);
    for (const p of [
      "Button",
      "IconButton",
      "LinkButton",
      "Badge",
      "Card",
      "Dialog",
      "Popover",
      "SegmentedControl",
      "DataList",
      "ConfirmButton",
      "LoadErrorBanner",
      "EmptyState",
      "PageLoading",
      "Skeleton",
      "Picker",
    ]) {
      expect(doc).toContain(`\`${p}\``);
    }
    expect(doc).toContain("ui/field");
  });

  it("describes no rule that is gone", () => {
    // U6 deleted the five .glow-* classes; the sentence about their softness
    // described a stylesheet that no longer has them.
    expect(doc).not.toMatch(/`\.glow-\*`/);
    // The Field Kit is the rule for a form control; a helper that assembles
    // input classes is not what a contributor should be sent to first.
    const formInputs = doc.slice(doc.indexOf("## Form inputs"), doc.indexOf("## ", doc.indexOf("## Form inputs") + 3));
    expect(formInputs).toMatch(/ui\/field|Field Kit/);
  });
});

describe("U16 · the other two contributor guides", () => {
  it("the repo guide states the data-layer rule as it is", () => {
    const guide = read("docs/contributing/repo-guide.md");
    expect(guide).toMatch(/useApiResource/);
    expect(guide).toMatch(/endpoint is the (cache )?key/i);
    expect(guide).not.toMatch(/multi-query bundles/);
  });

  it("the testing guide counts the lint chain as package.json has it", () => {
    const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    const commands = pkg.scripts.lint.split("&&").map((c) => c.trim()).filter(Boolean);
    const words = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen"];
    const testing = read("docs/contributing/testing.md");
    expect(testing).toMatch(new RegExp(`chains ${words[commands.length]} gates`));
    for (const name of ["check-icon-button-names", "check-form-control-names"]) {
      expect(testing).toContain(name);
    }
  });
});

describe("U16 · the plan is closed", () => {
  const plan = read("org/plans/2026-09-ui-overhaul.md");

  it("carries status done", () => {
    expect(plan).toMatch(/^status: done$/m);
  });

  it("has a closing that puts the after-census beside the before-census", () => {
    expect(plan).toMatch(/^## Closing/m);
    const closing = plan.slice(plan.indexOf("## Closing"));
    for (const measure of ["hitTargetsBelowTwentyFour", "railVsPageContrast", "distinctContentWidths", "monoShare", "controlBordersBelowThree"]) {
      expect(closing).toContain(measure);
    }
    // The measure the programme did not move, stated as a number, not an adjective.
    expect(closing).toMatch(/105,975/);
    expect(closing).toMatch(/105,942/);
    expect(closing).toMatch(/117,944/);
  });
});
