/** @jest-environment node */

// T-0071 acceptance oracle — five console defects that all share one shape: the
// product knows the answer and does not hand it over.
//
// F7 A BUTTON INSIDE A BUTTON, THREE DEEP. Every Chat conversation row is a
// `<button>` wrapping three more: Download-JSON, an "as CSV" button nested
// inside that one's hover group, and Delete. Nested interactive content is
// invalid HTML -- browsers recover by hoisting the inner elements out of the
// outer button, which is why the hover-revealed CSV button behaves
// unpredictably -- and it is unusable with a keyboard or a screen reader, which
// cannot address a control that is not in the tree where the markup put it.
//
// The gate that should have caught it walks every button in the tree and never
// asks whether one contains another. This adds that, because the reason F7
// shipped is not that nobody looked -- it is that the thing that looks was not
// looking for this.
//
// Its siblings cover the rest of T-0071: logs-404-can-self-correct (F8),
// monitor-selfpid-crosses-the-wire (F10) and mission-verbs-say-what-to-send
// (F6). Split by MOCK STACK rather than by theme -- one subject per file, so no
// assertion here is standing on a fake of the thing it is about.
//
// F8 /logs 404s AND CANNOT RECOVER. `activeLog` initialises to a hard-coded
// "agent". The route computes `availableLogs` and then DISCARDS it on the 404
// path, so the page's "auto-select the first available log" effect can never
// receive the list it needs. An install whose logs directory has no agent.log
// 404s on every load, forever, with a working file list one field away.
//
// F11 THE MODEL NAMES THE CHAPTER AND NOBODY CHECKS. `title: ch.title` takes
// the model's string verbatim -- any length, newlines included -- into a field
// the reader renders in a heading and a navigation list.
//
// F10 selfPid IS A WIRE FIELD, AND TYPES DO NOT SURVIVE JSON. The scheduler pill
// says "this process will not dispatch" only when selfPid and ownerPid disagree.
// If selfPid stops crossing the wire the pill silently stops warning, and
// TypeScript cannot see it: /api/monitor's response is parsed as `any` by
// whatever fetches it.
//
// F6 TWO ERRORS THAT NAME THE VERB AND NOT THE CALL. "Use promote for draft or
// queued missions" and "Use re-dispatch for completed missions" tell an operator
// which word to use and not what to send, and neither enumerates the modes.

import { readFileSync } from "fs";
import { join } from "path";

import { classifyButtons, scanTree, verdict } from "../../scripts/tooling/check-icon-button-names.mjs";

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf-8");

describe("the gate learns to see a button inside a button", () => {
  it("reports a nested button", () => {
    // Fixture-driven, not tree-driven. The floors in the script prove the walk
    // still finds things; only a fixture proves the matcher still matches.
    const r = classifyButtons(
      `export const A = () => (
         <button onClick={x}>
           <span>Title</span>
           <button aria-label="Delete"><X /></button>
         </button>
       );`,
    );
    expect(r.nested).toHaveLength(1);
    // The .mjs gate is untyped, so `nested` widens to never[] under the tests
    // tsconfig; the assertion is on the value, not the shape.
    expect((r.nested as { line: number }[])[0].line).toBe(4);
  });

  it("reports one three deep, which is the shape that actually shipped", () => {
    const r = classifyButtons(
      `export const A = () => (
         <button onClick={x}>
           <div className="group/download">
             <button aria-label="Download"><D /></button>
             <div className="hidden group-hover/download:block">
               <button onClick={y}>as CSV</button>
             </div>
           </div>
         </button>
       );`,
    );
    // Both inner buttons are inside the outer one; the CSV button is inside two.
    expect(r.nested).toHaveLength(2);
  });

  it("CONTROL: siblings are not nesting", () => {
    // The fix turns the outer button into a container with the actions beside
    // the label. If that reads as nested, the gate would block its own remedy.
    const r = classifyButtons(
      `export const A = () => (
         <div className="group">
           <button onClick={x}>Title</button>
           <button aria-label="Delete"><X /></button>
         </div>
       );`,
    );
    expect(r.nested).toHaveLength(0);
    expect(r.buttons).toBe(2);
  });

  it("CONTROL: it still counts and names buttons exactly as before", () => {
    // The addition must not disturb what the gate already does. An icon-only
    // button with no accessible name is still the offence it was.
    const r = classifyButtons(
      `export const A = () => (
         <div>
           <button onClick={x}><X /></button>
           <button aria-label="Named"><X /></button>
         </div>
       );`,
    );
    expect(r.buttons).toBe(2);
    expect(r.iconOnly).toBe(2);
    expect(r.unnamed).toHaveLength(1);
    expect(r.nested).toHaveLength(0);
  });
});

