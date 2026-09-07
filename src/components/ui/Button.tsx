// ═══════════════════════════════════════════════════════════════
// Button Component
// ═══════════════════════════════════════════════════════════════

"use client";

import { Loader2 } from "lucide-react";
import type { AccentColor } from "@/types/console";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  color?: AccentColor;
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
  children?: React.ReactNode;
}

const colorMap: Record<AccentColor, { bg: string; border: string; text: string; hover: string }> = {
  cyan: {
    bg: "bg-neon-cyan/20",
    border: "border-neon-cyan/30",
    text: "text-neon-cyan",
    hover: "hover:bg-neon-cyan/30",
  },
  purple: {
    bg: "bg-neon-purple/20",
    border: "border-neon-purple/30",
    text: "text-neon-purple",
    hover: "hover:bg-neon-purple/30",
  },
  green: {
    bg: "bg-neon-green/20",
    border: "border-neon-green/30",
    text: "text-neon-green",
    hover: "hover:bg-neon-green/30",
  },
  pink: {
    bg: "bg-neon-pink/20",
    border: "border-neon-pink/30",
    text: "text-neon-pink",
    hover: "hover:bg-neon-pink/30",
  },
  orange: {
    bg: "bg-neon-orange/20",
    border: "border-neon-orange/30",
    text: "text-neon-orange",
    hover: "hover:bg-neon-orange/30",
  },
  red: {
    bg: "bg-red-500/20",
    border: "border-red-500/30",
    text: "text-red-400",
    hover: "hover:bg-red-500/30",
  },
  blue: {
    bg: "bg-blue-500/20",
    border: "border-blue-500/30",
    text: "text-blue-400",
    hover: "hover:bg-blue-500/30",
  },
  yellow: {
    bg: "bg-yellow-500/20",
    border: "border-yellow-500/30",
    text: "text-yellow-400",
    hover: "hover:bg-yellow-500/30",
  },
};

const sizeMap = {
  sm: "px-2.5 py-1.5 text-body gap-1.5",
  md: "px-3.5 py-2 text-body gap-2",
  lg: "px-5 py-2.5 text-lead gap-2.5",
};

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
  const c = colorMap[color];
  const s = sizeMap[size];

  const variantStyles =
    variant === "primary"
      ? `${c.bg} ${c.text} ${c.border} border ${c.hover}`
      : variant === "ghost"
      ? "bg-transparent text-ps-text-secondary border border-transparent hover:bg-ps-surface-raised hover:text-ps-text-primary"
      : variant === "danger"
      ? "bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30"
      : "bg-ps-surface-raised text-ps-text-secondary border border-ps-edge hover:border-ps-edge-emphasis hover:text-ps-text-primary";

  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center rounded-ps-md font-mono transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${variantStyles} ${s} ${className}`}
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
