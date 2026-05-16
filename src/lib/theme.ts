// ═══════════════════════════════════════════════════════════════
// Shared Theme Constants — Single Source of Truth
// ═══════════════════════════════════════════════════════════════

import type { AccentColor } from "@/types/hermes";

/** Aligns main-column top bar with Sidebar brand row (`--ch-shell-header-min-height` in globals.css). */
export const shellHeaderBarClasses =
  "border-b border-white/10 bg-dark-900/50 backdrop-blur-xl min-h-[var(--ch-shell-header-min-height)] flex items-center px-6";

type ColorEntry = string;

const ALL_COLORS: AccentColor[] = ["cyan", "purple", "green", "pink", "orange", "red", "blue", "yellow"];

function makeMap<T>(fn: (c: AccentColor) => T): Record<AccentColor, T> {
  return Object.fromEntries(ALL_COLORS.map((c) => [c, fn(c)])) as Record<AccentColor, T>;
}

// ── Icon Color Map ────────────────────────────────────────────
export const iconColorMap: Record<AccentColor, ColorEntry> = makeMap((c) => {
  const m: Record<string, string> = { cyan: "text-neon-cyan", purple: "text-neon-purple", green: "text-neon-green", pink: "text-neon-pink", orange: "text-neon-orange", red: "text-red-400", blue: "text-blue-400", yellow: "text-yellow-400" };
  return m[c];
});

// ── Border Color Map (for hover effects) — token-aligned ─────
export const colorBorderMap: Record<AccentColor, ColorEntry> = makeMap((c) => {
  const accentColors: Record<string, string> = { cyan: "neon-cyan", purple: "neon-purple", green: "neon-green", pink: "neon-pink", orange: "neon-orange", red: "red", blue: "blue", yellow: "yellow" };
  const token = accentColors[c] || "white";
  const opacity = ["red", "blue", "yellow"].includes(c) ? "40" : "30";
  const hoverOpacity = ["red", "blue", "yellow"].includes(c) ? "70" : "60";
  const shadowRgb = c === "red" ? "239,68,68" : c === "blue" ? "96,165,250" : c === "yellow" ? "250,204,21" : `var(--ch-rgb-${accentColors[c]})`;
  return `border-${token}/${opacity} hover:border-${token}/${hoverOpacity} hover:shadow-[0_0_20px_rgb(${shadowRgb}_/_0.12)]`;
});

// ── Focus Ring Color (for inputs/selects) ─────────────────────
export const focusColorMap: Record<AccentColor, ColorEntry> = makeMap((c) => {
  const m: Record<string, string> = { cyan: "neon-cyan", purple: "neon-purple", green: "neon-green", pink: "neon-pink", orange: "neon-orange", red: "red", blue: "blue", yellow: "yellow" };
  return `focus:border-${m[c]}/50`;
});

// ── Glow Class Map (legacy box-shadow utilities in globals.css) ─
export const glowClassMap: Record<AccentColor, ColorEntry> = makeMap((c) => {
  const m: Record<string, string> = { cyan: "glow-cyan", purple: "glow-purple", green: "glow-green", pink: "glow-pink", orange: "glow-orange", red: "shadow-red-500/20", blue: "shadow-blue-500/20", yellow: "shadow-yellow-500/20" };
  return m[c];
});

/** RGB triplets for `rgb(var(--glow-surface-rgb) / …)` */
export const glowSurfaceRgbMap: Record<AccentColor, ColorEntry> = makeMap((c) => {
  const m: Record<string, string> = { cyan: "0, 191, 255", purple: "139, 92, 255", green: "163, 255, 18", pink: "232, 121, 249", orange: "255, 159, 28", red: "239, 68, 68", blue: "96, 165, 250", yellow: "250, 204, 21" };
  return m[c];
});

// ── Badge Background Color ────────────────────────────────────
export const badgeBgMap: Record<AccentColor, ColorEntry> = makeMap((c) => {
  const m: Record<string, string> = { cyan: "neon-cyan", purple: "neon-purple", green: "neon-green", pink: "neon-pink", orange: "neon-orange", red: "red-500", blue: "blue-500", yellow: "yellow-500" };
  return `bg-${m[c]}/10`;
});

// ── Badge Text Color ──────────────────────────────────────────
export const badgeTextMap: Record<AccentColor, ColorEntry> = makeMap((c) => {
  const m: Record<string, string> = { cyan: "neon-cyan", purple: "neon-purple", green: "neon-green", pink: "neon-pink", orange: "neon-orange", red: "red-400", blue: "blue-400", yellow: "yellow-400" };
  return `text-${m[c]}`;
});

// ── Badge Border Color ────────────────────────────────────────
export const badgeBorderMap: Record<AccentColor, ColorEntry> = makeMap((c) => {
  const m: Record<string, string> = { cyan: "neon-cyan", purple: "neon-purple", green: "neon-green", pink: "neon-pink", orange: "neon-orange", red: "red", blue: "blue", yellow: "yellow" };
  return `border-${m[c]}/20`;
});

// ── Combined Badge Styles ─────────────────────────────────────
export function badgeClasses(color: AccentColor): string {
  return `${badgeBgMap[color]} ${badgeTextMap[color]} ${badgeBorderMap[color]} border`;
}

// ── Base Input Styles ─────────────────────────────────────────
export const baseInputStyles =
  "w-full bg-dark-900/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none transition-colors font-mono";
