/** @jest-environment jsdom */
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * U11 (T-0125): DataList, grown from LedgerRow with column definitions.
 *
 * Forty-one surfaces fake a table with a grid of divs, and the two that are
 * real tables put their last column off the right edge of a 1024px screen with
 * no affordance at all: on /agent/models the ACTIONS cell holding edit and
 * delete sat at x=1036 in a 774px scroll container (T-0114's reconnaissance).
 *
 * A DataList is a real table - caption, column headers, row semantics - and
 * below a breakpoint the SAME rows re-lay as stacked cards, each cell labelled
 * by its column, so nothing is ever off-screen and nothing is rendered twice.
 * The caption names it, so a screen reader can say what the table is a table
 * of, and a page can carry two.
 */
import { render, screen, within } from "@testing-library/react";

jest.mock("lucide-react", () => require("../helpers/mocks").lucideMock());

import DataList, { type DataListColumn } from "@/components/ui/DataList";

interface Row {
  id: string;
  name: string;
  provider: string;
  context: number | null;
}

const ROWS: Row[] = [
  { id: "a", name: "Sonnet", provider: "anthropic", context: 200000 },
  { id: "b", name: "MiniMax", provider: "minimax", context: null },
];

const COLUMNS: DataListColumn<Row>[] = [
  { key: "name", header: "Name", render: (r) => r.name, primary: true },
  { key: "provider", header: "Provider", render: (r) => r.provider, hideBelow: "md" },
  { key: "context", header: "Context", render: (r) => r.context ?? "—", align: "right" },
];

describe("a DataList is a table", () => {
  it("has a caption, one column header per column, and one row per record", () => {
    render(<DataList caption="Models" columns={COLUMNS} rows={ROWS} rowKey={(r) => r.id} />);
    const table = screen.getByRole("table", { name: "Models" });
    const headers = within(table).getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers).toEqual(["Name", "Provider", "Context"]);
    // The header row plus one per record.
    expect(within(table).getAllByRole("row")).toHaveLength(ROWS.length + 1);
    const first = within(table).getAllByRole("row")[1];
    expect(within(first).getAllByRole("cell").map((c) => c.textContent)).toEqual(["Sonnet", "anthropic", "200000"]);
  });

  it("a row can be found by its own test id, and carries its key", () => {
    render(
      <DataList caption="Models" columns={COLUMNS} rows={ROWS} rowKey={(r) => r.id} rowTestId={(r) => `model-${r.id}`} />,
    );
    expect(screen.getByTestId("model-b")).toHaveAttribute("data-row-id", "b");
  });

  it("renders the actions as the trailing cell of every row, under a header that names them", () => {
    render(
      <DataList
        caption="Models"
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(r) => r.id}
        actions={(r) => <button type="button">Edit {r.name}</button>}
      />,
    );
    const table = screen.getByRole("table", { name: "Models" });
    expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
      "Name",
      "Provider",
      "Context",
      "Actions",
    ]);
    expect(within(table).getByRole("button", { name: "Edit Sonnet" })).toBeInTheDocument();
  });

  it("marks the selected row", () => {
    render(<DataList caption="Models" columns={COLUMNS} rows={ROWS} rowKey={(r) => r.id} selectedKey="b" rowTestId={(r) => r.id} />);
    expect(screen.getByTestId("b")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("a")).not.toHaveAttribute("aria-selected", "true");
  });

  it("says what an empty list is empty of", () => {
    render(<DataList caption="Models" columns={COLUMNS} rows={[]} rowKey={(r) => r.id} empty="No models yet" />);
    expect(screen.getByText("No models yet")).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });
});

describe("below its breakpoint, a DataList stacks", () => {
  it("every cell carries its column's label for the stacked layout, hidden at the table layout", () => {
    render(
      <DataList caption="Models" columns={COLUMNS} rows={ROWS} rowKey={(r) => r.id} collapseBelow="xl" />,
    );
    const table = screen.getByRole("table", { name: "Models" });
    expect(table.className).toMatch(/\bblock\b/);
    expect(table.className).toMatch(/\bxl:table\b/);
    const thead = table.querySelector("thead")!;
    expect(thead.className).toMatch(/\bhidden\b/);
    expect(thead.className).toMatch(/\bxl:table-header-group\b/);
    const cell = within(within(table).getAllByRole("row")[1]).getAllByRole("cell")[1];
    // The label lives in the cell so the stacked card reads "Provider: anthropic",
    // and is hidden once the real header row is back.
    const label = cell.querySelector("[data-cell-label]")!;
    expect(label).toHaveTextContent("Provider");
    expect(label.className).toMatch(/\bxl:hidden\b/);
  });

  it("a column that hides below a width says so on both its header and its cells", () => {
    render(<DataList caption="Models" columns={COLUMNS} rows={ROWS} rowKey={(r) => r.id} />);
    const table = screen.getByRole("table", { name: "Models" });
    const header = within(table).getAllByRole("columnheader")[1];
    expect(header.className).toMatch(/\bhidden\b/);
    expect(header.className).toMatch(/\bmd:table-cell\b/);
    const cell = within(within(table).getAllByRole("row")[1]).getAllByRole("cell")[1];
    expect(cell.className).toMatch(/\bhidden\b/);
    expect(cell.className).toMatch(/\bmd:table-cell\b/);
  });

  it("without a breakpoint, nothing stacks and no cell carries a label", () => {
    render(<DataList caption="Models" columns={COLUMNS} rows={ROWS} rowKey={(r) => r.id} />);
    const table = screen.getByRole("table", { name: "Models" });
    expect(table.className).not.toMatch(/\bblock\b/);
    expect(table.querySelector("[data-cell-label]")).toBeNull();
  });
});
