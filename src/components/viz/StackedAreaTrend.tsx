import { neon, neonAlpha, gradId, type NeonColor } from "./colors";

export interface StackedSeries {
  key: string;
  label: string;
  color: NeonColor;
}

export interface StackedPoint {
  date: string;
  /** value per series key */
  values: Record<string, number>;
}

interface StackedAreaTrendProps {
  data: StackedPoint[];
  series: StackedSeries[];
  height?: number;
  className?: string;
}

/**
 * Stacked area chart over a date axis (e.g. activity by category over time).
 * Pure SVG, responsive width via viewBox.
 */
export default function StackedAreaTrend({
  data,
  series,
  height = 120,
  className,
}: StackedAreaTrendProps) {
  const W = 600;
  const H = height;
  const n = data.length;

  if (n === 0) {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} className={className} preserveAspectRatio="none">
        <line x1="0" y1={H - 1} x2={W} y2={H - 1} stroke="var(--color-ps-viz-axis)" />
      </svg>
    );
  }

  const totals = data.map((d) => series.reduce((s, sr) => s + (d.values[sr.key] ?? 0), 0));
  const max = Math.max(1, ...totals);
  const pad = 4;
  const innerH = H - pad * 2;
  const x = (i: number) => (n === 1 ? W / 2 : (i / (n - 1)) * W);
  const y = (v: number) => pad + innerH - (v / max) * innerH;

  // Build stacked bands bottom→top.
  const cumulative = data.map(() => 0);
  const bands = series.map((sr) => {
    const top = data.map((d, i) => {
      const base = cumulative[i];
      const next = base + (d.values[sr.key] ?? 0);
      cumulative[i] = next;
      return { i, base, next };
    });
    const id = gradId(`stack-${sr.key}`);
    const topLine = top.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.i).toFixed(1)},${y(p.next).toFixed(1)}`).join(" ");
    const bottomLine = [...top]
      .reverse()
      .map((p) => `L${x(p.i).toFixed(1)},${y(p.base).toFixed(1)}`)
      .join(" ");
    return { sr, id, d: `${topLine} ${bottomLine} Z` };
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} className={className} preserveAspectRatio="none">
      <defs>
        {bands.map(({ sr, id }) => (
          <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={neonAlpha(sr.color, 55)} />
            <stop offset="100%" stopColor={neonAlpha(sr.color, 18)} />
          </linearGradient>
        ))}
      </defs>
      {bands.map(({ sr, id, d }) => (
        <path key={sr.key} d={d} fill={`url(#${id})`} stroke={neon(sr.color)} strokeWidth={0.75} strokeOpacity={0.5} />
      ))}
    </svg>
  );
}
