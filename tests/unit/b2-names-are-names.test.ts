/** @jest-environment node */
/**
 * B2 (T-0096), D118 and D119: two name gates that could be satisfied without a
 * name.
 *
 * D118. check-form-control-names says "a placeholder is not a name" and then
 * accepted aria-label="Search skills..." beside placeholder="Search skills...",
 * twenty times. The same string is the same non-name.
 *
 * D119. The collapsed sidebar rendered thirty links as a bare icon, and the
 * icon-button gate only looked at buttons, so a screen reader heard "link"
 * thirty times with no destination.
 */
import { classifyControls, scanTree as scanControls, verdict as controlsVerdict } from "../../scripts/tooling/check-form-control-names.mjs";
import { classifyButtons, scanTree as scanButtons } from "../../scripts/tooling/check-icon-button-names.mjs";

describe("D118: a placeholder pasted into aria-label is still a placeholder", () => {
  it.each([
    ["verbatim", `<input placeholder="Search skills..." aria-label="Search skills..." />`],
    ["without the ellipsis", `<input placeholder="Search skills..." aria-label="Search skills" />`],
    ["with a unicode ellipsis", `<textarea placeholder="Describe it…" aria-label="Describe it" />`],
    ["in title", `<input placeholder="Your name" title="Your name" />`],
    ["differing only in case", `<input placeholder="Theme name..." aria-label="theme name" />`],
  ])("is unnamed %s", (_why, jsx) => {
    const r = classifyControls(`const A = () => ${jsx};`);
    expect(r.unnamed).toHaveLength(1);
    expect(r.placeholderOnly).toHaveLength(1);
  });

  it("a label that says something the placeholder does not is a name", () => {
    const r = classifyControls(`const A = () => <input placeholder="e.g. Nightly triage" aria-label="Mission name" />;`);
    expect(r.unnamed).toHaveLength(0);
  });

  it("the tree passes the sharper gate", () => {
    const counts = scanControls();
    expect(counts.offenders).toEqual([]);
    expect(controlsVerdict(counts).ok).toBe(true);
  });
});

describe("D119: an icon-only link needs a name like an icon-only button", () => {
  it("flags a <Link> whose text is conditional", () => {
    const r = classifyButtons(
      `export const C = () => <Link href="/x" onClick={f}><Zap className="w-4" />{!collapsed && <span>Chat</span>}</Link>;`,
    );
    expect(r.unnamed).toHaveLength(1);
  });

  it("flags a bare <a> with only an icon", () => {
    const r = classifyButtons(`export const C = () => <a href="/x"><Zap className="w-4" /></a>;`);
    expect(r.unnamed).toHaveLength(1);
  });

  it("accepts the same link with an aria-label", () => {
    const r = classifyButtons(
      `export const C = () => <Link href="/x" aria-label={link.label}><Zap className="w-4" />{!collapsed && <span>Chat</span>}</Link>;`,
    );
    expect(r.unnamed).toHaveLength(0);
  });

  it("does not count a link that always renders text", () => {
    const r = classifyButtons(`export const C = () => <Link href="/x"><Zap className="w-4" /> Chat</Link>;`);
    expect(r.unnamed).toHaveLength(0);
  });

  it("the tree has no unnamed icon-only link or button", () => {
    const c = scanButtons();
    expect(c.offenders).toEqual([]);
  });
});
