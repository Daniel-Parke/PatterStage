// ═══════════════════════════════════════════════════════════════
// Panel + PanelHeader — Shared "rounded card with icon-and-label
// header" shell for the Dashboard's 5 panel sections
// ═══════════════════════════════════════════════════════════════
//
// Extracted from src/app/page.tsx (List 1 — Dashboard, Sessions,
// Memory, Logs surface). The 5 dashboard panels that use this shell
// are:
//
//   1. Mission Dispatch (line ~557)       — accent=cyan,  toggle header
//   2. Active Missions  (line ~633)       — accent=cyan,  count + link
//   3. Cron Jobs        (line ~695)       — accent=orange, link
//   4. Platforms        (line ~735)       — accent=cyan,  (no right slot)
//   5. Errors           (line ~793)       — accent=red,   severity pills
//   6. Rec Room         (line ~894)       — accent=purple,(no right slot)
//
// (That's 6 sites, not 5 — the source-pattern test pins the
// `border-*-500/20 bg-dark-900/50 overflow-hidden` outer + the
// `border-b border-white/10 bg-dark-800/50` header bar + the icon
// + label inner. The 6 sites all render the same outer shell with
// only the accent colour + optional right-slot content varying.)
//
// The 5 identical lines per site that this extraction collapses:
//
//   <div className="rounded-xl border border-{accent}-500/20 bg-dark-900/50 overflow-hidden">
//     <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-dark-800/50">
//       <div className="flex items-center gap-2">
//         <Icon className="w-3.5 h-3.5 text-{accent}" />
//         <span className="text-xs font-mono text-white/60">{label}</span>
//       </div>
//       {rightSlot}
//     </div>
//     {children}
//   </div>
//
// Live use site count: 6 (was 6 inline copies). All 6 sites are
// in src/app/page.tsx — no other page in the codebase uses this
// shell today, but the helper is exported so a future surface
// (e.g. a redesigned Mission detail page, a custom widget on a
// future Operations page) can pick it up without re-deriving the
// 5-line shell.
//
// `Mission Dispatch` (site #1) is intentionally NOT migrated —
// its header is a `<button>` (a click-to-toggle accordion), not
// the static 4-flex-div header this component renders. Different
// shape, not a duplicate. The 5 other sites all render the same
// static-header shape.

import type { ReactNode } from "react";
import type { AccentColor } from "@/types/console";
import { iconColorMap } from "@/lib/theme";

/**
 * Tailwind static-border class for a panel accent. The panel uses
 * `/20` opacity (a static, no-hover state) — distinct from the
 * hover-aware `colorBorderMap` in `theme.ts` which uses `/30`/`/40`
 * base opacities. The `red` / `blue` / `yellow` base accents get
 * `-500` because their token is a bare colour name (not `neon-*`).
 * For the 6 current call sites, the mapping is:
 *
 *   accent=cyan   → border-neon-cyan/20
 *   accent=orange → border-neon-orange/20
 *   accent=red    → border-red-500/20
 *   accent=purple → border-neon-purple/20
 *
 * Centralised here so a future "we want the panel border to be
 * more visible" tweak lands in one place.
 */
// Literal classes only — Tailwind cannot see an interpolated one, so
// `border-${accent}-500/20` produced no border at all. See src/lib/theme.ts.
function panelBorderClass(accent: AccentColor): string {
  switch (accent) {
    case "red":
      return "border-red-500/20";
    case "blue":
      return "border-blue-500/20";
    case "yellow":
      return "border-yellow-500/20";
    case "cyan":
      return "border-neon-cyan/20";
    case "purple":
      return "border-neon-purple/20";
    case "green":
      return "border-neon-green/20";
    case "pink":
      return "border-neon-pink/20";
    case "orange":
      return "border-neon-orange/20";
  }
}

/**
 * Outer panel shell: rounded card with the static accent border +
 * the `bg-dark-900/50` interior + `overflow-hidden` (so list rows
 * with their own borders don't escape the rounded corners).
 *
 * `children` is the panel body (typically a list of rows under the
 * `PanelHeader`, or a single link like the Rec Room card). The
 * header is rendered separately so the call site can omit it when
 * a future panel needs only the body shell (none today, but the
 * split is cheap and keeps the props simple).
 */
export function Panel({
  accent,
  children,
}: {
  accent: AccentColor;
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-xl border ${panelBorderClass(accent)} bg-dark-900/50 overflow-hidden`}
    >
      {children}
    </div>
  );
}

/**
 * The 4-div header bar that sits at the top of every dashboard panel:
 *
 *   <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-dark-800/50">
 *     <div className="flex items-center gap-2">
 *       <Icon className="w-3.5 h-3.5 text-{accent}" />
 *       <span className="text-xs font-mono text-white/60">{label}</span>
 *     </div>
 *     {rightSlot}
 *   </div>
 *
 * `rightSlot` is the optional right-side content — a count badge,
 * a "manage →" link, severity-filter pills, a refresh icon, etc.
 * The 6 call sites each render a different rightSlot (or no
 * rightSlot at all — Platforms + Rec Room). Keeping it as a
 * `children` slot rather than baking in a fixed set of "things
 * the right side can be" keeps the helper open-ended.
 *
 * The icon colour is derived from `iconColorMap` in `theme.ts` —
 * the same map the `StatPill` and `MissionStatusBadge` components
 * consume. This is the single source of truth for "what colour is
 * the X accent on a dark background", so the panel header is
 * automatically consistent with every other accent-aware component.
 */
export function PanelHeader({
  icon: Icon,
  label,
  accent,
  count,
  rightSlot,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  accent: AccentColor;
  /**
   * Optional count rendered next to the label in the same dimmed
   * `text-white/25` style as the pre-extraction inline form. Used by
   * the Active Missions panel ("Active Missions (3)"). Pass a string
   * to wrap in parens (the standard "(N)" form) or any ReactNode for
   * a custom badge. The default `text-[10px] font-mono` styling is
   * owned by the component — call sites don't get to override it
   * (the styling is the same in every pre-extraction site).
   */
  count?: ReactNode;
  /** Optional right-side content (links, severity pills, refresh icon, etc.). */
  rightSlot?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-dark-800/50">
      <div className="flex items-center gap-2">
        <Icon className={`w-3.5 h-3.5 ${iconColorMap[accent]}`} />
        <span className="text-xs font-mono text-white/60">{label}</span>
        {count !== undefined && (
          <span className="text-[10px] font-mono text-white/25">{count}</span>
        )}
      </div>
      {rightSlot}
    </div>
  );
}
