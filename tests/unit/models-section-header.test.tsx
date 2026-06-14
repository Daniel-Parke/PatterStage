/**
 * @jest-environment jsdom
 *
 * Unit test for the `ModelsSectionHeader` component extraction
 * (List 4 refactor — session carryover). Pre-extraction: the same
 * 3-line `<h2>` chrome (`text-sm font-bold text-white/70 uppercase
 * tracking-wider flex items-center gap-2` + the icon with
 * `w-4 h-4 text-neon-{color}[/60]`) was inlined in 3 sibling
 * Models-* section components
 * (`ModelsTableSection`, `ModelsAgentDefaultSection`,
 * `ModelsTaskDefaultsSection`). Post-extraction: all 3 call sites
 * delegate to this shared component, with `iconTone` variant to
 * match the 2 visual variants in the wild ("full" vs "muted").
 *
 * The test pins the post-extraction shape with positive + negative
 * assertions:
 *   1. The shared component renders the h2 with the canonical
 *      className chrome (text-sm, font-bold, text-white/70,
 *      uppercase, tracking-wider, flex, items-center, gap-2) —
 *      this is the contract the 3 call sites depend on.
 *   2. The icon picks the neon-{color} class from `iconColorMap`
 *      (verified by passing a known `color` and asserting the
 *      `text-neon-purple` class lands on the icon).
 *   3. The default `iconTone="full"` adds no opacity modifier;
 *      `iconTone="muted"` adds the `/60` suffix.
 *   4. The title text is rendered as a child of the h2.
 *   5. The 3 call sites in the codebase import the shared
 *      component (not the inline icon imports for the section
 *      header use).
 *   6. None of the 3 call sites render the inline h2 chrome
 *      string (regression guard — a future tweak to the chrome
 *      shouldn't be shadowed by an inline h2 that bypasses it).
 */
import { render, screen } from "@testing-library/react";
import { Database, Star, Settings } from "lucide-react";
import { readFileSync } from "fs";
import { join } from "path";

import ModelsSectionHeader from "@/components/models/ModelsSectionHeader";

const REPO_ROOT = join(__dirname, "..", "..");

describe("ModelsSectionHeader", () => {
  describe("shared-component contract", () => {
    it("renders the h2 with the canonical section-header className chrome", () => {
      render(
        <ModelsSectionHeader icon={Star} title="Agent Default" color="orange" />,
      );
      const h2 = screen.getByRole("heading", { level: 2, name: /agent default/i });
      expect(h2).toHaveClass("text-sm");
      expect(h2).toHaveClass("font-bold");
      expect(h2).toHaveClass("text-white/70");
      expect(h2).toHaveClass("uppercase");
      expect(h2).toHaveClass("tracking-wider");
      expect(h2).toHaveClass("flex");
      expect(h2).toHaveClass("items-center");
      expect(h2).toHaveClass("gap-2");
    });

    it("picks the icon color from iconColorMap[color]", () => {
      render(
        <ModelsSectionHeader
          icon={Database}
          title="Models"
          color="purple"
          iconTone="full"
        />,
      );
      // The Star lucide icon renders an svg with the icon className.
      const h2 = screen.getByRole("heading", { level: 2 });
      const svg = h2.querySelector("svg");
      expect(svg).not.toBeNull();
      expect(svg).toHaveClass("text-neon-purple");
    });

    it("appends /60 to the icon class when iconTone='muted'", () => {
      render(
        <ModelsSectionHeader
          icon={Database}
          title="Models"
          color="purple"
          iconTone="muted"
        />,
      );
      const h2 = screen.getByRole("heading", { level: 2 });
      const svg = h2.querySelector("svg");
      expect(svg).toHaveClass("text-neon-purple/60");
    });

    it("does NOT append /60 when iconTone='full' (the default)", () => {
      // The default is "full" — i.e. no opacity modifier. This is
      // the "Agent Default" variant in the wild.
      render(
        <ModelsSectionHeader
          icon={Star}
          title="Agent Default"
          color="orange"
        />,
      );
      const h2 = screen.getByRole("heading", { level: 2 });
      const svg = h2.querySelector("svg");
      expect(svg).toHaveClass("text-neon-orange");
      expect(svg).not.toHaveClass("text-neon-orange/60");
    });

    it("renders the title text as a child of the h2", () => {
      render(
        <ModelsSectionHeader
          icon={Settings}
          title="Task Defaults"
          color="purple"
          iconTone="muted"
        />,
      );
      const h2 = screen.getByRole("heading", { level: 2 });
      expect(h2).toHaveTextContent(/task defaults/i);
      // The title must be a direct text child of the h2, not a
      // nested element — the section header is a label, not a
      // composite widget.
      expect(h2.textContent).toBe("Task Defaults");
    });
  });

  describe("call-site migration (source-pattern assertions)", () => {
    /**
     * Read the 3 call-site files. The positive + negative assertions
     * catch regressions like "re-introduced the inline h2 chrome
     * string" (negative) and "forgot to import the shared component"
     * (positive).
     */
    const callSites = [
      {
        file: "src/components/models/ModelsTableSection.tsx",
        title: "Models",
      },
      {
        file: "src/components/models/ModelsAgentDefaultSection.tsx",
        title: "Agent Default",
      },
      {
        file: "src/components/models/ModelsTaskDefaultsSection.tsx",
        title: "Task Defaults",
      },
    ] as const;

    it.each(callSites)(
      "$file imports ModelsSectionHeader (positive)",
      ({ file }) => {
        const src = readFileSync(join(REPO_ROOT, file), "utf8");
        expect(src).toMatch(/import\s+ModelsSectionHeader\s+from/);
      },
    );

    it.each(callSites)(
      "$file does NOT inline the section-header h2 chrome string (negative)",
      ({ file }) => {
        const src = readFileSync(join(REPO_ROOT, file), "utf8");
        // The pre-extraction inline form was a 3-line h2 with the
        // exact className string. A regression would re-introduce
        // it. We assert the canonical className combo is NOT
        // present in the file (it's owned by the shared component).
        expect(src).not.toMatch(
          /text-sm font-bold text-white\/70 uppercase tracking-wider/,
        );
      },
    );
  });
});
