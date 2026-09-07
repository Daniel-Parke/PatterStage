// ═══════════════════════════════════════════════════════════════
// Button Component
//
// The chrome lives in button-chrome.ts, shared with IconButton so the two
// cannot drift. What is new here is the HEIGHT: a button was sized by padding
// alone, and padding plus a font size gave twenty distinct heights across 25
// screens. Three are declared now, and the caller picks one (T-0122).
// ═══════════════════════════════════════════════════════════════

"use client";

import { Loader2 } from "lucide-react";

import type { AccentColor } from "@/types/console";
import {
  buttonChrome,
  buttonHeights,
  buttonPadding,
  type ButtonSize,
  type ButtonVariant,
} from "@/components/ui/button-chrome";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  color?: AccentColor;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
  children?: React.ReactNode;
}

export default function Button({
  variant = "secondary",
  color = "cyan",
  size = "md",
  loading = false,
  icon: Icon,
  children,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      className={`${buttonChrome({ variant, color })} ${buttonHeights[size]} ${buttonPadding[size]} ${className}`}
      disabled={disabled || loading}
      // Bloom tier (WG-WEB-011 C), tight variant: a button is a small target
      // and the 200px field would overflow it into a flat wash, so it takes the
      // 90px one. Declared BEFORE the prop spread, so a call site that needs a
      // button not to answer can pass data-bloom={undefined} and win.
      // A disabled button needs no opt-out: browsers do not deliver pointer
      // events to it, so the listener resolves to the container behind it,
      // which is the correct reading. Nothing dead lights up.
      data-bloom="tight"
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
      ) : Icon ? (
        <Icon className="w-4 h-4 flex-shrink-0" />
      ) : null}
      {children}
    </button>
  );
}
