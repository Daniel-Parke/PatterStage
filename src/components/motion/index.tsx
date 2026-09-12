// ═══════════════════════════════════════════════════════════════
// Stagger, StaggerItem, Collapse — in CSS
//
// These three wrappers were the only importers of the animation library: 669
// KB, and a 5.5 MB peer behind it, to fade a grid in and open a panel, both
// of which globals.css already did (`ch-float-in`). The dependency is gone
// (T-0129); the names and the callers stay.
//
//   Stagger      a `.ps-stagger` container: the stylesheet floats each child in
//                and staggers them by child order, so items carry no state.
//   StaggerItem  a plain block, kept so call sites read as they did.
//   Collapse     mounts its children when open and not otherwise, floated in,
//                which is what AnimatePresence left behind once its exit ran.
//
// Reduced motion costs nothing here: the reduce rule is universal since
// T-0128, so both animations halt for an operator who asked for that.
// ═══════════════════════════════════════════════════════════════

import type { ReactNode } from "react";

export function Stagger({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={`ps-stagger ${className ?? ""}`.trim()}>{children}</div>;
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}

export function Collapse({ open, children, className }: { open: boolean; children: ReactNode; className?: string }) {
  if (!open) return null;
  return <div className={`animate-float-in ${className ?? ""}`.trim()}>{children}</div>;
}
