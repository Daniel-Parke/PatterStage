/**
 * @jest-environment jsdom
 *
 * The shared ledger row (T-0033, warrant WG-WEB-003 ruled D).
 *
 * WG-WEB-003 rules that a record with three or more comparable fields is a
 * table or a ledger, not a rounded box. The dashboard already had the ledger:
 * ActiveMissionsPanel and ErrorsPanel each render a divided list of rows, and
 * T-0024 put data-bloom="tight" on each of them by hand. Two hand-written
 * copies of a pattern is how the third copy gets the attribute wrong, and the
 * whole point of this task is that a future styling ruling should reach a
 * record surface BY CONSTRUCTION rather than by an editor remembering.
 *
 * So the pattern becomes a component with one definition, and this file is what
 * holds it to its contract:
 *
 *   - the row answers the bloom field, at the tight tier, because a row is
 *     short and wide and the 200px field would overflow it into a flat wash;
 *   - the interactive row is a real <button type="button">, so a keyboard
 *     reaches it and a form containing one is not submitted by it;
 *   - the attribute is declared BEFORE the prop spread, exactly as Button
 *     declares it, so a call site that needs a row not to answer can pass
 *     data-bloom={undefined} and win.
 *
 * Authored before the component existed. Every case below was red on write.
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { LedgerRow, LedgerRowButton } from "@/components/dashboard/LedgerRow";

describe("LedgerRow", () => {
  it("answers the bloom field at the tight tier", () => {
    render(<LedgerRow>a row</LedgerRow>);
    const row = screen.getByText("a row");
    expect(row.getAttribute("data-bloom")).toBe("tight");
  });

  it("carries the caller's classes as well as its own padding", () => {
    render(<LedgerRow className="flex items-center">a row</LedgerRow>);
    const row = screen.getByText("a row");
    expect(row.className).toContain("flex items-center");
    expect(row.className).toContain("px-4");
  });

  it("takes no hover wash unless the caller asks for one", () => {
    // ErrorsPanel's rows do not light on hover; ActiveMissionsPanel's do.
    // The default is the quieter of the two, so a row has to opt in.
    const { rerender } = render(<LedgerRow>quiet</LedgerRow>);
    expect(screen.getByText("quiet").className).not.toContain("hover:bg-");
    rerender(<LedgerRow hover>loud</LedgerRow>);
    expect(screen.getByText("loud").className).toContain("hover:bg-");
  });

  it("drops its padding when the caller owns the box", () => {
    render(<LedgerRow padding="none" className="grid">a row</LedgerRow>);
    expect(screen.getByText("a row").className).not.toContain("px-4");
  });

  it("lets a call site opt out of the field", () => {
    // Declared before the spread, so the caller wins. This is the escape
    // hatch Button documents, held here for the row as well.
    render(<LedgerRow data-bloom={undefined}>a row</LedgerRow>);
    expect(screen.getByText("a row").hasAttribute("data-bloom")).toBe(false);
  });
});

describe("LedgerRowButton", () => {
  it("is a real button that does not submit a form", () => {
    render(<LedgerRowButton>click me</LedgerRowButton>);
    const button = screen.getByRole("button", { name: "click me" });
    expect(button.tagName).toBe("BUTTON");
    expect(button.getAttribute("type")).toBe("button");
  });

  it("answers the bloom field at the tight tier", () => {
    render(<LedgerRowButton>click me</LedgerRowButton>);
    expect(
      screen.getByRole("button", { name: "click me" }).getAttribute("data-bloom"),
    ).toBe("tight");
  });

  it("calls the handler it was given", () => {
    const onClick = jest.fn();
    render(<LedgerRowButton onClick={onClick}>click me</LedgerRowButton>);
    fireEvent.click(screen.getByRole("button", { name: "click me" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("hovers by default, because it is interactive", () => {
    render(<LedgerRowButton>click me</LedgerRowButton>);
    expect(
      screen.getByRole("button", { name: "click me" }).className,
    ).toContain("hover:bg-");
  });

  it("stands down its hover when the row paints its own selected state", () => {
    // The log file picker paints active and inactive rows itself. Two
    // competing hover:bg-* classes resolve by stylesheet order, not by
    // attribute order, so the shared one has to be switchable off rather
    // than overridden.
    render(<LedgerRowButton hover={false}>click me</LedgerRowButton>);
    expect(
      screen.getByRole("button", { name: "click me" }).className,
    ).not.toContain("hover:bg-");
  });
});
