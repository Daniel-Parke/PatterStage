/** @jest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { NumberInput, SearchInput, Field, Input } from "@/components/ui/field";
import { Toggle } from "@/components/ui/field/Toggle";
import { NativeSelect } from "@/components/ui/field/Select";

// Field label/error, Modal, Sheet and full Schedule controls are preserved by
// their existing suites; this adds the description/reset and callback joins.
describe("T0191 primitive parity", () => {
  it("legacy text keeps its name and description after external reset", () => {
    const change = jest.fn();
    const props = { label: "Webhook", description: "Destination URL", onChange: change };
    const view = render(<Field label={props.label} hint={props.description}><Input value="first" onChange={(event) => props.onChange(event.target.value)} /></Field>);
    expect(screen.getByRole("textbox", { name: "Webhook" })).toHaveAccessibleDescription("Destination URL");
    view.rerender(<Field label={props.label} hint={props.description}><Input value="reset" onChange={(event) => props.onChange(event.target.value)} /></Field>);
    expect(screen.getByRole("textbox", { name: "Webhook" })).toHaveValue("reset");
    expect(screen.getByRole("textbox", { name: "Webhook" })).toHaveAccessibleDescription("Destination URL");
    expect(change).not.toHaveBeenCalled();
  });
  it("search preserves exact value and invokes its submit callback once", () => {
    const change = jest.fn(), submit = jest.fn();
    render(<SearchInput value="" ariaLabel="Find skills" onChange={change} onSubmit={submit} />);
    const input = screen.getByRole("textbox", { name: "Find skills" });
    fireEvent.change(input, { target: { value: "  local query  " } });
    expect(change).toHaveBeenCalledWith("  local query  ");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(submit).toHaveBeenCalledTimes(1);
  });
  it.each(["", "-", "1e", "999", "42"])("numeric edit %j retains description and resets from the external value", (raw) => {
    const change = jest.fn();
    const props = { label: "Timeout", description: "Seconds per attempt", min: 1, max: 120, onChange: change };
    const view = render(<NumberInput {...props} value={30} />);
    const input = screen.getByLabelText("Timeout");
    fireEvent.change(input, { target: { value: raw } });
    if (raw === "") expect(change).toHaveBeenLastCalledWith(null);
    else if (raw === "999" || raw === "42") expect(change).toHaveBeenLastCalledWith(Number(raw));
    else {
      // A native number input sanitises partial lexemes to empty before React.
      // A text adapter may retain the exact draft, but cannot emit a number.
      expect(["", raw]).toContain((input as HTMLInputElement).value);
      for (const [value] of change.mock.calls) expect(value).toBeNull();
    }
    if (raw === "999") {
      fireEvent.blur(input);
      expect(change).toHaveBeenLastCalledWith(120);
    }
    view.rerender(<NumberInput {...props} value={17} />);
    expect((input as HTMLInputElement).value).toBe("17");
    expect(input).toHaveAccessibleDescription(expect.stringContaining("Seconds per attempt"));
  });
  it("labelled inspector track retains hint, disabled state and exactly one callback", () => {
    const change = jest.fn();
    const view = render(<Toggle label="Require approval" value={false} onChange={change} hint="Pause before execution" />);
    const toggle = screen.getByRole("switch", { name: "Require approval" });
    expect(toggle).toHaveAccessibleDescription("Pause before execution");
    expect(toggle).toHaveAttribute("aria-checked", "false");
    fireEvent.click(toggle);
    expect(change).toHaveBeenCalledTimes(1);
    expect(change).toHaveBeenCalledWith(true);
    view.rerender(<Toggle label="Require approval" value onChange={change} disabled hint="Pause before execution" />);
    fireEvent.click(screen.getByRole("switch", { name: "Require approval" }));
    expect(change).toHaveBeenCalledTimes(1);
  });
  it("native select adapter preserves browser semantics and exact values", () => {
    const change = jest.fn();
    render(<NativeSelect aria-label="Stored provider" defaultValue="a" onChange={change}><option value="a">Alpha</option><option value="b">Beta</option></NativeSelect>);
    const select = screen.getByRole("combobox", { name: "Stored provider" });
    fireEvent.change(select, { target: { value: "b" } });
    expect(select).toHaveValue("b");
    expect(change).toHaveBeenCalledTimes(1);
  });
});

it("T0191 numeric partial draft never fabricates a numeric callback and remains editable", () => {
  const onChange = jest.fn();
  render(<NumberInput label="Partial timeout" value={30} min={1} max={120} onChange={onChange} />);
  const control = screen.getByLabelText("Partial timeout") as HTMLInputElement;
  for (const partial of ["-", "1e", "1e-"]) {
    onChange.mockClear();
    fireEvent.change(control, { target: { value: partial } });
    expect(["", partial]).toContain(control.value);
    for (const [value] of onChange.mock.calls) expect(value).toBeNull();
    fireEvent.change(control, { target: { value: "12" } });
    expect(onChange).toHaveBeenLastCalledWith(12);
    expect(control.value).toBe("12");
  }
});
