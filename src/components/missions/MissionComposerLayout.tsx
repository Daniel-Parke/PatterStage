"use client";

import { useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";

export function ComposerFieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="text-xs text-white/40 font-mono block mb-1.5">
      {children}
    </label>
  );
}

const ACCENT_BORDER: Record<string, string> = {
  cyan: "border-l-neon-cyan/50",
  purple: "border-l-neon-purple/50",
  pink: "border-l-neon-pink/50",
  green: "border-l-neon-green/50",
};

export function ComposerAccordion({
  title,
  description,
  defaultOpen = false,
  step,
  accent = "cyan",
  hintWhenCollapsed = "Expand to configure",
  onOpenChange,
  actions,
  children,
}: {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  step?: number;
  accent?: "cyan" | "purple" | "pink" | "green";
  hintWhenCollapsed?: string;
  onOpenChange?: (open: boolean) => void;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    onOpenChange?.(next);
  };

  const borderAccent = ACCENT_BORDER[accent] ?? ACCENT_BORDER.cyan;

  return (
    <section
      className={`pt-6 border-t border-white/10 overflow-visible border-l-2 pl-3 -ml-0.5 ${!open ? borderAccent : "border-l-white/10"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={toggle}
          className="flex-1 flex items-start justify-between gap-3 py-3 text-left hover:bg-white/[0.02] rounded-lg -mx-1 px-1 transition-colors min-w-0"
          aria-expanded={open}
        >
          <span className="min-w-0 flex items-start gap-2">
            {step != null && (
              <span className="shrink-0 w-5 h-5 rounded-full border border-white/20 text-[10px] font-mono text-white/50 flex items-center justify-center mt-0.5">
                {step}
              </span>
            )}
            <span className="min-w-0">
              <span className="block text-xs font-mono text-white/50 uppercase tracking-widest">
                {title}
              </span>
              {description && (
                <span className="block text-xs text-white/30 font-mono mt-1 leading-relaxed">
                  {description}
                </span>
              )}
              {!open && hintWhenCollapsed && (
                <span className="block text-[10px] text-neon-cyan/50 font-mono mt-1.5">
                  {hintWhenCollapsed}
                </span>
              )}
            </span>
          </span>
          <ChevronRight
            className={`w-4 h-4 text-white/40 shrink-0 mt-0.5 transition-transform ${open ? "rotate-90" : ""}`}
          />
        </button>
        {actions && (
          <div className="shrink-0 pt-3" onClick={(e) => e.stopPropagation()}>
            {actions}
          </div>
        )}
      </div>
      {open && (
        <div className="pb-2 pt-2 space-y-4 overflow-visible">{children}</div>
      )}
    </section>
  );
}
