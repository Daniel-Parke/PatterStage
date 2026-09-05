"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { useDialogA11y } from "@/hooks/useDialogA11y";

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

export default function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  side,
}: SheetProps) {
  const [isMobile, setIsMobile] = useState(false);

  // Escape, the body scroll lock and, new with T-0036, the focus trap and
  // focus restoration. This used to be an inline effect here; Modal needed
  // the same behaviour, so it moved to a hook both components call rather
  // than being written a second time. Sheet's props are unchanged.
  const panelRef = useDialogA11y({ open, onClose });

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  if (!open || typeof document === "undefined") return null;

  const effectiveSide = side ?? (isMobile ? "bottom" : "right");

  const panelClass =
    effectiveSide === "bottom"
      ? "fixed inset-x-0 bottom-0 z-[61] max-h-[92vh] rounded-t-xl border-t border-white/10"
      : "fixed top-0 right-0 bottom-0 z-[61] w-full border-l border-white/10 sm:max-w-2xl lg:max-w-3xl xl:max-w-4xl max-w-[min(90vw,56rem)]";

  return createPortal(
    <>
      <button
        type="button"
        aria-label="Close overlay"
        className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        // design-lint-disable-next-line no-bare-outline-none -- the sheet panel takes programmatic focus on open so its title is announced; a ring around the whole panel is noise
        className={`${panelClass} flex flex-col bg-dark-950 shadow-2xl outline-none`}
        role="dialog"
        aria-modal="true"
        aria-label={title ?? "Panel"}
        tabIndex={-1}
      >
        {title && (
          <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-white/10 shrink-0">
            <div className="min-w-0">
              <h2 className="text-sm font-mono text-neon-cyan uppercase tracking-widest">
                {title}
              </h2>
              {subtitle && (
                <p className="text-xs text-ps-text-muted font-mono mt-1 leading-relaxed">
                  {subtitle}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded text-ps-text-muted hover:text-ps-text-primary shrink-0"
              aria-label="Close panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto min-h-0">{children}</div>
        {footer && (
          <div className="shrink-0 border-t border-white/10 px-6 py-4 bg-dark-950">
            {footer}
          </div>
        )}
      </div>
    </>,
    document.body,
  );
}
