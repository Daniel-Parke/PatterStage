// ═══════════════════════════════════════════════════════════════
// modules/registry.ts — the modules PatterStage ships (ADR-0005)
//
// One list. The sidebar, the e2e route matrix and every page title are DERIVED
// from it, so adding a surface no longer means editing a hardcoded array in
// core and then remembering to mirror it into a test file by hand. (That
// mirror had already drifted: it was missing /laboratory/artifacts.)
//
// `core` is the console itself — the verbs that are PatterStage's own job.
// Everything else is a module, including the Hermes surface, which is what makes
// the framework-agnostic claim testable rather than aspirational: a boundary
// check can assert that nothing outside the hermes module knows Hermes' layout.
//
// THE MAP (T-0097). Five sections, verb-first, and the URLs renamed to match:
//
//   Home      /            /quests            /help
//   Work      /work/chat   /work/missions     /work/composer   /work/research   /work/scripts
//   Results   /results/sessions   /results/artifacts   /results/insights   /results/logs
//   Agent     /agent/profiles  /agent/skills  /agent/tools
//             /agent/memory   /agent/models   /agent/settings (+ /restore, /system)
//   Rec Room  /recroom/story-weaver/*
//
// The old paths answer 307 from next.config.ts for one release. The config
// tree is not rail data any more: /agent/settings is the index, derived from
// src/lib/config-sections.ts, and this file derives the section routes from
// the same list so the e2e matrix still visits each one.
// ═══════════════════════════════════════════════════════════════

import type { AccentColor } from "@/types/console";
import { settingsRoutes } from "@/lib/config-sections";
import type { ProductModule } from "./types";
import { NAV_SECTIONS, moduleRoutes } from "./types";

