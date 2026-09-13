/**
 * U15 · The dead are gone.
 *
 * Three modules no entrypoint reaches, with the three test files that kept
 * them green. Three API routes with zero callers, documented in api.md with
 * two rows that were wrong about what the UI does. A runtime dependency,
 * `motion` (669 KB, pulling framer-motion at 5.5 MB), serving three wrappers
 * used by two files, when globals.css already ships the float-in they
 * perform. Three stylesheet rules that match nothing in the tree.
 *
 * The wrappers keep their names and their callers; they are CSS now. Stagger
 * is a class the stylesheet staggers by child order, Collapse mounts its
 * children when open and not otherwise, which is what AnimatePresence left
 * behind once its exit had run, and both honour reduced motion for free,
 * because U14 made the reduce rule universal.
 */

import { render, screen } from "@testing-library/react";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { Collapse, Stagger, StaggerItem } from "@/components/motion";

const ROOT = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const gone = (p: string) => !existsSync(join(ROOT, p));

describe("U15 · the dead are gone", () => {
  it("the three unreachable modules and their three tests", () => {
    for (const p of [
      "src/lib/runtime/run-trajectory.ts",
      "src/lib/llm-judge.ts",
      "src/lib/sessions/session-window.ts",
      "tests/unit/run-trajectory.test.ts",
      "tests/unit/llm-judge.test.ts",
      "tests/unit/session-window.test.ts",
    ]) {
      expect({ [p]: gone(p) }).toEqual({ [p]: true });
    }
    // Named dead by the reconnaissance, and wrong: the docs checker imports it.
    expect(gone("src/lib/help/concept-attachments.ts")).toBe(false);
  });

  it("the three orphan routes, and their rows in api.md", () => {
    for (const p of [
      "src/app/api/agent/profiles/sync/drift/route.ts",
      "src/app/api/cron/hardware/meta/route.ts",
      "src/app/api/missions/[id]/dispatch/route.ts",
    ]) {
      expect({ [p]: gone(p) }).toEqual({ [p]: true });
    }
    const api = read("docs/reference/api.md");
    expect(api).not.toMatch(/\/api\/agent\/profiles\/sync\/drift/);
    expect(api).not.toMatch(/\/api\/cron\/hardware\/meta/);
    expect(api).not.toMatch(/\/api\/missions\/\[id\]\/dispatch/);
    // The neighbour that stays, so the deletion did not take the wrong row.
    expect(api).toMatch(/\/api\/models\/sync\/drift/);
  });

  it("the motion dependency, and the stylesheet's three orphans", () => {
    const pkg = JSON.parse(read("package.json")) as { dependencies: Record<string, string> };
    expect(pkg.dependencies.motion).toBeUndefined();
    expect(read("src/components/motion/index.tsx")).not.toMatch(/motion\/react|framer-motion/);

    const css = read("src/app/globals.css");
    for (const selector of [".animate-in", ".ps-rail-done", ".skeleton-shimmer"]) {
      expect({ [selector]: new RegExp(`^\\${selector}\\b`, "m").test(css) }).toEqual({ [selector]: false });
    }
    expect(css).not.toMatch(/@keyframes slide-in-from-bottom/);
    expect(css).not.toMatch(/@keyframes skeleton-shimmer/);
    // The stagger the wrappers now lean on.
    expect(css).toMatch(/\.ps-stagger\s*>\s*\*/);
  });
});

describe("U15 · the wrappers, in CSS", () => {
  it("Stagger is a class the stylesheet staggers, and its items are plain", () => {
    render(
      <Stagger className="grid">
        <StaggerItem>
          <span>one</span>
        </StaggerItem>
        <StaggerItem>
          <span>two</span>
        </StaggerItem>
      </Stagger>,
    );
    const one = screen.getByText("one");
    const stagger = one.closest(".ps-stagger");
    expect(stagger).not.toBeNull();
    expect(stagger).toHaveClass("grid");
    expect(stagger!.children).toHaveLength(2);
  });

  it("Collapse mounts its children when open and not otherwise", () => {
    const { rerender } = render(
      <Collapse open={false}>
        <p>hidden until asked</p>
      </Collapse>,
    );
    expect(screen.queryByText("hidden until asked")).toBeNull();
    rerender(
      <Collapse open>
        <p>hidden until asked</p>
      </Collapse>,
    );
    expect(screen.getByText("hidden until asked")).toBeVisible();
  });
});
