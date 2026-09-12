// ═══════════════════════════════════════════════════════════════
// mission-deep-link.ts: resolving `/work/missions?mission=<id>`
// ═══════════════════════════════════════════════════════════════
//
// Sessions know which mission produced them, so a session row carries an
// "open the parent mission" affordance. Those four link sites
// (SessionCard, MissionGroupCard, and two on the session transcript page)
// pointed at `/work/missions/<id>`, a route that has never
// existed in this repository. Every one of them 404'd.
//
// There is no mission detail PAGE because a mission's detail is an
// expanding panel on the board, keyed by `expandedId`. So the honest
// destination is the board with that panel already open, which is a query
// param, not a path segment. `?template=<id>` on the same page had already
// established the pattern; this is its sibling for missions.
//
// The resolution is pure and lives here so it can be tested without a DOM,
// a router or a fetch. The hook keeps only the side effects.

/** What the caller should do about a `?mission=<id>` deep link. */
export type MissionDeepLink =
  /** No `mission` param on the URL, so nothing to do. */
  | { kind: "none" }
  /** The param named a mission that is in the loaded list: open its panel. */
  | { kind: "open"; missionId: string }
  /**
   * The param named a mission that is not in the list: deleted, or from
   * another data directory. Say so; silently doing nothing would make the
   * link look broken again.
   */
  | { kind: "missing"; missionId: string };

/** The board's own URL, used to strip a consumed query param. */
export const MISSIONS_PATH = "/work/missions";

/**
 * Resolve a `?mission=<id>` deep link against the missions that loaded.
 *
 * `href` is the full current URL (`window.location.href` at the call site).
 * An unparseable href resolves to "none" rather than throwing: a deep link
 * is an affordance, and a broken one must not take the board down with it.
 */
export function resolveMissionDeepLink(
  href: string,
  missions: readonly { id: string }[],
): MissionDeepLink {
  let missionId: string | null = null;
  try {
    missionId = new URL(href).searchParams.get("mission");
  } catch {
    return { kind: "none" };
  }
  if (!missionId) return { kind: "none" };
  const found = missions.some((m) => m.id === missionId);
  return found ? { kind: "open", missionId } : { kind: "missing", missionId };
}
