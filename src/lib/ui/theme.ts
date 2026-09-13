// ═══════════════════════════════════════════════════════════════
// theme.ts — the shared class strings, and the code mirror of the ruled tokens
// ═══════════════════════════════════════════════════════════════

import type { AccentColor } from "@/types/console";

/**
 * The header BAR's own chrome, used by AppPageShell only. No measure and no
 * horizontal padding: the bar spans the viewport so its rule reaches both
 * edges, and the container INSIDE it owns the left edge (its old `px-6` is one
 * reason 21 of 23 routes had an h1 out of line with its body). The min-height
 * keeps it level with the Sidebar's brand row (`--ps-shell-header-min-height`).
 */
export const shellHeaderBarClasses =
  // No backdrop-blur: the panel rung is opaque, so it blurred nothing and cost
  // a compositing layer per scroll, the dead paint T-0118 took off the rail.
  "border-b border-ps-edge-hairline bg-ps-surface-panel min-h-[var(--ps-shell-header-min-height)] flex items-center";

// ═══════════════════════════════════════════════════════════════
// The surface ladder and the measures: the code mirror of the tokens ruled at
// the first-build lock-in sitting of 2026-08-24 (org/LOCKBOOK.md, Tokens). The
// lock-book names two homes for a token, globals.css @theme and this file, so
// tests/unit/lockbook-tokens.test.ts fails if either map names a token the CSS
// does not declare.
// ═══════════════════════════════════════════════════════════════

/** Semantic surfaces: the page ground, a raised panel, a sunken well, a rule. */
export const surfaceClasses = {
  ground: "bg-ps-surface-ground",
  panel: "bg-ps-surface-panel",
  raised: "bg-ps-surface-raised",
  inset: "bg-ps-surface-inset",
} as const;

/**
 * The three rules, a separate ladder from the fills: on the surface ray a 3:1
 * stroke reads as a blue line, so the rules travel a cooler, less saturated
 * one (T-0116). `edge` is a control's boundary and the shell's seams, 3:1 per
 * WCAG 1.4.11; `hairline` a subdivision inside one surface at 1.63:1, because
 * a card already 1.47:1 off the page with a 3:1 stroke round it reads as
 * wireframe; `emphasis` is selected, armed, focused, 4.52:1.
 */
export const edgeClasses = {
  edge: "border-ps-edge",
  hairline: "border-ps-edge-hairline",
  emphasis: "border-ps-edge-emphasis",
} as const;

/**
 * What a status tone looks like, one literal class per slot (T-0120): Tailwind
 * scans source, so `text-status-${tone}` generates no rule. The tone itself
 * comes from the ratified WORD in src/lib/ui/status-labels.ts.
 */
export const statusToneClasses = {
  idle: {
    text: "text-status-idle",
    dot: "bg-status-idle",
    fill: "bg-status-idle/10",
    border: "border-status-idle/30",
  },
  queued: {
    text: "text-status-queued",
    dot: "bg-status-queued",
    fill: "bg-status-queued/10",
    border: "border-status-queued/30",
  },
  running: {
    text: "text-status-running",
    dot: "bg-status-running",
    fill: "bg-status-running/10",
    border: "border-status-running/30",
  },
  ok: {
    text: "text-status-ok",
    dot: "bg-status-ok",
    fill: "bg-status-ok/10",
    border: "border-status-ok/30",
  },
  warn: {
    text: "text-status-warn",
    dot: "bg-status-warn",
    fill: "bg-status-warn/10",
    border: "border-status-warn/30",
  },
  fail: {
    text: "text-status-fail",
    dot: "bg-status-fail",
    fill: "bg-status-fail/10",
    border: "border-status-fail/30",
  },
  blocked: {
    text: "text-status-blocked",
    dot: "bg-status-blocked",
    fill: "bg-status-blocked/10",
    border: "border-status-blocked/30",
  },
} as const;

/** Column widths and the block rhythm. `block` is a `space-y-*`, not a width. */
export const measureClasses = {
  reading: "max-w-ps-reading",
  wide: "max-w-ps-wide",
  full: "max-w-ps-full",
  block: "space-y-ps-block",
} as const;

type ColorEntry = string;

const ALL_COLORS: AccentColor[] = ["cyan", "purple", "green", "pink", "orange", "red", "blue", "yellow"];

function makeMap<T>(fn: (c: AccentColor) => T): Record<AccentColor, T> {
  return Object.fromEntries(ALL_COLORS.map((c) => [c, fn(c)])) as Record<AccentColor, T>;
}

// ═══════════════════════════════════════════════════════════════
// The accent maps below are written out LITERALLY, one class per entry.
//
// They were generated with template literals, and Tailwind scans source
// statically, so a generated class reached the stylesheet only when some other
// file spelled out the same literal: `hover:border-neon-cyan/60` and
// `focus:border-neon-*/50` produced ZERO rules (a missing focus ring is WCAG
// 2.4.7, not cosmetic), and `border-red/40` was never a class at all. Base and
// hover are separate maps because one malformed candidate in the old combined
// string (a `hover:shadow-[...]`) took its well-formed neighbours down with it;
// that shadow never rendered and is dropped. `scripts/tooling/design-lint.mjs`
// (rule `no-template-literal-tailwind`) fails the build if the pattern returns.
// ═══════════════════════════════════════════════════════════════

