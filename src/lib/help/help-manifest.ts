// ═══════════════════════════════════════════════════════════════
// help-manifest.ts — the pure half of in-app Help
//
// B15 generates public/help/ from docs/**/*.md at build time. This module is
// everything that decides what to do with it: which slugs are safe to touch,
// which page documents which screen, what order the Help rail is in, and what
// comes next. No React, no fs, no database, because the same answers are needed
// on the server (the Help page), on the client (the ? on every header) and in a
// plain-node check script, and three copies of a resolver is how the ? starts
// landing on the wrong page.
//
// Every parser here is TOTAL. A fresh clone has no public/help/ until the first
// build, so an absent or half-written corpus has to read as "no Help yet" and
// never as a thrown render. That is the difference between a screen that says
// how to build the docs and a screen that is blank.
// ═══════════════════════════════════════════════════════════════

import { railOrder } from "@/lib/modules/registry";

/**
 * The six tiers, in reading order.
 *
 * @public The order IS the reading path, and it is the same list docs:check,
 * the generator and this resolver all sort by. A second copy anywhere would be
 * a second answer to what comes after Concepts.
 */
export const HELP_SECTIONS = [
  "start-here",
  "concepts",
  "guides",
  "running",
  "reference",
  "contributing",
] as const;

/** One of the six tiers. @public The type every page's `section` field has. */
export type HelpSection = (typeof HELP_SECTIONS)[number];

/**
 * What each tier is called on screen.
 *
 * @public Read through `helpNavOrder`, which stamps the label onto each section
 * so a renderer never has to know the map; exported because the label for a
 * tier is a fact about the corpus rather than about the rail that shows it.
 */
export const HELP_SECTION_LABELS: Record<HelpSection, string> = {
  "start-here": "Start here",
  concepts: "Concepts",
  guides: "Guides",
  running: "Running it",
  reference: "Reference",
  contributing: "Contributing",
};

export interface HelpPageMeta {
  slug: string;
  title: string;
  summary: string;
  section: HelpSection;
  nav: number;
  audience?: string;
  /** A registry route this page documents. */
  screen?: string;
  concepts?: string[];
  shots?: string[];
}

export interface HelpManifest {
  generatedAt: string;
  pages: HelpPageMeta[];
}

/**
 * What every parser answers when there is nothing to read.
 *
 * @public A named constant rather than an inline literal so a caller can
 * compare against it, and so "no corpus" is one value in one place rather than
 * a shape three functions each rebuild.
 */
export const EMPTY_HELP_MANIFEST: HelpManifest = { generatedAt: "", pages: [] };

/** registry route -> help slug. Small enough to hand to the client. */
export type HelpScreenIndex = Record<string, string>;

/** One concept, as the popover shows it. @public The element type of ConceptIndex. */
export interface ConceptEntry {
  id: string;
  term: string;
  short: string;
  slug: string;
}

export type ConceptIndex = Record<string, ConceptEntry>;

export interface HelpSearchEntry {
  slug: string;
  title: string;
  section: HelpSection;
  heading?: string;
  anchor?: string;
  text: string;
}

export interface HelpNavSection {
  section: HelpSection;
  label: string;
  pages: HelpPageMeta[];
}

/**
 * The only slug shape this feature will touch.
 *
 * This is the whole path-traversal guard: a fragment is read from disk by
 * joining the slug's segments onto a directory, so anything that could name a
 * parent, an absolute path, a Windows separator or a file extension has to be
 * refused BEFORE a path is built rather than checked after.
 */
export function isSafeHelpSlug(slug: string): boolean {
  return typeof slug === "string" && /^[a-z0-9][a-z0-9-]*(\/[a-z0-9][a-z0-9-]*)*$/.test(slug);
}

function isSection(value: unknown): value is HelpSection {
  return typeof value === "string" && (HELP_SECTIONS as readonly string[]).includes(value);
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out = value.filter((v): v is string => typeof v === "string");
  return out.length > 0 ? out : undefined;
}

