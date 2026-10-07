// ═══════════════════════════════════════════════════════════════
// PageLoading — the BODY of a page while it loads.
//
// The header is not here, and that is the contract. `AppPageShell` takes the
// header as a prop (T-0117), so the title, the back link and the page's
// identity render immediately and only the part that depends on a fetch waits.
// Three screens used to replace the whole page with a spinner, so for the
// length of the request you could not tell which page you were on.
//
// One announcement for the group: the skeletons inside are `aria-hidden`, so a
// screen reader hears "Loading sessions" once rather than eight times.
// ═══════════════════════════════════════════════════════════════

import Skeleton from "@/components/ui/Skeleton";

export interface PageLoadingProps {
  /** What is loading, in the user's words. Becomes the accessible name. */
  label: string;
  /** How many rows the content will be. The skeleton holds that much space. */
  rows?: number;
  /** Height of each row, when the content is not list-shaped. */
  rowClassName?: string;
}

export default function PageLoading({
  label,
  rows = 6,
  rowClassName = "h-14",
}: PageLoadingProps) {
  return (
    <div role="status" aria-label={label} aria-busy="true" className="space-y-3">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} announce={false} className={`w-full ${rowClassName}`} />
      ))}
    </div>
  );
}

/**
 * A count that is not known yet is an em dash, not a zero.
 *
 * Three screens render a confident `0` before their fetch resolves - "0
 * sessions", "0 skills" - and a user reads that as an answer when it is really
 * the absence of one. A wrong number is worse than no number, because no
 * number is obviously no number.
 *
 * Zero itself still renders as `0`: once the read HAS resolved, none is a real
 * and useful answer, and blanking it would be the same lie in the other
 * direction.
 */
export function pendingCount(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : String(value);
}
