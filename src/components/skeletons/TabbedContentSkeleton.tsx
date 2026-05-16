// ═══════════════════════════════════════════════════════════════
// TabbedContentSkeleton — With sidebar/tab navigation
// Matches: /memory (tabs: memories/directives/models),
//          /gateway (platform cards + log viewer)
// Wraps in AppPageShell to match actual pages.
// ═══════════════════════════════════════════════════════════════

import AppPageShell from "@/components/layout/AppPageShell";

interface TabbedContentSkeletonProps {
  tabs?: number;
  /** Show a sidebar-style layout like gateway page */
  sidebar?: boolean;
}

export function TabbedContentSkeleton({
  tabs = 3,
  sidebar = false,
}: TabbedContentSkeletonProps) {
  return (
    <AppPageShell>
      {/* Header */}
      <div className="border-b border-white/10 bg-dark-900/50 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 rounded bg-white/10 animate-pulse" />
          <div className="space-y-1">
            <div className="h-5 w-36 rounded bg-white/10 animate-pulse" />
            <div className="h-3 w-44 rounded bg-white/10 animate-pulse" />
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="border-b border-white/10 bg-dark-950 px-6 py-2 flex gap-2">
        {Array.from({ length: tabs }).map((_, i) => (
          <div
            key={i}
            className={`h-8 rounded-lg bg-white/10 animate-pulse ${
              i === 0 ? "w-28" : "w-32"
            }`}
          />
        ))}
      </div>

      <div className="px-6 py-6 space-y-4">
        {sidebar ? (
          /* Gateway-style: sidebar + content */
          <div className="flex gap-4">
            <div className="w-72 space-y-3 shrink-0">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-white/10 bg-dark-900/50 p-4 space-y-2 animate-pulse"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-white/10" />
                      <div className="h-4 w-20 rounded bg-white/10" />
                    </div>
                    <div className="w-3 h-3 rounded-full bg-white/10" />
                  </div>
                  <div className="h-3 w-32 rounded bg-white/10" />
                </div>
              ))}
            </div>
            <div className="flex-1 rounded-xl border border-white/10 bg-dark-900/50 p-4 animate-pulse">
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-white/10" />
                    <div className="h-3 w-40 rounded bg-white/10" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Memory-style: search + card grid */
          <>
            {/* Search/action bar */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-10 rounded-lg bg-white/10 animate-pulse" />
              <div className="h-9 w-24 rounded-lg bg-white/10 animate-pulse" />
              <div className="h-9 w-32 rounded-lg bg-white/10 animate-pulse" />
            </div>
            {/* Card list */}
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-white/10 bg-dark-900/50 p-4 space-y-2 animate-pulse"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-white/10" />
                      <div className="h-4 w-48 rounded bg-white/10" />
                    </div>
                    <div className="h-5 w-20 rounded-full bg-white/10" />
                  </div>
                  <div className="h-3 w-full rounded bg-white/10" />
                  <div className="h-3 w-3/4 rounded bg-white/10" />
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-16 rounded bg-white/10" />
                    <div className="h-4 w-20 rounded bg-white/10" />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </AppPageShell>
  );
}
