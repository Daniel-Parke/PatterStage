// ═══════════════════════════════════════════════════════════════
// LiveDot — Small pulsing green dot used to indicate a live state
// ═══════════════════════════════════════════════════════════════
//
// Renders a tiny ping-animated green dot to indicate a "live" or
// "active" state on a card or row. Extracted from
// src/app/(main)/sessions/page.tsx (which used it inline) so any
// other surface that needs a "live now" indicator — e.g. a future
// dashboard tile, a model card, an "agent heartbeat" badge — can
// import it without re-declaring the markup.
//
// The original inline markup was a 7-line `<span>` tree with the
// `animate-ping` ring layered over a solid dot; the visual output
// is byte-identical, so the migration is safe.
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
