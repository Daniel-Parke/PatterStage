// ═══════════════════════════════════════════════════════════════
// operator-prefs-repository.ts — the console's own settings, allow-listed
//
// Six keys, each with the shape it may hold, validated before a write so
// PUT /api/prefs cannot become a free-form store. Adding a preference means
// adding a key and its schema here; the table (038_operator_prefs.sql) does
// not change. Read as one map, because the shell reads them all at once.
// ═══════════════════════════════════════════════════════════════

import { z } from "zod";

import { getDb, now } from "@/lib/db";

const SCHEMAS = {
  /** The rail collapsed to icons. */
  "sidebar.collapsed": z.boolean(),
  /** The dashboard's dispatch strip open. */
  "dispatchStrip.open": z.boolean(),
  /** Quest id → ISO time it was first seen complete (B17 latches here). */
  "quests.completedAt": z.record(z.string(), z.string()),
  /** Quest ids the operator skipped. */
  "quests.skipped": z.array(z.string()),
  /** The first-run guide hidden by choice. */
  "guide.hidden": z.boolean(),
  /** The last help page read, as its slug. */
  "help.lastSlug": z.string().max(200),
} as const;

export type OperatorPrefKey = keyof typeof SCHEMAS;

export const OPERATOR_PREF_KEYS: readonly OperatorPrefKey[] = Object.keys(SCHEMAS) as OperatorPrefKey[];

function isOperatorPrefKey(key: string): key is OperatorPrefKey {
  return Object.prototype.hasOwnProperty.call(SCHEMAS, key);
}

/** The value as the schema accepts it, or the reason it does not. */
export function validateOperatorPref(
  key: string,
  value: unknown,
): { ok: true; key: OperatorPrefKey; value: unknown } | { ok: false; error: string } {
  if (!isOperatorPrefKey(key)) {
    return { ok: false, error: `Unknown preference "${key}". Known keys: ${OPERATOR_PREF_KEYS.join(", ")}.` };
  }
  const parsed = SCHEMAS[key].safeParse(value);
  if (!parsed.success) {
    return { ok: false, error: `Preference "${key}" has the wrong shape: ${parsed.error.issues[0]?.message ?? "invalid"}.` };
  }
  return { ok: true, key, value: parsed.data };
}

interface PrefRow {
  key: string;
  value_json: string;
}

/** Every stored preference, as one map. A value that will not parse is skipped. */
export function readOperatorPrefs(): Record<string, unknown> {
  const rows = getDb().prepare("SELECT key, value_json FROM operator_prefs").all() as PrefRow[];
  const out: Record<string, unknown> = {};
  for (const row of rows) {
    try {
      out[row.key] = JSON.parse(row.value_json);
    } catch {
      // A row this process cannot read is left out rather than crashing the shell.
    }
  }
  return out;
}

/** Validate, then upsert. Throws on an unknown key or a wrong shape. */
export function writeOperatorPref(key: string, value: unknown): void {
  const checked = validateOperatorPref(key, value);
  if (!checked.ok) throw new Error(checked.error);
  getDb()
    .prepare(
      "INSERT INTO operator_prefs (key, value_json, updated_at) VALUES (?, ?, ?) " +
        "ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at",
    )
    .run(checked.key, JSON.stringify(checked.value), now());
}
