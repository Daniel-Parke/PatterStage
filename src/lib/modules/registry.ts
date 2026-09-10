// ═══════════════════════════════════════════════════════════════
// modules/registry.ts — the modules PatterStage ships (ADR-0005)
//
// One list; the sidebar, the e2e route matrix and every page title derive from
// it, so a surface is added here and nowhere else (the hand-mirrored test copy
// had already lost /laboratory/artifacts). `core` is the console's own verbs;
// everything else, the Hermes surface included, is a module, which is what lets
// a boundary check assert nothing outside the hermes module knows Hermes' layout.
//
// The map (T-0097): five sections, verb-first, URLs renamed to match, the Rec
// Room under /recroom/story-weaver/*; old paths answer 307 from next.config.ts
// for one release. /agent/settings is ONE page
// whose 27 sections are anchors derived from src/lib/config/config-sections.ts
// (decision 7, T-0125), so a section is not a route and the matrix visits anchors.
// ═══════════════════════════════════════════════════════════════

import type { AccentColor } from "@/types/console";
import type { ProductModule } from "./types";
import { NAV_SECTIONS, moduleRoutes } from "./types";

/** The console's own verbs and the surfaces they produce. Never gated by a flag. */
const coreModule: ProductModule = {
  id: "core",
  title: "Console",
  nav: [
    {
      label: "Home",
      links: [
        { icon: "Zap", label: "Dashboard", href: "/", color: "cyan", order: 1 },
        { icon: "Trophy", label: "Quests", href: "/quests", color: "orange", order: 2 },
        { icon: "LifeBuoy", label: "Help", href: "/help", color: "cyan", order: 3 },
      ],
    },
    {
      label: "Work",
      links: [
        { icon: "MessageCircle", label: "Chat", href: "/work/chat", color: "cyan", order: 1 },
        { icon: "Rocket", label: "Missions", href: "/work/missions", color: "cyan", order: 2 },
        {
          icon: "Workflow",
          label: "Composer",
          href: "/work/composer",
          color: "purple",
          order: 3,
          featureFlag: "composer",
        },
        {
          icon: "CalendarClock",
          label: "Automation",
          href: "/work/automation",
          color: "orange",
          // 6, after Scripts: Research is 4, and orders are unique per section
          // across modules, which is what makes the merge deterministic.
          order: 6,
        },
        { icon: "Terminal", label: "Scripts", href: "/work/scripts", color: "cyan", order: 5 },
      ],
    },
    {
      label: "Results",
      links: [
        { icon: "Clock", label: "Sessions", href: "/results/sessions", color: "orange", order: 1 },
        { icon: "ScrollText", label: "Logs", href: "/results/logs", color: "cyan", order: 4 },
      ],
    },
    {
      label: "Agent",
      links: [{ icon: "Database", label: "Memory", href: "/agent/memory", color: "pink", order: 5 }],
    },
  ],
};

/**
 * The Hermes control plane. ADR-0002 makes Hermes one framework behind the
 * AgentRuntime port, so everything Hermes-shaped belongs in here.
 */
const hermesModule: ProductModule = {
  id: "hermes",
  title: "Hermes",
  nav: [
    {
      label: "Agent",
      links: [
        {
          icon: "Bot",
          label: "Agents",
          href: "/agent/profiles",
          color: "purple",
          order: 1,
          // Personalities is the Identity tab now (decision 11, T-0103); its two
          // old paths redirect to ?tab=identity, so no bookmark is lost.
        },
        { icon: "FileText", label: "Skills", href: "/agent/skills", color: "green", order: 3 },
        { icon: "Wrench", label: "Tools", href: "/agent/tools", color: "purple", order: 4 },
        { icon: "Globe", label: "Models", href: "/agent/models", color: "purple", order: 6 },
        {
          icon: "Settings",
          label: "Settings",
          href: "/agent/settings",
          color: "orange",
          order: 7,
          // Visited by the e2e matrix, NOT drawn in the rail: Settings' own page lists both.
          childRoutes: [
            { label: "Restore", href: "/agent/settings/restore" },
            { label: "System", href: "/agent/settings/system" },
          ],
        },
      ],
    },
  ],
};

/** Measurement and research surfaces. */
const laboratoryModule: ProductModule = {
  id: "laboratory",
  title: "Laboratory",
  nav: [
    {
      label: "Work",
      links: [{ icon: "Telescope", label: "Research", href: "/work/research", color: "cyan", order: 4 }],
    },
    {
      label: "Results",
      links: [
        { icon: "FileStack", label: "Artifacts", href: "/results/artifacts", color: "orange", order: 2 },
        { icon: "BarChart3", label: "Insights", href: "/results/insights", color: "green", order: 3 },
      ],
    },
  ],
};

/**
 * Rec Room: creative work while the agent works. The acceptance test for the
 * ADR-0005 seam: the next Rec Room app should need no change to core.
 */
