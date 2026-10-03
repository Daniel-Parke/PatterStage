/**
 * Component tests for the Field Kit primitives (src/components/ui/field/*)
 * and equivalent Field/Input compositions after retiring TextInput.
 * Guards label, description, disabled state and event-to-value semantics
 * alongside the migrated NumberInput control.
 */
import { render, screen, fireEvent } from "@testing-library/react";

import { Field, Input, Textarea, NumberInput } from "@/components/ui/field";

describe("Field", () => {
  it("renders the label and hint", () => {
    render(
      <Field label="Display name" hint="Shown on the dashboard">
        <input aria-label="display-name" />
      </Field>,
    );
    expect(screen.getByText("Display name")).toBeInTheDocument();
    expect(screen.getByText("Shown on the dashboard")).toBeInTheDocument();
  });

  it("shows the error instead of the hint when both are set", () => {
    render(
      <Field label="Port" hint="42069–42100" error="Port already in use">
        <input aria-label="port" />
      </Field>,
    );
    expect(screen.getByText("Port already in use")).toBeInTheDocument();
    expect(screen.queryByText("42069–42100")).not.toBeInTheDocument();
  });
});

describe("Field Kit Input / Textarea", () => {
  it("forwards props and fires onChange", () => {
    const onChange = jest.fn();
    render(<Input aria-label="api-key" placeholder="sk-…" onChange={onChange} />);
    const el = screen.getByLabelText("api-key");
    expect(el).toHaveAttribute("placeholder", "sk-…");
    fireEvent.change(el, { target: { value: "abc" } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("Textarea forwards a custom className alongside the base styles", () => {
    render(<Textarea aria-label="notes" className="h-40" />);
    expect(screen.getByLabelText("notes")).toHaveClass("h-40");
  });
});

describe("legacy TextInput (delegates to the Field Kit Input)", () => {
  it("renders label + description and calls onChange with the raw value", () => {
    const onChange = jest.fn();
    render(
      <Field label="Webhook URL" hint="POSTed on each run">
        <Input value="" onChange={(event) => onChange(event.target.value)} />
      </Field>,
    );
    expect(screen.getByText("Webhook URL")).toBeInTheDocument();
    expect(screen.getByText("POSTed on each run")).toBeInTheDocument();
    fireEvent.change(screen.getByDisplayValue(""), {
      target: { value: "https://example.com/hook" },
    });
    expect(onChange).toHaveBeenCalledWith("https://example.com/hook");
  });

  it("respects the disabled prop", () => {
    render(<Field label="Locked"><Input value="x" onChange={() => {}} disabled /></Field>);
    expect(screen.getByDisplayValue("x")).toBeDisabled();
  });
});

describe("legacy NumberInput (delegates to the Field Kit Input)", () => {
  it("calls onChange with a parsed number", () => {
    const onChange = jest.fn();
    render(<NumberInput label="Timeout" value={30} onChange={onChange} min={1} max={120} />);
    fireEvent.change(screen.getByDisplayValue("30"), { target: { value: "45" } });
    expect(onChange).toHaveBeenCalledWith(45);
  });
});
