// ═══════════════════════════════════════════════════════════════
// scripts/script-ext.ts — the one place the script extensions live
// ═══════════════════════════════════════════════════════════════
//
// The seven script kinds were written out five times across four files, and
// three copies disagreed: the scheduler map was bash-only, so ps-db-backup.mjs
// was in the crontab yet reported "not scheduled" forever (D41); the crontab
// parser named four of the seven, so .ps1, .bat and .cmd could never be
// scheduled (D47); the Scripts page stripped a bash-only suffix, so Unschedule
// sent id=ps-db-backup.mjs against an entry filed as ps-db-backup and got a
// 404 (D48). The alternation appears here and nowhere else in src/;
// tests/unit/b13-script-extensions-are-one-rule.test.ts fails if a copy reappears.
//
// CLIENT-SAFE, and it must stay so: src/app, src/components and src/lib all
// import it, so data, regexes and pure text only; no fs, path, child_process,
// @/lib/paths, @/lib/platform or next/server. `interpreterFor` stays in
// @/lib/platform: it needs the platform and duplicates no alternation.
// ═══════════════════════════════════════════════════════════════

/**
 * The seven script types PatterStage lists, runs and schedules.
 *
 * @public The source of `SCRIPT_EXT_LIST`, and what the b13 test checks the
 * four regexes against, so the alternations cannot drift from the list.
 */
export const SCRIPT_EXTS = [".sh", ".mjs", ".cjs", ".js", ".ps1", ".bat", ".cmd"] as const;

/** One of the seven, for a caller that wants the narrow type. @public */
export type ScriptExt = (typeof SCRIPT_EXTS)[number];

/**
 * A trailing script extension, any case; THE one copy in the repo. No `g`
 * flag: it is shared state used with `.test()` and `.replace()`, and a sticky
 * `lastIndex` only shows up on the second call.
 */
export const SCRIPT_EXT_RE = /\.(?:sh|mjs|cjs|js|ps1|bat|cmd)$/i;

/**
 * A path token ending in a script extension, either separator. The required
 * separator keeps the crontab parser off a `>> …/x.log` target and a leading
 * `KEEP=7` assignment.
 *
 * @public Read through `extractScriptName`; exported so the rule can be asserted directly.
 */
export const SCRIPT_PATH_RE = /(\S+[/\\][^/\\\s]+\.(?:sh|mjs|cjs|js|ps1|bat|cmd))\b/i;

/**
 * The alternation as a bare basename OR a path token, for command parsing:
 * group 1 the directory when supplied, group 2 the basename, which
 * `canonicaliseScriptsCommand` checks and rebuilds from respectively.
 */
export const SCRIPT_COMMAND_RE =
  /(?:^|[\s'"])([^\s'"]*[/\\])?([^\s/\\'"]+\.(?:sh|mjs|cjs|js|ps1|bat|cmd))\b/i;

/**
 * ".sh, .mjs, … or .cmd" for user-facing messages, derived from SCRIPT_EXTS so
 * an eighth extension cannot be left out of the sentence that names it.
 */
export const SCRIPT_EXT_LIST = `${SCRIPT_EXTS.slice(0, -1).join(", ")} or ${
  SCRIPT_EXTS[SCRIPT_EXTS.length - 1]
}`;

/** Does this filename name a script PatterStage will list and run? */
export function hasScriptExt(name: string): boolean {
  return SCRIPT_EXT_RE.test(name);
}

/** "ps-db-backup.mjs" → "ps-db-backup". The crontab id, and the job label. */
export function stripScriptExt(name: string): string {
  return name.replace(SCRIPT_EXT_RE, "");
}

/**
 * The script basename from a command string, or "" when it invokes none.
 * Lives here rather than in crontab-command.ts because the scripts manager
 * needs it too and crontab-command already imports `resolveScriptPath` from
 * there, so the reverse import would close a cycle.
 */
export function extractScriptName(command: string): string {
  const m = command.match(SCRIPT_PATH_RE);
  return m ? m[1].split(/[/\\]/).pop()! : "";
}
