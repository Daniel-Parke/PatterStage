/**
 * @jest-environment jsdom
 *
 * ModelSelectDropdown now delegates to the unified Field Kit `Select` (a custom,
 * keyboard-accessible dropdown — button trigger + listbox, options rendered on
 * open) instead of a native <select>. These tests pin that behaviour plus the
 * call-site source pattern.
 */
import { render, screen, fireEvent } from "@testing-library/react";
import ModelSelectDropdown from "@/components/models/ModelSelectDropdown";
import { readFileSync } from "fs";
import { join } from "path";

const REPO_ROOT = join(__dirname, "..", "..");

const SAMPLE_OPTIONS = [
  { id: "m-1", name: "Claude Sonnet 4", provider: "anthropic", modelId: "claude-sonnet-4" },
  { id: "m-2", name: "GPT-4o", provider: "openai", modelId: "gpt-4o" },
];

function renderDropdown(extra: Partial<React.ComponentProps<typeof ModelSelectDropdown>> = {}) {
  return render(
    <ModelSelectDropdown options={SAMPLE_OPTIONS} value="" onChange={() => undefined} placeholder="— none —" {...extra} />,
  );
}

describe("ModelSelectDropdown (Field Kit Select)", () => {
  it("renders each option's name + provider/modelId hint when opened", () => {
    renderDropdown();
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("Claude Sonnet 4")).toBeInTheDocument();
    expect(screen.getByText("anthropic/claude-sonnet-4")).toBeInTheDocument();
    expect(screen.getByText("GPT-4o")).toBeInTheDocument();
    expect(screen.getByText("openai/gpt-4o")).toBeInTheDocument();
  });

  it("offers the placeholder as a selectable (empty) option", () => {
    renderDropdown();
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("option", { name: "— none —" })).toBeInTheDocument();
  });

  it("selecting an option calls onChange with its id", () => {
    const onChange = jest.fn();
    renderDropdown({ onChange });
    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getByText("GPT-4o"));
    expect(onChange).toHaveBeenCalledWith("m-2");
  });

  it("forwards ariaLabel to the trigger", () => {
    renderDropdown({ ariaLabel: "Default model for Agent" });
    expect(screen.getByLabelText("Default model for Agent")).toBeInTheDocument();
  });

  it("forwards the title prop", () => {
    renderDropdown({ title: "Primary model used for all agent missions" });
    expect(screen.getByTitle("Primary model used for all agent missions")).toBeInTheDocument();
  });

  it("reflects the controlled value in the trigger label", () => {
    renderDropdown({ value: "m-2" });
    expect(screen.getByRole("button")).toHaveTextContent("GPT-4o");
  });

  it("renders a chevron indicator", () => {
    const { container } = renderDropdown();
    expect(container.querySelector("svg")).not.toBeNull();
  });

  describe("call-site source pattern", () => {
    const callSites = ["src/components/models/DefaultsGrid.tsx", "src/components/models/BulkAuxiliaryUpdater.tsx"];
    for (const relPath of callSites) {
      it(`${relPath} imports the shared ModelSelectDropdown`, () => {
        const text = readFileSync(join(REPO_ROOT, relPath), "utf-8");
        expect(text).toMatch(/import\s+ModelSelectDropdown\s+from\s+["']@\/components\/models\/ModelSelectDropdown["']/);
      });
    }
    it("DefaultsGrid does NOT import ChevronDown (chevron lives in the shared component)", () => {
      const text = readFileSync(join(REPO_ROOT, "src/components/models/DefaultsGrid.tsx"), "utf-8");
      expect(text).not.toMatch(/import\s*\{[^}]*\bChevronDown\b[^}]*\}\s*from\s*["']lucide-react["']/);
    });
  });
});
