/**
 * Types for lib.mjs (T-0109, B15, decision 3).
 *
 * The module is plain ESM for two reasons at once: bare `node` runs the build
 * with no compile step, and next/jest can load a .mjs from a unit test where it
 * cannot load a .mts. That leaves the callers unable to see its shapes, and
 * `typecheck:tests` runs at zero, so the shapes are declared here rather than
 * the tests being loosened to `any`. Same arrangement as
 * scripts/tooling/output-canary.d.mts and design-lint.d.mts.
 */

export type DocSection = "start-here" | "concepts" | "guides" | "running" | "reference" | "contributing";

export interface DocFrontMatter {
  title: string;
  summary: string;
  section: DocSection;
  nav: number;
  audience?: "operator" | "contributor";
  screen?: string;
  concepts?: string[];
  shots?: string[];
}

export interface DocPage {
  /** Repo-root-relative, e.g. "docs/guides/missions.md". */
  path: string;
  /** Site slug, e.g. "guides/missions". docs/README.md -> "index". */
  slug: string;
  data: DocFrontMatter;
  body: string;
}

export type ParseResult =
  | { ok: true; data: DocFrontMatter; body: string }
  | { ok: false; errors: string[] };

export interface ManifestPage {
  slug: string;
  title: string;
  summary: string;
  nav: number;
  screen?: string;
  concepts?: string[];
  shots?: string[];
}

export interface Manifest {
  generatedBy: "scripts/docs/build-site.mjs";
  sections: Array<{ id: DocSection; label: string; pages: ManifestPage[] }>;
  /** route -> slug, for the Help deep-link resolver. */
  screens: Record<string, string>;
  /** every concept id defined under docs/concepts/, sorted. */
  concepts: string[];
  /** slug -> {prev, next} across the whole reading path, in SECTIONS then nav order. */
  order: string[];
}

export type RefusalCode =
  | "route-without-guide"
  | "screen-not-a-route"
  | "missing-image"
  | "undefined-concept"
  | "stale-generated-block"
  | "retired-path";

export interface Refusal {
  code: RefusalCode;
  /** the offending doc, repo-root-relative; "" when the subject is a route with no doc. */
  path: string;
  /** the route, image path, concept id or block id the refusal is about. */
  subject: string;
  /** the printed line; always starts "docs:check: ". */
  message: string;
}

export interface GeneratedBlock {
  id: string;
  /** text between the markers, with the marker lines and their newlines removed. */
  body: string;
  /** character offset of the "<" of the opening marker. */
  start: number;
  /** character offset one past the ">" of the closing marker; = start of body when unclosed. */
  end: number;
  closed: boolean;
}

export const SECTIONS: readonly DocSection[];
export const SECTION_LABELS: Readonly<Record<DocSection, string>>;
export const REQUIRED_KEYS: readonly string[];
export const OPTIONAL_KEYS: readonly string[];
export const IGNORED_KEYS: readonly string[];
export const REFUSAL_CODES: readonly RefusalCode[];
export const GENERATED_BLOCK_IDS: readonly string[];
export const RETIRED_PATHS: readonly string[];

/** "docs/guides/missions.md" -> "guides/missions"; "docs/README.md" -> "index". */
export function slugFor(repoRelPath: string): string;

/** Splits and validates the leading --- block. `path` is repo-root-relative and
 *  appears verbatim at the head of every error string. */
export function parseDocFrontMatter(source: string, path: string): ParseResult;

/** Deterministic. Sections in SECTIONS order; pages by nav then slug. */
export function buildManifest(pages: readonly DocPage[]): Manifest;

/** A concepts page's id is its own basename: docs/concepts/mission.md -> "mission". */
export function conceptIdFor(page: DocPage): string;

/** JSON.stringify(manifest, null, 2) + "\n". The exact bytes of docs/manifest.json. */
export function serialiseManifest(manifest: Manifest): string;

/** Relative href from one slug's page to another's, always ending ".html",
 *  never starting "/" or "http". */
export function relativeHref(fromSlug: string, toSlug: string): string;

/** Relative href from a slug's page to a repo-root-relative asset the build
 *  copies into site/. Strips the leading "docs/" and resolves against the slug's
 *  own directory: relativeAsset("guides/missions", "docs/images/x.png") ===
 *  "../images/x.png"; relativeAsset("index", "docs/images/x.png") ===
 *  "images/x.png". Never starts with "/". */
export function relativeAsset(fromSlug: string, repoRelPath: string): string;

/** A complete HTML document. CSS inlined in <style>. Every href/src relative. */
export function renderPage(page: DocPage, html: string, manifest: Manifest): string;

/** The fragment written to public/help/fragments/<slug>.html — body only, no
 *  <html>, <head>, <style> or <script>. */
export function renderFragment(page: DocPage, html: string, manifest: Manifest): string;

export function buildSearchIndex(pages: readonly DocPage[]): Array<{
  slug: string;
  title: string;
  section: DocSection;
  heading: string;
  anchor: string;
  text: string;
}>;

/** The heading anchors buildSearchIndex writes; build-site.mjs gives markdown-it
 *  the same function so a search hit lands on the heading it names. */
export function slugifyHeading(text: string): string;

export function findGeneratedBlocks(markdown: string): GeneratedBlock[];
export function replaceGeneratedBlock(markdown: string, id: string, body: string): string;

export interface CheckInput {
  pages: readonly DocPage[];
  /** documentedRoutes() from src/lib/modules/registry.ts. */
  routes: readonly string[];
  /** repo-root-relative path -> does it exist on disk. Injected so the checker is pure. */
  imageExists: (repoRelPath: string) => boolean;
  /** generated-block id -> the body it should currently hold. */
  freshBlocks: Readonly<Record<string, string>>;
}

export function checkDocs(input: CheckInput): Refusal[];
