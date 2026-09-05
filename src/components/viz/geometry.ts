// ═══════════════════════════════════════════════════════════════
// viz/geometry.ts — pure geometry/scale helpers shared by the SVG charts.
// Kept dependency-free + unit-tested so the chart components stay thin.
// ═══════════════════════════════════════════════════════════════

/** Point on a circle. Angle in degrees, 0° = 12 o'clock, clockwise. */
export function polarPoint(
  cx: number,
  cy: number,
  r: number,
  angleDeg: number,
): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/**
 * Round a max value up to a "nice" axis bound (1/2/5 × 10ⁿ). Returns 1 for
 * non-positive input so charts never divide by zero.
 */
export function niceMax(v: number): number {
  if (!Number.isFinite(v) || v <= 0) return 1;
  const exp = Math.floor(Math.log10(v));
  const base = Math.pow(10, exp);
  const frac = v / base;
  const niceFrac = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
  return niceFrac * base;
}

/** Map a value in [min,max] to a pixel position in [lo,hi]. */
export function scaleLinear(
  value: number,
  min: number,
  max: number,
  lo: number,
  hi: number,
): number {
  if (max === min) return (lo + hi) / 2;
  const t = (value - min) / (max - min);
  return lo + t * (hi - lo);
}

/** Running cumulative sum of a numeric series. */
export function cumulative(series: number[]): number[] {
  let acc = 0;
  return series.map((v) => (acc += v));
}

/** Build an SVG polyline `d` from points, optionally smoothed-cap. */
export function linePath(points: Array<{ x: number; y: number }>): string {
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
}
