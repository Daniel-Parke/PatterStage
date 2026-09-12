import { neon, neonAlpha, type NeonColor } from "./colors";

interface ProgressRingProps {
  /** 0–1. */
  value: number;
  color?: NeonColor;
  size?: number;
  thickness?: number;
  label?: React.ReactNode;
  sublabel?: React.ReactNode;
  /** Glow the arc (default true). */
  glow?: boolean;
  className?: string;
}

/**
 * Circular progress gauge with a centred label. Arc starts at 12 o'clock and
 * sweeps clockwise. Used for the dashboard vitals (health, success rate, level).
 */
export default function ProgressRing({
  value,
  color = "cyan",
  size = 92,
  thickness = 8,
  label,
  sublabel,
  glow = true,
  className,
}: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(1, value || 0));
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const center = size / 2;

  return (
    <div className={`relative inline-flex items-center justify-center ${className ?? ""}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={center} cy={center} r={r} fill="none" stroke={neonAlpha(color, 12)} strokeWidth={thickness} />
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke={neon(color)}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
          style={{
            transition: "stroke-dashoffset 700ms cubic-bezier(0.22,1,0.36,1)",
            filter: glow ? `drop-shadow(0 0 6px ${neonAlpha(color, 60)})` : undefined,
          }}
        />
      </svg>
      {(label != null || sublabel != null) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center leading-none">
          {label != null && <span className="font-mono font-semibold text-ps-text-primary">{label}</span>}
          {sublabel != null && <span className="mt-0.5 text-micro uppercase tracking-wider text-ps-text-muted">{sublabel}</span>}
        </div>
      )}
    </div>
  );
}
