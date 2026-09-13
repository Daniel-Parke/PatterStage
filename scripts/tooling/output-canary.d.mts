/**
 * Types for output-canary.mjs (T-0009, source row WO-0008).
 *
 * The canary is plain ESM so it can run from a bare `node` in CI with no build
 * step, which is what lets it gate a commit that has not been compiled yet.
 * That leaves its own test unable to see the shapes, and `typecheck:tests`
 * runs at zero, so the shapes are declared here rather than the test being
 * loosened to `any`. A test that lies about a real signature is a red build.
 */

/** One hashed surface. `null` when the surface could not be produced at all. */
export type Surface = string | null;

export interface CanaryReport {
  canaryVersion: number;
  surfaces: Record<string, Surface>;
  diagnostics: {
    moduleGraph: { modules: number };
    httpSurface: { entries: number };
    seedPack: { files: number; lines: string[] };
    [key: string]: unknown;
  };
}

export interface CanaryGolden {
  canaryVersion: number;
  goldenSurfaces: readonly string[];
  surfaces: Record<string, Surface>;
}

export interface ModuleEntry {
  path: string;
  source: string;
}

/** The surfaces held against the committed golden. Deliberately excludes the
 *  noisy ones (moduleGraph, prerender); see docs/contributing/output-canary.md. */
export const GOLDEN_SURFACES: readonly string[];

/** Matches a commit message that declares itself a pure move. */
export const MOVE_COMMIT_MARKER: RegExp;

export function normaliseSpecifier(spec: string): string;
export function normaliseModuleSource(source: string): string;
export function exportedHttpMethods(source: string): string[];
export function segmentConfig(source: string): string[];
export function moduleMultisetHash(entries: readonly ModuleEntry[]): string;
export function normalisePrerenderedHtml(html: string, buildId: string): string;
export function buildReport(options?: { includePrerender?: boolean }): CanaryReport;
export function readGolden(): CanaryGolden;
export function diffSurfaces(
  expected: Record<string, Surface>,
  actual: Record<string, Surface>,
  names: readonly string[],
): string[];
export function sharedSurfaceNames(
  a: Record<string, Surface>,
  b: Record<string, Surface>,
): string[];
