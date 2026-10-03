// ═══════════════════════════════════════════════════════════════
// log-freshness.ts: how old is the log you are looking at?
//
// /api/logs has always returned each file's mtime, both for the file
// being read and for every file in the picker, and the viewer discarded
// all of it. So the page auto-refreshed every five seconds and gave the
// operator no way to tell a live log from one that stopped being written
// three days ago: same header, same sidebar row, same silence.
//
// `timeAgo` in lib/utils is not the tool for this: its finest bucket is
// "just now" for anything under a minute, and the whole question here is
// whether the file moved in the last few seconds.
// ═══════════════════════════════════════════════════════════════

/** A file written inside this window is being actively appended to. */
export const LOG_LIVE_WITHIN_MS = 60_000;

function parsedMtime(modified: string | null | undefined): number | null {
  if (!modified) return null;
  const ms = Date.parse(modified);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Age of a log file as a short duration ("4s", "12m", "3h", "2d").
 *
 * Returns null when there is no readable mtime, so the caller can omit
 * the whole phrase rather than render "updated unknown ago". A clock
 * skew that puts the mtime in the future clamps to "0s" instead of
 * rendering a negative age.
 */
export function formatLogAge(
  modified: string | null | undefined,
  now: number,
): string | null {
  const at = parsedMtime(modified);
  if (at === null) return null;
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

/** True when the file was written inside the live window. Unknown mtimes are not live. */
export function isLogLive(modified: string | null | undefined, now: number): boolean {
  const at = parsedMtime(modified);
  return at !== null && now - at < LOG_LIVE_WITHIN_MS;
}
