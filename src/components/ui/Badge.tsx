// ═══════════════════════════════════════════════════════════════
// Badge Component — Tags, status indicators, labels
// ═══════════════════════════════════════════════════════════════

import type { AccentColor } from "@/types/console";

interface BadgeProps {
  children: React.ReactNode;
  color?: AccentColor | "gray" | "red";
  size?: "sm" | "md";
  variant?: "solid" | "outline";
  className?: string;
}

const colorMap: Record<string, { bg: string; text: string; border: string }> = {
  cyan: { bg: "bg-neon-cyan/10", text: "text-neon-cyan", border: "border-neon-cyan/20" },
  purple: { bg: "bg-neon-purple/10", text: "text-neon-purple", border: "border-neon-purple/20" },
  green: { bg: "bg-neon-green/10", text: "text-neon-green", border: "border-neon-green/20" },
  pink: { bg: "bg-neon-pink/10", text: "text-neon-pink", border: "border-neon-pink/20" },
  orange: { bg: "bg-neon-orange/10", text: "text-neon-orange", border: "border-neon-orange/20" },
  gray: { bg: "bg-white/5", text: "text-ps-text-muted", border: "border-white/10" },
  red: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20" },
};

const sizeMap = {
  sm: "text-xs px-1.5 py-0.5",
  md: "text-xs px-2 py-0.5",
};

export default function Badge({
  children,
  color = "gray",
  size = "sm",
  variant = "solid",
  className = "",
}: BadgeProps) {
  const c = colorMap[color] || colorMap.gray;
  const s = sizeMap[size];

  const variantClass =
    variant === "outline"
      ? `bg-transparent border ${c.border} ${c.text}`
      : `${c.bg} ${c.text}`;

  return (
    <span
      className={`inline-flex items-center font-mono rounded ${s} ${variantClass} ${className}`}
    >
      {children}
    </span>
  );
}
