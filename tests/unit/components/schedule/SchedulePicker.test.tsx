/** @jest-environment jsdom */

/**
 * Tests for SchedulePicker — the canonical schedule input used by
 * the cron page and the mission page.
 *
 * Covers: 5-field cron input, "every Nh" shorthand input, JSON-serialised
 * ParsedSchedule input (the live mission's storage format), preset selection,
 * custom builder, day-of-week toggling, advanced raw-cron editing, disabled
 * and error states.
 */

import { render, screen, fireEvent } from "@testing-library/react";

// Mock lucide-react to keep tests focused on behaviour, not icon rendering
jest.mock("lucide-react", () => {
  const MockIcon = () => null;
  return new Proxy({}, { get: () => MockIcon });
});

import SchedulePicker from "@/components/schedule/SchedulePicker";

describe("SchedulePicker", () => {
  it("renders with a 5-field cron value and shows the matching preset label", () => {
    const onChange = jest.fn();
    render(<SchedulePicker value="0 */2 * * *" onChange={onChange} onDraftError={jest.fn()} />);
    // The dropdown button should display "Every 2 hours"
    expect(screen.getByRole("button", { name: /Every 2 hours/i })).toBeInTheDocument();
    // The canonical cron display should be visible
    expect(screen.getByText("0 */2 * * *")).toBeInTheDocument();
  });

  it("accepts 'every Nh' shorthand on load and canonicalises it", () => {
    const onChange = jest.fn();
    render(<SchedulePicker value="every 2h" onChange={onChange} onDraftError={jest.fn()} />);
    // The button shows the preset label
    expect(screen.getByRole("button", { name: /Every 2 hours/i })).toBeInTheDocument();
    // The canonical cron is displayed in the read-only box
    expect(screen.getByText("0 */2 * * *")).toBeInTheDocument();
  });

  it("accepts JSON-serialised ParsedSchedule on load (live mission's storage format)", () => {
    const onChange = jest.fn();
    const stored = JSON.stringify({ kind: "interval", minutes: 120, display: "every 2h" });
    render(<SchedulePicker value={stored} onChange={onChange} onDraftError={jest.fn()} />);
    expect(screen.getByRole("button", { name: /Every 2 hours/i })).toBeInTheDocument();
    expect(screen.getByText("0 */2 * * *")).toBeInTheDocument();
  });

  it("calls onChange with the canonical 5-field cron when a preset is selected", () => {
    const onChange = jest.fn();
    render(<SchedulePicker value="" onChange={onChange} onDraftError={jest.fn()} />);

    // Open the dropdown
    const dropdownButton = screen.getAllByRole("button")[0];
    fireEvent.click(dropdownButton);

    // Click the "Weekdays at 9am" preset
    fireEvent.click(screen.getByRole("button", { name: /Weekdays at 9am/i }));

    expect(onChange).toHaveBeenCalledWith("0 9 * * 1-5");
  });

  it("emits 0 9 * * 1-5 for the existing live mission's expected replacement", () => {
    const onChange = jest.fn();
    render(<SchedulePicker value="0 */2 * * *" onChange={onChange} onDraftError={jest.fn()} />);
    const dropdownButton = screen.getAllByRole("button")[0];
    fireEvent.click(dropdownButton);
    fireEvent.click(screen.getByRole("button", { name: /Weekdays at 9am/i }));
    expect(onChange).toHaveBeenCalledWith("0 9 * * 1-5");
  });

  it("shows the custom builder when 'Custom…' is clicked", () => {
    const onChange = jest.fn();
    render(<SchedulePicker value="" onChange={onChange} onDraftError={jest.fn()} />);

    // Open dropdown
    fireEvent.click(screen.getAllByRole("button")[0]);

    // Click "Custom…"
    fireEvent.click(screen.getByRole("button", { name: /Custom/i }));

    // The custom builder has "Days of week" label and a Mon button
    expect(screen.getByText(/Days of week/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Mon$/ })).toBeInTheDocument();
  });

  it("in custom builder, checking Mon/Wed/Fri at 18:00 calls onChange with 0 18 * * 1,3,5", () => {
    const onChange = jest.fn();
    render(<SchedulePicker value="" onChange={onChange} onDraftError={jest.fn()} />);

    // Open dropdown
    fireEvent.click(screen.getAllByRole("button")[0]);
    // Click Custom
    fireEvent.click(screen.getByRole("button", { name: /Custom/i }));

    // Clear the default all-days
    fireEvent.click(screen.getByRole("button", { name: /^Clear$/ }));

    // Set time to 18:00
    const timeInput = screen.getByDisplayValue("09:00");
    fireEvent.change(timeInput, { target: { value: "18:00" } });

    // Click Mon, Wed, Fri
    fireEvent.click(screen.getByRole("button", { name: /^Mon$/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Wed$/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Fri$/ }));

    // Click Apply
    fireEvent.click(screen.getByRole("button", { name: /Apply/i }));

    expect(onChange).toHaveBeenCalledWith("0 18 * * 1,3,5");
  });

  it("in custom builder, the Weekdays shortcut sets days 1-5", () => {
    const onChange = jest.fn();
    render(<SchedulePicker value="" onChange={onChange} onDraftError={jest.fn()} />);

    fireEvent.click(screen.getAllByRole("button")[0]);
    fireEvent.click(screen.getByRole("button", { name: /Custom/i }));

    // Clear first, then click Weekdays
    fireEvent.click(screen.getByRole("button", { name: /^Clear$/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Weekdays$/ }));

    const timeInput = screen.getByDisplayValue("09:00");
    fireEvent.change(timeInput, { target: { value: "09:00" } });

    fireEvent.click(screen.getByRole("button", { name: /Apply/i }));

    expect(onChange).toHaveBeenCalledWith("0 9 * * 1-5");
  });

  it("typing a cron expression in the advanced field calls onChange on blur", () => {
    const onChange = jest.fn();
    render(<SchedulePicker value="0 */2 * * *" onChange={onChange} onDraftError={jest.fn()} />);

    // Open the advanced section
    fireEvent.click(screen.getByRole("button", { name: /Show advanced/i }));

    // The advanced input is now a controlled input. Simulate free-form
    // typing across multiple keystrokes; the input should NOT reset
    // mid-word (the previous implementation re-mounted the input on
    // every parent update, making free-form typing impossible).
    const advancedInput = screen.getByDisplayValue("0 */2 * * *") as HTMLInputElement;
    fireEvent.change(advancedInput, { target: { value: "0 9 * * 1" } });
    // The parent should NOT have received onChange yet (commit is on blur).
    expect(onChange).not.toHaveBeenCalled();
    // Continue typing — input must not reset.
    fireEvent.change(advancedInput, { target: { value: "0 9 * * 1-5" } });
    expect(onChange).not.toHaveBeenCalled();
    // Commit on blur
    fireEvent.blur(advancedInput);
    expect(onChange).toHaveBeenCalledWith("0 9 * * 1-5");
  });

  // This test used to end at `expect(onChange).not.toHaveBeenCalled()` and
  // called the behaviour a SILENT revert, approvingly. Rewritten under T-0051,
  // not weakened: the half it protected is still asserted, and the half that
  // was a defect is now asserted the other way.
  //
  // Not emitting garbage to the parent is right. Saying nothing about it is
  // not: a live QA pass typed a cron, watched it sit in the box, submitted, and
  // shipped the preset default instead, with no error anywhere on the form.
  it("does not emit an invalid advanced draft to the parent", () => {
    const onChange = jest.fn();
    render(<SchedulePicker value="0 */2 * * *" onChange={onChange} onDraftError={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Show advanced/i }));
    const advancedInput = screen.getByDisplayValue("0 */2 * * *") as HTMLInputElement;
    fireEvent.change(advancedInput, { target: { value: "not a cron at all" } });
    fireEvent.blur(advancedInput);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("says WHY an invalid advanced draft was not accepted", () => {
    const onChange = jest.fn();
    render(<SchedulePicker value="0 */2 * * *" onChange={onChange} onDraftError={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Show advanced/i }));
    const advancedInput = screen.getByDisplayValue("0 */2 * * *") as HTMLInputElement;
    fireEvent.change(advancedInput, { target: { value: "not a cron at all" } });
    fireEvent.blur(advancedInput);
    expect(screen.getByText(/not a schedule this understands/i)).toBeInTheDocument();
  });

  it("keeps the operator's text on screen so they can fix it", () => {
    // Reverting the box as well as refusing the value means the typo vanishes
    // before it can be corrected, and the operator cannot see what was wrong.
    const onChange = jest.fn();
    render(<SchedulePicker value="0 */2 * * *" onChange={onChange} onDraftError={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Show advanced/i }));
    const advancedInput = screen.getByDisplayValue("0 */2 * * *") as HTMLInputElement;
    fireEvent.change(advancedInput, { target: { value: "not a cron at all" } });
    fireEvent.blur(advancedInput);
    expect(advancedInput.value).toBe("not a cron at all");
  });

  it("clears the error once the draft becomes valid", () => {
    const onChange = jest.fn();
    render(<SchedulePicker value="0 */2 * * *" onChange={onChange} onDraftError={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Show advanced/i }));
    const advancedInput = screen.getByDisplayValue("0 */2 * * *") as HTMLInputElement;
    fireEvent.change(advancedInput, { target: { value: "nope" } });
    fireEvent.blur(advancedInput);
    expect(screen.getByText(/not a schedule this understands/i)).toBeInTheDocument();
    fireEvent.change(advancedInput, { target: { value: "5 1 * * *" } });
    fireEvent.blur(advancedInput);
    expect(screen.queryByText(/not a schedule this understands/i)).toBeNull();
    expect(onChange).toHaveBeenCalledWith("5 1 * * *");
  });

  it("Escape does not reach the dialog behind the field", () => {
    // useDialogA11y listens on the document; without stopPropagation, pressing
    // Escape to abandon a cron typo closed the whole composer and discarded a
    // half-filled mission.
    const onChange = jest.fn();
    const onDocEscape = jest.fn();
    document.addEventListener("keydown", onDocEscape);
    render(<SchedulePicker value="0 */2 * * *" onChange={onChange} onDraftError={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Show advanced/i }));
    const advancedInput = screen.getByDisplayValue("0 */2 * * *") as HTMLInputElement;
    fireEvent.keyDown(advancedInput, { key: "Escape", bubbles: true });
    expect(onDocEscape).not.toHaveBeenCalled();
    document.removeEventListener("keydown", onDocEscape);
  });

  it("commits the advanced draft on Enter", () => {
    const onChange = jest.fn();
    render(<SchedulePicker value="0 */2 * * *" onChange={onChange} onDraftError={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Show advanced/i }));
    const advancedInput = screen.getByDisplayValue("0 */2 * * *") as HTMLInputElement;
    fireEvent.change(advancedInput, { target: { value: "0 9 * * 1-5" } });
    fireEvent.keyDown(advancedInput, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("0 9 * * 1-5");
  });

  it("displays the error message when error prop is set", () => {
    const onChange = jest.fn();
    render(<SchedulePicker value="0 */2 * * *" onChange={onChange} error="Invalid cron" onDraftError={jest.fn()} />);
    expect(screen.getByText("Invalid cron")).toBeInTheDocument();
  });

  it("disables all interactive controls when disabled prop is set", () => {
    const onChange = jest.fn();
    render(<SchedulePicker value="0 */2 * * *" onChange={onChange} disabled onDraftError={jest.fn()} />);
    const dropdownButton = screen.getAllByRole("button")[0];
    expect(dropdownButton).toBeDisabled();
  });

  it("compact mode renders just the preset dropdown (no custom builder)", () => {
    const onChange = jest.fn();
    render(<SchedulePicker value="0 */2 * * *" onChange={onChange} compact onDraftError={jest.fn()} />);
    // No "Schedule" label in compact mode
    expect(screen.queryByText(/^Schedule$/i)).not.toBeInTheDocument();
    // The preset label is shown
    expect(screen.getByRole("button", { name: /Every 2 hours/i })).toBeInTheDocument();
  });

  it("compact mode opens dropdown and selecting a preset calls onChange", () => {
    const onChange = jest.fn();
    render(<SchedulePicker value="" onChange={onChange} compact onDraftError={jest.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /Select a frequency/i }));
    fireEvent.click(screen.getByRole("button", { name: /Weekdays at 9am/i }));

    expect(onChange).toHaveBeenCalledWith("0 9 * * 1-5");
  });

  it("renders the schedule label and cron display in a read-only state for the existing live mission", () => {
    const onChange = jest.fn();
    const stored = JSON.stringify({ kind: "interval", minutes: 120, display: "every 2h" });
    render(<SchedulePicker value={stored} onChange={onChange} onDraftError={jest.fn()} />);

    // Label is "Every 2 hours" (matched preset)
    expect(screen.getByRole("button", { name: /Every 2 hours/i })).toBeInTheDocument();
    // Cron display shows the canonical 5-field form
    expect(screen.getByText("0 */2 * * *")).toBeInTheDocument();
  });
});
