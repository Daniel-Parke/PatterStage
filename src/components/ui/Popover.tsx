// ═══════════════════════════════════════════════════════════════
// Popover — a trigger, a panel beside it, and one way to close.
//
// The behaviour is useDismissable's; this file owns only the chrome and the
// positioning, so that the ten components which each hand-rolled both get one
// answer to "what does an open menu look like" instead of ten (T-0122).
//
// The wrapper encloses the trigger AND the panel deliberately: a pointer down
// on the trigger of an OPEN popover must not read as "outside", or a toggle
// would close and reopen on the same click and never appear to work.
//
// What this is NOT is a listbox. It carries no role, because a filter menu, a
// disclosure and a combobox are three different things to a screen reader and
// the caller is the only one that knows which it is building.
// ═══════════════════════════════════════════════════════════════

"use client";

import type { ReactNode } from "react";

import { useDismissable } from "@/hooks/useDismissable";

export interface PopoverProps {
  open: boolean;
  onClose: () => void;
  /** The control that opens it. Rendered inside the dismissable region. */
  trigger: ReactNode;
  children: ReactNode;
  /** Which edge the panel hangs from. Defaults to the left. */
  align?: "left" | "right";
  /** Extra classes for the PANEL, typically a width. */
  className?: string;
}

export default function Popover({
  open,
  onClose,
  trigger,
  children,
  align = "left",
  className = "",
}: PopoverProps) {
  const containerRef = useDismissable<HTMLSpanElement>({ open, onClose });

  return (
    <span ref={containerRef} className="relative inline-flex">
      {trigger}
      {open && (
        <div
          className={`absolute top-full ${align === "right" ? "right-0" : "left-0"} mt-1 z-dropdown max-h-80 overflow-y-auto rounded-ps-md border border-ps-edge bg-ps-surface-raised ${className}`}
        >
          {children}
        </div>
      )}
    </span>
  );
}
