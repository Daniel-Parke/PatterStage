// ═════════════════════════════════════════════════════════════
// EmptyState — nothing here, and why that is fine.
//
// It lived in LoadingSpinner.tsx, which is how nine callers came to import
// "LoadingSpinner" in order to render "no sessions yet". One file, one
// component (T-0122).
// ═════════════════════════════════════════════════════════════

/**
 * The empty state. Only after a SUCCESSFUL read: a page that renders this over
 * a failed fetch is lying, and the read contract (T-0096) says the failure is
 * a LoadErrorBanner with a Retry instead. `ErrorBanner` used to live beside
 * this, a message with no way to retry; it is gone, and LoadErrorBanner is the
 * one error surface.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Icon className="w-10 h-10 text-ps-viz-glyph-idle mb-3" />
      <h3 className="text-body font-medium text-ps-text-muted">{title}</h3>
      {description && (
        <p className="text-body text-ps-text-faint mt-1">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