/**
 * The console. Dispatch, schedule, gate and watch, plus the transcript and log
 * surfaces those verbs produce. Never gated by a flag.
 */
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
 * The Hermes control plane: the agent's own configuration surfaces.
 *
 * ADR-0002 keeps PatterStage's run engine but makes Hermes one framework behind
 * the AgentRuntime port. Everything Hermes-shaped belongs in here.
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
          // Personalities IS the Identity tab now (decision 11, T-0103). It was
          // a sub-link here until the fold landed; the two old paths redirect
          // to ?tab=identity, so nothing that was bookmarked is lost.
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
          subLinks: [
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
 * Rec Room: creative work to do while your agent is working. Story Weaver is the
 * first of several, and this module is the acceptance test for the seam — if the
 * next Rec Room app needs no change to core, ADR-0005 has worked.
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
          subLinks: [
            { label: "Library", href: "/recroom/story-weaver/library" },
            { label: "Create", href: "/recroom/story-weaver/create" },
            { label: "Characters", href: "/recroom/story-weaver/characters" },
            { label: "Themes", href: "/recroom/story-weaver/themes" },
          ],
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
 * entries, and until now there was no map at all: five accents were applied
 * decoratively and a module's colour was whatever its links happened to grow.
 * Ruled at the first-build lock-in sitting of 2026-08-24 (org/LOCKBOOK.md).
 *
 * Five accents, four modules, so one accent leaves, and it is green:
 * `--color-neon-green` and `--color-semantic-success` are the same hex
 * (#a3ff12), and docs/contributing/design-tokens.md gives green the role "Success / online".
 * A hue that already means "this finished" cannot also mean "this is the
 * Laboratory". That is the arithmetic behind the ruling's four entries.
 *
 * The remaining four go to the module that already flies them. Counted across
 * each module's own route tree and component directories on 2026-08-24, with
 * the shared kit (src/components/ui, providers, motion) excluded because it
 * belongs to no module:
 *
 *   core        cyan     186 uses against 97 orange, and cyan is the Cherenkov
 *                        primary. Core is the console itself.
 *   rec-room    purple   115 of its 117 non-green accent uses, and the reading
 *                        register's own `--ps-reader-accent` is a purple.
 *   hermes      orange   47 uses against 0 pink. Purple is its own plurality at
 *                        60, but rec-room holds purple by a factor of two.
 *   laboratory  pink     the remainder. Laboratory owns no hue: its top accent
 *                        is cyan at 24, which is core's by a factor of eight.
 *                        Its own use of pink (5) already beats its orange (2).
 *
 * Registering the map is not applying it. The nav links above still carry the
 * hues the tree grew, and pink still doubles as the failure tint on two
 * Laboratory surfaces, which belong on `--color-semantic-danger` before this
 * map can be read off a screen. That repaint is separate work, deliberately not
 * taken in the sitting that ruled the map.
 *
 * tests/unit/lockbook-tokens.test.ts holds the map to the ruling: one entry per
 * registered module, four entries, four distinct accents, none of them green.
 */
export const MODULE_ACCENTS = {
  core: "cyan",
  hermes: "orange",
  laboratory: "pink",
  "rec-room": "purple",
} as const satisfies Record<string, AccentColor>;

/**
 * Every route every module contributes, plus the settings section routes the
 * catalogue derives. Deduplicated and sorted so the e2e matrix is stable
 * across reorderings.
 */
export function allModuleRoutes(): string[] {
  const routes = new Set<string>();
  for (const mod of MODULES) for (const route of moduleRoutes(mod)) routes.add(route);
  for (const route of settingsRoutes()) routes.add(route);
  return [...routes].sort();
}

/**
 * Every rail destination, in the order the rail shows it.
 *
 * The five sections in NAV_SECTIONS order, each section's links by `order`,
 * each link followed by its sub-links as declared. This is the same walk
 * `mainSections` in sidebar-config.ts does, kept HERE because the Help rail
 * needs it too and sidebar-config imports React icons: a resolver that runs on
 * the server, on the client and in a node script cannot reach through that.
 *
 * A feature-flagged link is included. A flag hides a rail entry; it does not
 * un-document the screen behind it, and a guide that vanished with a flag would
 * be a guide nobody could find the day the flag came back.
 *
 * The generated `/agent/settings/<section>` editors are NOT here: they are one
 * page rendered many times and they are not rail destinations.
 */
export function railOrder(): string[] {
  const out: string[] = [];
  for (const label of NAV_SECTIONS) {
    const links = MODULES.flatMap((mod) =>
      (mod.nav ?? []).filter((section) => section.label === label).flatMap((section) => section.links),
    ).sort((a, b) => a.order - b.order);
    for (const link of links) {
      out.push(link.href);
      for (const sub of link.subLinks ?? []) out.push(sub.href);
    }
  }
  return out;
}

/**
 * The routes documentation is answerable for: every module route except the
 * generated `/agent/settings/<section>` editors.
 *
 * `allModuleRoutes()` is the e2e answer to "what can be visited"; this is the
 * docs answer to "what needs a guide". The twenty-seven section editors are one
 * page rendered twenty-seven times from src/lib/config-sections.ts, and the
 * fields each one carries are already documented where they are declared.
 * Demanding a guide per section would buy twenty-seven near-identical pages and
 * a gate everybody learns to satisfy with a stub, so the index stands for them.
 *
 * `docs:check` reads this, and tests/e2e/app-routes.ts derives its navigation
 * matrix from it, so the two sets cannot drift apart.
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
        for (const sub of link.subLinks ?? []) out.push({ href: sub.href, label: sub.label });
      }
    }
  }
  return out;
}

/**
 * The name of the page at `pathname`, from the registry, or null when no
 * module owns the path. The longest owning href wins, so a detail path
 * (`/results/sessions/abc`) reads as its list page and a Settings section
 * (`/agent/settings/agent`) reads as Settings, while `/agent/settings/system`
 * finds its own sub-link. PageHeader and PageTitle read this when a page
 * passes no title, which is what makes the rail entry and the h1 one word
 * (T-0097, D55).
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
