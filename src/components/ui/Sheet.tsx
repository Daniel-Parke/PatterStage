// ═══════════════════════════════════════════════════════════════
// Sheet — a side Dialog, by its older name
//
// Right on a desktop, bottom on a phone, unless a side is forced. The
// backdrop closes it, and the close is named "Close panel", which is what its
// callers and its contract suite rely on. Dialog is the one overlay now
// (T-0125); prefer it in new code.
// ═══════════════════════════════════════════════════════════════

"use client";

import type { ReactNode } from "react";

import Dialog from "@/components/ui/Dialog";

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Force side; when omitted, bottom on viewports below `md`, right otherwise */
  side?: "right" | "bottom";
}

export default function Sheet({ open, onClose, title, subtitle, children, footer, side }: SheetProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      footer={footer}
      placement={side ?? "sheet"}
      ariaLabel={title ?? "Panel"}
      closeLabel="Close panel"
      dismissOnOverlay
    >
      {children}
    </Dialog>
  );
}
