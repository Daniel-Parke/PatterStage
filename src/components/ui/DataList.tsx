// ═══════════════════════════════════════════════════════════════
// DataList — a real table, that stacks when it must.
//
// Forty-one surfaces fake a table with a grid of divs, and the two that are
// real tables put their last column off the right edge of a 1024px screen
// with no affordance at all: on /agent/models the ACTIONS cell holding edit
// and delete sat at x=1036 in a 774px scroll container (the reconnaissance
// behind T-0114). LedgerRow gave the console its record row (T-0033); this
// gives it the record TABLE, with column definitions, so a screen declares
// what its columns are and this decides how they render (T-0125).
//
// Two things it insists on. It is a `<table>` with a caption and column
// headers, because "column two" is a thing a screen reader can only say of a
// table. And below `collapseBelow` the SAME rows re-lay as stacked cards, each
// cell labelled by its own column, in CSS alone: nothing is rendered twice, so
// a test that counts rows counts them once and a screen that fetches once
// paints once.
// ═══════════════════════════════════════════════════════════════

import type { ReactNode } from "react";

import Card from "@/components/ui/Card";

type Breakpoint = "sm" | "md" | "lg" | "xl";

export interface DataListColumn<Row> {
  key: string;
  header: ReactNode;
  render: (row: Row) => ReactNode;
  align?: "left" | "right";
  /** Hidden below this width. The census's answer to a column nobody can read at 390px. */
  hideBelow?: Breakpoint;
  /** Width class for the cell, e.g. `w-24`. */
  width?: string;
  /** The column a stacked card leads with; its label is not repeated. */
  primary?: boolean;
  className?: string;
}

export interface DataListProps<Row> {
  /** What the table is a table OF. Its accessible name; sr-only on screen. */
  caption: string;
  columns: readonly DataListColumn<Row>[];
  rows: readonly Row[];
  rowKey: (row: Row) => string;
  /** A trailing cell of controls, under a header that names it. */
  actions?: (row: Row) => ReactNode;
  actionsHeader?: string;
  /** Below this width the rows stack as cards. Omit for a table that never does. */
  collapseBelow?: "lg" | "xl";
  selectedKey?: string | null;
  rowTestId?: (row: Row) => string;
  /** What to say instead of an empty table. */
  empty?: ReactNode;
  className?: string;
}

/**
 * Literal class strings per breakpoint, because Tailwind scans source and an
 * assembled `${bp}:table` never exists (T-0120's lesson, held here too).
 */
const COLLAPSE = {
  lg: {
    table: "block lg:table",
    thead: "hidden lg:table-header-group",
    tbody: "block lg:table-row-group",
    tr: "block lg:table-row",
    td: "block lg:table-cell",
    label: "lg:hidden",
    stackedRow: "px-4 py-3 lg:p-0",
    stackedCell: "py-0.5 lg:px-4 lg:py-2.5",
  },
  xl: {
    table: "block xl:table",
    thead: "hidden xl:table-header-group",
    tbody: "block xl:table-row-group",
    tr: "block xl:table-row",
    td: "block xl:table-cell",
    label: "xl:hidden",
    stackedRow: "px-4 py-3 xl:p-0",
    stackedCell: "py-0.5 xl:px-4 xl:py-2.5",
  },
} as const;

/** A hidden column in a table that never stacks. */
const HIDE_HEADER: Record<Breakpoint, string> = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
  xl: "hidden xl:table-cell",
};

/**
 * A hidden column in a table that stacks: hidden below its own width, a block
 * while stacked, a cell once the table is back.
 */
const HIDE_CELL: Record<"lg" | "xl", Record<Breakpoint, string>> = {
  lg: {
    sm: "hidden sm:block lg:table-cell",
    md: "hidden md:block lg:table-cell",
    lg: "hidden lg:table-cell",
    xl: "hidden xl:table-cell",
  },
  xl: {
    sm: "hidden sm:block xl:table-cell",
    md: "hidden md:block xl:table-cell",
    lg: "hidden lg:block xl:table-cell",
    xl: "hidden xl:table-cell",
  },
};

export default function DataList<Row>({
  caption,
  columns,
  rows,
  rowKey,
  actions,
  actionsHeader = "Actions",
  collapseBelow,
  selectedKey = null,
  rowTestId,
  empty,
  className = "",
}: DataListProps<Row>) {
  if (rows.length === 0 && empty !== undefined) {
    return <div className={className}>{empty}</div>;
  }

  const stack = collapseBelow ? COLLAPSE[collapseBelow] : null;
  const cellClass = (col: DataListColumn<Row>) => {
    const hide = col.hideBelow
      ? stack
        ? HIDE_CELL[collapseBelow!][col.hideBelow]
        : HIDE_HEADER[col.hideBelow]
      : stack
        ? stack.td
        : "";
    const pad = stack ? stack.stackedCell : "px-4 py-2.5";
    const align = col.align === "right" ? "text-right" : "text-left";
    return `${hide} ${pad} ${align} ${col.width ?? ""} ${col.className ?? ""}`.trim();
  };
  const headerClass = (col: DataListColumn<Row>) => {
    const hide = col.hideBelow ? HIDE_HEADER[col.hideBelow] : "";
    const align = col.align === "right" ? "text-right" : "text-left";
    return `${hide} px-4 py-2 font-normal ${align} ${col.width ?? ""}`.trim();
  };

  return (
    <Card padding="none" className={`overflow-x-auto ${className}`}>
      <table className={`w-full text-body ${stack ? stack.table : ""}`.trim()}>
        <caption className="sr-only">{caption}</caption>
        <thead className={stack ? stack.thead : undefined}>
          <tr className="border-b border-ps-edge-hairline font-mono text-micro uppercase tracking-widest text-ps-text-muted">
            {columns.map((col) => (
              <th key={col.key} scope="col" className={headerClass(col)}>
                {col.header}
              </th>
            ))}
            {actions && (
              <th scope="col" className="px-4 py-2 text-right font-normal">
                <span className="sr-only">{actionsHeader}</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody className={stack ? stack.tbody : undefined}>
          {rows.map((row) => {
            const key = rowKey(row);
            const selected = selectedKey !== null && selectedKey === key;
            return (
              <tr
                key={key}
                data-row-id={key}
                data-testid={rowTestId?.(row)}
                aria-selected={selected ? "true" : undefined}
                className={`border-b border-ps-edge-hairline transition-colors last:border-0 hover:bg-ps-surface-raised ${
                  selected ? "bg-ps-surface-raised" : ""
                } ${stack ? `${stack.tr} ${stack.stackedRow}` : ""}`.trim()}
              >
                {columns.map((col) => (
                  <td key={col.key} className={cellClass(col)}>
                    {stack && !col.primary && (
                      <span
                        data-cell-label=""
                        className={`${stack.label} mr-2 font-mono text-micro uppercase tracking-wider text-ps-text-faint`}
                      >
                        {col.header}
                      </span>
                    )}
                    {col.render(row)}
                  </td>
                ))}
                {actions && (
                  <td className={`${stack ? `${stack.td} ${stack.stackedCell}` : "px-4 py-2.5"} text-right`}>
                    <div className="flex items-center justify-end gap-1">{actions(row)}</div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
