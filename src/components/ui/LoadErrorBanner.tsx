// ═══════════════════════════════════════════════════════════════
// LoadErrorBanner — Persistent error banner for page-level load failures
// ═══════════════════════════════════════════════════════════════
//
// THE READ CONTRACT (T-0096). A list read that failed shows THIS, with a
// Retry, and never the page's empty state. Nine pages rendered "no X yet"
// over a 500, because their hooks swallowed the failure into an empty array;
// the page owns the conditional and gates its empty state on `!error`. The
// `compact` variant is for a sidebar or a list column, where the full banner
// is wider than the column.
//
// Purely presentational: it never calls `useApiData` or any fetch. The page
// owns `refetch`; the banner just invokes it on click. The component never
// checks for an empty `error` and always renders the banner chrome; pages
// wrap it as
//   {loadError && <LoadErrorBanner error={loadError} onRetry={refetch} />}

"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

interface LoadErrorBannerProps {
  /** The error string (typically `loadError` from `useApiData`). */
  error: string;
  /** Optional retry handler. When provided, a "Retry" button is shown. */
  onRetry?: () => void;
  /** Optional human-readable hint (e.g. "the list is empty because the
   *  load failed, not because the catalog is empty"). */
  hint?: string;
  /** Optional className for the outer container (margin/layout tweaks). */
  className?: string;
  /** Optional button label (default: "Retry"). */
  retryLabel?: string;
  /** The smaller variant, for a sidebar or a list column. */
  compact?: boolean;
}

export default function LoadErrorBanner({
  error,
  onRetry,
  hint,
  className,
  retryLabel = "Retry",
  compact = false,
}: LoadErrorBannerProps) {
  const chrome = compact
    ? "mb-2 gap-2 rounded-ps-md px-3 py-2 text-body"
    : "mb-4 gap-3 rounded-ps-lg px-4 py-3 text-body";
  // The sentence is what the banner is for, and the button took its room:
  // on a phone the memory health banner's words sat in a column beside
  // Retry (the review of 2026-09-08). Below sm the button wraps under the
  // words; the compact variant lives in a list column that is narrow at
  // every width, so its button always does (T-0131).
  const wrap = compact ? "basis-full" : "basis-full sm:basis-auto";
  return (
    <div
      role="alert"
      className={`flex flex-wrap items-start border border-semantic-danger/30 bg-semantic-danger/10 text-semantic-danger ${chrome} ${className ?? ""}`}
    >
      <AlertTriangle className={`${compact ? "w-4 h-4" : "w-5 h-5"} shrink-0 mt-0.5`} />
      <div className="flex-1 min-w-0">
        <div>{error}</div>
        {hint && (
          <div className="mt-1 text-micro text-ps-text-muted font-mono">{hint}</div>
        )}
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className={`flex w-fit items-center gap-1.5 rounded-ps-md text-micro font-mono border border-semantic-danger/40 text-semantic-danger hover:bg-semantic-danger/20 transition-colors shrink-0 ${wrap} ${compact ? "px-2 py-0.5" : "px-2.5 py-1"}`}
        >
          <RefreshCw className="w-3 h-3" />
          {retryLabel}
        </button>
      )}
    </div>
  );
}
