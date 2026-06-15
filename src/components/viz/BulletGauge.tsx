import { neon, neonAlpha, type NeonColor } from "./colors";
import { niceMax, scaleLinear } from "./geometry";

interface BulletGaugeProps {
  value: number;
  /** Optional target marker (vertical tick). */
  target?: number;
  /** Upper bound; defaults to a nice round number above max(value,target). */
  max?: number;
  color?: NeonColor;
  label?: string;
  format?: (v: number) => string;
  className?: string;
}

/**
 * A compact bullet gauge: a measure bar with an optional target marker.
 * Great for "this vs goal" KPIs. Pure SVG, responsive width.
 */
export default function BulletGauge({
  value,
  target,
  max,
  color = "green",
  label,
  format = (v) => v.toLocaleString(),
  className,
}: BulletGaugeProps) {
  const W = 300;
  const H = 28;
  const top = label ? 14 : 6;
  const barH = 8;
  const upper = max ?? niceMax(Math.max(value, target ?? 0, 1));
  const vx = scaleLinear(Math.min(value, upper), 0, upper, 0, W);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} className={className} preserveAspectRatio="none">
      {label && (
        <text x={0} y={8} fill="rgba(255,255,255,0.45)" fontSize={8} fontFamily="monospace">
          {label}
        </text>
      )}
      {/* track */}
      <rect x={0} y={top} width={W} height={barH} rx={barH / 2} fill="rgba(255,255,255,0.05)" />
      {/* measure */}
      <rect
        x={0}
        y={top}
        width={Math.max(0, vx)}
        height={barH}
        rx={barH / 2}
        fill={neonAlpha(color, 60)}
        stroke={neon(color)}
        strokeWidth={0.75}
        style={{ transition: "width 0.6s cubic-bezier(0.22,1,0.36,1)" }}
      >
        <title>{format(value)}</title>
      </rect>
      {/* target marker */}
      {target !== undefined && (
        <line
          x1={scaleLinear(Math.min(target, upper), 0, upper, 0, W)}
          y1={top - 2}
          x2={scaleLinear(Math.min(target, upper), 0, upper, 0, W)}
          y2={top + barH + 2}
          stroke="rgba(255,255,255,0.7)"
          strokeWidth={1.5}
        >
          <title>{`Target: ${format(target)}`}</title>
        </line>
      )}
    </svg>
  );
}
