// ═══════════════════════════════════════════════════════════════
// CardGridSkeleton — Grid/list of card skeletons
// Matches: sessions list, cron jobs, missions, agents, tools,
//          personalities, teams, kanban, skills pages
// When useAppPageShell is true (default), wraps in AppPageShell.
// When false, uses the bare wrapper (matching orchestration/operations).
// ═══════════════════════════════════════════════════════════════

import AppPageShell from "@/components/layout/AppPageShell";

interface CardGridSkeletonProps {
  count?: number;
  columns?: 1 | 2 | 3;
  /** If true, renders a list layout instead of grid */
  list?: boolean;
  /** Optional heading skeleton */
  title?: string;
  /** Wrap in AppPageShell (default: true). Set false for pages that don't use AppPageShell */
  useAppPageShell?: boolean;
}

function CardSkeleton({ list }: { list?: boolean }) {
  return (
    <div
      className={`rounded-xl border border-white/10 bg-dark-900/50 p-4 animate-pulse ${
        list ? "" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0 space-y-2">
          {/* Title row */}
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-white/10" />
            <div className="h-4 w-40 rounded bg-white/10" />
          </div>
          {/* Subtitle row */}
          <div className="flex items-center gap-3">
            <div className="h-3 w-20 rounded bg-white/10" />
            <div className="h-3 w-32 rounded bg-white/10" />
          </div>
        </div>
        {/* Action buttons area */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-white/10" />
          <div className="w-7 h-7 rounded-lg bg-white/10" />
          <div className="w-7 h-7 rounded-lg bg-white/10" />
        </div>
      </div>
    </div>
  );
}

function CardGridSkeletonContent({
  count = 6,
  columns = 2,
  list = false,
  title,
}: CardGridSkeletonProps) {
  const gridCols =
    columns === 3
      ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
      : columns === 1
        ? "grid-cols-1"
        : "grid-cols-1 md:grid-cols-2";

  return (
    <>
      {/* Page header skeleton */}
      <div className="border-b border-white/10 bg-dark-900/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded bg-white/10 animate-pulse" />
            <div className="space-y-1">
              <div className="h-5 w-36 rounded bg-white/10 animate-pulse" />
              {title && (
                <div className="h-3 w-48 rounded bg-white/10 animate-pulse" />
              )}
            </div>
          </div>
          <div className="h-8 w-28 rounded-lg bg-white/10 animate-pulse" />
        </div>
      </div>

      <div className="px-6 py-6">
        {/* Search/filter bar skeleton for list pages */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex-1 h-10 rounded-lg bg-white/10 animate-pulse" />
          <div className="flex items-center gap-2">
            <div className="h-8 w-12 rounded bg-white/10 animate-pulse" />
            <div className="h-8 w-12 rounded bg-white/10 animate-pulse" />
          </div>
        </div>

        {/* Card grid/list */}
        <div className={list ? "space-y-3" : `grid ${gridCols} gap-4`}>
          {Array.from({ length: count }).map((_, i) => (
            <CardSkeleton key={i} list={list} />
          ))}
        </div>
      </div>
    </>
  );
}

export function CardGridSkeleton(props: CardGridSkeletonProps) {
  const { useAppPageShell = true } = props;

  if (useAppPageShell) {
    return (
      <AppPageShell>
        <CardGridSkeletonContent {...props} />
      </AppPageShell>
    );
  }

  return (
    <div className="min-h-screen bg-dark-950 grid-bg">
      <CardGridSkeletonContent {...props} />
    </div>
  );
}
