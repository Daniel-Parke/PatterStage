/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * U19 · The strip fits a phone.
 *
 * On /results/sessions at 390 the donut, the Messages tile and the Active
 * ring stacked to about 350px before the search field (the UI review of
 * 2026-09-08, P3). Below sm the strip is one row of its numbers, "48
 * sessions · 1.3k messages · 0 active"; the rings are for the desk. The row
 * is derived from the same props inside StatStrip, so every strip in the
 * product gets it and no caller changes.
 */

import { render, screen } from "@testing-library/react";

jest.mock("lucide-react", () => require("../helpers/mocks").lucideMock());

import StatStrip from "@/components/viz/StatStrip";

const Icon = () => <svg />;

describe("U19 · the strip fits a phone", () => {
  it("renders one row of its numbers for a phone, and the pictures for the desk", () => {
    render(
      <StatStrip
        donut={{ segments: [{ label: "CLI", value: 48, color: "cyan" }], center: 48, centerSub: "sessions" }}
        tiles={[{ icon: Icon, label: "Messages", value: 1300, color: "orange", compact: true }]}
        ring={{ value: 0, color: "green", label: <span>0</span>, sublabel: "active" }}
      />,
    );
    const row = screen.getByTestId("strip-phone-row");
    expect(row).toHaveClass("sm:hidden");
    expect(row).toHaveTextContent(/48 sessions/);
    expect(row).toHaveTextContent(/1\.3k messages/i);
    expect(row).toHaveTextContent(/0 active/);

    const donut = screen.getByTestId("donut-legend").parentElement!;
    expect(donut).toHaveClass("hidden");
    expect(donut).toHaveClass("sm:flex");
    const ring = screen.getByTestId("stat-ring");
    expect(ring).toHaveClass("hidden");
    expect(ring).toHaveClass("sm:flex");
  });

  it("a strip of tiles alone has a row too, and no picture to hide", () => {
    render(<StatStrip tiles={[{ icon: Icon, label: "Errors", value: 7, color: "orange" }]} />);
    expect(screen.getByTestId("strip-phone-row")).toHaveTextContent(/7 errors/i);
    expect(screen.queryByTestId("stat-ring")).toBeNull();
  });
});
