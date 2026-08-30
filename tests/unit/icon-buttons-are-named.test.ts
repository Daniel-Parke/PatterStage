/** @jest-environment node */
/**
 * T-0050 · An icon-only button says what it does.
 *
 * A button whose entire content is an SVG icon has no accessible name unless
 * something supplies one. To a screen reader it is "button", and to any
 * automated pass it is indistinguishable from a control with no purpose. Five
 * of these existed, and three of them were the only way to close the UI they
 * sat in: an assistive-technology user got an unnamed button as the sole exit.
 *
 * This codebase leans on `title` (112 uses against 27 `aria-label`). `title` IS
 * a valid accessible-name source per HTML-AAM, so it counts here, but it is the
 * weaker mechanism: it is not exposed on touch, not exposed to keyboard-only
 * users, and some assistive-technology verbosity settings suppress it. New
 * controls should prefer `aria-label`; this check enforces the floor, not the
 * preference.
 *
 * Line-oriented rather than parsed, per WG-WEB-013, and therefore deliberately
 * narrow: it catches the single-line `<button …><Icon /></button>` shape, which
 * is the shape all five offenders had. A multi-line button is out of scope
 * rather than guessed at.
 */

import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

const SRC = join(__dirname, "..", "..", "src");

function tsxFiles(dir = SRC, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) tsxFiles(full, out);
    else if (entry.endsWith(".tsx")) out.push(full);
  }
  return out;
}

/** `<button …>` … `<Icon … />` … `</button>` all on one line, with no text. */
const ONE_LINE_ICON_BUTTON =
  /<button\b([^>]*)>\s*<[A-Z][\w]*\s[^>]*\/>\s*<\/button>/;

const NAMED = /aria-label=|aria-labelledby=|title=/;

describe("an icon-only button has an accessible name", () => {
  const files = tsxFiles();

  it("finds components to check, so an empty scan cannot read as a pass", () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it("names every single-line icon button", () => {
    const offenders: string[] = [];
    for (const file of files) {
      readFileSync(file, "utf-8")
        .split(/\r?\n/)
        .forEach((line, i) => {
          const m = ONE_LINE_ICON_BUTTON.exec(line);
          if (!m) return;
          if (NAMED.test(m[1])) return;
          const rel = file.replace(/\\/g, "/").split("/src/")[1];
          offenders.push(`src/${rel}:${i + 1}  ${line.trim().slice(0, 90)}`);
        });
    }
    expect(offenders).toEqual([]);
  });
});
