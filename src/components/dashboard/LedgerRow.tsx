// ═══════════════════════════════════════════════════════════════
// LedgerRow + LedgerRowButton — the console's record row
// ═══════════════════════════════════════════════════════════════
//
// WG-WEB-003 (D): a record with three or more comparable fields is a table or
// a ledger, not a rounded box. This is the ledger. ActiveMissionsPanel and
// ErrorsPanel rendered it by hand and T-0024 set data-bloom on each by hand;
// T-0033's point is that a styling ruling reaches a record surface BY
// CONSTRUCTION, so the pattern has one definition and those panels consume it.
//
// Two shapes, because a row is either a fact or a control: LedgerRow is a div
// of facts with its own links inside, quiet on hover unless asked (ErrorsPanel's
// rows do not wash, ActiveMissionsPanel's do; the quieter is the default);
// LedgerRowButton is a real <button type="button">, the whole row the control,
// washing on hover. Both answer the bloom field at the TIGHT tier: the 200px
// field sized for a card overflows a short wide row into a flat wash, and 90px
// reads as a row lighting up.

import type { ReactNode } from "react";

export type LedgerRowPadding = "row" | "block" | "none";

/**
 * `row` is one line of facts; `block` the taller row with a title and a meta
 * line (session, mission, session group); `none` hands the box to a call site
 * that paints its own (the log line's column grid, the log file picker).
 */
const paddingMap: Record<LedgerRowPadding, string> = {
  row: "px-4 py-2.5",
  block: "p-4",
  none: "",
};

/** The one hover wash. Every row in the console lights the same amount. */
const HOVER = "hover:bg-ps-surface-raised";

function rowClasses(
  padding: LedgerRowPadding,
  hover: boolean,
  className: string,
): string {
  return [paddingMap[padding], "transition-colors", hover ? HOVER : "", className]
    .filter(Boolean)
    .join(" ");
}

export interface LedgerRowProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padding?: LedgerRowPadding;
  /** Wash on hover. Off by default: a row of facts is not a control. */
  hover?: boolean;
}

export function LedgerRow({
  children,
  className = "",
  padding = "row",
  hover = false,
  ...props
}: LedgerRowProps) {
  return (
    <div
      className={rowClasses(padding, hover, className)}
      // Bloom tier (WG-WEB-011 C), tight variant. Before the spread, so a call
      // site that needs this row dark can pass data-bloom={undefined}.
      data-bloom="tight"
      {...props}
    >
      {children}
    </div>
  );
}

export interface LedgerRowButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  padding?: LedgerRowPadding;
  /**
   * Wash on hover, on by default because the whole row is the control. Pass
   * false where the row paints its own selected state: two `hover:bg-*` classes
   * resolve by stylesheet order, so the shared one must be switchable off.
   */
  hover?: boolean;
}

export function LedgerRowButton({
  children,
  className = "",
  padding = "row",
  hover = true,
  ...props
}: LedgerRowButtonProps) {
  return (
    <button
      type="button"
      className={rowClasses(padding, hover, className)}
      // Bloom tier (WG-WEB-011 C), tight variant, before the spread. A disabled
      // row needs no opt-out: it gets no pointer events, so the listener
      // resolves to the container behind it. Nothing dead lights up.
      data-bloom="tight"
      {...props}
    >
      {children}
    </button>
  );
}
