// ═══════════════════════════════════════════════════════════════
// Card Component
// ═══════════════════════════════════════════════════════════════

import type { AccentColor } from "@/types/hermes";
import GlowSurface from "@/components/ui/GlowSurface";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  glow?: AccentColor;
  /** Stronger / animated glow (optional). */
  glowIntensity?: number;
  glowAnimated?: boolean;
  hover?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
}

const paddingMap = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
};

export default function Card({
  children,
  className = "",
  glow,
  glowIntensity = 1,
  glowAnimated = false,
  hover = false,
  padding = "md",
}: CardProps) {
  const hoverClass = hover
    ? "hover:border-white/30 transition-colors cursor-pointer"
    : "";
  const padClass = paddingMap[padding];

  const innerClasses = `rounded-xl border border-white/10 bg-dark-900/50 min-w-0 ${padClass} ${hoverClass} ${className}`;

  return (
    <GlowSurface
      accent={glow}
      intensity={glowIntensity}
      animated={glowAnimated}
      className={innerClasses}
    >
      {children}
    </GlowSurface>
  );
}

// ── Status Dot ─────────────────────────────────────────────────
export function StatusDot({
  status,
  pulse = false,
}: {
  status: "online" | "warning" | "error" | "idle";
  pulse?: boolean;
}) {
  const colors = {
    online: "bg-neon-green",
    warning: "bg-neon-orange",
    error: "bg-red-500",
    idle: "bg-white/30",
  };

  return (
    <div
      className={`w-2 h-2 rounded-full ${colors[status]} ${pulse && status === "online" ? "pulse-glow" : ""}`}
    />
  );
}

// ── Stat Card (dashboard style) ────────────────────────────────
export function StatCard({
  icon: Icon,
  label,
  value,
  status = "online",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  status?: "online" | "warning" | "error" | "idle";
}) {
  return (
    <Card hover>
      <div className="flex items-center justify-between mb-2">
        <Icon className="w-4 h-4 text-white/40" />
        <StatusDot status={status} pulse />
      </div>
      <div className="text-2xl font-bold font-mono text-white">{value}</div>
      <div className="text-xs text-white/40 mt-1">{label}</div>
    </Card>
  );
}
