import { neon, neonAlpha, type NeonColor } from "./colors";

export interface DonutSegment {
  label: string;
  value: number;
  color: NeonColor;
}

interface DonutProps {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  center?: React.ReactNode;
  centerSub?: React.ReactNode;
  className?: string;
}

/**
 * Multi-segment ring (mission status breakdown). Segments render clockwise from
 * 12 o'clock; an empty total draws a faint placeholder ring.
 */
export default function Donut({ segments, size = 120, thickness = 14, center, centerSub, className }: DonutProps) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const cx = size / 2;
  const total = segments.reduce((s, seg) => s + seg.value, 0);

  let offset = 0;
  const arcs = total > 0
    ? segments
        .filter((s) => s.value > 0)
        .map((seg) => {
          const frac = seg.value / total;
          const dash = frac * c;
          const arc = (
            <circle
              key={seg.label}
              cx={cx}
              cy={cx}
              r={r}
              fill="none"
              stroke={neon(seg.color)}
              strokeWidth={thickness}
              strokeDasharray={`${dash} ${c - dash}`}
              strokeDashoffset={-offset}
              style={{ filter: `drop-shadow(0 0 4px ${neonAlpha(seg.color, 45)})`, transition: "stroke-dasharray 600ms ease" }}
            />
          );
          offset += dash;
          return arc;
        })
    : null;

  return (
    <div className={`relative inline-flex items-center justify-center ${className ?? ""}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--color-ps-viz-track)" strokeWidth={thickness} />
        {arcs}
      </svg>
      {(center != null || centerSub != null) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center leading-none">
          {center != null && <span className="font-mono text-title font-semibold text-ps-text-primary">{center}</span>}
          {centerSub != null && <span className="mt-0.5 text-micro uppercase tracking-wider text-ps-text-muted">{centerSub}</span>}
        </div>
      )}
    </div>
  );
}
