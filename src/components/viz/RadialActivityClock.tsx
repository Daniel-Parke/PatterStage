import { neon, neonAlpha, type NeonColor } from "./colors";
import { polarPoint } from "./geometry";

interface RadialActivityClockProps {
  /** 24 values, index = hour-of-day (0–23). */
  hours: number[];
  color?: NeonColor;
  size?: number;
  className?: string;
}

/**
 * 24-hour polar "activity clock": one radial bar per hour, length ∝ activity.
 * 0 (midnight) at the top, clockwise. Pure SVG.
 */
export default function RadialActivityClock({
  hours,
  color = "cyan",
  size = 200,
  className,
}: RadialActivityClockProps) {
  const cx = size / 2;
  const cy = size / 2;
  const rInner = size * 0.18;
  const rOuter = size * 0.46;
  const max = Math.max(1, ...hours);
  // The hour labels sit at rOuter + 10, which is 102 of a 200-unit box, so at
  // any legible size they overhang the viewport and the outermost <svg> clips
  // them. Padding the viewBox rather than moving the labels keeps every radius
  // and every proportion exactly as it was; the drawing simply scales down a
  // little inside the same container (T-0114).
  const pad = size * 0.07;

  return (
    <svg
      viewBox={`${-pad} ${-pad} ${size + pad * 2} ${size + pad * 2}`}
      width="100%"
      height="100%"
      className={className}
    >
      {/* guide rings */}
      <circle cx={cx} cy={cy} r={rOuter} fill="none" stroke="var(--color-ps-viz-guide)" />
      <circle cx={cx} cy={cy} r={rInner} fill="none" stroke="var(--color-ps-viz-guide)" />
      {/* quadrant ticks (0/6/12/18h) */}
      {[0, 6, 12, 18].map((h) => {
        const a = (h / 24) * 360;
        const p1 = polarPoint(cx, cy, rInner, a);
        const p2 = polarPoint(cx, cy, rOuter + 4, a);
        return (
          <line
            key={h}
            x1={p1.x}
            y1={p1.y}
            x2={p2.x}
            y2={p2.y}
            stroke="var(--color-ps-viz-axis)"
            strokeWidth={1}
          />
        );
      })}
      {/* hour labels */}
      {[
        { h: 0, label: "0" },
        { h: 6, label: "6" },
        { h: 12, label: "12" },
        { h: 18, label: "18" },
      ].map(({ h, label }) => {
        const p = polarPoint(cx, cy, rOuter + 10, (h / 24) * 360);
        return (
          <text
            key={h}
            x={p.x}
            y={p.y}
            fill="var(--color-ps-text-faint)"
            fontSize={12}
            fontFamily="monospace"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {label}
          </text>
        );
      })}
      {/* radial bars */}
      {hours.map((v, h) => {
        const a = (h / 24) * 360;
        const len = rInner + (v / max) * (rOuter - rInner);
        const base = polarPoint(cx, cy, rInner, a);
        const tip = polarPoint(cx, cy, len, a);
        return (
          <line
            key={h}
            x1={base.x}
            y1={base.y}
            x2={tip.x}
            y2={tip.y}
            stroke={v > 0 ? neon(color) : neonAlpha(color, 12)}
            strokeWidth={size * 0.028}
            strokeLinecap="round"
            opacity={v > 0 ? 0.5 + 0.5 * (v / max) : 1}
          >
            <title>{`${String(h).padStart(2, "0")}:00 — ${v} event${v === 1 ? "" : "s"}`}</title>
          </line>
        );
      })}
    </svg>
  );
}
