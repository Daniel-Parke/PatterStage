import { neon, neonAlpha, gradId, type NeonColor } from "./colors";

export interface AreaPoint {
  date: string;
  completed: number;
  failed?: number;
}

interface AreaTrendProps {
  data: AreaPoint[];
  color?: NeonColor;
  failColor?: NeonColor;
  height?: number;
  className?: string;
}

/**
 * Throughput area chart (completed, with an optional failed overlay line).
 * Responsive width via viewBox; pure SVG. Renders a flat baseline when empty
 * so the panel never collapses.
 */
export default function AreaTrend({
  data,
  color = "cyan",
  failColor = "pink",
  height = 96,
  className,
}: AreaTrendProps) {
  const W = 600;
  const H = height;
  const n = data.length;
  const id = gradId("area");

  if (n === 0) {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className={className} preserveAspectRatio="none" width="100%" height={H}>
        <line x1="0" y1={H - 1} x2={W} y2={H - 1} stroke={neonAlpha(color, 20)} strokeWidth={1} />
      </svg>
    );
  }

  const max = Math.max(1, ...data.map((d) => d.completed), ...data.map((d) => d.failed ?? 0));
  const pad = 6;
  const innerH = H - pad * 2;
  const x = (i: number) => (n === 1 ? W / 2 : (i / (n - 1)) * W);
  const y = (v: number) => pad + innerH - (v / max) * innerH;

  const linePts = (key: (d: AreaPoint) => number) =>
    data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(key(d)).toFixed(1)}`).join(" ");
  const completedLine = linePts((d) => d.completed);
  const completedArea = `${completedLine} L${W},${H} L0,${H} Z`;
  const hasFailures = data.some((d) => (d.failed ?? 0) > 0);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} preserveAspectRatio="none" width="100%" height={H}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={neonAlpha(color, 40)} />
          <stop offset="100%" stopColor={neonAlpha(color, 0)} />
        </linearGradient>
      </defs>
      <path d={completedArea} fill={`url(#${id})`} />
      <path d={completedLine} fill="none" stroke={neon(color)} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" pathLength={1} className="viz-draw" />
      {hasFailures && (
        <path
          d={linePts((d) => d.failed ?? 0)}
          fill="none"
          stroke={neon(failColor)}
          strokeWidth={1.5}
          strokeDasharray="3 3"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}
