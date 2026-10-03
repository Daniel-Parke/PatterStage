// ═══════════════════════════════════════════════════════════════
// LiveDot — pulsing live-state indicator using the shared status colour
// ═══════════════════════════════════════════════════════════════
//
export function LiveDot() {
  return (
    // `data-ps-live` so a caller can assert "this row is live" without
    // reaching for a colour class, which is what a test that asked about
    // `bg-neon-green` would be doing (T-0124).
    <span data-ps-live="" className="relative inline-flex shrink-0 items-center" title="Session is active">
      <span className="absolute inline-flex h-2 w-2 rounded-full bg-neon-green opacity-75 animate-ping" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-neon-green" />
    </span>
  );
}
