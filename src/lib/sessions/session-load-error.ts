// ═══════════════════════════════════════════════════════════════
// session-load-error.ts — which failure a transcript hit
// ═══════════════════════════════════════════════════════════════
//
// Every failure on the transcript page read "Session Not Found": a malformed
// id, a transcript over the size ceiling, a rate limit and a server error all
// told the operator the same untrue thing, and none of them offered a retry
// (T-0105, D33).

/** The heading for a transcript read that failed with this status. */
export function sessionLoadErrorHeading(status: number | null | undefined): string {
  switch (status) {
    case 400:
      return "That session link is not valid";
    case 404:
      return "Session not found";
    case 413:
      return "Transcript too large to display";
    case 429:
      return "Too many session requests";
    default:
      return "Couldn't load this transcript";
  }
}