const recRoomModule: ProductModule = {
  id: "rec-room",
  title: "Rec Room",
  nav: [
    {
      label: "Rec Room",
      links: [
        {
          icon: "BookOpen",
          label: "Story Weaver",
          href: "/recroom/story-weaver",
          color: "purple",
          order: 1,
          // Visited by the e2e matrix, NOT drawn in the rail. One child since
          // decision 6 (T-0126): the library is this page, Characters and Themes
          // are panels on Create, and the three retired addresses answer 307.
          childRoutes: [{ label: "Create", href: "/recroom/story-weaver/create" }],
        },
      ],
    },
  ],
};

/** Registration order is display order within a section, after `order`. */
export const MODULES: readonly ProductModule[] = [
  coreModule,
  hermesModule,
  laboratoryModule,
  recRoomModule,
];

export function getModule(id: string): ProductModule | undefined {
  return MODULES.find((m) => m.id === id);
}

/**
 * The module-to-accent map. WG-WEB-009 (B) rules ONE registered map of four
 * entries, ruled at the first-build lock-in sitting of 2026-08-24
 * (org/LOCKBOOK.md); before it five accents were applied decoratively.
 *
 * Green leaves because `--color-neon-green` and `--color-semantic-success` are
 * the same hex and docs/contributing/design-tokens.md gives green "Success /
 * online": a hue that means "this finished" cannot also mean "Laboratory".
 * The other four go to the module that already flew them most, counted over
 * each module's own routes and components on 2026-08-24 (shared kit excluded):
 * core cyan (186 vs 97 orange, and the Cherenkov primary), rec-room purple
 * (115 of 117), hermes orange (47 vs 0 pink; its purple plurality of 60 loses
 * to rec-room by two to one), laboratory pink (the remainder; it owns no hue).
 *
 * Registering is not applying: the nav links still carry the hues the tree
 * grew, and pink still doubles as a failure tint on two Laboratory surfaces
 * that belong on `--color-semantic-danger` first. That repaint is separate work.
 * tests/unit/lockbook-tokens.test.ts holds the map to the ruling.
 */
export const MODULE_ACCENTS = {
  core: "cyan",
  hermes: "orange",
  laboratory: "pink",
  "rec-room": "purple",
} as const satisfies Record<string, AccentColor>;

/**
 * Every route every module contributes, deduplicated and sorted so the e2e
 * matrix is stable. Settings sections are not here since U11 (T-0125): they are
 * anchors, and tests/e2e/config-sections.spec.ts visits them from the catalogue.
 */
export function allModuleRoutes(): string[] {
  const routes = new Set<string>();
  for (const mod of MODULES) for (const route of moduleRoutes(mod)) routes.add(route);
  return [...routes].sort();
}

/**
 * Every rail destination in rail order: NAV_SECTIONS, each section's links by
 * `order`, each link followed by its child routes. The same walk as
 * `mainSections` in sidebar-config.ts, kept HERE because the Help rail needs it
 * on the server and in node scripts, and sidebar-config imports React icons.
 *
 * A feature-flagged link is included: a flag hides a rail entry, it does not
 * un-document the screen behind it. The generated `/agent/settings/<section>`
 * editors are NOT here: they are one page rendered many times.
 */
export function railOrder(): string[] {
  const out: string[] = [];
  for (const label of NAV_SECTIONS) {
    const links = MODULES.flatMap((mod) =>
      (mod.nav ?? []).filter((section) => section.label === label).flatMap((section) => section.links),
    ).sort((a, b) => a.order - b.order);
    for (const link of links) {
      out.push(link.href);
      for (const child of link.childRoutes ?? []) out.push(child.href);
    }
  }
  return out;
}

/**
 * The routes documentation answers for: every module route except the Settings
 * page's own children, which the Settings guide describes in its own sections
 * (the settings sections are anchors since U11, T-0125, and never reach here).
 * `docs:check` reads this and tests/e2e/app-routes.ts derives its matrix from
 * it, so the two cannot drift.
 */
export function documentedRoutes(): string[] {
  return allModuleRoutes().filter((p) => p === "/agent/settings" || !p.startsWith("/agent/settings/"));
}

/** Every (href, label) pair the registry names, sub-links included. */
function namedRoutes(): Array<{ href: string; label: string }> {
  const out: Array<{ href: string; label: string }> = [];
  for (const mod of MODULES) {
    for (const section of mod.nav ?? []) {
      for (const link of section.links) {
        out.push({ href: link.href, label: link.label });
        for (const child of link.childRoutes ?? []) {
          out.push({ href: child.href, label: child.label });
        }
      }
    }
  }
  return out;
}

/**
 * The registry's name for the page at `pathname`, or null when no module owns
 * it. The longest owning href wins, so a detail path reads as its list page and
 * a Settings section reads as Settings while `/agent/settings/system` finds its
 * own child. PageHeader and PageTitle read this when a page passes no title,
 * which is what keeps the rail entry and the h1 one word (T-0097, D55).
 */
export function labelFor(pathname: string): string | null {
  const path = pathname.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  let best: { href: string; label: string } | null = null;
  for (const entry of namedRoutes()) {
    const owns = entry.href === "/" ? path === "/" : path === entry.href || path.startsWith(entry.href + "/");
    if (!owns) continue;
    if (!best || entry.href.length > best.href.length) best = entry;
  }
  return best?.label ?? null;
}
