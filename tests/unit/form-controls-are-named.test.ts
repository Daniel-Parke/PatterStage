/** @jest-environment node */

// The companion test to scripts/tooling/check-form-control-names.mjs.
//
// The gate's floors catch "the walk found nothing". They cannot catch "the
// classifier stopped classifying", because a classifier that judges everything
// NAMED empties the offender list while every floor stays green — which is
// exactly how the check that check-icon-button-names.mjs replaced shipped 26
// unnamed buttons while reporting success.
//
// So this drives the classifier with fixtures in both directions, and it drives
// the VERDICT separately. That second half is the T-0071 lesson: mutation showed
// that deleting a gate's `process.exit(1)` left every assertion green, because
// every test exercised the classifier and none exercised the decision. A gate
// that reports and does not fail the build is decoration.

import { classifyControls, verdict } from "../../scripts/tooling/check-form-control-names.mjs";

const OK_FLOORS = { filesScanned: 229, filesWithControls: 43, controlsSeen: 100 };

function counts(over: Partial<Record<string, unknown>> = {}) {
  return { ...OK_FLOORS, placeholderOnly: 0, offenders: [], ...over };
}

describe("what counts as named", () => {
  it("aria-label names a control", () => {
    const r = classifyControls(`const A = () => <input aria-label="Search" />;`);
    expect(r.controls).toBe(1);
    expect(r.unnamed).toHaveLength(0);
  });

  it("aria-labelledby names a control", () => {
    expect(
      classifyControls(`const A = () => <select aria-labelledby="h1"><option /></select>;`).unnamed,
    ).toHaveLength(0);
  });

  it("a <label htmlFor> elsewhere in the file names it", () => {
    // The structural case, and the reason this is a parser and not a regex: the
    // two halves can be any distance apart.
    const src = `const A = () => (<div>
      <label htmlFor="name">Name</label>
      <div><span><input id="name" /></span></div>
    </div>);`;
    expect(classifyControls(src).unnamed).toHaveLength(0);
  });

  it("being wrapped in a <label> that renders text names it", () => {
    const src = `const A = () => (<label>Name <input /></label>);`;
    expect(classifyControls(src).unnamed).toHaveLength(0);
  });

  it("a hidden input needs no name and is not even counted", () => {
    const r = classifyControls(`const A = () => <input type="hidden" value="x" />;`);
    expect(r.controls).toBe(0);
    expect(r.unnamed).toHaveLength(0);
  });
});

describe("what does NOT count as named", () => {
  it("a placeholder is not a name", () => {
    // The single most important assertion in the file. Five of the eight
    // offenders a browser pass found were placeholder-only, and a gate that
    // accepted this would have blessed them on day one.
    const r = classifyControls(`const A = () => <input placeholder="Your name" />;`);
    expect(r.unnamed).toHaveLength(1);
    expect(r.placeholderOnly).toHaveLength(1);
  });

  it("a bare select is not named by its options", () => {
    const src = `const A = () => (<select><option value="a">Alpha</option></select>);`;
    expect(classifyControls(src).unnamed).toHaveLength(1);
  });

  it("a <label> that does NOT wrap the control does not name it", () => {
    // Adjacent is not associated. This is the shape most of the real offenders
    // had: a perfectly good visible label sitting beside a control with no
    // htmlFor and no id to point at.
    const src = `const A = () => (<div><label>Role</label><select><option /></select></div>);`;
    expect(classifyControls(src).unnamed).toHaveLength(1);
  });

  it("an htmlFor pointing at a DIFFERENT id does not name it", () => {
    const src = `const A = () => (<div>
      <label htmlFor="other">Name</label>
      <input id="name" />
    </div>);`;
    expect(classifyControls(src).unnamed).toHaveLength(1);
  });

  it("a wrapping label with no text does not name it", () => {
    const src = `const A = () => (<label><input /></label>);`;
    expect(classifyControls(src).unnamed).toHaveLength(1);
  });

  it("a name that exists in only one state is not a name", () => {
    // Same rule as the icon-button gate: the wrapping label's text has to
    // survive both branches.
    const src = `const A = ({ armed }: { armed: boolean }) => (<label>{armed ? "Confirm" : ""}<input /></label>);`;
    expect(classifyControls(src).unnamed).toHaveLength(1);
  });
});

describe("the exemption pragma", () => {
  it("exempts a control when a reason is given", () => {
    const src = `const A = () => (
  // form-control-names-disable-next-line -- a pass-through that cannot supply one
  <input placeholder="x" />
);`;
    expect(classifyControls(src).unnamed).toHaveLength(0);
  });

  it("does NOT exempt without a reason", () => {
    // An escape hatch with no cost is an escape hatch everybody takes.
    const src = `const A = () => (
  // form-control-names-disable-next-line
  <input placeholder="x" />
);`;
    expect(classifyControls(src).unnamed).toHaveLength(1);
  });

  it("does NOT exempt on a reason too short to be one", () => {
    const src = `const A = () => (
  // form-control-names-disable-next-line -- nope
  <input placeholder="x" />
);`;
    expect(classifyControls(src).unnamed).toHaveLength(1);
  });
});

describe("the verdict, which is the half that fails the build", () => {
  it("passes a clean scan", () => {
    expect(verdict(counts()).code).toBe(0);
  });

  it("FAILS when there are offenders", () => {
    expect(verdict(counts({ offenders: ["a.tsx:1 <input>"] })).code).toBe(1);
  });

  it("names every offender in the message, not just a count", () => {
    const v = verdict(counts({ offenders: ["a.tsx:1 <input>", "b.tsx:9 <select>"] }));
    expect(v.message).toContain("a.tsx:1");
    expect(v.message).toContain("b.tsx:9");
  });

  it("explains the placeholder rule when a placeholder is involved", () => {
    // The offender most likely to be argued with is the one whose author
    // believed they HAD labelled it. The message answers that in advance.
    const v = verdict(counts({ offenders: ["a.tsx:1 <input>"], placeholderOnly: 1 }));
    expect(v.message).toMatch(/placeholder is NOT a name/i);
  });

  it("REFUSES to pass on a population that has collapsed", () => {
    // Guard the guard. Both floors are on the noun the rule is about.
    expect(verdict(counts({ controlsSeen: 3 })).code).toBe(1);
    expect(verdict(counts({ filesScanned: 4 })).code).toBe(1);
  });

  it("says WHY it refused, rather than reporting a clean run", () => {
    const v = verdict(counts({ controlsSeen: 3 }));
    expect(v.message).toMatch(/refusing to pass/i);
    expect(v.message).toContain("floor");
  });

  it("a collapsed population fails even with zero offenders", () => {
    // The exact failure mode this exists for: a broken walk reports no
    // offenders, which reads identically to a clean tree.
    expect(verdict(counts({ controlsSeen: 0, offenders: [] })).code).toBe(1);
  });
});
