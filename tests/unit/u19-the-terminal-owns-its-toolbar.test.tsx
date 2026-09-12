/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * U19 · The terminal owns its toolbar.
 *
 * Logs' header actions wrapped onto three rows on a phone: the help link
 * alone, then the auto-refresh toggle with the line count and Refresh, then
 * Delete All (the UI review of 2026-09-08, P3). The auto-refresh switch and
 * the line count are about the terminal, so they sit in the terminal's own
 * bar, as the primitives (a switch that says on or off, the house select);
 * the page header keeps Refresh and Delete All. The three coloured dots that
 * decorated that bar go with the move: the product's convention is no
 * decoration that is not information (P4, taken early because the bar was
 * open).
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

jest.mock("lucide-react", () => require("../helpers/mocks").lucideMock());

import LogTerminal from "@/components/logs/LogTerminal";
import LogsHeaderActions from "@/components/logs/LogsHeaderActions";

const ROOT = join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

function renderTerminal(over: Partial<React.ComponentProps<typeof LogTerminal>> = {}) {
  const props = {
    scrollRef: { current: null },
    onScroll: () => {},
    logName: "agent",
    activeLog: "agent",
    showingLines: 200,
    totalLines: 771,
    lines: ["2026-09-09 10:00:00 INFO hello"],
    searchTerm: "",
    autoRefresh: true,
    onToggleAutoRefresh: jest.fn(),
    lineCount: 200,
    onLineCountChange: jest.fn(),
    ...over,
  } as React.ComponentProps<typeof LogTerminal>;
  return { ...render(<LogTerminal {...props} />), props };
}

describe("U19 · the terminal owns its toolbar", () => {
  it("carries the auto-refresh switch and the line count, as primitives", () => {
    const { props } = renderTerminal();
    const toggle = screen.getByRole("switch", { name: "Auto-refresh" });
    expect(toggle).toBeChecked();
    fireEvent.click(toggle);
    expect(props.onToggleAutoRefresh).toHaveBeenCalledTimes(1);

    const lines = screen.getByRole("combobox", { name: "Lines to show" }) as HTMLSelectElement;
    expect(lines.value).toBe("200");
    fireEvent.change(lines, { target: { value: "500" } });
    expect(props.onLineCountChange).toHaveBeenCalledWith(500);
  });

  it("draws no window-chrome dots", () => {
    const { container } = renderTerminal();
    for (const cls of ["bg-red-500/80", "bg-yellow-500/80", "bg-green-500/80"]) {
      expect(container.getElementsByClassName(cls).length).toBe(0);
    }
    expect(screen.getByText(/agent\.log/)).toBeInTheDocument();
  });

  it("the page header keeps Refresh and Delete All, and nothing about the terminal", () => {
    render(
      <LogsHeaderActions
        hasLogs
        refreshing={false}
        onRefresh={() => {}}
        deleteArmed={false}
        onDeleteAll={() => {}}
        onCancelDelete={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /Refresh/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Delete All/ })).toBeInTheDocument();
    expect(screen.queryByRole("switch")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("the page wires the terminal's toolbar and not the header's", () => {
    const page = read("src/app/results/logs/page.tsx");
    const terminal = page.slice(page.indexOf("<LogTerminal"), page.indexOf("/>", page.indexOf("<LogTerminal")));
    expect(terminal).toMatch(/autoRefresh=\{autoRefresh\}/);
    expect(terminal).toMatch(/lineCount=\{lineCount\}/);
    const header = page.slice(page.indexOf("<LogsHeaderActions"), page.indexOf("/>", page.indexOf("<LogsHeaderActions")));
    expect(header).not.toMatch(/autoRefresh=/);
    expect(header).not.toMatch(/lineCount=/);
  });
});
