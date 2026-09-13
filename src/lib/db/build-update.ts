// ═══════════════════════════════════════════════════════════════
// db/build-update.ts — generic SQL UPDATE SET-clause builder
//
// Replaces the repeated "const sets: string[] = []; if (x !== undefined)
// sets.push(...)" pattern duplicated across every repository. Skips
// undefined fields, always touches updated_at when `now` is given, and
// returns the parameterised clause + ordered values.
// ═══════════════════════════════════════════════════════════════

export interface BuildUpdateResult {
  /** Comma-joined "col = ?" assignments (no leading/trailing commas). */
  sql: string;
  /** Values in the same order as the assignments. */
  values: unknown[];
  /** Number of non-timestamp fields actually set. */
  count: number;
}

/**
 * Build an UPDATE SET clause from a column→value map. `undefined` values are
 * skipped (use `null` to set NULL explicitly). When `now` is provided an
 * `updated_at = ?` assignment is prepended.
 */
export function buildUpdate(
  fields: Record<string, unknown>,
  opts: { now?: string } = {},
): BuildUpdateResult {
  const sets: string[] = [];
  const values: unknown[] = [];

  if (opts.now !== undefined) {
    sets.push("updated_at = ?");
    values.push(opts.now);
  }

  let count = 0;
  for (const [col, val] of Object.entries(fields)) {
    if (val === undefined) continue;
    sets.push(`${col} = ?`);
    values.push(val);
    count += 1;
  }

  return { sql: sets.join(", "), values, count };
}
