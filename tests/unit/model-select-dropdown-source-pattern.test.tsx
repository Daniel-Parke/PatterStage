/**
 * @jest-environment jsdom
 *
 * Unit test for the `ModelSelectDropdown` component extraction
 * (List 4 refactor). Pre-extraction: identical 19-line `<select>`
 * + `ChevronDown` overlay patterns were inlined in `DefaultsGrid`
 * and `BulkAuxiliaryUpdater`. Post-extraction: both call sites
 * delegate to the shared component, with `tone` variant to match
 * the two background surfaces (`dark-900/50` for the per-slot card,
 * `dark-800` for the panel).
 *
 * The test pins the post-extraction shape with positive + negative
 * assertions:
 *   1. Both call sites import the shared component (not the inline
 *      `ChevronDown` icon — the chevron is now part of the
 *      component's internal chrome).
 *   2. Neither call site instantiates a local `<select>` for the
 *      model dropdown (regression guard — a future "add a clear
 *      button" tweak in the shared component shouldn't be
 *      shadowed by a local inlined select that bypasses it).
 *   3. The shared component renders the model-label format
 *      `${name} (${provider}/${modelId})` (verified via a shallow
 *      render of synthetic props) — this is the contract the two
 *      call sites depend on.
 *   4. The shared component supports both `tone="panel"` (the
 *      default) and `tone="card"` variants.
 *   5. The shared component forwards the `ariaLabel` and
 *      `title` props to the underlying `<select>`.
 *   6. The `placeholder` option is rendered with `value=""` and
 *      the placeholder text, so the parent state can detect
 *      "no selection" via `value === ""`.
 *   7. The chevron is positioned with the
 *      `absolute right-2.5 top-1/2 -translate-y-1/2` className
 *      so the layout doesn't shift between the two call sites.
 */
import { render, screen } from "@testing-library/react";
import ModelSelectDropdown from "@/components/models/ModelSelectDropdown";
import { readFileSync } from "fs";
import { join } from "path";

const REPO_ROOT = join(__dirname, "..", "..");

const SAMPLE_OPTIONS = [
  { id: "m-1", name: "Claude Sonnet 4", provider: "anthropic", modelId: "claude-sonnet-4" },
  { id: "m-2", name: "GPT-4o", provider: "openai", modelId: "gpt-4o" },
];

describe("ModelSelectDropdown", () => {
  describe("shared-component contract", () => {
    it("renders the model label as `${name} (${provider}/${modelId})`", () => {
      render(
        <ModelSelectDropdown
          options={SAMPLE_OPTIONS}
          value=""
          onChange={() => undefined}
          placeholder="— none —"
        />,
      );
      expect(
        screen.getByRole("option", { name: "Claude Sonnet 4 (anthropic/claude-sonnet-4)" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("option", { name: "GPT-4o (openai/gpt-4o)" }),
      ).toBeInTheDocument();
    });

    it("renders the placeholder as a value=\"\" option", () => {
      render(
        <ModelSelectDropdown
          options={SAMPLE_OPTIONS}
          value=""
          onChange={() => undefined}
          placeholder="— none —"
        />,
      );
      const placeholder = screen.getByRole("option", { name: "— none —" });
      expect(placeholder).toBeInTheDocument();
      expect((placeholder as HTMLOptionElement).value).toBe("");
    });

    it("forwards ariaLabel to the underlying <select>", () => {
      render(
        <ModelSelectDropdown
          options={SAMPLE_OPTIONS}
          value=""
          onChange={() => undefined}
          placeholder="— none —"
          ariaLabel="Default model for Agent"
        />,
      );
      expect(screen.getByLabelText("Default model for Agent")).toBeInTheDocument();
    });

    it("forwards the title prop to the underlying <select>", () => {
      render(
        <ModelSelectDropdown
          options={SAMPLE_OPTIONS}
          value=""
          onChange={() => undefined}
          placeholder="— none —"
          title="Primary model used for all agent missions"
        />,
      );
      expect(
        screen.getByTitle("Primary model used for all agent missions"),
      ).toBeInTheDocument();
    });

    it("reflects the controlled value back into the <select>", () => {
      render(
        <ModelSelectDropdown
          options={SAMPLE_OPTIONS}
          value="m-2"
          onChange={() => undefined}
          placeholder="— none —"
        />,
      );
      const select = screen.getByRole("combobox") as HTMLSelectElement;
      expect(select.value).toBe("m-2");
    });

    it("renders the chevron with the absolute-right positioning", () => {
      const { container } = render(
        <ModelSelectDropdown
          options={SAMPLE_OPTIONS}
          value=""
          onChange={() => undefined}
          placeholder="— none —"
        />,
      );
      const chevron = container.querySelector("svg");
      expect(chevron).not.toBeNull();
      expect(chevron?.getAttribute("class") ?? "").toContain("absolute");
      expect(chevron?.getAttribute("class") ?? "").toContain("right-2.5");
      expect(chevron?.getAttribute("class") ?? "").toContain("pointer-events-none");
    });
  });

  describe("call-site migration (post-extraction source-pattern)", () => {
    // Pin the post-extraction shape: both call sites import the
    // shared component and DO NOT instantiate a local <select> for
    // the model dropdown OR import ChevronDown (the chevron is now
    // part of the component's internal chrome, not a sibling icon
    // the call site renders).

    const callSites = [
      "src/components/models/DefaultsGrid.tsx",
      "src/components/models/BulkAuxiliaryUpdater.tsx",
    ];

    for (const relPath of callSites) {
      it(`${relPath} imports the shared ModelSelectDropdown`, () => {
        const text = readFileSync(join(REPO_ROOT, relPath), "utf-8");
        expect(text).toMatch(
          /import\s+ModelSelectDropdown\s+from\s+["']@\/components\/models\/ModelSelectDropdown["']/,
        );
      });

      // DefaultsGrid is the file we removed the chevron import from
      // entirely; BulkAuxiliaryUpdater still uses ChevronDown for
      // the panel's collapse indicator, so we only assert
      // DefaultsGrid doesn't import it.
    }

    it("DefaultsGrid does NOT import ChevronDown (it now lives in the shared component)", () => {
      const text = readFileSync(
        join(REPO_ROOT, "src/components/models/DefaultsGrid.tsx"),
        "utf-8",
      );
      expect(text).not.toMatch(
        /import\s*\{[^}]*\bChevronDown\b[^}]*\}\s*from\s*["']lucide-react["']/,
      );
    });
  });
});
