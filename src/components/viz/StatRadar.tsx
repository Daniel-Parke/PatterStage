"use client";

// ═══════════════════════════════════════════════════════════════
// StatRadar — the JRPG stat card (SVG hexagon)
//
// Plots the 6 agent stats (STR/DEX/INT/WIS/FOR/SPD) on a hexagonal radar, with
// an optional second card overlaid (e.g. the brain-only baseline) for the
// agent-vs-baseline comparison. Pure SVG, no deps; theme via CSS variables.
// ═══════════════════════════════════════════════════════════════

import { STATS, type Stat, type StatCard } from "@/lib/benchmarks/types";

const SHORT: Record<Stat, string> = {
  strength: "STR",
  dexterity: "DEX",
  intelligence: "INT",
  wisdom: "WIS",
  fortitude: "FOR",
  speed: "SPD",
};

function pointAt(cx: number, cy: number, radius: number, index: number, total: number) {
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2; // start at top
  return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
}

function polygon(card: StatCard, cx: number, cy: number, R: number): string {
  return STATS.map((s, i) => {
    const v = Math.max(0, Math.min(100, card[s])) / 100;
    const p = pointAt(cx, cy, R * v, i, STATS.length);
    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }).join(" ");
}

export default function StatRadar({
  card,
  compare,
  size = 220,
  color = "var(--color-neon-cyan)",
  compareColor = "rgba(255,255,255,0.35)",
}: {
  card: StatCard | null;
  compare?: StatCard | null;
  size?: number;
  color?: string;
  compareColor?: string;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 26;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Agent stat card">
      {/* grid rings */}
      {[0.25, 0.5, 0.75, 1].map((ring) => (
        <polygon
          key={ring}
          points={STATS.map((_, i) => {
            const p = pointAt(cx, cy, R * ring, i, STATS.length);
            return `${p.x},${p.y}`;
          }).join(" ")}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={1}
        />
      ))}
      {/* axes + labels */}
      {STATS.map((s, i) => {
        const edge = pointAt(cx, cy, R, i, STATS.length);
        const label = pointAt(cx, cy, R + 14, i, STATS.length);
        return (
          <g key={s}>
            <line x1={cx} y1={cy} x2={edge.x} y2={edge.y} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
            <text
              x={label.x}
              y={label.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={10}
              fill="rgba(255,255,255,0.45)"
              style={{ fontFamily: "monospace" }}
            >
              {SHORT[s]}
            </text>
          </g>
        );
      })}
      {/* compare (baseline) polygon underneath */}
      {compare ? (
        <polygon points={polygon(compare, cx, cy, R)} fill={compareColor} fillOpacity={0.15} stroke={compareColor} strokeWidth={1.5} />
      ) : null}
      {/* agent polygon */}
      {card ? (
        <polygon points={polygon(card, cx, cy, R)} fill={color} fillOpacity={0.18} stroke={color} strokeWidth={2} />
      ) : (
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize={11} fill="rgba(255,255,255,0.3)">
          no data
        </text>
      )}
    </svg>
  );
}
