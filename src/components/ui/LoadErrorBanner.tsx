// ═══════════════════════════════════════════════════════════════
// LoadErrorBanner — Persistent error banner for page-level load failures
// ═══════════════════════════════════════════════════════════════
//
// Replaces the ad-hoc error-banner / error-toast / "not found" full-page
// patterns that pages with `useApiData` had open-coded:
//   - `useEffect(() => showToast(loadError, "error"), [loadError])` (toast
//     disappears after 4s — no recovery affordance; the user just stares
//     at a frozen list with a generic "no results" empty state)
//   - inline `<div className="border-red-500/30 bg-red-500/10 ...">{error}</div>`
//     (persistent but no Retry button)
//   - "Session Not Found" full-page placeholder (no way to retry without
//     manually navigating back)
//
// THE READ CONTRACT (T-0096). A list read that failed shows THIS, with a
// Retry, and never the page's empty state. Nine pages rendered "no X yet"
// over a 500, because their hooks swallowed the failure into an empty array;
// the page owns the conditional and gates its empty state on `!error`. The
// `compact` variant is for a sidebar or a list column, where the full banner
// is wider than the column.
//
// Component contract:
//   - `error`: the actual error string from `useApiData`'s `error` field
//   - `onRetry`: optional retry click handler; when provided, a "Retry"
//     button is rendered on the right side of the banner
//   - `hint`: optional explanation text rendered below the error (kept
//     short — the banner is meant to fit on one line at desktop width)
//   - `className`: optional container class extension (lets the page add
//     margin-bottom / max-width without forking the component)
//   - `compact`: the smaller variant
//
// The component is purely presentational; it never calls `useApiData` or
// any fetch. The page is the source of truth for `refetch`, the banner
// just invokes it on click. This keeps the component decoupled from any
// particular data hook.
//
// **The page OWNS the conditional render.** The component itself does
// NOT check for an empty `error` and does NOT short-circuit; it
// always renders the banner chrome. Pages wrap it as
//   {loadError && <LoadErrorBanner error={loadError} onRetry={refetch} />}
// so the success path renders nothing and the failure path renders
// the banner with the actual error string. Putting the conditional at
// the call site (vs. inside the component) keeps the component
// trivially testable — no null-error handling needed in the
// component, and the "no error, no banner" invariant is one of the
// easiest things to read off a JSX tree.

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
    ? "mb-2 gap-2 rounded-lg px-3 py-2 text-xs"
    : "mb-4 gap-3 rounded-xl px-4 py-3 text-sm";
  return (
    <div
      role="alert"
      className={`flex items-start border border-red-500/30 bg-red-500/10 text-red-200 ${chrome} ${className ?? ""}`}
    >
      <AlertTriangle className={`${compact ? "w-4 h-4" : "w-5 h-5"} shrink-0 mt-0.5`} />
      <div className="flex-1 min-w-0">
        <div>{error}</div>
        {hint && (
          <div className="mt-1 text-xs text-red-200/70 font-mono">{hint}</div>
        )}
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className={`flex items-center gap-1.5 rounded-lg text-xs font-mono border border-red-500/40 text-red-200 hover:bg-red-500/20 transition-colors shrink-0 ${compact ? "px-2 py-0.5" : "px-2.5 py-1"}`}
        >
          <RefreshCw className="w-3 h-3" />
          {retryLabel}
        </button>
      )}
    </div>
  );
}
