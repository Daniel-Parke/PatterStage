import { neon, neonAlpha, type NeonColor } from "./colors";

export interface RadarAxis {
  label: string;
  value: number; // 0–100
}

interface RadarChartProps {
  axes: RadarAxis[];
  size?: number;
  color?: NeonColor;
  className?: string;
}

/** Attributes radar (regular polygon). Pure SVG; 0–100 per axis. */
export default function RadarChart({ axes, size = 220, color = "cyan", className }: RadarChartProps) {
  const n = axes.length;
  if (n < 3) return <svg width={size} height={size} className={className} />;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 26;

  const point = (i: number, frac: number): [number, number] => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [cx + Math.cos(a) * r * frac, cy + Math.sin(a) * r * frac];
  };
  const poly = (frac: number) => axes.map((_, i) => point(i, frac).join(",")).join(" ");
  const dataPoly = axes.map((ax, i) => point(i, Math.max(0, Math.min(1, ax.value / 100))).join(",")).join(" ");

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={className}>
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon key={f} points={poly(f)} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
      ))}
      {axes.map((_, i) => {
        const [x, y] = point(i, 1);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />;
      })}
      <polygon
        points={dataPoly}
        fill={neonAlpha(color, 22)}
        stroke={neon(color)}
        strokeWidth={2}
        strokeLinejoin="round"
        style={{ filter: `drop-shadow(0 0 6px ${neonAlpha(color, 50)})` }}
      />
      {axes.map((ax, i) => {
        const [x, y] = point(i, 1.16);
        return (
          <text key={ax.label} x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="fill-white/50" style={{ fontSize: 10, fontFamily: "var(--font-mono)" }}>
            {ax.label}
          </text>
        );
      })}
    </svg>
  );
}
