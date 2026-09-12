/**
 * @jest-environment node
 *
 * K0 · The decision register is complete.
 *
 * The review left 110 findings that only the operator can rule. A register that
 * quietly drops one is worse than no register, because the finding then looks
 * settled. This reads the committed files and refuses three things: an OP
 * finding with no entry, an entry with no ruling line, and a question in the
 * register that the repository's own decision queue does not carry.
 *
 * It pins structure, never wording: a ruling may read "pending" or the
 * operator's answer, and the register's prose is free to change.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), "utf-8");

/** An id the index marks OP, e.g. "- `critic-02` [security, ...] **OP** ..." */
function operatorIds(index: string): string[] {
  const ids: string[] = [];
  for (const line of index.split("\n")) {
    if (!line.startsWith("- `") || !line.includes("**OP**")) continue;
    const id = /^- `([a-z-]+-\d+)`/.exec(line)?.[1];
    if (id) ids.push(id);
  }
  return ids;
}

/** Register headings are "#### <id> · title"; a split finding reads id + a letter. */
function registerIds(register: string): Set<string> {
  const ids = new Set<string>();
  for (const line of register.split("\n")) {
    const id = /^#### ([A-Za-z0-9-]+) ·/.exec(line)?.[1];
    if (id) ids.add(id);
  }
  return ids;
}

describe("K0 · the decision register is complete", () => {
  const index = read("org", "reviews", "2026-09-codebase-review.md");
  const register = read("org", "reviews", "2026-09-decision-register.md");
  const questions = read("org", "QUESTIONS.md");

  it("carries an entry for every finding the review marks OP", () => {
    const ids = operatorIds(index);
    expect(ids.length).toBe(110);

    const present = registerIds(register);
    // A finding that hid two decisions is split: critic-03 -> critic-03a, -03b.
    const covered = (id: string) => present.has(id) || [..."abcdefgh"].some((s) => present.has(id + s));
    expect(ids.filter((id) => !covered(id))).toEqual([]);
  });

  it("gives every entry a ruling line, so nothing looks settled that is not", () => {
    const blocks = register.split(/^#### /m).slice(1);
    const withoutRuling = blocks
      .filter((b) => !/^- \*\*Ruling:\*\*/m.test(b))
      .map((b) => b.split(" ·")[0]);
    expect(withoutRuling).toEqual([]);
  });

  it("raises every register question in the repository's decision queue", () => {
    const asked = [...register.matchAll(/^### (Q-\d{3}) · /gm)].map((m) => m[1]);
    expect(asked.length).toBeGreaterThanOrEqual(8);

    const open = questions.split("## Folded")[0];
    const unraised = asked.filter((q) => !open.includes(`- ${q} (`));
    expect(unraised).toEqual([]);
  });
});
