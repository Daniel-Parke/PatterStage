import { neon, neonAlpha, type NeonColor } from "./colors";

export interface TopListRow {
  label: string;
  value: number;
  /** Optional secondary value shown muted (e.g. token count). */
  sub?: string;
}

interface TopListProps {
  rows: TopListRow[];
  color?: NeonColor;
  /** Formatter for the primary value. */
  format?: (v: number) => string;
  className?: string;
}

/**
 * Horizontal bar-rank list (top missions, per-model tokens, …). Each row is a
 * label + an inline proportional bar + a value. Pure CSS/flex (no SVG).
 */
export default function TopList({
  rows,
  color = "cyan",
  format = (v) => v.toLocaleString(),
  className = "",
}: TopListProps) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) {
    return <p className={`text-xs text-white/30 ${className}`}>No data yet.</p>;
  }
  return (
    <div className={`space-y-1.5 ${className}`}>
      {rows.map((r, i) => (
        <div key={`${r.label}-${i}`} className="relative overflow-hidden rounded-md">
          {/* proportional bar */}
          <div
            className="absolute inset-y-0 left-0 rounded-md"
            style={{
              width: `${(r.value / max) * 100}%`,
              background: neonAlpha(color, 14),
              transition: "width 0.6s cubic-bezier(0.22,1,0.36,1)",
            }}
          />
          <div className="relative flex items-center justify-between gap-2 px-2 py-1">
            <span className="min-w-0 flex-1 truncate text-xs text-white/75" title={r.label}>
              <span className="mr-1.5 font-mono text-[10px] text-white/30">{i + 1}</span>
              {r.label}
            </span>
            <span className="flex items-baseline gap-1.5 font-mono text-xs" style={{ color: neon(color) }}>
              {r.sub && <span className="text-[10px] text-white/30">{r.sub}</span>}
              {format(r.value)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
