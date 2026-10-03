/**
 * @jest-environment node
 *
 * K0 · The decision register is complete.
 *
 * The review left 110 findings that only the operator can rule. A register that
 * quietly drops one is worse than no register, because the finding then looks
 * settled. This reads the committed files and refuses four things: an OP
 * finding with no disposition, an entry with no ruling line, a question the
 * repository's own decision queue does not carry, and a folded question with no
 * answer under it.
 *
 * It pins structure, never wording. A ruling may read "pending" or the
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

/**
 * A finding the review marked OP that a sceptic returned to the executor's free
 * band appears as a bullet with its reason instead of a heading. Either
 * disposition is complete; silence is not.
 */
function freeBandIds(register: string): Set<string> {
  const section = register.split("## Decisions the executor takes")[1] ?? "";
  const ids = new Set<string>();
  for (const m of section.matchAll(/^- \*\*([A-Za-z0-9-]+)\*\* /gm)) ids.add(m[1]);
  return ids;
}

describe("K0 · the decision register is complete", () => {
  const index = read("org", "reviews", "2026-09-codebase-review.md");
  const register = read("org", "reviews", "2026-09-decision-register.md");
  const questions = read("org", "QUESTIONS.md");

  it("carries a disposition for every finding the review marks OP", () => {
    const ids = operatorIds(index);
    expect(ids.length).toBe(110);

    const ruled = registerIds(register);
    const free = freeBandIds(register);
    // A finding that hid two decisions is split: critic-03 -> critic-03a, -03b.
    const has = (set: Set<string>, id: string) =>
      set.has(id) || [..."abcdefgh"].some((suffix) => set.has(id + suffix));
    expect(ids.filter((id) => !has(ruled, id) && !has(free, id))).toEqual([]);
  });

  it("gives every entry a ruling line, so nothing looks settled that is not", () => {
    const blocks = register.split(/^#### /m).slice(1);
    const withoutRuling = blocks
      .filter((block) => !/^- \*\*Ruling:\*\*/m.test(block))
      .map((block) => block.split(" ·")[0]);
    expect(withoutRuling).toEqual([]);
  });

  it("raises every register question in the repository's decision queue", () => {
    const asked = [...register.matchAll(/^### (Q-\d{3}) · /gm)].map((m) => m[1]);
    expect(asked.length).toBeGreaterThanOrEqual(8);

    const unraised = asked.filter((id) => !questions.includes("- " + id + " ("));
    expect(unraised).toEqual([]);
  });

  it("gives a folded question its answer, so the queue says what was decided", () => {
    const folded = questions.split("## Folded")[1] ?? "";
    const ids = [...folded.matchAll(/^- (Q-\d{3}) \(/gm)].map((m) => m[1]);
    expect(ids.length).toBeGreaterThanOrEqual(8);

    const withoutAnswer = ids.filter((id) => {
      const at = folded.indexOf("- " + id + " (");
      const next = folded.indexOf("\n- Q-", at + 1);
      const body = folded.slice(at, next === -1 ? undefined : next);
      return !body.includes("Answer, from the");
    });
    expect(withoutAnswer).toEqual([]);
  });
});
