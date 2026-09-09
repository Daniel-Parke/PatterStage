// ═══════════════════════════════════════════════════════════════
// modules/types.ts — the ProductModule contract (ADR-0005)
//
// A module is a product surface that plugs into PatterStage; the console verbs
// stay in core and everything else declares itself here. PURE DATA, no React,
// lucide or db, because the e2e route matrix imports the registry from plain
// node, so icons are named as STRINGS and resolved by the sidebar (the
// hand-mirrored copy in tests/e2e/app-routes.ts had already lost
// /laboratory/artifacts).
//
// THE FIVE SECTIONS (T-0097, decisions 8, 11, 12 and 14): a module contributes
// links to sections it does not own (Research is Work, Artifacts and Insights
// are Results), so the section is named from a fixed list, every link carries
// an `order`, and the rail merges by section and sorts by order. The config
// tree is the Settings index, derived from src/lib/config-sections.ts, not rail data.
// ═══════════════════════════════════════════════════════════════

import type { AccentColor } from "@/types/console";
import type { FeatureFlag } from "@/lib/feature-flags";

/** The rail's sections, in the order the rail shows them. Home has no heading. */
export const NAV_SECTIONS = ["Home", "Work", "Results", "Agent", "Rec Room"] as const;
export type NavSectionLabel = (typeof NAV_SECTIONS)[number];

/**
 * Icon names, resolved to lucide components by the sidebar, whose map is
 * exhaustive over this union, so a typo is a compile error, not a missing icon.
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
  | "ListTodo" | "Network" | "Settings2" | "CalendarClock"
  | "Settings" | "LifeBuoy";

export interface NavLink {
  label: string;
  href: string;
  icon: IconName;
  color: AccentColor;
  /** Position within its section, across modules. Unique per section. */
  order: number;
  /** Hidden while this flag is disabled. */
  featureFlag?: FeatureFlag;
  /** Routes this link owns that the rail does not draw. */
  childRoutes?: ChildRoute[];
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

/**
 * Routes a nav link owns but the rail does not render. They were `subLinks`,
 * drawn as a second tier; decision 8 deleted the tier (both destinations
 * navigate there from inside the page, and it was the only rail height the
 * registry did not bound). The registry still NAMES them because `labelFor` is
 * the one source of a page's h1 and tab title, and the e2e matrix visits them.
 */
// Not exported: NavLink is the only reader.
interface ChildRoute {
  label: string;
  href: string;
}

/** Every route a module contributes, including the ones the rail does not draw. */
export function moduleRoutes(mod: ProductModule): string[] {
  const out: string[] = [];
  for (const section of mod.nav ?? []) {
    for (const link of section.links) {
      out.push(link.href);
      for (const child of link.childRoutes ?? []) out.push(child.href);
    }
  }
  return out;
}