describe("the Chat sidebar stops nesting its controls", () => {
  it("has no nested buttons left", () => {
    // The defect itself, measured on the real file rather than described.
    const r = classifyButtons(
      read("src", "app", "work", "chat", "page.tsx"),
      "chat/page.tsx",
    );
    expect(r.nested).toEqual([]);
  });

  it("and neither does anywhere else", () => {
    // Chat is where it was found; this is what stops the next one. Over the real
    // tree, with the same denominator the gate prints -- a sweep that asserts
    // zero without saying zero OF WHAT is the failure mode T-0062 was filed for.
    const counts = scanTree();
    expect(counts.buttonsSeen).toBeGreaterThan(250);
    expect(counts.nested).toEqual([]);
  });
});

describe("a chapter title is bounded", () => {
  it("keeps a sensible title as it is", async () => {
    const { chapterTitle } = await import("@/modules/rec-room/lib/chapter-title");
    expect(chapterTitle("The Long Road Home", 3)).toBe("The Long Road Home");
  });

  it("clamps a title long enough to break the heading it is rendered in", async () => {
    const { chapterTitle } = await import("@/modules/rec-room/lib/chapter-title");
    const out = chapterTitle("x".repeat(500), 3);
    expect(out.length).toBeLessThanOrEqual(80);
  });

  it("strips newlines, which a heading and a nav list both render as one line", async () => {
    const { chapterTitle } = await import("@/modules/rec-room/lib/chapter-title");
    expect(chapterTitle("The Road\nHome\r\nAgain", 3)).toBe("The Road Home Again");
  });

  it("falls back to the name the file already uses when the model gives nothing", async () => {
    // `Chapter ${i + 1}` is the outline fallback a few lines up. A blank or
    // whitespace-only title must land on the same string rather than on "".
    const { chapterTitle } = await import("@/modules/rec-room/lib/chapter-title");
    expect(chapterTitle("", 3)).toBe("Chapter 4");
    expect(chapterTitle("   \n  ", 0)).toBe("Chapter 1");
    expect(chapterTitle(undefined, 1)).toBe("Chapter 2");
  });

  it("is what create.ts actually uses", async () => {
    // The helper being correct is worth nothing if the handler still takes
    // ch.title verbatim, and only this line connects them.
    expect(read("src", "modules", "rec-room", "handlers", "create.ts")).toMatch(
      /chapterTitle\(/,
    );
  });
});

describe("the gate FAILS on a nested button, not merely reports one", () => {
  // Found by mutation: deleting the nested branch's exit left everything green,
  // because every assertion above drives the CLASSIFIER and none of them drove
  // the verdict. A gate that prints and returns 0 is decoration.
  const healthy = { filesScanned: 228, buttonsSeen: 394, iconOnlySeen: 77, offenders: [], nested: [] };

  it("exits non-zero and says which files", () => {
    const v = verdict({ ...healthy, nested: ["src/a.tsx:12 <button>"] });
    expect(v.code).toBe(1);
    expect(v.message).toContain("src/a.tsx:12");
    expect(v.message).toMatch(/inside another button/);
  });

  it("still exits non-zero for an unnamed button", () => {
    const v = verdict({ ...healthy, offenders: ["src/b.tsx:9 <button>"] });
    expect(v.code).toBe(1);
    expect(v.message).toContain("src/b.tsx:9");
  });

  it("still refuses a population too small to have inspected anything", () => {
    expect(verdict({ ...healthy, buttonsSeen: 3 }).code).toBe(1);
    expect(verdict({ ...healthy, iconOnlySeen: 0 }).code).toBe(1);
    expect(verdict({ ...healthy, filesScanned: 4 }).code).toBe(1);
  });

  it("GREEN CONTROL: a healthy tree exits zero and prints the denominator", () => {
    const v = verdict(healthy);
    expect(v.code).toBe(0);
    expect(v.message).toContain("394 button elements");
    expect(v.message).toContain("0 nested");
  });

  it("and the real tree is one", () => {
    expect(verdict(scanTree()).code).toBe(0);
  });
});
