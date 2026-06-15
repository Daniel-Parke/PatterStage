import { neon, neonAlpha, gradId, type NeonColor } from "./colors";

interface SparklineProps {
  data: number[];
  color?: NeonColor;
  width?: number;
  height?: number;
  strokeWidth?: number;
  /** Fill the area under the line with a fading gradient. */
  fill?: boolean;
  className?: string;
}

/**
 * Minimal trend line. Pure SVG, no deps. Scales to its data's min/max with a
 * small vertical pad so flat series still render a centred line.
 */
export default function Sparkline({
  data,
  color = "cyan",
  width = 120,
  height = 36,
  strokeWidth = 2,
  fill = true,
  className,
}: SparklineProps) {
  const n = data.length;
  if (n === 0) return <svg width={width} height={height} className={className} />;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pad = strokeWidth + 1;
  const innerH = height - pad * 2;
  const x = (i: number) => (n === 1 ? width / 2 : (i / (n - 1)) * width);
  const y = (v: number) => pad + innerH - ((v - min) / span) * innerH;

  const line = data.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  const id = gradId("spark");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} preserveAspectRatio="none">
      {fill && (
        <>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={neonAlpha(color, 35)} />
              <stop offset="100%" stopColor={neonAlpha(color, 0)} />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#${id})`} />
        </>
      )}
      <path
        d={line}
        fill="none"
        stroke={neon(color)}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        className="viz-draw"
      />
    </svg>
  );
}
