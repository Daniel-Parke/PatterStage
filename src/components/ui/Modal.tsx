// ═══════════════════════════════════════════════════════════════
// Modal — a centred Dialog, by its older name
//
// Seventeen consumers and two contract suites (modal-a11y, sheet-a11y) know
// this name and this prop shape. Dialog is the one overlay now (T-0125); this
// is the centred placement with the close named "Close dialog", and nothing
// else. Prefer Dialog in new code.
// ═══════════════════════════════════════════════════════════════

"use client";

import Dialog from "@/components/ui/Dialog";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  iconColor?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}

export default function Modal({ open, onClose, title, icon, iconColor, children, footer, size = "md" }: ModalProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      icon={icon}
      iconColor={iconColor}
      footer={footer}
      size={size}
      placement="center"
      closeLabel="Close dialog"
    >
      {children}
    </Dialog>
  );
}
