/**
 * Field associates its label with its control BY CONSTRUCTION.
 *
 * `htmlFor` was an optional prop the caller had to remember, and callers
 * forgot: a 2026-08-23 accessibility audit found the Deep Research page
 * rendering number inputs as unlabelled spinbuttons, even though a perfectly
 * good label sat directly above them on screen. A label that is only visual is
 * not a label.
 *
 * These tests pin the property rather than the incident, so the association
 * cannot quietly stop happening for the next control someone wraps.
 */
import { render, screen } from "@testing-library/react";
import { Field } from "@/components/ui/field/Field";

describe("Field label association", () => {
  it("labels a control that carries no id of its own", () => {
    render(
      <Field label="Depth">
        <input type="number" defaultValue={3} />
      </Field>,
    );
    // getByRole with a name only succeeds when the two are really associated.
    expect(screen.getByRole("spinbutton", { name: /depth/i })).toBeInTheDocument();
  });

  it("does not steal an id the control already has", () => {
    render(
      <Field label="Breadth">
        <input id="chosen-by-caller" type="number" defaultValue={6} />
      </Field>,
    );
    const input = screen.getByRole("spinbutton", { name: /breadth/i });
    expect(input).toHaveAttribute("id", "chosen-by-caller");
  });

  it("lets an explicit htmlFor win", () => {
    render(
      <Field label="Rounds" htmlFor="explicit-id">
        <input id="explicit-id" type="text" />
      </Field>,
    );
    expect(screen.getByRole("textbox", { name: /rounds/i })).toHaveAttribute("id", "explicit-id");
  });

  it("wires the hint up as the control's description, not just as nearby text", () => {
    render(
      <Field label="Depth" hint="rounds">
        <input type="number" defaultValue={3} />
      </Field>,
    );
    expect(screen.getByRole("spinbutton", { name: /depth/i })).toHaveAccessibleDescription("rounds");
  });

  it("prefers the error over the hint as the description", () => {
    render(
      <Field label="Depth" hint="rounds" error="must be at least 1">
        <input type="number" defaultValue={0} />
      </Field>,
    );
    expect(screen.getByRole("spinbutton", { name: /depth/i })).toHaveAccessibleDescription(
      "must be at least 1",
    );
  });

  it("survives a child it cannot clone, rather than throwing", () => {
    // A fragment or bare text is not an element; Field must not explode.
    render(<Field label="Static">just some text</Field>);
    expect(screen.getByText("just some text")).toBeInTheDocument();
  });
});
