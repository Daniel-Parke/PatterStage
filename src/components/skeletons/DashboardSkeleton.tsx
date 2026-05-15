// ═══════════════════════════════════════════════════════════════
// DashboardSkeleton — Full-page skeleton for /
// Matches layout: stat row (4 cards) + handoff bar + dispatch
// + 3-column panel + process grid + rec room card
// ═══════════════════════════════════════════════════════════════

export function StatPillSkeleton() {
  return (
    <div className="rounded-lg border border-white/10 bg-dark-900/50 px-4 py-3 flex items-center gap-3 animate-pulse">
      <div className="w-4 h-4 rounded bg-white/10" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 w-16 rounded bg-white/10" />
        <div className="h-5 w-20 rounded bg-white/10" />
      </div>
    </div>
  );
}

export function HandoffBarSkeleton() {
  return (
    <div className="rounded-xl border border-white/10 bg-dark-900/40 px-4 py-3 animate-pulse">
      <div className="h-3 w-24 rounded bg-white/10 mb-2" />
      <div className="h-4 w-64 rounded bg-white/10" />
    </div>
  );
}

function DispatchSkeleton() {
  return (
    <div className="rounded-xl border border-neon-cyan/20 bg-dark-900/50 overflow-hidden animate-pulse">
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-white/10" />
          <div className="h-4 w-28 rounded bg-white/10" />
        </div>
        <div className="h-3 w-16 rounded bg-white/10" />
      </div>
      <div className="px-4 pb-3 flex flex-wrap gap-1.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-6 w-20 rounded-full bg-white/10" />
        ))}
      </div>
    </div>
  );
}

function PanelSkeleton() {
  return (
    <div className="rounded-xl border border-white/10 bg-dark-900/50 overflow-hidden animate-pulse">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-dark-800/50">
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded bg-white/10" />
          <div className="h-3 w-16 rounded bg-white/10" />
        </div>
        <div className="h-3 w-12 rounded bg-white/10" />
      </div>
      <div className="divide-y divide-white/5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="px-4 py-2.5 flex items-center justify-between">
            <div className="space-y-1.5 flex-1">
              <div className="h-3 w-32 rounded bg-white/10" />
              <div className="h-3 w-20 rounded bg-white/10" />
            </div>
            <div className="h-5 w-14 rounded-full bg-white/10" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ProcessCardSkeleton() {
  return (
    <div className="rounded-xl border border-neon-purple/20 bg-dark-900/50 p-4 animate-pulse">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-white/10" />
          <div className="h-4 w-24 rounded bg-white/10" />
        </div>
        <div className="h-5 w-14 rounded-full bg-white/10" />
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between">
          <div className="h-3 w-8 rounded bg-white/10" />
          <div className="h-3 w-16 rounded bg-white/10" />
        </div>
        <div className="flex justify-between">
          <div className="h-3 w-10 rounded bg-white/10" />
          <div className="h-3 w-20 rounded bg-white/10" />
        </div>
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-dark-950 grid-bg">
      {/* Top Bar skeleton */}
      <div className="sticky top-0 z-30 border-b border-white/10 bg-dark-900/80 backdrop-blur-md px-6 py-3 flex items-center justify-between">
        <div className="space-y-1">
          <div className="h-6 w-32 rounded bg-white/10 animate-pulse" />
          <div className="h-3 w-20 rounded bg-white/10 animate-pulse" />
        </div>
        <div className="flex items-center gap-6">
          <div className="space-y-1 text-right">
            <div className="h-4 w-16 rounded bg-white/10 animate-pulse" />
            <div className="h-3 w-24 rounded bg-white/10 animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-white/20" />
            <div className="h-3 w-14 rounded bg-white/10 animate-pulse" />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Stat Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatPillSkeleton />
          <StatPillSkeleton />
          <StatPillSkeleton />
          <StatPillSkeleton />
        </div>

        {/* Handoff */}
        <HandoffBarSkeleton />

        {/* Dispatch */}
        <DispatchSkeleton />

        {/* Three-Panel Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <PanelSkeleton />
          <PanelSkeleton />
          <PanelSkeleton />
        </div>

        {/* Process Grid */}
        <div>
          <div className="h-4 w-48 rounded bg-white/10 animate-pulse mb-3" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <ProcessCardSkeleton />
            <ProcessCardSkeleton />
            <ProcessCardSkeleton />
          </div>
        </div>

        {/* Rec Room */}
        <div className="rounded-xl border border-purple-500/20 bg-dark-900/50 overflow-hidden animate-pulse">
          <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-dark-800/50">
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded bg-white/10" />
              <div className="h-3 w-16 rounded bg-white/10" />
            </div>
          </div>
          <div className="flex items-center justify-center gap-3 py-4">
            <div className="w-5 h-5 rounded bg-white/10" />
            <div className="h-4 w-24 rounded bg-white/10" />
          </div>
        </div>
      </div>
    </div>
  );
}
