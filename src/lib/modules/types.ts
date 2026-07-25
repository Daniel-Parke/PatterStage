// ═══════════════════════════════════════════════════════════════
// modules/types.ts — the ProductModule contract (ADR-0005)
//
// A module is a product surface that plugs into PatterStage. The console verbs
// (found, commission, gate, watch) stay in core; everything else declares itself
// here rather than editing core files.
//
// This file is PURE DATA: no React, no lucide, no db. That matters because the
// registry has three consumers with three different environments —
//
//   • the sidebar          (client React, needs icon components)
//   • the e2e route matrix (plain node, must not import React)
//   • future module code   (server)
//
// so icons are named as STRINGS and resolved to components by the sidebar. The
// hand-mirrored copy in tests/e2e/app-routes.ts was already stale when this was
// written: it had lost /laboratory/artifacts entirely.
// ═══════════════════════════════════════════════════════════════

import type { AccentColor } from "@/types/console";
import type { FeatureFlag } from "@/lib/feature-flags";

/**
 * Icon names, resolved to lucide components by the sidebar. A string keeps this
 * module importable from a non-React context; the sidebar's map is exhaustive
 * over this union, so a typo is a compile error rather than a missing icon.
 */
export type IconName =
  | "Zap" | "Clock" | "Database" | "ScrollText"
  | "Rocket" | "Workflow" | "Terminal" | "MessageCircle"
  | "Bot" | "FileText" | "Wrench" | "Sparkles"
  | "BarChart3" | "Trophy" | "Telescope" | "FileStack"
  | "BookOpen" | "Globe" | "Cpu" | "Lock"
  | "RotateCcw" | "Activity" | "Layers" | "HardDrive"
  | "Globe2" | "Code" | "Shield" | "ShieldCheck"
  | "AudioLines" | "Mic" | "Volume2" | "GitBranch"
  | "ListTodo" | "Network" | "Settings2";

export interface NavSubLink {
  label: string;
  href: string;
}

export interface NavLink {
  label: string;
  href: string;
  icon: IconName;
  color: AccentColor;
  /** Hidden while this flag is disabled. */
  featureFlag?: FeatureFlag;
  subLinks?: NavSubLink[];
}

export interface NavSection {
  label: string;
  links: NavLink[];
}

/** A collapsible group in the Config tree. */
export interface ConfigGroup {
  label: string;
  defaultOpen?: boolean;
  links: NavLink[];
}

export interface ProductModule {
  /** Stable id, used for the boundary lint and for module-owned table prefixes. */
  id: string;
  /** Human name, for the console's estate rail. */
  title: string;
  /** Sidebar sections this module contributes, in order. */
  nav?: NavSection[];
  /** Pinned entries above the Config tree. */
  configPinned?: NavLink[];
  /** Collapsible groups in the Config tree. */
  configGroups?: ConfigGroup[];
  /** When set, the whole module disappears while the flag is off. */
  featureFlag?: FeatureFlag;
}

/** Every route a module contributes, including sub-links. Order is preserved. */
export function moduleRoutes(mod: ProductModule): string[] {
  const out: string[] = [];
  const push = (link: NavLink) => {
    out.push(link.href);
    for (const sub of link.subLinks ?? []) out.push(sub.href);
  };
  for (const section of mod.nav ?? []) section.links.forEach(push);
  (mod.configPinned ?? []).forEach(push);
  for (const group of mod.configGroups ?? []) group.links.forEach(push);
  return out;
}
