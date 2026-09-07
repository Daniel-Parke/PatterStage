// ═══════════════════════════════════════════════════════════════
// Shared Theme Constants — Single Source of Truth
// ═══════════════════════════════════════════════════════════════

import type { AccentColor } from "@/types/console";

/**
 * The header BAR's own chrome, used by AppPageShell and nowhere else.
 *
 * It carries no measure and no horizontal padding on purpose: the bar spans the
 * viewport so its bottom rule reaches both edges, and the container INSIDE it
 * owns the left edge. It used to carry `px-6`, which made every page's header
 * pad itself independently of its body — one of the reasons 21 of 23 routes
 * measured an h1 that did not line up with its own content.
 *
 * The min-height is what keeps the bar level with the Sidebar's brand row
 * (`--ps-shell-header-min-height` in globals.css).
 */
export const shellHeaderBarClasses =
  // No backdrop-blur. It was there because the bar used to be translucent
  // (bg-dark-900/50); the panel rung is opaque, so the filter blurs nothing and
  // costs a compositing layer on every scroll of every page — the same dead
  // paint T-0118 took off the rail, left behind on its neighbour.
  "border-b border-ps-edge-hairline bg-ps-surface-panel min-h-[var(--ps-shell-header-min-height)] flex items-center";

// ═══════════════════════════════════════════════════════════════
// The surface ladder and the measures — the code mirror of the tokens ruled at
// the first-build lock-in sitting of 2026-08-24 (org/LOCKBOOK.md, Tokens).
//
// The lock-book names two homes for a token, globals.css @theme and this file,
// and says they must agree. Two homes with nothing holding them together is how
// a mirror goes stale, so tests/unit/lockbook-tokens.test.ts reads the CSS and
// fails if either map names a token globals.css does not declare.
//
// These are the semantic names. The appearance-named spellings (bg-ps-surface-panel,
// max-w-4xl) still paint the same pixels and are still everywhere; nothing is
// repainted by declaring a name for what is already there.
// ═══════════════════════════════════════════════════════════════

/** Semantic surfaces: the page ground, a raised panel, a sunken well, a rule. */
export const surfaceClasses = {
  ground: "bg-ps-surface-ground",
  panel: "bg-ps-surface-panel",
  raised: "bg-ps-surface-raised",
  inset: "bg-ps-surface-inset",
} as const;

/**
 * The three rules, which are a separate ladder from the three fills: on the
 * surface ray a 3:1 stroke comes out a blue line rather than an edge, so the
 * rules travel a cooler, far less saturated one (T-0116).
 *
 *   edge      a control's boundary and the shell's seams. 3:1, WCAG 1.4.11.
 *   hairline  a subdivision inside one surface: a card outline, a row rule.
 *             1.63:1, because a card whose fill already sits 1.47:1 off the
 *             page does not also need a 3:1 stroke, and drawing one round
 *             every tile reads as wireframe.
 *   emphasis  selected, armed, focused. 4.52:1.
 */
export const edgeClasses = {
  edge: "border-ps-edge",
  hairline: "border-ps-edge-hairline",
  emphasis: "border-ps-edge-emphasis",
} as const;

