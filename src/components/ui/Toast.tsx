// ═══════════════════════════════════════════════════════════════
// Toast Component — Transient notification messages
// ═══════════════════════════════════════════════════════════════

"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Check, AlertCircle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "info";

interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose: () => void;
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

function Toast({
  message,
  type = "success",
  duration = 4000,
  onClose,
}: ToastProps) {
  const [visible, setVisible] = useState(true);
  const config = typeConfig[type];
  const Icon = config.icon;

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 200);
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 ${config.bg} border ${config.border} ${config.text} text-sm font-mono px-4 py-2.5 rounded-xl shadow-lg transition-all duration-200 ${
        visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
      }`}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span>{message}</span>
      <button
        onClick={() => {
          setVisible(false);
          setTimeout(onClose, 200);
        }}
        className="ml-2 p-0.5 rounded hover:bg-white/10 transition-colors"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

// ── useToast hook ──────────────────────────────────────────────

interface ToastState {
  message: string;
  type: ToastType;
  id: number;
}

/** Prefer destructuring `{ showToast, toastElement }` — the returned object is not referentially stable when toasts mount/unmount. */
export function useToast(duration = 4000) {
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback((message: string, type: ToastType = "success") => {
    setToast({ message, type, id: Date.now() });
  }, []);

  const handleClose = useCallback(() => setToast(null), []);

  const toastElement = useMemo(
    () =>
      toast ? (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          duration={duration}
          onClose={handleClose}
        />
      ) : null,
    [toast, handleClose, duration]
  );

  return useMemo(() => ({ showToast, toastElement }), [showToast, toastElement]);
}
