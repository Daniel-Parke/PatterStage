// ═══════════════════════════════════════════════════════════════
// Panel + PanelHeader — Shared "rounded card with icon-and-label
// header" shell for the Dashboard's 5 panel sections
// ═══════════════════════════════════════════════════════════════

import type { ReactNode } from "react";
import type { AccentColor } from "@/types/console";
import { iconColorMap } from "@/lib/theme";

/**
 * Tailwind static-border class for a panel accent. The panel uses
 * `/20` opacity (a static, no-hover state) — distinct from the
 * hover-aware `colorBorderMap` in `theme.ts` which uses `/30`/`/40`
 * base opacities. The `red` / `blue` / `yellow` base accents get
 * `-500` because their token is a bare colour name (not `neon-*`).
 */
// Literal classes only — Tailwind cannot see an interpolated one, so
// `border-${accent}-500/20` produced no border at all. See src/lib/theme.ts.
//
// `accent` is optional as of T-0033. A record surface is usually not accented
// at all — the sessions ledger, the log pane, the log file picker and the
// toolset reference are all plain surfaces — and before this they each spelled
// `border border-ps-edge-hairline bg-ps-surface-panel` for themselves, which is exactly the
// raw box WG-WEB-003 rules against. Omitting the accent now gives them the
// panel they were imitating.
function panelBorderClass(accent?: AccentColor): string {
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
    default:
      return "border-ps-edge-hairline";
  }
}

/**
 * Optional accent wash over the panel interior, replacing the neutral
 * `bg-ps-surface-panel`. Two surfaces had hand-rolled one: the sessions page's
 * mission group (`bg-neon-green/[0.03]`) and the Hermes toolsets card
 * (`bg-neon-orange/5`). One ruled intensity now serves both, because two
 * near-identical washes is a difference nobody chose.
 *
 * Literal classes, same reason as the borders above.
 */
function panelTintClass(tint?: AccentColor): string {
  switch (tint) {
    case "red":
      return "bg-red-500/5";
    case "blue":
      return "bg-blue-500/5";
    case "yellow":
      return "bg-yellow-500/5";
    case "cyan":
      return "bg-neon-cyan/5";
    case "purple":
      return "bg-neon-purple/5";
    case "green":
      return "bg-neon-green/5";
    case "pink":
      return "bg-neon-pink/5";
    case "orange":
      return "bg-neon-orange/5";
    default:
      return "bg-ps-surface-panel";
  }
}

/**
 * Outer panel shell: rounded card with the static accent border +
 * the `bg-ps-surface-panel` interior + `overflow-hidden` (so list rows
 * with their own borders don't escape the rounded corners). The header
 * is rendered separately so a call site can omit it.
 */
export interface PanelProps extends React.ComponentPropsWithRef<"div"> {
  /** Static accent border. Omit for the neutral `border-ps-edge-hairline` surface. */
  accent?: AccentColor;
  /** Optional accent wash over the interior, replacing `bg-ps-surface-panel`. */
  tint?: AccentColor;
  children: ReactNode;
}

export function Panel({
  accent,
  tint,
  className = "",
  children,
  ...props
}: PanelProps) {
  return (
    <div
      className={`rounded-ps-lg border ${panelBorderClass(accent)} ${panelTintClass(tint)} overflow-hidden ${className}`}
      // Bloom tier (WG-WEB-011 C). The panel is the container WG-WEB-003 rules
      // for the genuinely self-contained thing, so it answers the pointer.
      // Rows inside a panel carry their own tight field via LedgerRow; the
      // listener resolves to the innermost match, so a row wins over its panel
      // and the two never light at once.
      //
      // Before the spread, as on Button and LedgerRow: a call site that needs a
      // panel dark can pass data-bloom={undefined} and win. Everything else in
      // `props` reaches the div too, which is how the log pane keeps the scroll
      // ref and the scroll handler it has always had.
      data-bloom=""
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * The header bar at the top of every dashboard panel. `rightSlot` is the
 * optional right-side content — a count badge, a "manage →" link,
 * severity-filter pills. The icon colour comes from `iconColorMap` in
 * `theme.ts`, the same map every other accent-aware component consumes.
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
  /** Optional count rendered next to the label, e.g. "(3)". */
  count?: ReactNode;
  /** Optional right-side content (links, severity pills, refresh icon, etc.). */
  rightSlot?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-ps-edge-hairline bg-ps-surface-raised">
      <div className="flex items-center gap-2">
        <Icon className={`w-3.5 h-3.5 ${iconColorMap[accent]}`} />
        <span className="text-micro font-mono text-ps-text-secondary">{label}</span>
        {count !== undefined && (
          <span className="text-micro font-mono text-ps-text-faint">{count}</span>
        )}
      </div>
      {rightSlot}
    </div>
  );
}
