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

export function driftBannerHeadline({ driftCount, errorCount }: DriftBannerCounts): string | null {
  if (driftCount === 0 && errorCount === 0) return null;
  return "Profile drift — database and Hermes disk differ";
}