// ── Icon Color Map ────────────────────────────────────────────
export const iconColorMap: Record<AccentColor, ColorEntry> = {
  cyan: "text-neon-cyan",
  purple: "text-neon-purple",
  green: "text-neon-green",
  pink: "text-neon-pink",
  orange: "text-neon-orange",
  red: "text-red-400",
  blue: "text-blue-400",
  yellow: "text-yellow-400",
};

/**
 * The "you are here" bar on the rail, in the destination's registry colour. A
 * bar, because the fill is what hover uses; edge-anchored, because the rail's
 * seam is the edge it grows from. Literal for the reason above (T-0120).
 */
export const railAccentBarMap: Record<AccentColor, ColorEntry> = {
  cyan: "bg-neon-cyan",
  purple: "bg-neon-purple",
  green: "bg-neon-green",
  pink: "bg-neon-pink",
  orange: "bg-neon-orange",
  red: "bg-red-400",
  blue: "bg-blue-400",
  yellow: "bg-yellow-400",
};

/**
 * The stat pill's resting and hover boundary, literal for the reason above
 * (T-0120). StatPill derived these from the icon colour with a regex, so three
 * of the eight accents had no border rule (the pill fell back to `currentColor`
 * and drew a solid white ring) and all eight had a dead hover.
 */
const PILL_BORDER: Record<AccentColor, ColorEntry> = {
  cyan: "border-neon-cyan/20",
  purple: "border-neon-purple/20",
  green: "border-neon-green/20",
  pink: "border-neon-pink/20",
  orange: "border-neon-orange/20",
  red: "border-red-400/20",
  blue: "border-blue-400/20",
  yellow: "border-yellow-400/20",
};

const PILL_BORDER_HOVER: Record<AccentColor, ColorEntry> = {
  cyan: "hover:border-neon-cyan/45",
  purple: "hover:border-neon-purple/45",
  green: "hover:border-neon-green/45",
  pink: "hover:border-neon-pink/45",
  orange: "hover:border-neon-orange/45",
  red: "hover:border-red-400/45",
  blue: "hover:border-blue-400/45",
  yellow: "hover:border-yellow-400/45",
};

/**
 * The same eight at 60%, for an icon that labels a section rather than
 * signalling one. Literal for the reason above: ModelsSectionHeader built these
 * by interpolation, and the rules existed only because a test spelled two out.
 */
export const iconMutedColorMap: Record<AccentColor, ColorEntry> = {
  cyan: "text-neon-cyan/60",
  purple: "text-neon-purple/60",
  green: "text-neon-green/60",
  pink: "text-neon-pink/60",
  orange: "text-neon-orange/60",
  red: "text-red-400/60",
  blue: "text-blue-400/60",
  yellow: "text-yellow-400/60",
};

export const pillBorderMap: Record<AccentColor, ColorEntry> = PILL_BORDER;
export const pillBorderHoverMap: Record<AccentColor, ColorEntry> = PILL_BORDER_HOVER;

// ── Focus Ring Color (for inputs/selects) ─────────────────────
export const focusColorMap: Record<AccentColor, ColorEntry> = {
  cyan: "",
  purple: "",
  green: "",
  pink: "",
  orange: "",
  red: "",
  blue: "",
  yellow: "",
};

/** RGB triplets for `rgb(var(--glow-surface-rgb) / …)` */
const GLOW_RGBS: Record<AccentColor, string> = {
  cyan: "0 191 255", purple: "164 128 255", green: "163 255 18",
  pink: "232 121 249", orange: "255 102 34", red: "239 68 68",
  blue: "96 165 250", yellow: "250 204 21",
} as const;

export const glowSurfaceRgbMap: Record<AccentColor, ColorEntry> = makeMap((c) => GLOW_RGBS[c]);

// ── Base Input Styles ─────────────────────────────────────────
export const baseInputStyles =
  // `edge`, not `hairline`: a control's boundary is what WCAG 1.4.11 is about,
  // and on the hairline it measured 2.38:1 against the page (T-0118).
  // design-lint-disable-next-line no-bare-outline-none -- inputFieldClasses appends the accent focus border to this base; it is never used bare
  "w-full bg-ps-surface-panel border border-ps-edge rounded-ps-md px-3 py-2 text-body text-ps-text-primary placeholder-ps-text-muted transition-colors font-mono";

/**
 * A section heading, which is not a smaller page title. Thirty h2s wore ten
 * treatments, so a heading was indistinguishable from an emphatic list item;
 * this is the one, micro-caps mono on the secondary tier with a hairline under
 * it, a HEADING by register and rule rather than size (T-0119, decision 10).
 * It owns the TYPOGRAPHY only; placement stays with the call site. A dialog's
 * title and an empty state's heading are not section headings; they keep `text-title`.
 */
export const sectionHeadingClasses =
  "text-micro font-mono uppercase tracking-widest text-ps-text-secondary border-b border-ps-edge-hairline pb-1.5 mb-3";

/** Canonical text input / select classes with accent focus ring. */
export function inputFieldClasses(accent: AccentColor = "cyan"): string {
  return `${baseInputStyles} ${focusColorMap[accent]}`;
}
