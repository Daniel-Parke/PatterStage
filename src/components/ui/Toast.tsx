// ═══════════════════════════════════════════════════════════════
// Toast — the answer to "did that work?"
//
// This is the confirmation path for 73 `showToast` call sites, which makes it
// the most-used piece of feedback in the product. It was also, until T-0050,
// invisible in two separate ways.
//
// IT RENDERED UNDER THE THING THAT TRIGGERED IT. The overlay ladder is Sheet
// backdrop z-[60], Sheet panel z-[61], Modal z-[70], and this component sat at
// z-50 and rendered inline on the page while Sheet portaled to document.body.
// The Sheet occupies the entire right edge, which is exactly where the toast is
// anchored, so every confirmation of a mutation made from inside a sheet or a
// modal was covered by it. A QA pass reported "the dialog stays open and there
// is no toast"; the toast was there, behind the dialog.
//
// A z-index alone would not have been enough. Any ancestor with a transform, a
// filter or a backdrop-blur creates a stacking context a child cannot escape,
// and this app uses backdrop-blur on its overlays, so the toast is portaled to
// the body as well as raised above them.
//
// NOTHING ANNOUNCED IT. There was no role and no aria-live, so a screen reader
// was never told a mutation succeeded or failed, and a harness counting
// [role=status] found zero and concluded nothing had fired. That is the same
// defect as T-0036, where Modal announced itself as a plain div.
//
// AND ERRORS DESTROYED THEIR OWN EXPLANATION. One duration governed everything,
// so the reason a write failed disappeared after four seconds whether or not
// anyone was looking. A success is safe to auto-dismiss because the operator
// asked for it and it happened. A failure is the opposite: it is news, it is
// the only place the reason appears, and it now waits to be dismissed.
//
// AND THEN A SUCCESS DESTROYED THE ERROR ANYWAY (T-0096, D122). The hook held
// one slot, so the persisted error was replaced by the next routine success
// before it was read. The stack now lives in FeedbackProvider, mounted once in
// the shell; useToast() keeps its API and reads the provider. Without a
// provider (a unit test) it falls back to the single slot below.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useContext, useEffect, useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { Check, AlertCircle, Info, X } from "lucide-react";

import { FeedbackContext } from "./feedback-context";

export type ToastType = "success" | "error" | "info";

interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose: () => void;
  /** Position in the stack, bottom-up. 0 is the lowest. */
  index?: number;
}

const typeConfig = {
  success: {
    icon: Check,
    bg: "bg-neon-green/10",
    border: "border-neon-green/30",
    text: "text-neon-green",
  },
  error: {
    icon: AlertCircle,
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    text: "text-red-400",
  },
  info: {
    icon: Info,
    bg: "bg-neon-cyan/10",
    border: "border-neon-cyan/30",
    text: "text-neon-cyan",
  },
};

/** Height of one toast plus its gap, the stride the stack climbs by. */
const STACK_STRIDE_REM = 3.25;

export function ToastView({
  message,
  type = "success",
  duration = 4000,
  onClose,
  index = 0,
}: ToastProps) {
  const [visible, setVisible] = useState(true);
  const [mounted, setMounted] = useState(false);
  const config = typeConfig[type];
  const Icon = config.icon;

  // An error waits. See the header: it is the only place its own reason
  // appears, and four seconds is not a reading.
  const persists = type === "error";

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (persists) return;
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 200);
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose, persists]);

  const node = (
    <div
      // assertive for a failure, polite for everything else. A success is
      // information; a failure interrupts, because the operator is about to act
      // on the belief that the write landed.
      role={type === "error" ? "alert" : "status"}
      aria-live={type === "error" ? "assertive" : "polite"}
      data-testid="toast"
      style={{ bottom: `calc(1.5rem + ${index * STACK_STRIDE_REM}rem)` }}
      className={`fixed right-6 z-[80] flex items-center gap-2 ${config.bg} border ${config.border} ${config.text} text-sm font-mono px-4 py-2.5 rounded-xl shadow-lg transition-all duration-200 ${
        visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
      }`}
    >
      <Icon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
      <span>{message}</span>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => {
          setVisible(false);
          setTimeout(onClose, 200);
        }}
        className="ml-2 p-0.5 rounded hover:bg-white/10 transition-colors"
      >
        <X className="w-3 h-3" aria-hidden="true" />
      </button>
    </div>
  );

  // Portaled so no ancestor stacking context can trap it. `mounted` gates the
  // first render because document.body does not exist during SSR.
  if (!mounted) return null;
  return createPortal(node, document.body);
}

// ── The outcome, after the toast has gone ──────────────────────

/** What happened, and when. Outlives the toast that announced it. */
export interface ToastResult {
  message: string;
  type: ToastType;
  at: Date;
}

/**
 * A durable "this is what happened" line for a settings-shaped surface.
 *
 * A toast answers "did that work?" for about four seconds. This answers it for
 * as long as the page is open, which is what an operator who looked away, or
 * who is deciding whether to click Save again, actually needs. The QA pass
 * called the absence of this the product's most common friction.
 */
export function LastResult({ result }: { result: ToastResult | null }) {
  if (!result) return null;
  const tone = result.type === "error" ? "text-red-400" : "text-ps-text-muted";
  const time = result.at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return (
    <p data-testid="last-result" className={`text-xs font-mono ${tone}`}>
      {result.type === "error" ? "Failed" : "Saved"} at {time}: {result.message}
    </p>
  );
}

// ── useToast hook ──────────────────────────────────────────────

interface ToastState {
  message: string;
  type: ToastType;
  id: number;
}

/**
 * Prefer destructuring `{ showToast, toastElement }` — the returned object is
 * not referentially stable when toasts mount/unmount.
 *
 * Under the shell, `toastElement` is always null: FeedbackProvider renders the
 * stack, and a page that still renders `{toastElement}` renders nothing, which
 * is what keeps the 73 call sites source-compatible. `lastResult` stays per
 * hook, because it is the settings page's own line, not the shell's.
 */
export function useToast(duration = 4000) {
  const shell = useContext(FeedbackContext);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [lastResult, setLastResult] = useState<ToastResult | null>(null);

  const showToast = useCallback(
    (message: string, type: ToastType = "success") => {
      setLastResult({ message, type, at: new Date() });
      if (shell) shell.showToast(message, type);
      else setToast({ message, type, id: Date.now() });
    },
    [shell],
  );

  const handleClose = useCallback(() => setToast(null), []);

  const toastElement = useMemo(
    () =>
      !shell && toast ? (
        <ToastView
          key={toast.id}
          message={toast.message}
          type={toast.type}
          duration={duration}
          onClose={handleClose}
        />
      ) : null,
    [shell, toast, handleClose, duration],
  );

  return useMemo(
    () => ({ showToast, toastElement, lastResult }),
    [showToast, toastElement, lastResult],
  );
}
