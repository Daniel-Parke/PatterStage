// ═══════════════════════════════════════════════════════════════
// Skeleton — a block the shape of what is coming.
//
// The house loading treatment was a centred spinner, which tells you that
// something is happening and nothing about what. A block the size of the
// content it replaces also holds the layout still, which is most of the CLS
// this programme is measuring: three Results screens shift 0.09-0.10 on load
// because a spinner 40px tall is replaced by a list 900px tall (T-0122).
//
// It announces itself once, as a `status`, so a screen reader hears "loading"
// rather than nothing at all. A page drawing eight of these announces once -
// see PageLoading, which is what a page should actually use.
// ═══════════════════════════════════════════════════════════════

export interface SkeletonProps {
  /** Size and shape, e.g. `h-8 w-40`. A skeleton is whatever it stands in for. */
  className?: string;
  /** Set false inside a PageLoading, which does the announcing for the group. */
  announce?: boolean;
}

export default function Skeleton({ className = "", announce = true }: SkeletonProps) {
  return (
    <div
      data-ps-skeleton=""
      {...(announce ? { role: "status" as const, "aria-label": "Loading" } : { "aria-hidden": "true" as const })}
      className={`animate-shimmer rounded-ps-md bg-ps-surface-raised ${className}`}
    />
  );
}
