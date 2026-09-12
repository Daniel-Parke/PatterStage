// ═══════════════════════════════════════════════════════════════
// IconButton — a square control with a name it cannot forget.
//
// An icon-only button has no text, so its accessible name has to be declared.
// `check-icon-button-names.mjs` exists because thirty-odd of them once had
// none, and a lint rule that catches it afterwards is strictly worse than a
// required prop that stops it being written (T-0122).
//
// Square, and off the same three heights as Button, so an icon control can
// never again be the 39x22 the rail's collapsed rows were - under the 24x24
// WCAG 2.5.8 asks of a target.
// ═══════════════════════════════════════════════════════════════

"use client";

import { Loader2 } from "lucide-react";

import type { ButtonProps } from "@/components/ui/Button";
import { buttonChrome, type ButtonSize } from "@/components/ui/button-chrome";

export interface IconButtonProps
  extends Omit<ButtonProps, "children" | "icon" | "size" | "aria-label"> {
  icon: React.ComponentType<{ className?: string }>;
  /** The accessible name. Required: an icon is not a label. */
  label: string;
  size?: ButtonSize;
}

const squareMap: Record<ButtonSize, string> = {
  sm: "h-6.5 w-6.5",
  md: "h-8 w-8",
  lg: "h-10 w-10",
};

const glyphMap: Record<ButtonSize, string> = {
  sm: "w-3.5 h-3.5",
  md: "w-4 h-4",
  lg: "w-5 h-5",
};

export default function IconButton({
  icon: Icon,
  label,
  size = "md",
  variant = "ghost",
  color = "cyan",
  loading = false,
  className = "",
  disabled,
  ...props
}: IconButtonProps) {
  const Glyph = loading ? Loader2 : Icon;
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`${buttonChrome({ variant, color })} ${squareMap[size]} shrink-0 justify-center p-0 ${className}`}
      disabled={disabled || loading}
      // Bloom tier (WG-WEB-011 C), tight variant — see Button for why.
      data-bloom="tight"
      {...props}
    >
      <Glyph
        className={`${glyphMap[size]} ${loading ? "animate-spin" : ""}`}
        // The name is on the button. An icon that announces itself beside a
        // labelled button is the same thing said twice.
        aria-hidden="true"
      />
    </button>
  );
}
