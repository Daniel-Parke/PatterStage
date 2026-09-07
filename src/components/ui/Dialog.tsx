// ═══════════════════════════════════════════════════════════════
// Dialog — the one overlay, with a placement.
//
// Modal and Sheet already shared useDialogA11y and were correct (T-0036,
// T-0096); what they did not share was their chrome, and the two Models
// overlays that hand-rolled a backdrop, a panel, a header and a footer a
// third and fourth time each did it a little differently. T-0122 deferred
// this until the third shape was known. It is: `center` for a form or a
// confirmation, `right` and `bottom` for a detail pane, and `sheet`, which is
// right on a desktop and bottom on a phone (T-0125).
//
// Modal and Sheet are two names for this now, so their seventeen consumers
// and their contract suites are untouched. The behaviour - role, Escape, the
// Tab trap, focus restored, scroll locked - is still the hook's; this file
// owns only the chrome and the labelling.
//
// A centred dialog does NOT close on a backdrop click. It holds a form or a
// question, and a stray click on the dark part of the screen must not throw
// either away; a side pane does close, because it is a detail you looked at
// and are done with.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import IconButton from "@/components/ui/IconButton";
import { useDialogA11y } from "@/hooks/useDialogA11y";

type DialogPlacement = "center" | "right" | "bottom" | "sheet";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  /** An explicit id for the heading, for a consumer that pins one. */
  titleId?: string;
  icon?: React.ComponentType<{ className?: string }>;
  iconColor?: string;
  children: ReactNode;
  footer?: ReactNode;
  placement?: DialogPlacement;
  /** The width of a centred dialog. */
  size?: "sm" | "md" | "lg" | "xl";
  /** The accessible name when there is no title to be named by. */
  ariaLabel?: string;
  /** The name of the X. */
  closeLabel?: string;
  /** Whether a click on the backdrop closes it. Defaults by placement. */
  dismissOnOverlay?: boolean;
  /** Extra classes for the panel. */
  className?: string;
}

const SIZE = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-3xl",
} as const;

const ROOT: Record<Exclude<DialogPlacement, "sheet">, string> = {
  center: "flex items-center justify-center p-4",
  right: "flex justify-end",
  bottom: "flex items-end",
};

const PANEL: Record<Exclude<DialogPlacement, "sheet">, string> = {
  center: "w-full max-h-[85vh] rounded-ps-lg border border-ps-edge-hairline",
  right:
    "h-full w-full max-w-[min(90vw,56rem)] border-l border-ps-edge-hairline sm:max-w-2xl lg:max-w-3xl xl:max-w-4xl",
  bottom: "w-full max-h-[92vh] rounded-t-ps-lg border-t border-ps-edge-hairline",
};

export default function Dialog({
  open,
  onClose,
  title,
  subtitle,
  titleId,
  icon: Icon,
  iconColor = "text-neon-cyan",
  children,
  footer,
  placement = "center",
  size = "md",
  ariaLabel,
  closeLabel = "Close dialog",
  dismissOnOverlay,
  className = "",
}: DialogProps) {
  // Every hook before the early return, or an opening dialog would change
  // the hook count for this component.
  const generatedId = useId();
  const headingId = titleId ?? generatedId;
  const panelRef = useDialogA11y({ open, onClose });
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    if (placement !== "sheet") return;
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [placement]);

  if (!open || typeof document === "undefined") return null;

  const resolved: Exclude<DialogPlacement, "sheet"> =
    placement === "sheet" ? (narrow ? "bottom" : "right") : placement;
  const dismiss = dismissOnOverlay ?? resolved !== "center";
  const labelling = ariaLabel
    ? { "aria-label": ariaLabel }
    : title
      ? { "aria-labelledby": headingId }
      : { "aria-label": "Panel" };

  return createPortal(
    <div className={`fixed inset-0 z-modal ${ROOT[resolved]}`}>
      {dismiss ? (
        <button
          type="button"
          aria-label="Close overlay"
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
      ) : (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" />
      )}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        {...labelling}
        tabIndex={-1}
        data-placement={resolved}
        // design-lint-disable-next-line no-bare-outline-none -- the panel takes programmatic focus on open so its title is announced; a ring around the whole panel is noise
        className={`relative flex flex-col bg-ps-surface-raised shadow-ps-raised ${PANEL[resolved]} ${
          resolved === "center" ? SIZE[size] : ""
        } ${className}`.trim()}
      >
        {(title || Icon) && (
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-ps-edge-hairline px-5 py-4">
            <div className="min-w-0">
              <h2 id={headingId} className="flex items-center gap-2 text-title font-bold text-ps-text-primary">
                {Icon && <Icon className={`h-5 w-5 shrink-0 ${iconColor}`} />}
                {title}
              </h2>
              {subtitle && <p className="mt-1 font-mono text-micro text-ps-text-muted">{subtitle}</p>}
            </div>
            <IconButton icon={X} label={closeLabel} size="sm" onClick={onClose} />
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
        {footer && (
          <div className="flex shrink-0 items-center justify-end gap-3 border-t border-ps-edge-hairline px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
