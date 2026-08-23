// ═══════════════════════════════════════════════════════════════
// Modal Component — Reusable modal dialog
// ═══════════════════════════════════════════════════════════════

"use client";

import { X } from "lucide-react";

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

const sizeMap = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-3xl",
};

export default function Modal({
  open,
  onClose,
  title,
  icon: Icon,
  iconColor = "text-neon-cyan",
  children,
  footer,
  size = "md",
}: ModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className={`w-full ${sizeMap[size]} mx-4 rounded-xl border border-white/10 bg-dark-950 shadow-2xl max-h-[85vh] flex flex-col`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 flex-shrink-0">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            {Icon && <Icon className={`w-5 h-5 ${iconColor}`} />}
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-ps-text-muted hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1 min-h-0">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-white/10 flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
