/**
 * Types for design-lint.mjs (T-0025, warrant Q-008).
 *
 * design-lint is plain ESM so it can run from a bare `node` inside `npm run
 * lint` with no build step. That leaves its own test unable to see the shapes,
 * and `typecheck:tests` runs at zero, so the shapes are declared here rather
 * than the test being loosened to `any`. Same arrangement as output-canary.d.mts
 * next door, and for the same reason: a test that lies about a real signature is
 * a red build waiting to happen.
 */

/** One matched line, as the report prints it. */
export interface ViolationHit {
  line: number;
  text: string;
}

/** A baseline key whose count is higher than the committed one. */
export interface GrownKey {
  key: string;
  was: number;
  now: number;
}

/** What the ratchet compares. `grew` is true if EITHER total or any key grew. */
export interface Growth {
  grown: GrownKey[];
  totalWas: number;
  totalNow: number;
  grew: boolean;
}

/** `--allow-growth <reason>`, parsed. `problem` is set when the reason is not one. */
export interface GrowthAllowance {
  present: boolean;
  reason: string;
  problem?: string;
}

/** One recorded growth, written into the baseline file under `__growth__`. */
export interface GrowthLogEntry {
  when: string;
  reason: string;
  total: string;
  grew: string[];
}

/** The serialised baseline: counts, plus the growth log when there is one. */
export type BaselineFile = Record<string, number | GrowthLogEntry[]>;

/** Either a refusal carrying the growth that caused it, or the object to write. */
export type BaselinePlan =
  | { ok: false; growth: Growth; file?: undefined; recorded?: undefined }
  | { ok: true; growth: Growth; file: BaselineFile; recorded: GrowthLogEntry | null };

export const GROWTH_LOG_KEY: string;
export const ALLOW_GROWTH_FLAG: string;
export const MIN_REASON_LENGTH: number;

/** One rule of the registry: a regex, or a predicate where a regex cannot answer alone. */
export interface Rule {
  id: string;
  law: string;
  files: (path: string) => boolean;
  pattern?: RegExp;
  test?: (line: string) => boolean;
  /** File-level: the index of the line to report, or null when the file is clean. */
  fileTest?: (lines: readonly string[]) => number | null;
  codeOnly?: boolean;
}

export const RULES: readonly Rule[];

/** Every `--color-<name>` declared in a stylesheet (T-0095, token-must-exist). */
export function declaredColourTokens(css: string): Set<string>;

/** The house colour tokens a line names that `declared` does not contain. */
export function undeclaredColourClasses(line: string, declared: Set<string>): string[];

/**
 * Which lines sit inside a block comment, so a code-only rule can skip them.
 *
 * The per-line skip recognises a comment by its leading marker, which is the
 * house style in .ts and .tsx and is not CSS: a block comment's interior lines
 * carry none (T-0118).
 */
export function blockCommentLines(lines: readonly string[]): boolean[];

/** Every violation in one file's lines, keyed `rule::path` (the unit scanTree walks). */
export function violationsIn(path: string, lines: readonly string[]): Map<string, ViolationHit[]>;

export function scanTree(): {
  found: Map<string, ViolationHit[]>;
  counts: Record<string, number>;
};

export function splitBaseline(parsed: unknown): {
  counts: Record<string, number>;
  log: GrowthLogEntry[];
};

export function baselineGrowth(
  current: Record<string, number>,
  committed: Record<string, number>,
): Growth;

export function parseGrowthAllowance(argv: readonly string[]): GrowthAllowance;

export function planBaselineWrite(input: {
  counts: Record<string, number>;
  committed: Record<string, number>;
  log?: GrowthLogEntry[];
  allowance?: GrowthAllowance;
  when: string;
}): BaselinePlan;
