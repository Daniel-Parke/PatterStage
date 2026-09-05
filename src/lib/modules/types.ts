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
//
// THE FIVE SECTIONS (T-0097, decisions 8, 11, 12 and 14). A module contributes
// links to sections it does not own: Research is Work beside Chat and Missions
// though it belongs to the laboratory module; Artifacts and Insights are
// Results beside Sessions and Logs. So the section is named from a fixed list
// and every link carries an `order`, and the rail merges by section and sorts
// by order. The config tree is no longer rail data: it is the Settings index,
// derived from src/lib/config-sections.ts.
// ═══════════════════════════════════════════════════════════════

import type { AccentColor } from "@/types/console";
import type { FeatureFlag } from "@/lib/feature-flags";

/** The rail's sections, in the order the rail shows them. Home has no heading. */
export const NAV_SECTIONS = ["Home", "Work", "Results", "Agent", "Rec Room"] as const;
export type NavSectionLabel = (typeof NAV_SECTIONS)[number];

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
  | "ListTodo" | "Network" | "Settings2"
  | "Settings" | "LifeBuoy";

interface NavSubLink {
  label: string;
  href: string;
}

export interface NavLink {
  label: string;
  href: string;
  icon: IconName;
  color: AccentColor;
  /** Position within its section, across modules. Unique per section. */
  order: number;
  /** Hidden while this flag is disabled. */
  featureFlag?: FeatureFlag;
  subLinks?: NavSubLink[];
}

interface NavSection {
  label: NavSectionLabel;
  links: NavLink[];
}

export interface ProductModule {
  /** Stable id, used for the boundary lint and for module-owned table prefixes. */
  id: string;
  /** Human name, for the console's estate rail. */
  title: string;
  /** Sidebar sections this module contributes, in order. */
  nav?: NavSection[];
  /** When set, the whole module disappears while the flag is off. */
  featureFlag?: FeatureFlag;
}

/** Every route a module contributes, including sub-links. Order is preserved. */
export function moduleRoutes(mod: ProductModule): string[] {
  const out: string[] = [];
  for (const section of mod.nav ?? []) {
    for (const link of section.links) {
      out.push(link.href);
      for (const sub of link.subLinks ?? []) out.push(sub.href);
    }
  }
  return out;
}
