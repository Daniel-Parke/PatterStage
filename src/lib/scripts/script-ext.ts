// ═══════════════════════════════════════════════════════════════
// scripts/script-ext.ts — the one place the script extensions live
// ═══════════════════════════════════════════════════════════════
//
// PatterStage lists, runs and schedules seven kinds of host script. Before
// this module the seven were written out five times across four files, and
// three of those copies disagreed with the other two:
//
//   - the scripts manager built its schedule map from a bash-only pattern, so
//     ps-db-backup.mjs (the backup script setup.sh actually installs) really
//     was written into the crontab and then reported "not scheduled" forever
//     (D41);
//   - the crontab command parser named only four of the seven, so a .ps1, .bat
//     or .cmd had a Schedule button that refused every time (D47);
//   - the Scripts page and the schedule modal stripped a bash-only suffix to
//     build the crontab id, so Unschedule sent id=ps-db-backup.mjs against an
//     entry filed as ps-db-backup and got a 404 (D48).
//
// One rule cannot be right in one file and wrong in three, so it is written
// here once and imported everywhere else. The alternation appears in this file
// and nowhere else in src/; tests/unit/b13-script-extensions-are-one-rule.test.ts
// scans the tree and fails if a second copy reappears.
//
// CLIENT-SAFE, and it must stay that way: src/app, src/components and src/lib
// all import it, so it holds data, regexes and pure text work only — no fs,
// path or child_process, no @/lib/paths, no @/lib/platform, no next/server.
// `interpreterFor` in @/lib/platform is deliberately left where it is: mapping
// an extension to an interpreter is a different question from "is this a
// script", it needs to know the platform, and it duplicates no alternation.
// ═══════════════════════════════════════════════════════════════

/**
 * The seven script types PatterStage lists, runs and schedules.
 *
 * @public The source of `SCRIPT_EXT_LIST` below, and the list
 * tests/unit/b13-script-extensions-are-one-rule.test.ts checks the four regexes
 * against, so the alternations cannot drift from the list they claim to encode.
 */
export const SCRIPT_EXTS = [".sh", ".mjs", ".cjs", ".js", ".ps1", ".bat", ".cmd"] as const;

/** One of the seven, for a caller that wants the narrow type. @public */
export type ScriptExt = (typeof SCRIPT_EXTS)[number];

/**
 * A trailing script extension, any case. THE one copy in the repo.
 *
 * Carries no `g` flag on purpose: it is shared module state used with `.test()`
 * and `.replace()`, and a sticky `lastIndex` on a shared regex is a bug that
 * only shows up on the second call.
 */
export const SCRIPT_EXT_RE = /\.(?:sh|mjs|cjs|js|ps1|bat|cmd)$/i;

/**
 * A path token ending in a script extension, either separator. Requiring a
 * separator before the basename is what keeps the crontab parser off the
 * redirected `>> …/x.log` target and off a leading `KEEP=7` env assignment.
 *
 * @public Read through `extractScriptName` below by both callers; exported so
 * the rule can be asserted directly rather than only through its one consumer.
 */
export const SCRIPT_PATH_RE = /(\S+[/\\][^/\\\s]+\.(?:sh|mjs|cjs|js|ps1|bat|cmd))\b/i;

/**
 * The same alternation as a bare basename OR a path token, for command
 * parsing. Group 1 is the directory part when the caller supplied one, group 2
 * the basename — `canonicaliseScriptsCommand` checks the first and rebuilds
 * the command from the second.
 */
export const SCRIPT_COMMAND_RE =
  /(?:^|[\s'"])([^\s'"]*[/\\])?([^\s/\\'"]+\.(?:sh|mjs|cjs|js|ps1|bat|cmd))\b/i;

/**
 * ".sh, .mjs, .cjs, .js, .ps1, .bat or .cmd" — for user-facing messages.
 * Derived from SCRIPT_EXTS rather than typed out, so an eighth extension
 * cannot be added to the list and left out of the sentence that names it.
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
 * Extract the script basename (e.g. "ps-backup.mjs") from a command string, or
 * empty string if the command invokes no host script. Anchors on a path token
 * ending in a known script extension (any separator) so it doesn't pick up env
 * vars or the redirected log path.
 *
 * This lives here rather than in hardware-cron-handlers/crontab-command.ts,
 * where it was written, because the scripts manager needs it too and
 * crontab-command already imports `resolveScriptPath` from the scripts manager
 * — importing it back the other way would close a cycle. It is pure text work
 * over SCRIPT_PATH_RE, so it belongs with the rule it reads.
 */
export function extractScriptName(command: string): string {
  const m = command.match(SCRIPT_PATH_RE);
  return m ? m[1].split(/[/\\]/).pop()! : "";
}
