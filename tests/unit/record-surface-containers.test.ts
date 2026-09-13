/**
 * The structural half of the record-surface migration (T-0033, WG-WEB-003 D).
 *
 * The ruling is that a record with three or more comparable fields is a table
 * or a ledger, not a rounded box. The measured cause it was ruled against is a
 * count, not an opinion: Card is imported by 10 files, Panel by 4 and Button by
 * 36, against 313 raw <button> elements and 209 inline rounded-border boxes. A
 * console styled that way cannot be restyled by a ruling, because the ruling
 * lands on components a minority of it goes through, and the vendored bloom
 * field lights only what those components render.
 *
 * A rendered test cannot hold that. Rendering proves a surface looks right
 * TODAY; it says nothing about whether the next edit re-hand-rolls the box that
 * was just removed. So the structural claim is held as source-level fact, the
 * way tests/unit/spend-unattended-dispatch.test.ts holds "the attended modules
 * must not import the gate": read the file, assert the seam.
 *
 * Two claims per record surface:
 *
 *   1. it goes THROUGH a shared container, named here, so a future styling
 *      ruling reaches it by editing one file;
 *   2. it contains no raw record box. The signature is the one the measurement
 *      counted, a rounded-xl surface painted bg-dark-900/50, which is the exact
 *      shape Card and Panel already render.
 *
 * Authored before any file under src/ was edited. Every case below was red on
 * write.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = join(__dirname, "..", "..", "src");

const read = (relative: string): string =>
  readFileSync(join(SRC, ...relative.split("/")), "utf-8").replace(/\r\n/g, "\n");

/**
 * The raw record box, as measured. Either order: Tailwind class order is a
 * matter of taste and both spellings paint the same surface.
 */
const RAW_RECORD_BOX = /rounded-xl[^"'`]*bg-dark-900\/50|bg-dark-900\/50[^"'`]*rounded-xl/;

/** Import specifiers of the shared containers. */
const PANEL = "@/components/dashboard/Panel";
const LEDGER = "@/components/dashboard/LedgerRow";
const BUTTON = "@/components/ui/Button";

/**
 * The record surfaces in this task's scope, and the shared containers each one
 * is required to render through. The skills page is deliberately absent: it is
 * another agent's, and naming it here would make this file fail on their work.
 */
const RECORD_SURFACES: ReadonlyArray<{ file: string; through: readonly string[] }> = [
  { file: "app/results/sessions/page.tsx", through: [PANEL] },
  { file: "components/session/SessionCard.tsx", through: [LEDGER] },
  { file: "components/session/MissionGroupCard.tsx", through: [LEDGER] },
  { file: "components/logs/LogFilePicker.tsx", through: [PANEL, LEDGER] },
  { file: "components/logs/LogTerminal.tsx", through: [PANEL] },
  { file: "components/logs/LogRow.tsx", through: [LEDGER] },
  { file: "components/missions/MissionsList.tsx", through: [PANEL, LEDGER] },
  { file: "app/agent/tools/page.tsx", through: [PANEL, BUTTON] },
];

describe("the record surfaces go through the shared containers", () => {
  it.each(RECORD_SURFACES)("$file", ({ file, through }) => {
    const source = read(file);
    for (const specifier of through) {
      expect(source).toContain(specifier);
    }
  });
});

describe("no record surface hand-rolls the box the containers already render", () => {
  it.each(RECORD_SURFACES)("$file", ({ file }) => {
    const offending = read(file)
      .split("\n")
      .map((line, i) => ({ line: line.trim(), number: i + 1 }))
      // A comment naming the anti-pattern must stay writable, exactly as
      // design-lint.mjs exempts comment-only lines from its code rules.
      .filter(({ line }) => !line.startsWith("//") && !line.startsWith("*"))
      .filter(({ line }) => RAW_RECORD_BOX.test(line));
    expect(offending).toEqual([]);
  });
});

describe("the ledger row has exactly one definition", () => {
  /**
   * ActiveMissionsPanel and ErrorsPanel are where the pattern came from, and
   * T-0024 set data-bloom on each of them by hand. Two hand-written copies is
   * how the third gets it wrong. If they consume the shared row, so does
   * everything else, and the row's styling has one home.
   */
  it.each([
    "components/dashboard/ActiveMissionsPanel.tsx",
    "components/dashboard/ErrorsPanel.tsx",
  ])("%s consumes the shared row", (file) => {
    expect(read(file)).toContain(LEDGER);
  });

  it("and the shared row is the only place the tight tier is spelled by hand", () => {
    for (const { file } of RECORD_SURFACES) {
      expect(read(file)).not.toContain('data-bloom="tight"');
    }
    expect(read("components/dashboard/ActiveMissionsPanel.tsx")).not.toContain(
      'data-bloom="tight"',
    );
    expect(read("components/dashboard/ErrorsPanel.tsx")).not.toContain(
      'data-bloom="tight"',
    );
  });
});

describe("the containers carry the field, so the call sites do not have to", () => {
  it("Panel answers the pointer", () => {
    expect(read("components/dashboard/Panel.tsx")).toContain("data-bloom");
  });

  it("the ledger row answers it at the tight tier", () => {
    expect(read("components/dashboard/LedgerRow.tsx")).toContain('"tight"');
  });
});

describe("a surface that is genuinely a table is a table", () => {
  /**
   * The Hermes toolset reference is a catalogue: one row per toolset, the same
   * two facts on every row, and the page already drew column-ish structure with
   * a two-column grid on a <ul>. That is a table wearing a list, and a screen
   * reader gets nothing from it. The ruling's own words are the test.
   */
  it("the toolset reference renders a table with a header row", () => {
    const source = read("components/tools/ToolsetReferenceTable.tsx");
    expect(source).toContain("<table");
    expect(source).toContain("<thead");
    expect(source).toContain("<th");
  });

  it("and the page renders the reference through it", () => {
    expect(read("app/agent/tools/page.tsx")).toContain(
      "@/components/tools/ToolsetReferenceTable",
    );
  });
});

describe("the skills page is another agent's, and stays untouched", () => {
  it("is named nowhere in this task's record surfaces", () => {
    for (const { file } of RECORD_SURFACES) {
      expect(read(file)).not.toContain("components/skills");
    }
  });
});
