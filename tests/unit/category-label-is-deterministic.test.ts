/**
 * @jest-environment node
 *
 * T-0053 acceptance oracle — a category renders the same label whatever order
 * the catalogue arrives in.
 *
 * The QA pass reported this as a regression in the T-0037 dedup: "CONTROL HUB
 * and CONTROLHUB render as separate rows". That claim is REFUTED. `CONTROLHUB`
 * has no separator, so it title-cases to `Controlhub`, a different label from
 * `Control Hub`, and the module says in as many words that a spelling which
 * renders differently keeps its own bucket. Two rows with two different labels
 * is the design working.
 *
 * But the observation was not nothing, and chasing it found a real defect in
 * the code T-0037 shipped, which is mine.
 *
 * `titleCaseCategory` upper-cases the first letter of each word and never
 * lowercases the rest, so `CONTROL HUB` renders as `CONTROL HUB`. All four of
 * `Control Hub`, `control-hub`, `control_hub` and `CONTROL HUB` land in ONE
 * bucket, correctly. But `skills-page-helpers.ts` takes that bucket's label from
 * `items[0].category` — the first row the catalogue happened to return. So the
 * heading reads `Control Hub` or `CONTROL HUB` depending on data order.
 *
 * That is precisely the failure the module's own comment says the design exists
 * to prevent:
 *
 *   "merging labels that do not match would leave the header text depending on
 *    whichever row the catalogue returned first"
 *
 * It is also what the QA agent actually saw: a shouting row heading.
 */

import { groupCategories } from "@/lib/skills-page-helpers";
import { groupByCategory, titleCaseCategory } from "@/lib/skills-grouping";

const skill = (name: string, category: string) =>
  ({ name, category, description: "", enabled: true }) as never;

describe("titleCaseCategory normalises case, not just word boundaries", () => {
  it("renders a SHOUTED category the same as a quiet one", () => {
    expect(titleCaseCategory("CONTROL HUB")).toBe("Control Hub");
    expect(titleCaseCategory("control hub")).toBe("Control Hub");
    expect(titleCaseCategory("control-hub")).toBe("Control Hub");
    expect(titleCaseCategory("Control_Hub")).toBe("Control Hub");
  });

  it("still honours the module's stated invariant", () => {
    // titleCaseCategory(raw).toLowerCase() === the grouping key. If this breaks,
    // a bucket and its heading can disagree again.
    for (const raw of ["CONTROL HUB", "control-hub", "Fine_Tuning", "mlops", "A"]) {
      const key = groupByCategory([{ category: raw }])[0][0];
      expect(titleCaseCategory(raw).toLowerCase()).toBe(key);
    }
  });

  it("keeps a separator-free spelling in its own bucket, as designed", () => {
    // NOT the reported bug. `Controlhub` is a different label from `Control
    // Hub`, so merging them would make the heading depend on data order, which
    // is the thing this whole design avoids.
    const groups = groupByCategory([{ category: "Control Hub" }, { category: "CONTROLHUB" }]);
    expect(groups).toHaveLength(2);
  });
});

describe("a bucket's heading does not depend on catalogue order", () => {
  const A = [skill("a", "CONTROL HUB"), skill("b", "control-hub"), skill("c", "Control Hub")];
  const B = [skill("c", "Control Hub"), skill("a", "CONTROL HUB"), skill("b", "control-hub")];

  it("renders one row for the four spellings", () => {
    expect(groupCategories(A)).toHaveLength(1);
  });

  it("renders the SAME heading whichever spelling came back first", () => {
    const [first] = groupCategories(A);
    const [second] = groupCategories(B);
    expect(first.category).toBe(second.category);
    expect(first.category).toBe("Control Hub");
  });

  it("never lets a shouted row set the heading", () => {
    const shoutedFirst = groupCategories([skill("a", "CONTROL HUB"), skill("b", "control hub")]);
    expect(shoutedFirst[0].category).toBe("Control Hub");
  });
});
