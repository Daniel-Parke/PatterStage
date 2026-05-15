// ═══════════════════════════════════════════════════════════════
// DetailSkeleton — Full-page skeleton for session detail
// Matches layout: header with stats + message thread
// ═══════════════════════════════════════════════════════════════

export function DetailSkeleton() {
  return (
    <div className="min-h-screen bg-dark-950 grid-bg">
      {/* Header */}
      <div className="border-b border-white/10 bg-dark-900/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded bg-white/10 animate-pulse" />
            <div className="space-y-1">
              <div className="h-5 w-64 rounded bg-white/10 animate-pulse" />
              <div className="h-3 w-48 rounded bg-white/10 animate-pulse" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-6 w-16 rounded bg-white/10 animate-pulse" />
            <div className="h-6 w-16 rounded bg-white/10 animate-pulse" />
            <div className="h-6 w-16 rounded bg-white/10 animate-pulse" />
          </div>
        </div>
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mt-3">
          <div className="h-3 w-20 rounded bg-white/10 animate-pulse" />
          <div className="h-3 w-3 rounded bg-white/10 animate-pulse" />
          <div className="h-3 w-32 rounded bg-white/10 animate-pulse" />
        </div>
      </div>

      {/* Message thread */}
      <div className="max-w-4xl mx-auto px-6 py-6 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={`rounded-xl border border-white/10 bg-dark-900/30 overflow-hidden animate-pulse`}
          >
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/5">
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 rounded bg-white/10" />
                <div className="h-3 w-16 rounded bg-white/10" />
              </div>
              <div className="h-3 w-8 rounded bg-white/10" />
            </div>
            <div className="px-4 py-3 space-y-2">
              <div className="h-3 w-full rounded bg-white/10" />
              <div className="h-3 w-3/4 rounded bg-white/10" />
              <div className="h-3 w-1/2 rounded bg-white/10" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
