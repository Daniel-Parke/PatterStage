// ═══════════════════════════════════════════════════════════════
// LedgerRow + LedgerRowButton — the console's record row
// ═══════════════════════════════════════════════════════════════
//
// WG-WEB-003 (D): a record with three or more comparable fields is a table or
// a ledger, not a rounded box. This is the ledger.
//
// The pattern is not new. ActiveMissionsPanel and ErrorsPanel have rendered it
// since the dashboard god-page was decomposed, and T-0024 set data-bloom on
// each of them by hand. Two hand-written copies of a pattern is how the third
// copy gets the attribute wrong, and T-0033's whole point is that a future
// styling ruling should reach a record surface BY CONSTRUCTION rather than by
// whoever edits it next remembering. So the pattern has one definition, here,
// and the panels that established it consume it like everyone else.
//
// Two shapes, because a row is either a fact or a control:
//
//   LedgerRow        a div. Facts, with their own links and buttons inside.
//                    Does not wash on hover unless asked, because ErrorsPanel's
//                    rows do not and ActiveMissionsPanel's do; the quieter of
//                    the two is the default.
//   LedgerRowButton  a real <button type="button">. The whole row is the
//                    control: a mission row that expands, a log file that
//                    selects, a session group that opens. Washes on hover,
//                    because it is interactive.
//
// Both answer the bloom field at the TIGHT tier. A row is short and wide, and
// the 200px field sized for a card would overflow it into a flat wash; 90px is
// the size that reads as a row lighting up. The attribute is declared BEFORE
// the prop spread, exactly as Button declares it, so a call site that needs a
// row not to answer can pass data-bloom={undefined} and win.

import type { ReactNode } from "react";

export type LedgerRowPadding = "row" | "block" | "none";

/**
 * `row` is the dashboard's own rhythm: one line of facts, wide and short.
 * `block` is the taller row that carries a title line and a meta line, which
 * is what a session, a mission and a session group each need. `none` hands the
 * box back to a call site that paints its own (the log line's column grid, the
 * log file picker's selected state).
 */
const paddingMap: Record<LedgerRowPadding, string> = {
  row: "px-4 py-2.5",
  block: "p-4",
  none: "",
};

/** The one hover wash. Every row in the console lights the same amount. */
const HOVER = "hover:bg-white/[0.02]";

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
   * Wash on hover. On by default, because the whole row is the control. Pass
   * false where the row paints its own selected and unselected states: two
   * competing `hover:bg-*` classes resolve by stylesheet order, not by the
   * order they appear in the attribute, so the shared one has to be switchable
   * off rather than overridden.
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
      // row needs no opt-out: browsers deliver no pointer events to it, so the
      // listener resolves to the container behind it, which is the correct
      // reading. Nothing dead lights up.
      data-bloom="tight"
      {...props}
    >
      {children}
    </button>
  );
}
