/** @jest-environment node */
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Narrow declaration contract only. Existing motion/token suites retain their
// exact palette, timing and reduced-motion preservation assertions.
describe("T0191 unused RGB declaration removal", () => {
  it.each(["purple", "green", "pink", "orange"])("removes only the ruled unused %s RGB mirror declaration", (colour) => {
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    expect(css).not.toMatch(new RegExp(`--ps-rgb-neon-${colour}\\s*:`));
  });
});
