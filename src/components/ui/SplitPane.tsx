// ═══════════════════════════════════════════════════════════════
// SplitPane — a list that chooses, and the thing chosen.
//
// Chat, Logs, Composer and Research were this shape built four times, each
// with its own breakpoint, its own widths and its own idea of a phone. Chat's
// idea was to keep its 240px list beside a 100px transcript, where the review
// of 2026-09-08 measured a failed run reading one word per line and the send
// button as a sliver. The records had carried "one shared layout" since
// T-0124; this is it (T-0131).
//
// From lg the aside is a column beside the main pane. Below lg it is behind a
// button that opens it as a Dialog sheet, and the sheet closes itself when
// the caller's selection changes, because choosing is what the list was for;
// the main pane takes the whole width. The split is lg, not md, because the
// grids this replaces split there and a 320px list beside a workflow canvas
// does not fit a 768px tablet either.
//
// The viewport is read on the client, so the server renders the two-column
// shape; the column is hidden below lg by CSS until then, and the button
// appears when the width is known, rather than the column flashing and going.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { PanelLeft } from "lucide-react";

import Button from "@/components/ui/Button";
import Dialog from "@/components/ui/Dialog";
import { useIsMobile } from "@/hooks/useIsMobile";

/** Below lg the aside is the sheet. */
const NARROW_QUERY = "(max-width: 1023px)";

export interface SplitPaneProps {
  /** The list: what the operator chooses from. */
  aside: ReactNode;
  /** Names the aside: the button below lg and the sheet's title. */
  asideLabel: string;
  /** The column's width from lg, as the utility class. */
  asideWidth?: string;
  /** Classes for the column only (a surface, a divider); the sheet has its own. */
  asideClassName?: string;
  /** Fill the remaining height and let each pane scroll itself. */
  fill?: boolean;
  /** The sheet closes when this changes: pass the selection. */
  closeOnChange?: unknown;
  /** The space between the columns: none, when the aside draws its own divider, or md. */
  gap?: "none" | "md";
  className?: string;
  children: ReactNode;
}

export default function SplitPane({
  aside,
  asideLabel,
  asideWidth = "lg:w-72",
  asideClassName = "",
  fill = false,
  closeOnChange,
  gap = "none",
  className = "",
  children,
}: SplitPaneProps) {
  const narrow = useIsMobile(NARROW_QUERY);
  const [open, setOpen] = useState(false);

  // Close on a CHANGE of the selection, not on every render: a ref holds the
  // last value so the same selection rendered again leaves the sheet open.
  const last = useRef(closeOnChange);
  useEffect(() => {
    if (Object.is(last.current, closeOnChange)) return;
    last.current = closeOnChange;
    setOpen(false);
  }, [closeOnChange]);

  const root = [
    "flex flex-col lg:flex-row",
    fill ? "min-h-0 flex-1 overflow-hidden" : "",
    gap === "md" ? "gap-4" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={root}>
      {narrow ? (
        <>
          <div
            className={`flex shrink-0 items-center lg:hidden ${
              gap === "none" ? "border-b border-ps-edge-hairline px-4 py-2" : ""
            }`}
          >
            <Button
              size="sm"
              variant="secondary"
              icon={PanelLeft}
              aria-haspopup="dialog"
              aria-expanded={open}
              onClick={() => setOpen(true)}
            >
              {asideLabel}
            </Button>
          </div>
          <Dialog open={open} onClose={() => setOpen(false)} title={asideLabel} placement="sheet">
            <div className="flex min-h-0 flex-col">{aside}</div>
          </Dialog>
        </>
      ) : (
        <div className={`hidden min-h-0 shrink-0 flex-col lg:flex ${asideWidth} ${asideClassName}`.trim()}>
          {aside}
        </div>
      )}
      <div data-ps-split="main" className="flex min-h-0 min-w-0 flex-1 flex-col">
        {children}
      </div>
    </div>
  );
}