/**
 * What a status tone looks like, one literal class per slot (T-0120).
 *
 * Literal because Tailwind scans source: `text-status-${tone}` generates no rule
 * at all, which is the defect the first half of this batch is about. The tone
 * itself comes from the ratified WORD, in src/lib/status-labels.ts.
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
// They used to be generated with template literals (`text-${COLOR_TEXT[c]}`).
// Tailwind scans source statically and cannot evaluate an expression, so a
// generated class only reached the stylesheet when some unrelated file happened
// to spell out the same literal. Two measured consequences on this tree:
//
//  • `hover:border-neon-cyan/60` and `focus:border-neon-*/50` produced ZERO CSS
//    rules. The border and focus-ring variants simply did not exist. A missing
//    focus ring is an accessibility defect (WCAG 2.4.7), not a cosmetic one.
//  • `border-red/40` was never a valid class at all: the token map gave bare
//    "red", and Tailwind has red-400/red-500, not `red`.
//
// The base/hover classes are also split into separate maps rather than one long
// string. The combined string previously ended in
// `hover:shadow-[0_0_20px_rgb(var(--ps-rgb-neon-cyan)_/_0.12)]`, and that
// malformed candidate took its well-formed neighbours down with it — splitting
// them is what actually made the hover and focus classes appear. The dead
// shadow is dropped rather than resurrected; it never rendered.
//
// `scripts/tooling/design-lint.mjs` (rule `no-template-literal-tailwind`) fails
// the build if the pattern returns. Keep these literal.
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

// ── Border Color Map (for hover effects) — token-aligned ─────
const BORDER_BASE: Record<AccentColor, ColorEntry> = {
  cyan: "border-neon-cyan/30",
  purple: "border-neon-purple/30",
  green: "border-neon-green/30",
  pink: "border-neon-pink/30",
  orange: "border-neon-orange/30",
  red: "border-red-400/40",
  blue: "border-blue-400/40",
  yellow: "border-yellow-400/40",
};

const BORDER_HOVER: Record<AccentColor, ColorEntry> = {
  cyan: "hover:border-neon-cyan/60",
  purple: "hover:border-neon-purple/60",
  green: "hover:border-neon-green/60",
  pink: "hover:border-neon-pink/60",
  orange: "hover:border-neon-orange/60",
  red: "hover:border-red-400/70",
  blue: "hover:border-blue-400/70",
  yellow: "hover:border-yellow-400/70",
};

export const colorBorderMap: Record<AccentColor, ColorEntry> = makeMap(
  (c) => `${BORDER_BASE[c]} ${BORDER_HOVER[c]}`,
);

/**
 * The stat pill's resting and hover boundary, written out for the same reason
 * everything above it is (T-0120).
 *
 * StatPill used to derive these from the icon colour:
 * `textColor.replace(/^text-/, "border-") + "/20"`. Tailwind scans source
 * statically and cannot see a class assembled at runtime, so three of the eight
 * accents had no border rule at all - the pill fell back to `currentColor` and
 * drew a solid white ring - and every one of the eight had a dead hover. The
 * three that DID work only worked because the class name happened to be written
 * down in a document Tailwind was also scanning.
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
 * The same eight accents at 60%, for an icon that labels a section rather than
 * signalling one. Written out for the reason above: ModelsSectionHeader built
 * these by concatenating `/60` onto an interpolated class, and the rules
 * existed only because a test file spelled two of them out.
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
  cyan: "focus:border-neon-cyan/50",
  purple: "focus:border-neon-purple/50",
  green: "focus:border-neon-green/50",
  pink: "focus:border-neon-pink/50",
  orange: "focus:border-neon-orange/50",
  red: "focus:border-red-400/50",
  blue: "focus:border-blue-400/50",
  yellow: "focus:border-yellow-400/50",
};

/** RGB triplets for `rgb(var(--glow-surface-rgb) / …)` */
const GLOW_RGBS: Record<AccentColor, string> = {
  cyan: "0 191 255", purple: "164 128 255", green: "163 255 18",
  pink: "232 121 249", orange: "255 102 34", red: "239 68 68",
  blue: "96 165 250", yellow: "250 204 21",
} as const;

export const glowSurfaceRgbMap: Record<AccentColor, ColorEntry> = makeMap((c) => GLOW_RGBS[c]);

// ── Badge Background Color ────────────────────────────────────
export const badgeBgMap: Record<AccentColor, ColorEntry> = {
  cyan: "bg-neon-cyan/10",
  purple: "bg-neon-purple/10",
  green: "bg-neon-green/10",
  pink: "bg-neon-pink/10",
  orange: "bg-neon-orange/10",
  red: "bg-red-500/10",
  blue: "bg-blue-500/10",
  yellow: "bg-yellow-500/10",
};

// ── Base Input Styles ─────────────────────────────────────────
export const baseInputStyles =
  // `edge` rather than `hairline`: this is the base every text input in the
  // product wears, and a control's boundary is the one WCAG 1.4.11 is about.
  // On the hairline it measured 2.38:1 against the page (T-0118).
  // design-lint-disable-next-line no-bare-outline-none -- inputFieldClasses appends the accent focus border to this base; it is never used bare
  "w-full bg-ps-surface-panel border border-ps-edge rounded-ps-md px-3 py-2 text-body text-ps-text-primary placeholder-ps-text-muted outline-none transition-colors font-mono";

/**
 * A section heading, which is not a smaller page title.
 *
 * Thirty h2 elements wore ten treatments between them, from a 12px micro-caps
 * label to a 20px bold line, so a section heading was indistinguishable from a
 * slightly emphatic list item on most screens. This is the one: micro-caps mono
 * on the secondary tier with a hairline under it, which reads as a HEADING
 * because of its register and its rule rather than because of its size
 * (T-0119, decision 10).
 *
 * It owns the TYPOGRAPHY and nothing else. Where the heading sits, and what
 * sits beside it, stays with the call site: several of these have an icon in a
 * row and a couple are inside a flex header bar.
 *
 * A dialog's title and an empty state's heading are not section headings; they
 * keep `text-title`.
 */
export const sectionHeadingClasses =
  "text-micro font-mono uppercase tracking-widest text-ps-text-secondary border-b border-ps-edge-hairline pb-1.5 mb-3";

/** Canonical text input / select classes with accent focus ring. */
export function inputFieldClasses(accent: AccentColor = "cyan"): string {
  return `${baseInputStyles} ${focusColorMap[accent]}`;
}
