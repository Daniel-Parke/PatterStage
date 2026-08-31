// ═══════════════════════════════════════════════════════════════
// drift-banner-headline — what the profiles banner leads with
//
// Lifted out of ProfilesDriftBanner so the sentence is something a test can
// hold. Returns null when there is nothing to say.
// ═══════════════════════════════════════════════════════════════

export interface DriftBannerCounts {
  driftCount: number;
  errorCount: number;
}

/**
 * The banner used to headline "Profile drift — database and Hermes disk differ"
 * whenever it rendered at all, including when nothing had drifted and the only
 * problem was a sync ERROR. That sends the operator to reconcile a difference
 * that does not exist while the real fault -- a push that threw -- goes unnamed
 * in the headline (T-0082).
 *
 * Drift and errors are different things and get different sentences. Drift is a
 * disagreement to reconcile; an error is an operation that did not happen.
 */
export function driftBannerHeadline({ driftCount, errorCount }: DriftBannerCounts): string | null {
  if (driftCount === 0 && errorCount === 0) return null;
  if (driftCount === 0) return "Sync error — a push to Hermes did not complete";
  if (errorCount === 0) return "Profile drift — database and Hermes disk differ";
  return "Profile drift and sync errors — some pushes did not complete";
}