/**
 * Read a manifest, dropping what cannot be trusted and keeping the rest.
 *
 * A page with no slug, an unknown tier or a slug that fails the guard is
 * dropped rather than fatal: one malformed entry in a generated file must not
 * take the whole Help section down with it.
 */
export function parseHelpManifest(raw: unknown): HelpManifest {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return EMPTY_HELP_MANIFEST;
  const obj = raw as { generatedAt?: unknown; pages?: unknown };
  if (!Array.isArray(obj.pages)) return EMPTY_HELP_MANIFEST;

  const pages: HelpPageMeta[] = [];
  for (const entry of obj.pages) {
    if (!entry || typeof entry !== "object") continue;
    const p = entry as Record<string, unknown>;
    if (typeof p.slug !== "string" || !isSafeHelpSlug(p.slug)) continue;
    if (typeof p.title !== "string" || p.title.length === 0) continue;
    if (!isSection(p.section)) continue;
    const page: HelpPageMeta = {
      slug: p.slug,
      title: p.title,
      summary: typeof p.summary === "string" ? p.summary : "",
      section: p.section,
      nav: typeof p.nav === "number" && Number.isFinite(p.nav) ? p.nav : 0,
    };
    if (typeof p.audience === "string") page.audience = p.audience;
    if (typeof p.screen === "string" && p.screen.startsWith("/")) page.screen = p.screen;
    const concepts = stringArray(p.concepts);
    if (concepts) page.concepts = concepts;
    const shots = stringArray(p.shots);
    if (shots) page.shots = shots;
    pages.push(page);
  }

  return { generatedAt: typeof obj.generatedAt === "string" ? obj.generatedAt : "", pages };
}

/** Index the concepts by id, dropping an entry that could not fill a popover. */
export function parseConcepts(raw: unknown): ConceptIndex {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const list = (raw as { concepts?: unknown }).concepts;
  if (!Array.isArray(list)) return {};
  const index: ConceptIndex = {};
  for (const entry of list) {
    if (!entry || typeof entry !== "object") continue;
    const c = entry as Record<string, unknown>;
    if (typeof c.id !== "string" || !c.id) continue;
    if (typeof c.term !== "string" || !c.term) continue;
    if (typeof c.short !== "string" || !c.short) continue;
    index[c.id] = {
      id: c.id,
      term: c.term,
      short: c.short,
      slug: typeof c.slug === "string" ? c.slug : `concepts/${c.id}`,
    };
  }
  return index;
}

/** Read the search index, dropping rows that cannot be linked to. */
export function parseSearchIndex(raw: unknown): HelpSearchEntry[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const list = (raw as { entries?: unknown }).entries;
  if (!Array.isArray(list)) return [];
  const out: HelpSearchEntry[] = [];
  for (const entry of list) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    if (typeof e.slug !== "string" || !isSafeHelpSlug(e.slug)) continue;
    if (typeof e.title !== "string" || !e.title) continue;
    if (!isSection(e.section)) continue;
    const row: HelpSearchEntry = {
      slug: e.slug,
      title: e.title,
      section: e.section,
      text: typeof e.text === "string" ? e.text : "",
    };
    if (typeof e.heading === "string" && e.heading) row.heading = e.heading;
    if (typeof e.anchor === "string" && e.anchor) row.anchor = e.anchor;
    out.push(row);
  }
  return out;
}

/**
 * Which page answers for which screen.
 *
 * A screen can be claimed twice: the guide documents it, and so does that
 * screen's tour page. The guide wins, because a ? pressed on a screen wants the
 * reference for it and not the walkthrough that mentions it. Failing that, the
 * lowest nav, then the smallest slug, so the answer never depends on the order
 * a directory happened to be read in.
 */
