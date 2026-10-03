/**
 * U19 · The canvas waits for Build.
 *
 * /work/composer shipped 524 KB of route scripts against a target of 160: U9
 * put the workflow canvas behind next/dynamic, which defers it but still
 * loads it on the route, and the Run tab, a form and a list, never needs it
 * (the UI review of 2026-09-08, P3). The canvas mounts the first time the
 * Build tab is opened and stays mounted after, so a look at a running
 * workflow still does not throw away what is on the board (T-0106, D7).
 * The bytes are the walk's to measure; this holds the guard.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

describe("U19 · the canvas waits for Build", () => {
  const page = read("src/app/work/composer/page.tsx");

  it("mounts the canvas only once Build has been opened, and keeps it", () => {
    expect(page).toMatch(/const \[buildOpened, setBuildOpened\] = useState\(false\)/);
    const canvas = page.indexOf("<WorkflowCanvas");
    const guard = page.lastIndexOf("buildOpened", canvas);
    expect(guard).toBeGreaterThan(-1);
    // The guard is the nearest thing above the canvas, not a comment far away.
    expect(canvas - guard).toBeLessThan(200);
    // Once opened it is not unmounted by a switch back to Run: the hidden
    // wrapper stays.
    expect(page).toMatch(/<div hidden=\{mode !== "build"\}>/);
  });

  it("the Build tab is what opens it", () => {
    expect(page).toMatch(/setBuildOpened\(true\)/);
  });
});
