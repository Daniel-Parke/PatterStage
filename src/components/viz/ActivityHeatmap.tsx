import { neonAlpha, type NeonColor } from "./colors";

interface HeatPoint {
  date: string; // YYYY-MM-DD
  value: number;
}

interface ActivityHeatmapProps {
  data: HeatPoint[];
  color?: NeonColor;
  /** Cell edge length in px. */
  cell?: number;
  gap?: number;
  className?: string;
}

/**
 * GitHub-style contribution grid: 7 rows (days) × N columns (weeks), intensity
 * scaled to the busiest day. Cells carry a native title tooltip. The input is
 * expected to be a continuous run of days (the stats repo fills gaps with 0).
 */
export default function ActivityHeatmap({
  data,
  color = "green",
  cell = 12,
  gap = 3,
  className,
}: ActivityHeatmapProps) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const step = cell + gap;

  // Group into week columns aligned to weekday (col advances each Sunday).
  const columns: HeatPoint[][] = [];
  let week: HeatPoint[] = [];
  data.forEach((pt, i) => {
    const dow = new Date(`${pt.date}T00:00:00Z`).getUTCDay();
    if (dow === 0 && week.length) {
      columns.push(week);
      week = [];
    }
    week.push(pt);
    if (i === data.length - 1) columns.push(week);
  });

  const intensity = (v: number): string => {
    if (v <= 0) return "var(--color-ps-viz-guide)";
    const t = 0.2 + 0.8 * (v / max); // 20%–100%
    return neonAlpha(color, Math.round(t * 100));
  };

  const width = columns.length * step;
  const height = 7 * step;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      preserveAspectRatio="xMinYMin meet"
      className={className}
      style={{ maxHeight: height }}
    >
      {columns.map((col, ci) =>
        col.map((pt) => {
          const dow = new Date(`${pt.date}T00:00:00Z`).getUTCDay();
          return (
            <rect
              key={pt.date}
              x={ci * step}
              y={dow * step}
              width={cell}
              height={cell}
              rx={2}
              fill={intensity(pt.value)}
              style={pt.value > 0 ? { filter: `drop-shadow(0 0 3px ${neonAlpha(color, 40)})` } : undefined}
            >
              <title>{`${pt.date}: ${pt.value} run${pt.value === 1 ? "" : "s"}`}</title>
            </rect>
          );
        }),
      )}
    </svg>
  );
}