export function helpScreenIndex(manifest: HelpManifest): HelpScreenIndex {
  const best = new Map<string, HelpPageMeta>();
  for (const page of manifest.pages) {
    if (!page.screen) continue;
    const current = best.get(page.screen);
    if (!current || beats(page, current)) best.set(page.screen, page);
  }
  const index: HelpScreenIndex = {};
  for (const [screen, page] of [...best.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    index[screen] = page.slug;
  }
  return index;
}

function beats(candidate: HelpPageMeta, incumbent: HelpPageMeta): boolean {
  const a = candidate.section === "guides";
  const b = incumbent.section === "guides";
  if (a !== b) return a;
  if (candidate.nav !== incumbent.nav) return candidate.nav < incumbent.nav;
  return candidate.slug < incumbent.slug;
}

/**
 * The screen a path belongs to, read exactly the way `labelFor` reads it.
 *
 * "Exactly" matters: the ? has to land on the guide whose title the header is
 * already showing, and two different notions of which route owns
 * /results/sessions/abc123 would put those two out of step on every detail
 * page.
 */
export function helpSlugForPathname(pathname: string, index: HelpScreenIndex): string | null {
  const path = normalisePath(pathname);
  let winner: string | null = null;
  let longest = -1;
  for (const [route, slug] of Object.entries(index)) {
    if (!owns(route, path)) continue;
    if (route.length > longest) {
      longest = route.length;
      winner = slug;
    }
  }
  return winner;
}

function normalisePath(pathname: string): string {
  const bare = String(pathname).split("?")[0].split("#")[0].replace(/\/+$/, "");
  return bare === "" ? "/" : bare;
}

/**
 * Does this route own this path?
 *
 * The dashboard needs no special case. Its route is "/", and the prefix test
 * below asks whether the path starts with "//", which no path does, so "/"
 * owns exactly itself and nothing else falls out of it. A separate branch for
 * the root read as a guard against something and guarded against nothing.
 */
function owns(route: string, path: string): boolean {
  return path === route || path.startsWith(`${route}/`);
}

export function helpPageBySlug(manifest: HelpManifest, slug: string): HelpPageMeta | null {
  return manifest.pages.find((p) => p.slug === slug) ?? null;
}

/**
 * The Help rail: the six tiers in reading order, each holding its pages.
 *
 * The guides are ordered by the app's own rail rather than by their nav
 * numbers. Two orders for the same list of screens is one order too many, and
 * the one a reader already knows is the one on the left of every screen. A
 * guide that documents no rail route sorts after every guide that does.
 */
export function helpNavOrder(manifest: HelpManifest): HelpNavSection[] {
  const rail = railOrder();
  const railIndex = new Map(rail.map((route, i) => [route, i]));

  const out: HelpNavSection[] = [];
  for (const section of HELP_SECTIONS) {
    const pages = manifest.pages.filter((p) => p.section === section);
    if (pages.length === 0) continue;
    pages.sort(section === "guides" ? byRailThenNav : byNavThenSlug);
    out.push({ section, label: HELP_SECTION_LABELS[section], pages });
  }
  return out;

  function byRailThenNav(a: HelpPageMeta, b: HelpPageMeta): number {
    const ra = a.screen !== undefined ? railIndex.get(a.screen) : undefined;
    const rb = b.screen !== undefined ? railIndex.get(b.screen) : undefined;
    if (ra !== undefined && rb !== undefined) return ra - rb;
    if (ra !== undefined) return -1;
    if (rb !== undefined) return 1;
    return byNavThenSlug(a, b);
  }
}

function byNavThenSlug(a: HelpPageMeta, b: HelpPageMeta): number {
  if (a.nav !== b.nav) return a.nav - b.nav;
  return a.slug.localeCompare(b.slug);
}

/** What /help renders: the first page of the reading path, never a literal. */
export function helpIndexSlug(manifest: HelpManifest): string | null {
  const order = helpNavOrder(manifest);
  return order[0]?.pages[0]?.slug ?? null;
}

/** The pages either side of this one, along the whole reading path. */
export function helpNeighbours(
  manifest: HelpManifest,
  slug: string,
): { prev: HelpPageMeta | null; next: HelpPageMeta | null } {
  const flat = helpNavOrder(manifest).flatMap((s) => s.pages);
  const i = flat.findIndex((p) => p.slug === slug);
  if (i === -1) return { prev: null, next: null };
  return { prev: flat[i - 1] ?? null, next: flat[i + 1] ?? null };
}
