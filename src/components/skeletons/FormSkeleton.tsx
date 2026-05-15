// ═══════════════════════════════════════════════════════════════
// FormSkeleton — Full-page skeleton for config/[section] and /config/models
// Matches layout: header + form fields sidebar
// ═══════════════════════════════════════════════════════════════

export function FormSkeleton() {
  return (
    <div className="min-h-screen bg-dark-950 grid-bg">
      {/* Header */}
      <div className="border-b border-white/10 bg-dark-900/50 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 rounded bg-white/10 animate-pulse" />
          <div className="space-y-1">
            <div className="h-5 w-40 rounded bg-white/10 animate-pulse" />
            <div className="h-3 w-36 rounded bg-white/10 animate-pulse" />
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
        {/* Form field groups */}
        {Array.from({ length: 4 }).map((_, groupIdx) => (
          <div key={groupIdx} className="rounded-xl border border-white/10 bg-dark-900/50 p-4 space-y-4 animate-pulse">
            {/* Section heading */}
            <div className="h-4 w-32 rounded bg-white/10 mb-4" />

            {/* Fields */}
            {Array.from({ length: 2 }).map((_, fieldIdx) => (
              <div key={fieldIdx} className="space-y-1.5">
                <div className="h-3 w-24 rounded bg-white/10" />
                <div className="h-9 w-full rounded-lg bg-white/10" />
              </div>
            ))}
          </div>
        ))}

        {/* Save button */}
        <div className="flex justify-end">
          <div className="h-9 w-24 rounded-lg bg-white/10 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

export function ModelsPageSkeleton() {
  return (
    <div className="min-h-screen bg-dark-950 grid-bg">
      {/* Header with tabs */}
      <div className="border-b border-white/10 bg-dark-900/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded bg-white/10 animate-pulse" />
            <div className="space-y-1">
              <div className="h-5 w-28 rounded bg-white/10 animate-pulse" />
              <div className="h-3 w-40 rounded bg-white/10 animate-pulse" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-24 rounded-lg bg-white/10 animate-pulse" />
            <div className="h-8 w-24 rounded-lg bg-white/10 animate-pulse" />
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="border-b border-white/10 px-6 py-2 flex gap-2">
        <div className="h-8 w-20 rounded-lg bg-white/10 animate-pulse" />
        <div className="h-8 w-24 rounded-lg bg-white/10 animate-pulse" />
        <div className="h-8 w-16 rounded-lg bg-white/10 animate-pulse" />
      </div>

      {/* Table skeleton */}
      <div className="px-6 py-6 space-y-2">
        <div className="grid grid-cols-5 gap-4 border-b border-white/10 pb-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-3 w-20 rounded bg-white/10 animate-pulse" />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="grid grid-cols-5 gap-4 py-2 animate-pulse">
            <div className="h-4 w-32 rounded bg-white/10" />
            <div className="h-4 w-24 rounded bg-white/10" />
            <div className="h-4 w-20 rounded bg-white/10" />
            <div className="h-4 w-16 rounded bg-white/10" />
            <div className="h-4 w-12 rounded bg-white/10" />
          </div>
        ))}
      </div>
    </div>
  );
}